import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserSession } from '../types';

/**
 * Payload del usuario retornado por las funciones de sesión RPC.
 * Usa snake_case porque viene directamente de PostgreSQL.
 */
interface SessionUserPayload {
  id: string;
  nombre: string;
  cedula: string;
  tipo_usuario: string;
  role_id: string;
  role_name: string;
}

/** Resultado de una operación de sesión (login, validate, logout). */
export interface SessionResult {
  ok: boolean;
  token?: string;
  user?: UserSession;
  error?: string;
}

/** Convierte el payload snake_case de la BD al formato camelCase del frontend. */
function toSessionUser(payload: SessionUserPayload): UserSession {
  return {
    id: payload.id,
    name: payload.nombre,
    cedula: payload.cedula,
    tipoUsuario: payload.tipo_usuario as UserSession['tipoUsuario'],
    roleId: payload.role_id,
    roleName: payload.role_name,
  };
}

/**
 * Inicia sesión validando credenciales contra la BD.
 *
 * - Rate limiting: máximo 5 intentos fallidos por cédula en 5 minutos.
 * - Contraseña validada con bcrypt server-side (`crypt(p_clave, clave::text)`).
 * - Si es exitoso, crea una sesión con expiración 24h en la tabla `sessions`.
 *
 * @param cedula - Número de cédula del usuario.
 * @param clave - Contraseña en texto plano (se compara con bcrypt en la BD).
 * @returns `SessionResult` con `ok: true`, `token` y `user` si es exitoso.
 */
export async function cclLogin(cedula: string, clave: string): Promise<SessionResult> {
  if (!isSupabaseConfigured) return { ok: false };
  const { data, error } = await supabase.rpc('ccl_login', { p_cedula: cedula, p_clave: clave });
  if (error) return { ok: false, error: error.message };
  const res = data as { ok?: boolean; token?: string; user?: SessionUserPayload } | null;
  if (!res || res.ok !== true || !res.user) return { ok: false };
  return { ok: true, token: res.token, user: toSessionUser(res.user) };
}

/**
 * Valida un token de sesión existente.
 *
 * - Se llama al recargar la app para restaurar la sesión.
 * - Si la sesión tiene más de 30 minutos de inactividad, se elimina automáticamente.
 * - Si es válida, renueva la ventana de 30 minutos.
 *
 * @param token - Token de sesión almacenado en localStorage.
 * @returns `SessionResult` con `ok: true` y `user` si la sesión es válida.
 */
export async function cclValidateSession(token: string): Promise<SessionResult> {
  if (!isSupabaseConfigured) return { ok: false };
  const { data, error } = await supabase.rpc('ccl_validate_session', { p_token: token });
  if (error) return { ok: false };
  const res = data as { ok?: boolean; user?: SessionUserPayload } | null;
  if (!res || res.ok !== true || !res.user) return { ok: false };
  return { ok: true, user: toSessionUser(res.user) };
}

/**
 * Invalida la sesión actual en la BD.
 *
 * Se llama al cerrar sesión. La BD elimina el token de la tabla `sessions`.
 * Si falla, el token expira solo por TTL de 24 horas.
 *
 * @param token - Token de sesión a invalidar.
 */
export async function cclLogout(token: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.rpc('ccl_logout', { p_token: token });
  } catch {
    // El token igual expira solo en la BD.
  }
}
