import { describe, expect, it } from 'vitest';
import { inicioSemanaStr, inicioMesStr, inicioAnioStr, todayStr } from '../lib/dateUtils';

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
