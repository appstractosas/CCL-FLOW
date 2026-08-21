import { create } from 'zustand';
import {
  UnifiedTransporte,
  TransporteData,
  ChatMessage,
  Notificacion,
  TipoNotificacion,
  KPIStats,
  EstadoPorteria,
  PorteriaTimeField,
} from '../types';
import {
  fetchTransportes, createTransporte, updateTransporte as updateTransporteRemote,
  subscribeToTransportes,
} from '../services/transportesService';
import { fetchMessages, sendMessage, subscribeToMessages } from '../services/chatService';
import {
  fetchNotificaciones,
  createNotificacion,
  markAllNotificacionesLeidas,
  subscribeToNotificaciones,
} from '../services/notificacionesService';
import { useAuthStore } from './useAuthStore';
import { isSupabaseConfigured } from '../lib/supabase';
import { initialTransportes, initialMessages } from './initialData';
import { getEstadoPorteria, isLlaveCerrada, puedeEditarOperacion, sortTransportesPorEstado } from '../utils/porteria';
import { playNotificationSound, playAlertSound } from '../utils/sound';
import { MUELLE_CERO } from '../lib/muelles';
import { nowHHMM, nowDateTime } from '../lib/dateUtils';

interface LogisticsState {
  initialized: boolean;
  loading: boolean;
  demoMode: boolean;
  nextLlaveSeq: number;
  transportes: UnifiedTransporte[];
  messages: ChatMessage[];
  unreadChatCount: number;
  notificaciones: Notificacion[];
  unreadNotifCount: number;

  initialize: () => Promise<void>;
  addTransporte: (data: TransporteData & { llave?: string }) => Promise<UnifiedTransporte>;
  updateTransporte: (id: string, updated: Partial<UnifiedTransporte>) => void;
  updatePorteriaHora: (id: string, campo: PorteriaTimeField, hora: string) => void;
  updateMuelleAsignado: (id: string, muelle: string) => void;
  updateMuelleHora: (id: string, hora: string) => void;
  updateCuadrilla: (id: string, cuadrilla: string) => void;
  updateCajas: (id: string, cajas: number) => void;
  cancelTransporte: (id: string) => void;
  sendMessage: (msg: { senderRole: string; senderName: string; senderModule: 'Portería' | 'Despachos' | 'Planeación' | 'General'; content: string; llaveRelacionada?: string; muelleSugerido?: string }) => void;
  markChatRead: () => void;
  markNotifRead: () => void;
  getKPIs: () => KPIStats;
}

let unsubscribeRealtime: (() => void) | null = null;
let unsubscribeTransportesRealtime: (() => void) | null = null;
let unsubscribeNotificacionesRealtime: (() => void) | null = null;
let transportesRefreshTimer: ReturnType<typeof setTimeout> | null = null;

export const useLogisticsStore = create<LogisticsState>()((set, get) => {
  // Crea una notificación in-app para TODOS los usuarios (broadcast).
  // No se agrega en local: Realtime la reenvía a este cliente y a los demás
  // (el banner y el sonido salen del suscriptor de tiempo real).
  function emitNotificacion(
    tipo: TipoNotificacion,
    titulo: string,
    mensaje: string,
    llaveRelacionada: string
  ): void {
    if (!isSupabaseConfigured) return;
    createNotificacion({ tipo, titulo, mensaje, llaveRelacionada })
      .catch((err) => console.error('Error creando notificación:', err));
  }

  return {
    initialized: false,
    loading: true,
    demoMode: !isSupabaseConfigured,
    nextLlaveSeq: 60538,
    transportes: initialTransportes,
    messages: initialMessages,
    unreadChatCount: 1,
    notificaciones: [],
    unreadNotifCount: 0,

  initialize: async () => {
    if (get().initialized) return;
    if (!isSupabaseConfigured) {
      set({ loading: false, initialized: true, demoMode: true });
      return;
    }

    try {
      const [transportes, messages] = await Promise.all([
        fetchTransportes(),
        fetchMessages(),
      ]);

      const unreadCount = messages.filter((m) => !m.isRead).length;

      // El contador de LLAVE se deriva de la BD (ya no se persiste en el navegador).
      const nextLlaveSeq = transportes.reduce((acc, t) => {
        const n = parseInt(String(t.llave).replace('LL-', ''), 10);
        return Number.isFinite(n) ? Math.max(acc, n) : acc;
      }, 0) + 1;

      // Las notificaciones se cargan aparte: si la tabla aún no existe en la BD
      // no se debe tumbar la inicialización (la app sigue funcionando sin ellas).
      let notificaciones: Notificacion[] = [];
      let notificacionesOk = false;
      try {
        notificaciones = await fetchNotificaciones();
        notificacionesOk = true;
      } catch (err) {
        console.warn('No se pudieron cargar las notificaciones:', err);
      }
      const unreadNotifCount = notificaciones.filter((n) => !n.leida).length;

      set({
        transportes: sortTransportesPorEstado(transportes),
        messages,
        unreadChatCount: unreadCount,
        nextLlaveSeq,
        notificaciones,
        unreadNotifCount,
        loading: false,
        initialized: true,
        demoMode: false,
      });

          unsubscribeRealtime = subscribeToMessages((newMsg) => {
            // Aviso sonoro para todos cuando PORTERÍA o SUPERVISOR envían un chat.
            if (newMsg.senderRole === 'PORTERO' || newMsg.senderRole === 'SUPERVISOR') {
              playNotificationSound();
            }
            set((s) => {
              if (s.messages.some((m) => m.id === newMsg.id)) return s;
              return { messages: [...s.messages, newMsg], unreadChatCount: s.unreadChatCount + 1 };
            });
          });

          // Tiempo real: si la BD cambia desde otra fuente (p.ej. el App Script
          // del Sheets), se recargan los transportes y el tablero se actualiza solo.
          // Se hace con DEBOUNCE: el sync del Sheets hace UPSERT fila por fila y
          // dispara muchos eventos seguidos; refrescar cada uno haría que las filas
          // parpadearan. Se agrupan y se refresca una sola vez por ráfaga.
          unsubscribeTransportesRealtime = subscribeToTransportes(() => {
            if (transportesRefreshTimer) clearTimeout(transportesRefreshTimer);
            transportesRefreshTimer = setTimeout(async () => {
              try {
                const transportes = await fetchTransportes();
                const nextLlaveSeq = transportes.reduce((acc, t) => {
                  const n = parseInt(String(t.llave).replace('LL-', ''), 10);
                  return Number.isFinite(n) ? Math.max(acc, n) : acc;
                }, 0) + 1;
                set({ transportes: sortTransportesPorEstado(transportes), nextLlaveSeq });
              } catch (err) {
                console.error('Error al refrescar transportes por realtime:', err);
              }
            }, 350);
          });

          // Notificaciones en vivo: cualquier INSERT (acción propia o de otro
          // usuario) enciende el sonido y actualiza la campana para todos.
          if (notificacionesOk) {
            unsubscribeNotificacionesRealtime = subscribeToNotificaciones((newNotif) => {
              if (get().notificaciones.some((n) => n.id === newNotif.id)) return;
              playAlertSound();
              set((s) => ({
                notificaciones: [newNotif, ...s.notificaciones].slice(0, 100),
                unreadNotifCount: s.unreadNotifCount + 1,
              }));
            });
          }
        } catch (err) {
          console.error('Error loading data from Supabase:', err);
          set({ loading: false, initialized: true, demoMode: true });
        }
      },

      addTransporte: async (data) => {
        const state = get();
        const llave = data.llave?.trim() || `LL-${state.nextLlaveSeq}`;
        const placa = (data.placa || '').toUpperCase().trim();

        // Regla de negocio: una llave puede tener VARIAS placas (cada placa =
        // una fila). Solo se rechaza el par (llave, placa) duplicado.
        if (state.transportes.some((t) => t.llave === llave && (t.placa || '').toUpperCase().trim() === placa)) {
          throw new Error(`La llave ${llave} con placa ${placa || 'SIN PLACA'} ya existe.`);
        }

        // Regla de negocio: un TRANSPORTE (nº pedido) no puede pertenecer a dos llaves.
        const transporte = data.transporte?.trim();
        if (transporte && state.transportes.some((t) => t.transporte === transporte && t.llave !== llave)) {
          throw new Error(`El transporte ${transporte} ya está asociado a otra llave.`);
        }

        const fechaHora = data.fechaHora || data.citaCargue || new Date().toISOString().replace('T', ' ').substring(0, 16);

        const newTransporte: UnifiedTransporte = {
          id: `TR-${Date.now()}-${state.nextLlaveSeq}`,
          llave,
          fechaHora,
          placa,
          vehiculoTipo: data.vehiculoTipo || 'SENCILLO',
          citaCargue: data.citaCargue || fechaHora,
          transporte: data.transporte || undefined,
          denominacion: data.denominacion || undefined,
          transportadora: data.transportadora || '',
          estadoTransporte: data.estadoTransporte || 'ALISTADO',
          // Placa opcional: sin placa → PENDIENTE; con placa → CONFIRMADO.
          estadoPorteria: placa ? 'Confirmado' : 'Pendiente',
          muelleAsignado: data.muelleAsignado || '',
          cuadrilla: data.cuadrilla || '',
          cajas: data.cajas,
          destino: data.destino || undefined,
          kg: data.kg,
          horaMuelleAsignado: data.horaMuelleAsignado || '',
          horaIngreso: '--:--',
          horaSalida: '--:--',
          horaLlegadaPorteria: '--:--',
          horaInicioCargue: '--:--',
          horaFinCargue: '--:--',
          observaciones: data.observaciones || '',
        };

        let savedId: string | undefined;
        if (isSupabaseConfigured) {
          try {
            const created = await createTransporte(newTransporte);
            savedId = created.id;
          } catch (err) {
            console.error('Error saving to Supabase:', err);
          }
        }

        set((s) => ({
          nextLlaveSeq: s.nextLlaveSeq + 1,
          transportes: sortTransportesPorEstado([
            { ...newTransporte, id: savedId || newTransporte.id },
            ...s.transportes,
          ]),
        }));

        useAuthStore.getState().addMovimiento(
          'CREAR_TRANSPORTE',
          'planeacion',
          `${newTransporte.placa || 'SIN PLACA'} · ${llave}`,
          llave
        );

        return newTransporte;
      },

      updateTransporte: async (id, updated) => {
        const current = get().transportes.find((t) => t.id === id);
        if (!current) return;
        if (isLlaveCerrada(current)) {
          window.alert(
            `No se puede modificar la llave ${current.llave}: tiene estado ${getEstadoPorteria(current)} y está cerrada.`
          );
          return;
        }
        // PLANEACIÓN/TRANSPORTES solo editan llaves PENDIENTE o CONFIRMADO.
        if (!puedeEditarOperacion(current)) {
          window.alert(
            `La llave ${current.llave} está en estado ${getEstadoPorteria(current)}; solo se puede editar en PENDIENTE o CONFIRMADO.`
          );
          return;
        }

        // Un TRANSPORTE (nº pedido) no puede pertenecer a dos llaves (dentro de
        // la misma llave sí puede repetirse si el pedido se reparte en placas).
        const transporte = updated.transporte?.trim();
        if (transporte && get().transportes.some((t) => t.id !== id && t.transporte === transporte && t.llave !== (updated.llave ?? current.llave))) {
          window.alert(`El transporte ${transporte} ya está asociado a otra llave.`);
          return;
        }

        // Una llave puede tener varias placas; solo se rechaza el par (llave,
        // placa) duplicado en OTRA fila (si se cambia llave o placa).
        const nLlave = (updated.llave ?? current.llave).trim();
        const nPlaca = (updated.placa ?? current.placa ?? '').toUpperCase().trim();
        if (get().transportes.some((t) => t.id !== id && t.llave === nLlave && (t.placa || '').toUpperCase().trim() === nPlaca)) {
          window.alert(`La llave ${nLlave} con placa ${nPlaca || 'SIN PLACA'} ya existe en otra fila.`);
          return;
        }

        // Si se quita la placa (o se edita vacía), la llave vuelve a PENDIENTE.
        if (updated.placa !== undefined && !String(updated.placa).trim()) {
          if (current.estadoPorteria === 'Confirmado') {
            updated = { ...updated, estadoPorteria: 'Pendiente' as EstadoPorteria };
          }
        }

        // Primero la BD; solo si el write remoto llega se refleja en la UI.
        // (antes era fire-and-forget con .catch silencioso y revertía por realtime).
        if (isSupabaseConfigured) {
          await updateTransporteRemote(id, updated);
        }
        set((s) => ({
          transportes: sortTransportesPorEstado(
            s.transportes.map((t) => (t.id === id ? { ...t, ...updated } : t))
          ),
        }));
        const row = get().transportes.find((t) => t.id === id);
        useAuthStore.getState().addMovimiento(
          'EDITAR_TRANSPORTE',
          'planeacion',
          `Actualización de ${row?.placa || id} · ${row?.llave || ''}`,
          row?.llave
        );
      },

      updatePorteriaHora: (id, campo, hora) => {
        const row = get().transportes.find((t) => t.id === id);
        if (!row) return;
        if (isLlaveCerrada(row)) {
          window.alert(
            `No se puede modificar la llave ${row.llave}: tiene estado ${getEstadoPorteria(row)} y está cerrada.`
          );
          return;
        }

        const estadoByCampo: Record<PorteriaTimeField, EstadoPorteria> = {
          horaLlegadaPorteria: 'LLEGO A PORTERIA',
          horaIngreso: 'INGRESO A MUELLE',
          horaInicioCargue: 'CARGANDO',
          horaFinCargue: 'FINALIZO CARGUE',
          horaSalida: 'SALIO DE PORTERIA',
        };
        const patch = { [campo]: hora, estadoPorteria: estadoByCampo[campo] } as Partial<UnifiedTransporte>;

        // Aviso de LLEGADA A PORTERÍA a toda la operación (una sola vez, cuando
        // se registra la hora por primera vez y no es borrado de campo).
        if (
          campo === 'horaLlegadaPorteria' &&
          hora && hora !== '--:--' && hora !== row.horaLlegadaPorteria
        ) {
          emitNotificacion(
            'LLEGO_PORTERIA',
            'Vehículo en portería',
            `Llave ${row.llave} (${row.placa || 'SIN PLACA'}) llegó a portería a las ${hora}.`,
            row.llave
          );
        }

        if (isSupabaseConfigured) updateTransporteRemote(id, patch).catch(console.error);
        set((s) => ({
          transportes: sortTransportesPorEstado(
            s.transportes.map((t) => (t.id === id ? { ...t, ...patch } : t))
          ),
        }));
        useAuthStore.getState().addMovimiento(
          'ACTUALIZAR_PORTERIA',
          'porteria',
          `Registro portería de ${row.llave}: ${campo} → ${hora} (${estadoByCampo[campo]})`,
          row.llave
        );
      },

      updateMuelleAsignado: (id, muelle) => {
        const row = get().transportes.find((t) => t.id === id);
        if (!row) return;
        if (isLlaveCerrada(row)) {
          window.alert(
            `No se puede modificar la llave ${row.llave}: tiene estado ${getEstadoPorteria(row)} y está cerrada.`
          );
          return;
        }

        const patch: Partial<UnifiedTransporte> = { muelleAsignado: muelle };
        // Al asignar un muelle distinto de MUELLE CERO se carga automáticamente
        // la H. Asignación Muelle (editable después, como las horas de portería).
        const esMuelleCero = (muelle || '').toUpperCase() === MUELLE_CERO.toUpperCase();
        if (muelle && !esMuelleCero) {
          patch.horaMuelleAsignado = nowDateTime();
        }

        // Aviso de ASIGNACIÓN DE MUELLE a toda la operación (solo si cambió el muelle).
        if (muelle && !esMuelleCero && muelle !== row.muelleAsignado) {
          emitNotificacion(
            'MUELLE_ASIGNADO',
            'Muelle asignado',
            `Llave ${row.llave} (${row.placa || 'SIN PLACA'}) asignada a ${muelle}.`,
            row.llave
          );
        }

        if (isSupabaseConfigured) updateTransporteRemote(id, patch).catch(console.error);
        set((s) => ({
          transportes: sortTransportesPorEstado(
            s.transportes.map((t) => (t.id === id ? { ...t, ...patch } : t))
          ),
        }));
        useAuthStore.getState().addMovimiento(
          'ASIGNAR_MUELLE',
          'personal',
          `Muelle ${muelle} asignado a ${row.llave} (${row.placa || 'SIN PLACA'})`,
          row.llave
        );
      },

      updateMuelleHora: (id, hora) => {
        const row = get().transportes.find((t) => t.id === id);
        if (!row) return;
        if (isLlaveCerrada(row)) {
          window.alert(
            `No se puede modificar la llave ${row.llave}: tiene estado ${getEstadoPorteria(row)} y está cerrada.`
          );
          return;
        }

        if (isSupabaseConfigured) updateTransporteRemote(id, { horaMuelleAsignado: hora }).catch(console.error);
        set((s) => ({
          transportes: sortTransportesPorEstado(
            s.transportes.map((t) => (t.id === id ? { ...t, horaMuelleAsignado: hora } : t))
          ),
        }));
      },

      updateCuadrilla: (id, cuadrilla) => {
        const row = get().transportes.find((t) => t.id === id);
        if (!row) return;
        if (isLlaveCerrada(row)) {
          window.alert(
            `No se puede modificar la llave ${row.llave}: tiene estado ${getEstadoPorteria(row)} y está cerrada.`
          );
          return;
        }

        if (isSupabaseConfigured) updateTransporteRemote(id, { cuadrilla }).catch(console.error);
        set((s) => ({
          transportes: sortTransportesPorEstado(
            s.transportes.map((t) => (t.id === id ? { ...t, cuadrilla } : t))
          ),
        }));
        useAuthStore.getState().addMovimiento(
          'ASIGNAR_CUADRILLA',
          'despachos',
          `Cuadrilla ${cuadrilla || '—'} asignada a ${row.llave}`,
          row.llave
        );
      },

      updateCajas: (id, cajas) => {
        const row = get().transportes.find((t) => t.id === id);
        if (!row) return;
        if (!Number.isFinite(cajas) || cajas < 0) return;
        // Editable en cualquier estado EXCEPTO llave cerrada (CANCELADO o SALIO
        // DE PORTERIA): se muestra alerta y NO se aplica el cambio.
        if (isLlaveCerrada(row)) {
          window.alert(
            `No se puede editar cajas en una llave con estado ${getEstadoPorteria(row)} (cerrada).`
          );
          return;
        }

        const patch: Partial<UnifiedTransporte> = { cajas };
        if (isSupabaseConfigured) updateTransporteRemote(id, patch).catch(console.error);
        set((s) => ({
          transportes: sortTransportesPorEstado(
            s.transportes.map((t) => (t.id === id ? { ...t, ...patch } : t))
          ),
        }));
        useAuthStore.getState().addMovimiento(
          'ACTUALIZAR_CAJAS',
          'despachos',
          `Cajas de ${row.llave} actualizadas: ${row.cajas ?? 0} → ${cajas}`,
          row.llave
        );
      },

      cancelTransporte: (id) => {
        const row = get().transportes.find((t) => t.id === id);
        if (!row) return;
        if (isLlaveCerrada(row)) {
          window.alert(
            `No se puede cancelar la llave ${row.llave}: tiene estado ${getEstadoPorteria(row)} y está cerrada.`
          );
          return;
        }

        // PLANEACIÓN solo cancela llaves PENDIENTE o CONFIRMADO (aplica a todos
        // los roles, incluido ADMIN: en cuanto la llave pasa a LLEGO A PORTERIA
        // ya no se puede cancelar).
        if (!puedeEditarOperacion(row)) {
          window.alert(
            `La llave ${row.llave} está en estado ${getEstadoPorteria(row)}; solo se puede cancelar en PENDIENTE o CONFIRMADO.`
          );
          return;
        }

        // No se elimina el vehículo: queda con estado CANCELADO y sin editar.
        const patch: Partial<UnifiedTransporte> = { estadoPorteria: 'CANCELADO' as EstadoPorteria };
        if (isSupabaseConfigured) updateTransporteRemote(id, patch).catch(console.error);
        set((s) => ({
          transportes: sortTransportesPorEstado(
            s.transportes.map((t) => (t.id === id ? { ...t, ...patch } : t))
          ),
        }));
        useAuthStore.getState().addMovimiento(
          'CANCELAR_TRANSPORTE',
          'planeacion',
          `Cancelación de ${row?.placa || 'SIN PLACA'} · ${row?.llave || ''}`,
          row?.llave
        );
      },

      sendMessage: (msg) => {
        const newMsg: ChatMessage = {
          id: `MSG-${Date.now()}`,
          senderRole: msg.senderRole,
          senderName: msg.senderName,
          senderModule: msg.senderModule,
          llaveRelacionada: msg.llaveRelacionada,
          muelleSugerido: msg.muelleSugerido,
          content: msg.content,
          timestamp: new Date().toISOString(),
          isRead: true,
        };

        set((s) => ({ messages: [...s.messages, newMsg] }));

        if (!isSupabaseConfigured) return;

        sendMessage(newMsg)
          .then((saved) => {
            set((s) => ({
              messages: s.messages.map((m) => (m.id === newMsg.id ? { ...m, id: saved.id } : m)),
            }));
          })
          .catch((err) => {
            console.error('Error enviando mensaje del chat a Supabase:', err);
          });
      },

      markChatRead: () => {
        set((s) => ({
          unreadChatCount: 0,
          messages: s.messages.map((m) => ({ ...m, isRead: true })),
        }));
      },

      markNotifRead: () => {
        set((s) => ({
          unreadNotifCount: 0,
          notificaciones: s.notificaciones.map((n) => ({ ...n, leida: true })),
        }));
        if (isSupabaseConfigured) markAllNotificacionesLeidas().catch(console.error);
      },

      getKPIs: () => {
        const { transportes } = get();
        const total = transportes.length;
        const cerradas = transportes.filter((t) => getEstadoPorteria(t) === 'SALIO DE PORTERIA').length;
        const cargasActivas = transportes.filter((t) => getEstadoPorteria(t) !== 'SALIO DE PORTERIA').length;
        const cumplimientoSLA = total > 0 ? Math.round((cerradas / total) * 100) : 100;
        const tiempoMuertoHoras = transportes.filter((t) => getEstadoPorteria(t) === 'Pendiente').length * 2.5;

        return { totalPedidos: total, cumplimientoSLA, tiempoMuertoHoras, cargasActivas };
      },
  };
});
