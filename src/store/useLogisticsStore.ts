import { create } from 'zustand';
import {
  UnifiedTransporte,
  TransporteData,
  ChatMessage,
  KPIStats,
  EstadoDespacho,
  EstadoPorteria,
  PorteriaTimeField,
} from '../types';
import {
  fetchTransportes, createTransporte, updateTransporte as updateTransporteRemote, deleteTransporte as deleteTransporteRemote,
} from '../services/transportesService';
import { fetchMessages, sendMessage, subscribeToMessages } from '../services/chatService';
import { useAuthStore } from './useAuthStore';
import { isSupabaseConfigured } from '../lib/supabase';
import { initialTransportes, initialMessages } from './initialData';
import { getEstadoPorteria, isLlaveCerrada } from '../utils/porteria';
import { playNotificationSound } from '../utils/sound';

interface LogisticsState {
  initialized: boolean;
  loading: boolean;
  demoMode: boolean;
  nextLlaveSeq: number;
  nextPedidoSeq: number;
  transportes: UnifiedTransporte[];
  messages: ChatMessage[];
  unreadChatCount: number;

  initialize: () => Promise<void>;
  addTransporte: (data: TransporteData & { llave?: string }) => Promise<UnifiedTransporte>;
  updateTransporte: (id: string, updated: Partial<UnifiedTransporte>) => void;
  updateEstadoDespacho: (id: string, estado: EstadoDespacho) => void;
  updatePorteriaHora: (id: string, campo: PorteriaTimeField, hora: string) => void;
  updateMuelleAsignado: (id: string, muelle: string) => void;
  deleteTransporte: (id: string) => void;
  sendMessage: (msg: { senderRole: string; senderName: string; senderModule: 'Portería' | 'Despachos' | 'Planeación' | 'General'; content: string; llaveRelacionada?: string; muelleSugerido?: string }) => void;
  markChatRead: () => void;
  getKPIs: () => KPIStats;
  getUnifiedTransportes: () => UnifiedTransporte[];
}

let unsubscribeRealtime: (() => void) | null = null;

export const useLogisticsStore = create<LogisticsState>()((set, get) => ({
  initialized: false,
  loading: true,
  demoMode: !isSupabaseConfigured,
  nextLlaveSeq: 60538,
  nextPedidoSeq: 3000576483,
  transportes: initialTransportes,
  messages: initialMessages,
  unreadChatCount: 1,

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

      // Los contadores se derivan de la BD (ya no se persisten en el navegador).
      const nextLlaveSeq = transportes.reduce((acc, t) => {
        const n = parseInt(String(t.llave).replace('LL-', ''), 10);
        return Number.isFinite(n) ? Math.max(acc, n) : acc;
      }, 0) + 1;
      const nextPedidoSeq = transportes.reduce((acc, t) => {
        const n = parseInt(String(t.numeroPedido || ''), 10);
        return Number.isFinite(n) ? Math.max(acc, n) : acc;
      }, 0) + 1;

      set({
        transportes,
        messages,
        unreadChatCount: unreadCount,
        nextLlaveSeq,
        nextPedidoSeq,
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
              return { messages: [newMsg, ...s.messages], unreadChatCount: s.unreadChatCount + 1 };
            });
          });
        } catch (err) {
          console.error('Error loading data from Supabase:', err);
          set({ loading: false, initialized: true, demoMode: true });
        }
      },

      addTransporte: async (data) => {
        const state = get();
        const llave = data.llave || `LL-${state.nextLlaveSeq}`;
        const numeroPedido = data.numeroPedido || `${state.nextPedidoSeq}`;
        const fechaHora = data.fechaHora || data.citaCargue || new Date().toISOString().replace('T', ' ').substring(0, 16);

        const newTransporte: UnifiedTransporte = {
          id: `TR-${Date.now()}`,
          llave,
          fechaHora,
          placa: (data.placa || '').toUpperCase().trim(),
          numeroPedido,
          vehiculoTipo: data.vehiculoTipo || 'SENCILLO',
          denominacionCliente: data.denominacionCliente || 'CLIENTE REGIONAL',
          destino: data.destino || 'NEIVA',
          citaCargue: data.citaCargue || fechaHora,
          transportadora: data.transportadora || '',
          estadoTransporte: data.estadoTransporte || 'ALISTADO',
          estadoDespacho: data.estado || 'PTE ALISTAR',
          estadoPorteria: 'Pendiente',
          muelleAsignado: data.muelleAsignado || '',
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
          nextPedidoSeq: s.nextPedidoSeq + 1,
          transportes: [{ ...newTransporte, id: savedId || newTransporte.id }, ...s.transportes],
        }));

        useAuthStore.getState().addMovimiento(
          'CREAR_TRANSPORTE',
          'planeacion',
          `${newTransporte.placa} · ${llave} · ${newTransporte.denominacionCliente}`,
          llave
        );

        return newTransporte;
      },

      updateTransporte: (id, updated) => {
        const current = get().transportes.find((t) => t.id === id);
        if (!current || isLlaveCerrada(current)) return;

        if (isSupabaseConfigured) updateTransporteRemote(id, updated).catch(console.error);
        set((s) => ({
          transportes: s.transportes.map((t) => (t.id === id ? { ...t, ...updated } : t)),
        }));
        const row = get().transportes.find((t) => t.id === id);
        useAuthStore.getState().addMovimiento(
          'EDITAR_TRANSPORTE',
          'planeacion',
          `Actualización de ${row?.placa || id} · ${row?.llave || ''}`,
          row?.llave
        );
      },

      updateEstadoDespacho: (id, estado) => {
        const current = get().transportes.find((t) => t.id === id);
        if (!current || isLlaveCerrada(current)) return;

        if (isSupabaseConfigured) updateTransporteRemote(id, { estadoDespacho: estado }).catch(console.error);
        set((s) => ({
          transportes: s.transportes.map((t) => (t.id === id ? { ...t, estadoDespacho: estado } : t)),
        }));
        const row = get().transportes.find((t) => t.id === id);
        useAuthStore.getState().addMovimiento(
          'CAMBIO_ESTADO_DESPACHO',
          'despachos',
          `Estado despacho de ${row?.llave || id} → ${estado}`,
          row?.llave
        );
      },

      updatePorteriaHora: (id, campo, hora) => {
        const row = get().transportes.find((t) => t.id === id);
        if (!row || isLlaveCerrada(row)) return;

        const estadoByCampo: Record<PorteriaTimeField, EstadoPorteria> = {
          horaLlegadaPorteria: 'LLEGO A PORTERIA',
          horaIngreso: 'INGRESO A MUELLE',
          horaInicioCargue: 'CARGANDO',
          horaFinCargue: 'FINALIZO CARGUE',
          horaSalida: 'SALIO DE PORTERIA',
        };
        const patch = { [campo]: hora, estadoPorteria: estadoByCampo[campo] } as Partial<UnifiedTransporte>;

        if (isSupabaseConfigured) updateTransporteRemote(id, patch).catch(console.error);
        set((s) => ({
          transportes: s.transportes.map((t) => (t.id === id ? { ...t, ...patch } : t)),
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
        if (!row || isLlaveCerrada(row)) return;

        if (isSupabaseConfigured) updateTransporteRemote(id, { muelleAsignado: muelle }).catch(console.error);
        set((s) => ({
          transportes: s.transportes.map((t) => (t.id === id ? { ...t, muelleAsignado: muelle } : t)),
        }));
        useAuthStore.getState().addMovimiento(
          'ASIGNAR_MUELLE',
          'personal',
          `Muelle ${muelle} asignado a ${row.llave} (${row.placa || ''})`,
          row.llave
        );
      },

      deleteTransporte: (id) => {
        const row = get().transportes.find((t) => t.id === id);
        if (!row || isLlaveCerrada(row)) return;

        if (isSupabaseConfigured) deleteTransporteRemote(id).catch(console.error);
        set((s) => ({
          transportes: s.transportes.filter((t) => t.id !== id),
        }));
        useAuthStore.getState().addMovimiento(
          'ELIMINAR_TRANSPORTE',
          'planeacion',
          `Eliminación de ${row?.placa || id} · ${row?.llave || ''}`,
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

        set((s) => ({ messages: [newMsg, ...s.messages] }));

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

      getKPIs: () => {
        const { transportes } = get();
        const total = transportes.length;
        const cerradas = transportes.filter((t) => getEstadoPorteria(t) === 'SALIO DE PORTERIA').length;
        const cargasActivas = transportes.filter((t) => getEstadoPorteria(t) !== 'SALIO DE PORTERIA').length;
        const cumplimientoSLA = total > 0 ? Math.round((cerradas / total) * 100) : 100;
        const tiempoMuertoHoras = transportes.filter((t) => getEstadoPorteria(t) === 'Pendiente').length * 2.5;

        return { totalPedidos: total, cumplimientoSLA, tiempoMuertoHoras, cargasActivas };
      },

      getUnifiedTransportes: () => get().transportes,
}));
