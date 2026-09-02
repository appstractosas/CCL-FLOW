/** Muelle especial que no genera hora de asignación (patio de espera). */
export const MUELLE_CERO = 'MUELLE CERO';

/** Muelles operativos del patio (1..12). */
export const MUELLES: string[] = Array.from({ length: 12 }, (_, i) => `Muelle ${i + 1}`);
