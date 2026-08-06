import { create } from 'zustand';
import {
  UnifiedTransporte,
  TransporteData,
  ChatMessage,
  KPIStats,
  EstadoPorteria,
  PorteriaTimeField,
} from '../types';
import {
  fetchTransportes, createTransporte, updateTransporte as updateTransporteRemote,
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
  transportes: UnifiedTransporte[];
  messages: ChatMessage[];
  unreadChatCount: number;

  initialize: () => Promise<void>;
  addTransporte: (data: TransporteData & { llave?: string }) => Promise<UnifiedTransporte>;
  updateTransporte: (id: string, updated: Partial<UnifiedTransporte>) => void;
  updatePorteriaHora: (id: string, campo: PorteriaTimeField, hora: string) => void;
  updateMuelleAsignado: (id: string, muelle: string) => void;
  updateMuelleHora: (id: string, hora: string) => void;
  updateCuadrilla: (id: string, cuadrilla: string) => void;
  cancelTransporte: (id: string) => void;
  sendMessage: (msg: { senderRole: string; senderName: string; senderModule: 'Portería' | 'Despachos' | 'Planeación' | 'General'; content: string; llaveRelacionada?: string; muelleSugerido?: string }) => void;
  markChatRead: () => void;
  getKPIs: () => KPIStats;
  getUnifiedTransportes: () => UnifiedTransporte[];
}

let unsubscribeRealtime: (() => void) | null = null;

function nowHHMM(): string {
  return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export const useLogisticsStore = create<LogisticsState>()((set, get) => ({
  initialized: false,
  loading: true,
  demoMode: !isSupabaseConfigured,
  nextLlaveSeq: 60538,
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

      // El contador de LLAVE se deriva de la BD (ya no se persiste en el navegador).
      const nextLlaveSeq = transportes.reduce((acc, t) => {
        const n = parseInt(String(t.llave).replace('LL-', ''), 10);
        return Number.isFinite(n) ? Math.max(acc, n) : acc;
      }, 0) + 1;

      set({
        transportes,
        messages,
        unreadChatCount: unreadCount,
        nextLlaveSeq,
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
        } catch (err) {
          console.error('Error loading data from Supabase:', err);
          set({ loading: false, initialized: true, demoMode: true });
        }
      },

      addTransporte: async (data) => {
        const state = get();
        const llave = data.llave?.trim() || `LL-${state.nextLlaveSeq}`;

        // No permitir llaves duplicadas.
        if (state.transportes.some((t) => t.llave === llave)) {
          throw new Error(`La llave ${llave} ya existe. Usa otra o guárdala con otro número.`);
        }

        const fechaHora = data.fechaHora || data.citaCargue || new Date().toISOString().replace('T', ' ').substring(0, 16);
        const placa = (data.placa || '').toUpperCase().trim();

        const newTransporte: UnifiedTransporte = {
          id: `TR-${Date.now()}`,
          llave,
          fechaHora,
          placa,
          vehiculoTipo: data.vehiculoTipo || 'SENCILLO',
          citaCargue: data.citaCargue || fechaHora,
          transportadora: data.transportadora || '',
          estadoTransporte: data.estadoTransporte || 'ALISTADO',
          // Placa opcional: sin placa → PENDIENTE; con placa → CONFIRMADO.
          estadoPorteria: placa ? 'Confirmado' : 'Pendiente',
          muelleAsignado: data.muelleAsignado || '',
          cuadrilla: data.cuadrilla || '',
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
          transportes: [{ ...newTransporte, id: savedId || newTransporte.id }, ...s.transportes],
        }));

        useAuthStore.getState().addMovimiento(
          'CREAR_TRANSPORTE',
          'planeacion',
          `${newTransporte.placa || 'SIN PLACA'} · ${llave}`,
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

        const patch: Partial<UnifiedTransporte> = { muelleAsignado: muelle };
        // Al asignar un muelle distinto de MUELLE CERO se carga automáticamente
        // la H. Asignación Muelle (editable después, como las horas de portería).
        const esMuelleCero = (muelle || '').toUpperCase() === 'MUELLE CERO';
        if (muelle && !esMuelleCero) {
          patch.horaMuelleAsignado = nowHHMM();
        }

        if (isSupabaseConfigured) updateTransporteRemote(id, patch).catch(console.error);
        set((s) => ({
          transportes: s.transportes.map((t) => (t.id === id ? { ...t, ...patch } : t)),
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
        if (!row || isLlaveCerrada(row)) return;

        if (isSupabaseConfigured) updateTransporteRemote(id, { horaMuelleAsignado: hora }).catch(console.error);
        set((s) => ({
          transportes: s.transportes.map((t) => (t.id === id ? { ...t, horaMuelleAsignado: hora } : t)),
        }));
      },

      updateCuadrilla: (id, cuadrilla) => {
        const row = get().transportes.find((t) => t.id === id);
        if (!row || isLlaveCerrada(row)) return;

        if (isSupabaseConfigured) updateTransporteRemote(id, { cuadrilla }).catch(console.error);
        set((s) => ({
          transportes: s.transportes.map((t) => (t.id === id ? { ...t, cuadrilla } : t)),
        }));
        useAuthStore.getState().addMovimiento(
          'ASIGNAR_CUADRILLA',
          'despachos',
          `Cuadrilla ${cuadrilla || '—'} asignada a ${row.llave}`,
          row.llave
        );
      },

      cancelTransporte: (id) => {
        const row = get().transportes.find((t) => t.id === id);
        if (!row || isLlaveCerrada(row)) return;

        // El PLANEADOR solo puede cancelar llaves en PENDIENTE o CONFIRMADO;
        // en estados posteriores únicamente las edita. El ADMIN cancela en cualquier estado.
        const currentUser = useAuthStore.getState().currentUser;
        const estado = getEstadoPorteria(row);
        const esAdmin = useAuthStore.getState().isAdmin();
        if (!esAdmin && currentUser?.roleName === 'PLANEADOR' && estado !== 'Pendiente' && estado !== 'Confirmado') {
          return;
        }

        // No se elimina el vehículo: queda con estado CANCELADO y sin editar.
        const patch: Partial<UnifiedTransporte> = { estadoPorteria: 'CANCELADO' as EstadoPorteria };
        if (isSupabaseConfigured) updateTransporteRemote(id, patch).catch(console.error);
        set((s) => ({
          transportes: s.transportes.map((t) => (t.id === id ? { ...t, ...patch } : t)),
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
