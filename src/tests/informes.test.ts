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
  diffMinutos,
  diffMinutosReales,
  generarDias,
  usoPorMuelle,
  rentabilidadCuadrillas,
  cajasPorDia,
  cajasPorCuadrilla,
  tiemposPorteria,
  ETAPAS_PORTERIA,
  mapaPosicionamiento,
  clasificarCita,
  primeraFechaDatos,
  horaHombre,
  tiempoCarguePorTipo,
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
      row({
        llave: 'LL-1',
        placa: 'AAA-111',
        fechaHora: '2026-08-12 08:00',
        horaLlegadaPorteria: '08:01',
        horaIngreso: '08:05',
        horaInicioCargue: '08:10',
        horaFinCargue: '09:00',
        horaSalida: '09:10',
      }),
      row({
        llave: 'LL-2',
        placa: 'BBB-222',
        fechaHora: '2026-08-12 09:00',
        horaLlegadaPorteria: '09:05',
      }),
      row({ llave: 'LL-3', placa: '', fechaHora: '2026-08-12 10:00' }),
      row({
        llave: 'LL-4',
        placa: 'DDD-444',
        fechaHora: '2026-08-12 11:00',
        estadoPorteria: 'CANCELADO',
      }),
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
      row({
        llave: 'LL-1',
        horaLlegadaPorteria: '08:01',
        horaIngreso: '08:05',
        horaInicioCargue: '08:10',
        horaFinCargue: '09:00',
        horaSalida: '09:10',
      }),
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

  it('volumenPorDia agrupa por cita de cargue y ordena ascendente', () => {
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

  it('minutosHora y diffMinutos procesan horas', () => {
    expect(minutosHora('09:00')).toBe(540);
    expect(diffMinutos('08:00', '09:30')).toBe(90);
    expect(diffMinutos('23:34', '01:00')).toBe(-1354);
    expect(diffMinutos('2026-09-02T23:34:00', '2026-09-03T01:00')).toBeNull();
    expect(diffMinutos('', '09:00')).toBeNull();
  });

  it('diffMinutosReales puentea cruces de medianoche y usa la fecha cuando viene', () => {
    expect(diffMinutosReales('23:34', '01:00')).toBe(86);
    expect(diffMinutosReales('2026-09-02 23:34', '2026-09-03 01:00')).toBe(86);
    expect(diffMinutosReales('2026-09-02T23:34:00', '2026-09-03T01:00')).toBe(86);
    expect(diffMinutosReales('23:15', '00:10')).toBe(55);
    expect(diffMinutosReales('2026-09-02 23:15', '2026-09-04 00:10')).toBe(1495);
    expect(diffMinutosReales('no-hora', '08:00')).toBeNull();
  });

  it('generarDias produce rango inclusivo ordenado', () => {
    expect(generarDias('2026-08-10', '2026-08-12')).toEqual([
      '2026-08-10',
      '2026-08-11',
      '2026-08-12',
    ]);
    expect(generarDias('2026-08-12', '2026-08-10')).toEqual([]);
  });

  it('primeraFechaDatos devuelve el día más antiguo con cita; null sin datos', () => {
    expect(
      primeraFechaDatos([
        row({ llave: 'LL-1', citaCargue: '2026-07-25 08:00' }),
        row({ llave: 'LL-2', citaCargue: '2026-01-05 09:00' }),
        row({ llave: 'LL-3', citaCargue: '' }),
      ]),
    ).toBe('2026-01-05');
    expect(
      primeraFechaDatos([
        row({ llave: 'LL-1', citaCargue: '' }),
        row({ llave: 'LL-2', citaCargue: '' }),
      ]),
    ).toBeNull();
  });

  it('horaHombre calcula cajas por hora-hombre de CCL y SLA; excluye LTSA y filas sin horas', () => {
    const res = horaHombre([
      row({
        llave: 'LL-1',
        cuadrilla: 'CCL',
        cajas: 120,
        horaInicioCargue: '08:00',
        horaFinCargue: '10:00',
      }),
      row({
        llave: 'LL-2',
        cuadrilla: 'SLA',
        cajas: 60,
        horaInicioCargue: '08:00',
        horaFinCargue: '09:00',
      }),
      row({
        llave: 'LL-3',
        cuadrilla: 'LTSA 1',
        cajas: 999,
        horaInicioCargue: '08:00',
        horaFinCargue: '09:00',
      }),
      row({
        llave: 'LL-4',
        cuadrilla: 'CCL',
        cajas: 50,
        horaInicioCargue: '--:--',
        horaFinCargue: '--:--',
      }),
    ]);
    // CCL: 2 h × 3 hombres = 6 h-h → 120/6 = 20 cajas por h-h.
    // SLA: 1 h × 3 = 3 h-h → 60/3 = 20 cajas por h-h.
    // Total: 9 h-h → 180/9 = 20 cajas por h-h; LTSA y la fila sin horas no cuentan.
    expect(res.cajas).toBe(180);
    expect(res.horasHombre).toBe(9);
    expect(res.indice).toBe(20);
    expect(res.ccl).toEqual({ cajas: 120, horasHombre: 6, indice: 20 });
    expect(res.sla).toEqual({ cajas: 60, horasHombre: 3, indice: 20 });
  });

  it('horaHombre devuelve índices 0 cuando no hay horas de cargue válidas', () => {
    const res = horaHombre([row({ llave: 'LL-1', cuadrilla: 'SLA', cajas: 40 })]);
    expect(res).toEqual({
      cajas: 0,
      horasHombre: 0,
      indice: 0,
      ccl: { cajas: 0, horasHombre: 0, indice: 0 },
      sla: { cajas: 0, horasHombre: 0, indice: 0 },
    });
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

  it('usoPorMuelle agrupa despachos y cajas por muelle, ordenado por cajas desc', () => {
    const uso = usoPorMuelle([
      g({ llave: 'LL-1', muelleAsignado: 'M2', cajas: 50 }),
      g({ llave: 'LL-2', muelleAsignado: 'M1', cajas: 10 }),
      g({ llave: 'LL-3', muelleAsignado: 'M1', cajas: 20 }),
      g({ llave: 'LL-4', muelleAsignado: '' }),
    ]);
    expect(uso[0]).toEqual({ name: 'M2', despachos: 1, cajas: 50 });
    expect(uso[1]).toEqual({ name: 'M1', despachos: 2, cajas: 30 });
  });

  it('rentabilidadCuadrillas costea CCL por día (1.432.000) e ingresa SLA según cajas del día × 140', () => {
    const rent = rentabilidadCuadrillas(
      [
        g({ llave: 'LL-1', cuadrilla: 'SLA', cajas: 100, citaCargue: '2026-08-12 08:00' }),
        g({ llave: 'LL-2', cuadrilla: 'SLV', cajas: 5, citaCargue: '2026-08-13 09:00' }),
      ],
      '2026-08-12',
      '2026-08-13',
    );
    expect(rent).toHaveLength(2);
    // Cada día cuesta la tarifa diaria fija de CCL (no depende de cajas).
    expect(rent[0].costoCCL).toBe(1_432_000);
    expect(rent[1].costoCCL).toBe(1_432_000);
    // Ingreso SLA: cajas de cuadrillas SLA de ese día × 140 (SLV cae en LTSA → no cuenta).
    expect(rent[0].ingresoSLA).toBe(100 * 140);
    expect(rent[1].ingresoSLA).toBe(0);
  });

  it('rentabilidadCuadrillas solo incluye días con movimiento (llaves en el rango)', () => {
    const rent = rentabilidadCuadrillas(
      [
        g({ llave: 'LL-1', cuadrilla: 'SLA', cajas: 711, citaCargue: '2026-08-15 08:00' }),
        g({ llave: 'LL-2', cuadrilla: '', cajas: 808, citaCargue: '2026-08-15 09:00' }),
        g({ llave: 'LL-3', cuadrilla: 'SLA', cajas: 100, citaCargue: '2026-08-14 08:00' }),
      ],
      '2026-08-14',
      '2026-08-16',
    );
    // El rango tiene 3 días, pero 08-16 no tiene llaves: queda fuera del eje X.
    expect(rent).toHaveLength(2);
    expect(rent.map((b) => b.name)).toEqual(['2026-08-14', '2026-08-15']);
    // Solo las filas con cuadrilla SLA generan ingreso SLA; las sin cuadrilla no.
    expect(rent.find((b) => b.name === '2026-08-14')?.ingresoSLA).toBe(100 * 140);
    expect(rent.find((b) => b.name === '2026-08-15')?.ingresoSLA).toBe(711 * 140);
  });

  it('cajasPorDia suma cajas por día de cita de cargue', () => {
    const cajas = cajasPorDia([
      g({ llave: 'LL-1', cajas: 10, citaCargue: '2026-08-12 08:00' }),
      g({ llave: 'LL-2', cajas: 15, citaCargue: '2026-08-12 10:00' }),
      g({ llave: 'LL-3', cajas: 25, citaCargue: '2026-08-12T09:00:00Z' }),
    ]);
    expect(cajas.find((c) => c.name === '2026-08-12')?.value).toBe(50);
    expect(cajas.find((c) => c.name === '2026-08-13')).toBeUndefined();
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

  it('tiemposPorteria mide minutos por etapa entre los hitos registrados', () => {
    const rows = [
      row({
        llave: 'LL-1',
        horaLlegadaPorteria: '08:00',
        horaMuelleAsignado: '08:15',
        horaIngreso: '08:25',
        horaInicioCargue: '08:30',
        horaFinCargue: '09:30',
        horaSalida: '09:45',
      }),
      // Solo llegó a portería: sin muelle asignado → no aporta a ninguna etapa.
      row({ llave: 'LL-2', horaLlegadaPorteria: '09:00' }),
    ];

    const tiempos = tiemposPorteria(rows);
    const porEtapa = (id: string) => tiempos.find((t) => t.id === id)!;
    expect(porEtapa('llegada_muelle')).toMatchObject({
      promedio: 15,
      minimo: 15,
      maximo: 15,
      conteo: 1,
    });
    expect(porEtapa('muelle_ingreso')).toMatchObject({
      promedio: 10,
      minimo: 10,
      maximo: 10,
      conteo: 1,
    });
    expect(porEtapa('ingreso_cargando')).toMatchObject({ promedio: 5, conteo: 1 });
    expect(porEtapa('cargando_fin')).toMatchObject({
      promedio: 60,
      minimo: 60,
      maximo: 60,
      conteo: 1,
    });
    expect(porEtapa('fin_salida')).toMatchObject({ promedio: 15, conteo: 1 });
    // LL-2 no tiene muelle asignado: la etapa 1 solo mide LL-1.
    expect(porEtapa('llegada_muelle').conteo).toBe(1);
  });

  it('tiemposPorteria ignora horas inconsistentes (fin antes de inicio)', () => {
    const tiempos = tiemposPorteria([
      row({ llave: 'LL-1', horaLlegadaPorteria: '08:30', horaMuelleAsignado: '08:00' }),
    ]);
    expect(tiempos.find((t) => t.id === 'llegada_muelle')).toMatchObject({
      conteo: 0,
      promedio: 0,
    });
  });

  it('ETAPAS_PORTERIA define las 5 transiciones con sus nombres de hito', () => {
    const labels = ETAPAS_PORTERIA.map((e) => e.label);
    expect(labels).toEqual([
      'ASIGNACIÓN MUELLE',
      'INGRESO A MUELLE',
      'INICIO DE CARGUE',
      'FINALIZO DE CARGUE',
      'SALIDA DE PORTERIA',
    ]);
    // Cada etapa declara dos hitos de hora distintos y un color hex propio.
    for (const e of ETAPAS_PORTERIA) {
      expect(e.inicio).not.toBe(e.fin);
      expect(e.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(e.descripcion).toContain('→');
    }
  });

  it('tiempoCarguePorTipo promedia y agrupa por tipo, solo con horas de cargue válidas', () => {
    const tiempos = tiempoCarguePorTipo([
      row({ llave: 'LL-1', vehiculoTipo: 'TURBO', horaInicioCargue: '08:00', horaFinCargue: '09:30' }),
      row({ llave: 'LL-2', vehiculoTipo: 'SENCILLO', horaInicioCargue: '08:00', horaFinCargue: '08:20' }),
      // Cruce de medianoche: 23:50 → 00:10 = 20 min.
      row({ llave: 'LL-3', vehiculoTipo: 'SENCILLO', horaInicioCargue: '23:50', horaFinCargue: '00:10' }),
      // Sin fin de cargue, hora inválida y duración 0 → no cuentan.
      row({ llave: 'LL-4', vehiculoTipo: 'SENCILLO', horaInicioCargue: '08:00' }),
      row({ llave: 'LL-5', vehiculoTipo: 'LUV', horaInicioCargue: '08:00', horaFinCargue: '--:--' }),
      row({ llave: 'LL-6', vehiculoTipo: 'TURBO', horaInicioCargue: '09:00', horaFinCargue: '09:00' }),
    ]);
    expect(tiempos.map((t) => t.name)).toEqual(['SENCILLO', 'TURBO', 'MINIMULA', 'LUV', 'MULA']);
    expect(tiempos.find((t) => t.name === 'SENCILLO')).toMatchObject({
      promedio: 20,
      minimo: 20,
      maximo: 20,
      conteo: 2,
    });
    expect(tiempos.find((t) => t.name === 'TURBO')).toMatchObject({
      promedio: 90,
      minimo: 90,
      maximo: 90,
      conteo: 1,
    });
    expect(tiempos.find((t) => t.name === 'MINIMULA')).toMatchObject({ promedio: 0, minimo: 0, maximo: 0, conteo: 0 });
    expect(tiempos.find((t) => t.name === 'LUV')).toMatchObject({ promedio: 0, minimo: 0, maximo: 0, conteo: 0 });
  });
});

describe('utils/informes (mapa de calor de posicionamiento)', () => {
  it('clasificarCita usa umbrales de 60 y 180 min', () => {
    expect(clasificarCita(0)).toBe('aTiempo');
    expect(clasificarCita(59)).toBe('aTiempo');
    expect(clasificarCita(60)).toBe('leve');
    expect(clasificarCita(179)).toBe('leve');
    expect(clasificarCita(180)).toBe('critico');
    expect(clasificarCita(300)).toBe('critico');
  });

  it('agrupa por fecha y hora de llegada a portería, y guarda el conteo por clasificación', () => {
    const rows = [
      row({ llave: 'LL-1', citaCargue: '2026-06-16 14:00', horaLlegadaPorteria: '2026-06-16 14:10' }), // a tiempo (<1h)
      row({ llave: 'LL-2', citaCargue: '2026-06-16 10:00', horaLlegadaPorteria: '2026-06-16 12:30' }), // 150 min → leve
      row({ llave: 'LL-3', citaCargue: '2026-06-16 08:00', horaLlegadaPorteria: '2026-06-16 13:00' }), // 300 min → critico
      row({ llave: 'LL-4', citaCargue: '2026-06-17 09:00', horaLlegadaPorteria: '2026-06-17 09:05' }), // a tiempo, otro día
    ];

    const m = mapaPosicionamiento(rows);
    const c1 = m.celdas.get('16-jun___14:00');
    const c2 = m.celdas.get('16-jun___12:00');
    const c3 = m.celdas.get('16-jun___13:00');
    const c4 = m.celdas.get('17-jun___09:00');
    expect(c1).toMatchObject({ count: 1, aTiempo: 1 });
    expect(c2).toMatchObject({ count: 1, entre1y3h: 1 });
    expect(c3).toMatchObject({ count: 1, masDe3h: 1 });
    expect(c4).toMatchObject({ count: 1, aTiempo: 1 });
    expect(m.fechas.map((f) => f.label)).toEqual(['16-jun', '17-jun']); // orden ascendente
  });

  it('demora en minutos absolutos cruza de día (llegada al día siguiente de la cita)', () => {
    const m = mapaPosicionamiento([
      row({ llave: 'LL-1', citaCargue: '2026-06-16 23:00', horaLlegadaPorteria: '2026-06-17 01:30' }),
    ]);
    // 150 min de demora (no 0): se ubica el 17-jun a la 01:00 como leve.
    expect(m.celdas.get('17-jun___01:00')).toMatchObject({ count: 1, entre1y3h: 1 });
  });

  it('sin hora de llegada válida usa la cita; fila sin hora salta', () => {
    const rows = [
      row({ llave: 'LL-1', citaCargue: '2026-06-16 20:30' }), // sin llegada: se ubica por cita
      row({ llave: 'LL-2', citaCargue: '2026-06-16 09:00', horaLlegadaPorteria: 'xx:yy' }), // llegada inválida → cita
      row({ llave: 'LL-3', citaCargue: '2026-06-16 09:00' }), // cita sin hora: no ubica
    ];
    rows[2].citaCargue = '2026-06-16'; // fecha sin hora

    const m = mapaPosicionamiento(rows);
    expect(m.celdas.get('16-jun___20:00')).toMatchObject({ count: 1, aTiempo: 1 });
    expect(m.celdas.get('16-jun___09:00')).toMatchObject({ count: 1, aTiempo: 1 });
    expect(m.celdas.size).toBe(2); // LL-3 (sin hora) no ubica
  });

  it('el eje de horas arranca como mínimo a las 06:00 y llega hasta las 23:00', () => {
    const m = mapaPosicionamiento([
      row({ llave: 'LL-1', citaCargue: '2026-06-16 12:00', horaLlegadaPorteria: '2026-06-16 12:00' }),
    ]);
    expect(m.horas[0]).toBe('06:00');
    expect(m.horas[m.horas.length - 1]).toBe('23:00');
    expect(m.horas).toHaveLength(18); // 06:00..23:00
  });
});
