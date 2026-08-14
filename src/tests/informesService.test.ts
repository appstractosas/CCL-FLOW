import { describe, it, expect, beforeEach } from 'vitest';
import { fetchInformesRango } from '../services/informesService';
import { useLogisticsStore } from '../store/useLogisticsStore';

describe('informesService (modo demo: filtra estado local del store)', () => {
  beforeEach(() => {
    useLogisticsStore.setState({
      transportes: [
        {
          id: 'T-1',
          llave: 'LL-60533',
          fechaHora: '2026-08-10 09:00',
          placa: 'XYZ-999',
          vehiculoTipo: 'TURBO',
          citaCargue: '2026-08-10 08:00',
          estadoTransporte: 'PENDIENTE',
          estadoPorteria: 'Pendiente',
        },
        {
          id: 'T-2',
          llave: 'LL-60534',
          fechaHora: '2026-08-15 09:00',
          placa: 'ABC-123',
          vehiculoTipo: 'SENCILLO',
          citaCargue: '2026-08-15 08:30',
          estadoTransporte: 'PENDIENTE',
          estadoPorteria: 'Confirmado',
        },
        {
          id: 'T-3',
          llave: 'LL-60535',
          fechaHora: '2026-08-20 09:00',
          placa: 'DEF-456',
          vehiculoTipo: 'LUV',
          citaCargue: '2026-08-20 07:00',
          estadoTransporte: 'PENDIENTE',
          estadoPorteria: 'Pendiente',
        },
      ],
    });
  });

  it('devuelve todos los transportes sin filtros de rango', async () => {
    const rows = await fetchInformesRango('', '');
    expect(rows.length).toBe(3);
  });

  it('filtra por rango de fechas', async () => {
    const rows = await fetchInformesRango('2026-08-12', '2026-08-16');
    expect(rows.length).toBe(1);
    expect(rows[0].llave).toBe('LL-60534');
  });

  it('respeta el límite desde (fechaDesde)', async () => {
    const rows = await fetchInformesRango('2026-08-15', '');
    expect(rows.length).toBe(2);
  });

  it('respeta el límite hasta (fechaHasta)', async () => {
    const rows = await fetchInformesRango('', '2026-08-15');
    expect(rows.length).toBe(2);
  });
});
