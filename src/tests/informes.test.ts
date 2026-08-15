import { describe, it, expect } from 'vitest';
import { UnifiedTransporte } from '../types';
import {
  calcularKPIs,
  embudoEstados,
  porTipo,
  porTransportadora,
  volumenPorDia,
  minutosHora,
  parsearFecha,
  formatearFechaClave,
  esDomingo,
  tipoGrupo,
  _c,
  diffMinutos,
  clasificacionDemora,
  generarDias,
  turnoDeHora,
  aFila,
  filasPorRango,
  filasParaTabla,
  determinacionHoraria,
  filasExportDeterminacion,
  usoPorMuelle,
  operacionesPorCliente,
  rentabilidadCuadrillas,
  cajasPorDia,
  cajasPorCuadrilla,
} from '../utils/informes';

function row(overrides: Partial<UnifiedTransporte> = {}): UnifiedTransporte {
  return {
    id: `TR-${Math.random()}`,
    llave: 'LL-60533',
    fechaHora: '2026-08-12 08:00',
    placa: 'XYZ-999',
    vehiculoTipo: 'SENCILLO',
    citaCargue: '2026-08-12 07:00',
    transportadora: 'TRANSPORTES ANDINA',
    estadoTransporte: 'ALISTADO',
    estadoPorteria: 'Confirmado',
    ...overrides,
  };
}

describe('utils/informes (agregaciones reales)', () => {
  it('calcularKPIs cuenta total, activas, finalizadas y cumplimiento', () => {
    const rows = [
      row({ llave: 'LL-1', placa: 'AAA-111', fechaHora: '2026-08-12 08:00', horaLlegadaPorteria: '08:01', horaIngreso: '08:05', horaInicioCargue: '08:10', horaFinCargue: '09:00', horaSalida: '09:10' }),
      row({ llave: 'LL-2', placa: 'BBB-222', fechaHora: '2026-08-12 09:00', horaLlegadaPorteria: '09:05' }),
      row({ llave: 'LL-3', placa: '', fechaHora: '2026-08-12 10:00' }),
      row({ llave: 'LL-4', placa: 'DDD-444', fechaHora: '2026-08-12 11:00', estadoPorteria: 'CANCELADO' }),
    ];

    const k = calcularKPIs(rows);
    expect(k.total).toBe(4);
    expect(k.finalizadas).toBe(1); // LL-1 salió de portería
    expect(k.activas).toBe(2); // LL-2 y LL-3 (no CANCELADO)
    expect(k.sinPlaca).toBe(1);
    expect(k.cumplimientoPct).toBe(25);
  });

  it('calcularKPIs devuelve 0% de cumplimiento sin filas', () => {
    const k = calcularKPIs([]);
    expect(k.total).toBe(0);
    expect(k.cumplimientoPct).toBe(0);
  });

  it('embudoEstados cuenta cada estado derivado en el orden del flujo', () => {
    const rows = [
      row({ llave: 'LL-1', horaLlegadaPorteria: '08:01', horaIngreso: '08:05', horaInicioCargue: '08:10', horaFinCargue: '09:00', horaSalida: '09:10' }),
      row({ llave: 'LL-2', horaLlegadaPorteria: '08:01', horaIngreso: '08:05' }),
      row({ llave: 'LL-3' }),
      row({ llave: 'LL-4', estadoPorteria: 'CANCELADO' }),
    ];

    const embudo = embudoEstados(rows);
    const map = Object.fromEntries(embudo.map((e) => [e.estado, e.count]));
    expect(map['SALIO DE PORTERIA']).toBe(1);
    expect(map['INGRESO A MUELLE']).toBe(1);
    expect(map['Confirmado']).toBe(1);
    expect(map['CANCELADO']).toBe(1);
    expect(embudo[0].estado).toBe('Pendiente');
    expect(embudo).toHaveLength(8);
  });

  it('porTipo incluye siempre los 5 tipos y suma los conteos', () => {
    const rows = [
      row({ llave: 'LL-1', vehiculoTipo: 'TURBO' }),
      row({ llave: 'LL-2', vehiculoTipo: 'TURBO' }),
      row({ llave: 'LL-3', vehiculoTipo: 'LUV' }),
      row({ llave: 'LL-4', vehiculoTipo: 'MULA' }),
    ];

    const flota = porTipo(rows);
    expect(flota).toHaveLength(5);
    expect(flota.find((f) => f.name === 'TURBO')?.value).toBe(2);
    expect(flota.find((f) => f.name === 'LUV')?.value).toBe(1);
    expect(flota.find((f) => f.name === 'MULA')?.value).toBe(1);
    expect(flota.find((f) => f.name === 'MINIMULA')?.value).toBe(0);
  });

  it('porTransportadora ordena descendente y corta al top N', () => {
    const rows = [
      row({ llave: 'LL-1', transportadora: 'A' }),
      row({ llave: 'LL-2', transportadora: 'B' }),
      row({ llave: 'LL-3', transportadora: 'A' }),
      row({ llave: 'LL-4', transportadora: 'C' }),
      row({ llave: 'LL-5', transportadora: 'A' }),
    ];

    const top = porTransportadora(rows, 2);
    expect(top[0]).toEqual({ name: 'A', value: 3 });
    expect(top[1]).toEqual({ name: 'B', value: 1 });
    expect(top).toHaveLength(2);
  });

  it('volumenPorDia agrupa por fecha de cita y ordena ascendente', () => {
    const rows = [
      row({ llave: 'LL-1', citaCargue: '2026-08-13 08:00' }),
      row({ llave: 'LL-2', citaCargue: '2026-08-12 09:00' }),
      row({ llave: 'LL-3', citaCargue: '2026-08-12 10:00' }),
      row({ llave: 'LL-4', citaCargue: '2026-08-12T11:00:00Z' }),
    ];

    const volumen = volumenPorDia(rows);
    expect(volumen).toEqual([
      { name: '2026-08-12', value: 3 },
      { name: '2026-08-13', value: 1 },
    ]);
  });
});

describe('utils/informes (utilidades Fase 2)', () => {
  it('minutosHora convierte HH:MM a minutos y null si no es válida', () => {
    expect(minutosHora('08:30')).toBe(510);
    expect(minutosHora('00:00')).toBe(0);
    expect(minutosHora('23:59')).toBe(1439);
    expect(minutosHora('08:30:15')).toBe(510);
    expect(minutosHora('')).toBeNull();
    expect(minutosHora('25:00')).toBeNull();
    expect(minutosHora('--:--')).toBeNull();
  });

  it('parsearFecha y formatearFechaClave manejan fechas y horas', () => {
    const d = parsearFecha('2026-08-12 08:30');
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(7);
    expect(d?.getDate()).toBe(12);
    expect(formatearFechaClave('2026-08-12 08:30')).toBe('2026-08-12');
    expect(formatearFechaClave('2026-08-12T09:00:00Z')).toBe('2026-08-12');
    expect(formatearFechaClave('')).toBe('');
    expect(parsearFecha('no-fecha')).toBeNull();
  });

  it('esDomingo detecta los domingos', () => {
    expect(esDomingo('2026-08-16')).toBe(true); // domingo
    expect(esDomingo('2026-08-12')).toBe(false); // miércoles
  });

  it('tipoGrupo mapea la cuadrilla al grupo', () => {
    expect(tipoGrupo('2DA CCL')).toBe('CCL');
    expect(tipoGrupo('ccl')).toBe('CCL');
    expect(tipoGrupo('SLA 1')).toBe('SLA');
    expect(tipoGrupo('')).toBe('LTSA');
    expect(tipoGrupo('OTRA')).toBe('LTSA');
  });

  it('_c es alias de minutosHora y diffMinutos resta horas', () => {
    expect(_c('09:00')).toBe(540);
    expect(diffMinutos('08:00', '09:30')).toBe(90);
    expect(diffMinutos('', '09:00')).toBeNull();
  });

  it('clasificacionDemora clasifica según los umbrales', () => {
    expect(clasificacionDemora(null)).toBe('aTiempo');
    expect(clasificacionDemora(0)).toBe('aTiempo');
    expect(clasificacionDemora(30)).toBe('leve');
    expect(clasificacionDemora(60)).toBe('leve');
    expect(clasificacionDemora(120)).toBe('critico');
  });

  it('generarDias produce rango inclusivo ordenado', () => {
    expect(generarDias('2026-08-10', '2026-08-12')).toEqual([
      '2026-08-10',
      '2026-08-11',
      '2026-08-12',
    ]);
    expect(generarDias('2026-08-12', '2026-08-10')).toEqual([]);
  });

  it('turnoDeHora separa por franjas horarias', () => {
    expect(turnoDeHora('06:00')).toBe('T1');
    expect(turnoDeHora('12:00')).toBe('T2');
    expect(turnoDeHora('20:00')).toBe('T3');
    expect(turnoDeHora('')).toBeNull();
  });

  it('aFila proyecta UnifiedTransporte a la Fila del motor de informes', () => {
    const fila = aFila(
      row({
        transporte: 'PED-100',
        denominacion: 'CLIENTE A',
        cajas: 120,
        cuadrilla: 'SLA 1',
        muelleAsignado: 'M1',
        horaLlegadaPorteria: '08:00',
        horaInicioCargue: '09:00',
        horaFinCargue: '10:30',
      })
    );
    expect(fila.transporte).toBe('PED-100');
    expect(fila.denominacion).toBe('CLIENTE A');
    expect(fila.cajas).toBe(120);
    expect(fila.tiempo_muelle_minutos).toBe(90);
    expect(fila.llegada_minutos).toBe(480);
    expect(fila.turno).toBe('T2');
    expect(fila.costo_diario_ccl).toBeGreaterThan(0);
  });
});

describe('utils/informes (Fase 3-4: filas y determinación)', () => {
  const base = (overrides: Partial<UnifiedTransporte> = {}): UnifiedTransporte =>
    row({
      cuadrilla: 'CCL',
      horaLlegadaPorteria: '08:00',
      horaInicioCargue: '09:00',
      horaFinCargue: '10:00',
      transporte: 'PED-1',
      denominacion: 'CLIENTE A',
      cajas: 50,
      ...overrides,
    });

  it('filasPorRango filtra por fecha de cita y proyecta a Fila', () => {
    const rows = [
      base({ llave: 'LL-1', citaCargue: '2026-08-12 08:00' }),
      base({ llave: 'LL-2', citaCargue: '2026-08-13 09:00' }),
      base({ llave: 'LL-3', citaCargue: '2026-08-14 10:00' }),
      base({ llave: 'LL-4', citaCargue: 'basura' }),
    ];
    const dentro = filasPorRango(rows, '2026-08-12', '2026-08-13');
    expect(dentro.map((f) => f.llave)).toEqual(['LL-1', 'LL-2']);
    expect(dentro[0].cajas).toBe(50);
    expect(dentro[0].denominacion).toBe('CLIENTE A');
  });

  it('filasParaTabla clasifica la demora contra el SLA', () => {
    const filas = filasParaTabla(filasPorRango([base({ llave: 'LL-1' })], '2026-08-12', '2026-08-12'));
    expect(filas[0].tiempo_muelle_minutos).toBe(60);
    expect(filas[0].demoraMin).toBe(15);
    expect(filas[0].nivelDemora).toBe('leve');
  });

  it('filasParaTabla marca aTiempo cuando el tiempo está dentro del SLA', () => {
    const filas = filasParaTabla(
      filasPorRango(
        [base({ llave: 'LL-1', horaInicioCargue: '09:00', horaFinCargue: '09:30' })],
        '2026-08-12',
        '2026-08-12'
      )
    );
    expect(filas[0].tiempo_muelle_minutos).toBe(30);
    expect(filas[0].nivelDemora).toBe('aTiempo');
  });

  it('determinacionHoraria agrupa por grupo de cuadrilla, turno y suma costo CCL', () => {
    const filas = filasPorRango(
      [
        base({ llave: 'LL-1', cuadrilla: 'CCL', horaInicioCargue: '03:00', horaFinCargue: '04:00' }), // T1
        base({ llave: 'LL-2', cuadrilla: 'CCL', horaInicioCargue: '09:00', horaFinCargue: '09:45' }), // T2
        base({ llave: 'LL-3', cuadrilla: 'SLA 1', horaInicioCargue: '09:00', horaFinCargue: '10:00' }), // T2
        base({ llave: 'LL-4', cuadrilla: 'CCL', horaInicioCargue: '', horaFinCargue: '' }), // sin inicio → no atendida
      ],
      '2026-08-12',
      '2026-08-12'
    );
    const det = determinacionHoraria(filas);
    expect(det.totalUnidades).toBe(3);
    const ccl = det.grupos.find((g) => g.grupo === 'CCL')!;
    expect(ccl.unidades).toBe(2);
    expect(ccl.costoEstimado).toBeGreaterThan(0);
    expect(ccl.porTurno.find((t) => t.turno === 'T1')!.unidades).toBe(1);
    expect(ccl.porTurno.find((t) => t.turno === 'T2')!.unidades).toBe(1);
    const sla = det.grupos.find((g) => g.grupo === 'SLA')!;
    expect(sla.costoEstimado).toBe(0);
  });

  it('filasExportDeterminacion produce encabezados y cierra con TOTAL', () => {
    const det = determinacionHoraria(
      filasPorRango([base({ llave: 'LL-1', cuadrilla: 'CCL' })], '2026-08-12', '2026-08-12')
    );
    const { headers, data } = filasExportDeterminacion(det);
    expect(headers[0]).toBe('GRUPO');
    expect(data[data.length - 1][0]).toBe('TOTAL');
    expect(data[data.length - 1][3]).toMatch(/h$/);
  });
});

describe('utils/informes (nuevos gráficos)', () => {
  const g = (overrides: Partial<UnifiedTransporte> = {}): UnifiedTransporte =>
    row({
      muelleAsignado: 'M1',
      denominacion: 'EXITO CALI',
      cuadrilla: 'CCL',
      cajas: 100,
      fechaHora: '2026-08-12 08:00',
      ...overrides,
    });

  it('usoPorMuelle agrupa despachos y cajas por muelle, ordenado por despachos', () => {
    const uso = usoPorMuelle([
      g({ llave: 'LL-1', muelleAsignado: 'M2', cajas: 50 }),
      g({ llave: 'LL-2', muelleAsignado: 'M1', cajas: 10 }),
      g({ llave: 'LL-3', muelleAsignado: 'M1', cajas: 20 }),
      g({ llave: 'LL-4', muelleAsignado: '' }),
    ]);
    expect(uso[0]).toEqual({ name: 'M1', despachos: 2, cajas: 30 });
    expect(uso[1]).toEqual({ name: 'M2', despachos: 1, cajas: 50 });
  });

  it('operacionesPorCliente cuenta llaves por cliente y aplica top N', () => {
    const ops = operacionesPorCliente([
      g({ llave: 'LL-1', denominacion: 'A' }),
      g({ llave: 'LL-2', denominacion: 'B' }),
      g({ llave: 'LL-3', denominacion: 'A' }),
      g({ llave: 'LL-4', denominacion: '' }),
    ]);
    expect(ops[0]).toEqual({ name: 'A', value: 2 });
    expect(ops[1]).toEqual({ name: 'B', value: 1 });
    expect(ops).toHaveLength(2);
  });

  it('rentabilidadCuadrillas costea CCL por día (1.432.000) e ingresa SLA según cajas del día × 140', () => {
    const rent = rentabilidadCuadrillas(
      [
        g({ llave: 'LL-1', cuadrilla: 'SLA', cajas: 100, citaCargue: '2026-08-12 08:00' }),
        g({ llave: 'LL-2', cuadrilla: 'SLV', cajas: 5, citaCargue: '2026-08-13 09:00' }),
      ],
      '2026-08-12',
      '2026-08-13'
    );
    expect(rent).toHaveLength(2);
    // Cada día cuesta la tarifa diaria fija de CCL (no depende de cajas).
    expect(rent[0].costoCCL).toBe(1_432_000);
    expect(rent[1].costoCCL).toBe(1_432_000);
    // Ingreso SLA: cajas de terceros de ese día × 140 (SLV cae en LTSA → tercero).
    expect(rent[0].ingresoSLA).toBe(100 * 140);
    expect(rent[1].ingresoSLA).toBe(5 * 140);
  });

  it('rentabilidadCuadrillas no cuenta filas sin cuadrilla como ingreso SLA (solo días con cuadrilla real)', () => {
    const rent = rentabilidadCuadrillas(
      [
        g({ llave: 'LL-1', cuadrilla: 'SLA', cajas: 711, citaCargue: '2026-08-15 08:00' }),
        g({ llave: 'LL-2', cuadrilla: '', cajas: 808, citaCargue: '2026-08-15 09:00' }),
        g({ llave: 'LL-3', cuadrilla: 'SLA', cajas: 100, citaCargue: '2026-08-14 08:00' }),
      ],
      '2026-08-14',
      '2026-08-15'
    );
    expect(rent).toHaveLength(2);
    // Solo las filas con cuadrilla SLA/LTSA generan ingreso SLA; las sin cuadrilla no.
    expect(rent.find((b) => b.name === '2026-08-14')?.ingresoSLA).toBe(100 * 140);
    expect(rent.find((b) => b.name === '2026-08-15')?.ingresoSLA).toBe(711 * 140);
  });

  it('cajasPorDia suma cajas por día de cita estremente', () => {
    const cajas = cajasPorDia([
      g({ llave: 'LL-1', cajas: 10, citaCargue: '2026-08-12 08:00' }),
      g({ llave: 'LL-2', cajas: 15, citaCargue: '2026-08-12 10:00' }),
      g({ llave: 'LL-3', cajas: 25, citaCargue: '2026-08-13 09:00' }),
    ]);
    expect(cajas.find((c) => c.name === '2026-08-12')?.value).toBe(25);
    expect(cajas.find((c) => c.name === '2026-08-13')?.value).toBe(25);
  });

  it('cajasPorCuadrilla devuelve siempre los 3 grupos en orden', () => {
    const cajas = cajasPorCuadrilla([
      g({ llave: 'LL-1', cuadrilla: 'CCL', cajas: 10 }),
      g({ llave: 'LL-2', cuadrilla: 'SLA', cajas: 30 }),
    ]);
    expect(cajas).toHaveLength(3);
    expect(cajas[0]).toEqual({ name: 'CCL', value: 10 });
    expect(cajas[1]).toEqual({ name: 'SLA', value: 30 });
    expect(cajas[2]).toEqual({ name: 'LTSA', value: 0 });
  });
});