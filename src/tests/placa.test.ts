import { describe, expect, it } from 'vitest';
import { esPlacaValida, filtrarEntradaPlaca, normalizarPlaca } from '../utils/placa';

describe('placa — formato 3 letras + 3 números / 1 letra + 5 números (sin guion)', () => {
  it('acepta los dos formatos válidos y el vacío (placa opcional → PENDIENTE)', () => {
    expect(esPlacaValida('')).toBe(true);
    expect(esPlacaValida('   ')).toBe(true);
    expect(esPlacaValida('ABC123')).toBe(true);
    expect(esPlacaValida('A12345')).toBe(true);
  });

  it('limpia el guion de las placas ya guardadas con ese formato', () => {
    expect(esPlacaValida('ABC-123')).toBe(true);
    expect(esPlacaValida('A-12345')).toBe(true);
    expect(esPlacaValida('TLX-842')).toBe(true);
  });

  it('rechaza longitudes o combinaciones distintas', () => {
    expect(esPlacaValida('ABC12')).toBe(false);
    expect(esPlacaValida('ABC1234')).toBe(false);
    expect(esPlacaValida('AB1234')).toBe(false);
    expect(esPlacaValida('1ABC23')).toBe(false);
    expect(esPlacaValida('A1234B')).toBe(false);
    expect(esPlacaValida('A123456')).toBe(false);
  });

  it('normaliza a mayúsculas, sin espacios y sin guion', () => {
    expect(normalizarPlaca('  abc123  ')).toBe('ABC123');
    expect(normalizarPlaca(' tgb-512 ')).toBe('TGB512');
    expect(normalizarPlaca('A-12345')).toBe('A12345');
  });

  it('filtra el tecleo: mayúsculas, sin guion y sin formatos imposibles', () => {
    expect(filtrarEntradaPlaca('abc123', '')).toBe('ABC123');
    expect(filtrarEntradaPlaca('a12345', '')).toBe('A12345');
    expect(filtrarEntradaPlaca('tgb-512', '')).toBe('TGB512');
    expect(filtrarEntradaPlaca('A-12345', '')).toBe('A12345');
    expect(filtrarEntradaPlaca('AB@C', '')).toBe('ABC');
    expect(filtrarEntradaPlaca('abc 123', '')).toBe('ABC123');
    expect(filtrarEntradaPlaca('A', '')).toBe('A');
    expect(filtrarEntradaPlaca('', 'ABC1')).toBe('');
  });

  it('rechaza la pulsación que no puede llegar a ser una placa válida', () => {
    expect(filtrarEntradaPlaca('ABC1234', 'ABC123')).toBe('ABC123');
    expect(filtrarEntradaPlaca('AB1234', 'AB123')).toBe('AB123');
    expect(filtrarEntradaPlaca('A123456', 'A12345')).toBe('A12345');
  });
});
