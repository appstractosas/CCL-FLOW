import { describe, expect, it } from 'vitest';
import {
  inicioSemanaStr,
  inicioMesStr,
  inicioAnioStr,
  todayStr,
  formatCitaCorta,
} from '../lib/dateUtils';

describe('dateUtils · presets de rango (informes)', () => {
  it('inicioSemanaStr es un lunes dentro de los últimos 7 días', () => {
    const hoy = new Date(`${todayStr()}T00:00:00`);
    const lunes = new Date(`${inicioSemanaStr()}T00:00:00`);
    expect(lunes.getDay()).toBe(1);
    const diff = Math.round((hoy.getTime() - lunes.getTime()) / 86_400_000);
    expect(diff).toBeGreaterThanOrEqual(0);
    expect(diff).toBeLessThanOrEqual(6);
  });

  it('inicioMesStr es el día 1 del mes actual', () => {
    const d = new Date();
    expect(inicioMesStr()).toBe(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`,
    );
  });

  it('inicioAnioStr es el 1 de enero del año actual', () => {
    expect(inicioAnioStr()).toBe(`${new Date().getFullYear()}-01-01`);
  });
});

describe('dateUtils · formatCitaCorta', () => {
  it('acorta un ISO a "DD/MM HH:mm"', () => {
    expect(formatCitaCorta('2026-10-01T08:30:00')).toBe('01/10 08:30');
  });

  it('acorta dd/mm/aaaa hh:mm', () => {
    expect(formatCitaCorta('01/10/2026 14:05')).toBe('01/10 14:05');
  });

  it('acorta un serial de Excel (día + fracción)', () => {
    expect(formatCitaCorta('46296.604166666664')).toBe('01/10 14:30');
  });

  it('devuelve vacío/— en entradas vacías y el texto si no se puede interpretar', () => {
    expect(formatCitaCorta('')).toBe('');
    expect(formatCitaCorta(undefined)).toBe('');
    expect(formatCitaCorta('sin fecha')).toBe('sin fecha');
  });
});
