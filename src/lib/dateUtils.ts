/** Fecha de hoy en formato YYYY-MM-DD (hora local, no UTC). */
export function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** True si el valor es una hora registrada (no vacío ni '--:--'). */
export function timeSet(value?: string): boolean {
  return value != null && value !== '' && value !== '--:--';
}

/** Hora actual HH:MM (hora local 24h). */
export function nowHHMM(): string {
  return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/** Formatea "YYYY-MM-DD[T ]HH:MM..." a "YYYY-MM-DD HH:MM"; si no hay match, quita la parte de tiempo. */
export function formatFechaHora(value?: string): string {
  if (!value) return '—';
  const m = value.match(/(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return value.split('T')[0];
  return `${m[1]} ${m[2]}:${m[3]}`;
}

/** Formatea un slot de cita ("YYYY-MM-DD[T ]HH:MM[:SS][Z|offset]") a "YYYY-MM-DD HH:MM". */
export function formatSlot(value?: string): string {
  if (!value) return '';
  const m = value.match(/(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})?/);
  if (!m) return value;
  return `${m[1]} ${m[2]}:${m[3]}`;
}

/** Texto relativo en español desde un timestamp ISO ("hace 5 min", "hace 2 h"...) o ''. */
export function timeAgo(iso?: string): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const seconds = Math.max(1, Math.floor((Date.now() - t) / 1000));
  if (seconds < 60) return 'ahora';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}

/** Hora HH:MM (local 24h) de un timestamp ISO; si no es válido, devuelve el texto tal cual. */
export function formatTimestamp(ts?: string): string {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
