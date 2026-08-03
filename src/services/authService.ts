import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserSession } from '../types';

interface SessionUserPayload {
  id: string;
  nombre: string;
  cedula: string;
  tipo_usuario: string;
  role_id: string;
  role_name: string;
}

export interface SessionResult {
  ok: boolean;
  token?: string;
  user?: UserSession;
  error?: string;
}

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

export async function cclLogin(cedula: string, clave: string): Promise<SessionResult> {
  if (!isSupabaseConfigured) return { ok: false };
  const { data, error } = await supabase.rpc('ccl_login', { p_cedula: cedula, p_clave: clave });
  if (error) return { ok: false, error: error.message };
  const res = data as { ok?: boolean; token?: string; user?: SessionUserPayload } | null;
  if (!res || res.ok !== true || !res.user) return { ok: false };
  return { ok: true, token: res.token, user: toSessionUser(res.user) };
}

export async function cclValidateSession(token: string): Promise<SessionResult> {
  if (!isSupabaseConfigured) return { ok: false };
  const { data, error } = await supabase.rpc('ccl_validate_session', { p_token: token });
  if (error) return { ok: false };
  const res = data as { ok?: boolean; user?: SessionUserPayload } | null;
  if (!res || res.ok !== true || !res.user) return { ok: false };
  return { ok: true, user: toSessionUser(res.user) };
}

export async function cclLogout(token: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.rpc('ccl_logout', { p_token: token });
  } catch {
    // El token igual expira solo en la BD.
  }
}
