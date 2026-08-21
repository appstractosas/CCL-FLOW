/** Fecha desplazada N días desde hoy en formato YYYY-MM-DD (hora local, no UTC). */
export function addDaysStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Fecha de hoy en formato YYYY-MM-DD (hora local, no UTC). */
export function todayStr(): string {
  return addDaysStr(0);
}

/** Fecha YYYY-MM-DD del último lunes (hoy si es lunes).
 *  Base del preset "Semana" de informes: desde el lunes de esta semana hasta hoy. */
export function inicioSemanaStr(): string {
  const d = new Date();
  const diasDesdeLunes = (d.getDay() + 6) % 7; // 0 = lunes ... 6 = domingo
  d.setDate(d.getDate() - diasDesdeLunes);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Fecha YYYY-MM-DD del primer día del mes actual.
 *  Base del preset "Mes" de informes: desde el día 1 hasta hoy. */
export function inicioMesStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

/** Fecha YYYY-MM-DD del primer día del año actual (1 de enero).
 *  Punto de partida del preset "Año"; luego se ajusta al primer día con datos. */
export function inicioAnioStr(): string {
  return `${new Date().getFullYear()}-01-01`;
}

/** True si el valor es una hora registrada (no vacío ni '--:--'). */
export function timeSet(value?: string): boolean {
  return value != null && value !== '' && value !== '--:--';
}

/** Hora actual HH:MM (hora local 24h). */
export function nowHHMM(): string {
  return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/** Fecha y hora actuales "YYYY-MM-DD HH:MM" (hora local, no UTC). */
export function nowDateTime(): string {
  return `${todayStr()} ${nowHHMM()}`;
}

/** Extrae la parte "HH:MM" de un valor "YYYY-MM-DD HH:MM"; si ya es solo hora, la devuelve tal cual. */
export function horaOf(value?: string): string {
  if (!value) return '';
  const m = value.trim().match(/(?:^|\s)(\d{2}:\d{2})$/);
  return m ? m[1] : value.trim();
}

/** Convierte "HH:MM" a "YYYY-MM-DD HH:MM" combinándola con la fecha base
 *  ("YYYY-MM-DD" o "YYYY-MM-DD HH:MM"); si la base no trae fecha, usa el día actual. */
export function combinarFechaHora(value?: string, baseDate?: string): string {
  const hora = horaOf(value);
  if (!hora) return '';
  const m = (baseDate || '').match(/(\d{4}-\d{2}-\d{2})/);
  const fecha = (m && m[1]) || todayStr();
  return `${fecha} ${hora}`;
}

/** Formatea "YYYY-MM-DD[T ]HH:MM..." a "YYYY-MM-DD HH:MM"; si no hay match, quita la parte de tiempo. */
export function formatFechaHora(value?: string): string {
  if (!value) return '—';
  const m = value.match(/(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return value.split('T')[0];
  return `${m[1]} ${m[2]}:${m[3]}`;
}

/** Formatea "YYYY-MM-DD[T ]HH:MM..." a solo "YYYY-MM-DD" (sin hora). */
export function formatFecha(value?: string): string {
  if (!value) return '—';
  const m = value.match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : value;
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
