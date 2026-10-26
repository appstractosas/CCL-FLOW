/**
 * Formato de placa del vehículo (columna `placa`, editable en TRANSPORTES y PLANEACIÓN):
 *   - 3 letras mayúsculas + 3 dígitos (ABC123)
 *   - 1 letra mayúscula + 5 dígitos (A12345)
 * El guion se elimina en todo el flujo (tecleo y guardado), así el valor almacenado
 * queda siempre sin separador: ABC-123 → ABC123 y A-12345 → A12345.
 */
export const PLACA_COMPLETA = /^(?:[A-Z]{3}[0-9]{3}|[A-Z][0-9]{5})$/;

/** Estado parcial: permite escribir la placa paso a paso sin aceptar un formato imposible. */
const PLACA_EN_PROGRESO = /^(?:[A-Z]{0,3}[0-9]{0,3}|[A-Z][0-9]{0,5})$/;

const CARACTERES_NO_PERMITIDOS = /[^A-Z0-9]/g;

/** Mayúsculas, sin espacios laterales y sin guiones ni separadores. */
export function normalizarPlaca(valor: string): string {
  return valor.trim().toUpperCase().replace(CARACTERES_NO_PERMITIDOS, '');
}

/** Placa válida para guardar: vacío (placa opcional → PENDIENTE) o formato completo. */
export function esPlacaValida(valor: string): boolean {
  const placa = normalizarPlaca(valor);
  return placa === '' || PLACA_COMPLETA.test(placa);
}

/**
 * Filtro de tecleo: descarta caracteres no permitidos (incluido el guion) y rechaza
 * la pulsación (devuelve `anterior`) si el resultado no puede llegar a ser una placa válida.
 */
export function filtrarEntradaPlaca(valor: string, anterior: string): string {
  const limpio = normalizarPlaca(valor);
  return PLACA_EN_PROGRESO.test(limpio) ? limpio : anterior;
}
