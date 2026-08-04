import React, { useEffect, useMemo, useState } from 'react';
import {
  MessageSquare,
  Minimize2,
  Send,
} from 'lucide-react';
import { useLogisticsStore } from '../../store/useLogisticsStore';
import { useAuthStore } from '../../store/useAuthStore';
import { getEstadoPorteria } from '../../utils/porteria';
import type { UserSession } from '../../types';

interface FloatingChatWidgetProps {
  isOpenExternal?: boolean;
  setIsOpenExternal?: (open: boolean) => void;
}

const MUELLES = Array.from({ length: 12 }, (_, i) => `Muelle ${i + 1}`);

function formatTimestamp(ts?: string): string {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function senderModuleFor(user: UserSession): 'Portería' | 'Despachos' | 'Planeación' | 'General' {
  if (user.roleName === 'PORTERO') return 'Portería';
  if (user.roleName === 'DESPACHADOR') return 'Despachos';
  if (user.roleName === 'PLANEADOR') return 'Planeación';
  return 'General';
}

export const FloatingChatWidget: React.FC<FloatingChatWidgetProps> = ({
  isOpenExternal,
  setIsOpenExternal,
}) => {
  const { messages, unreadChatCount, sendMessage, markChatRead, transportes } = useLogisticsStore();
  const { currentUser } = useAuthStore();

  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = isOpenExternal !== undefined ? isOpenExternal : internalIsOpen;

  const setIsOpen = (val: boolean) => {
    if (setIsOpenExternal) {
      setIsOpenExternal(val);
    } else {
      setInternalIsOpen(val);
    }
  };

  const [inputText, setInputText] = useState('');
  const [selectedLlave, setSelectedLlave] = useState<string>('');
  const [suggestedDock, setSuggestedDock] = useState<string>('Muelle 1');

  const role = currentUser?.roleName;
  const isPortero = role === 'PORTERO';
  const isSupervisor = role === 'SUPERVISOR';
  // DESPACHOS, PLANEACIÓN y MONITOREO: chat en solo lectura.
  const isReadOnly = role === 'DESPACHADOR' || role === 'PLANEADOR' || role === 'MONITOREO';
  const canInteract = !isReadOnly;

  // Llaves aún en operación (estado diferente a SALIO DE PORTERIA).
  const activeLlaves = useMemo(
    () => transportes.filter((t) => getEstadoPorteria(t) !== 'SALIO DE PORTERIA'),
    [transportes]
  );
  // Si no hay ninguna llave activa, el chat queda deshabilitado por completo.
  const canSend = activeLlaves.length > 0;

  const tieneSolicitud = (llave: string) =>
    messages.some((m) => m.llaveRelacionada === llave && m.content.includes('Solicitud de muelle'));
  const tieneAsignacion = (llave: string) =>
    messages.some((m) => m.llaveRelacionada === llave && m.content.includes('Confirmado ingreso'));
  const llaveCompletada = (llave: string) => tieneSolicitud(llave) && tieneAsignacion(llave);

  // Una llave que ya completó el flujo (solicitud de muelle + asignación de muelle)
  // queda INACTIVA para TODOS los módulos: no aparece en el selector de llaves.
  const selectorLlaves = useMemo(
    () => activeLlaves.filter((t) => !llaveCompletada(t.llave)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeLlaves, messages]
  );

  // Ajusta la llave seleccionada cuando cambia el conjunto disponible.
  useEffect(() => {
    if (selectorLlaves.length === 0) {
      setSelectedLlave('');
      return;
    }
    if (!selectorLlaves.some((t) => t.llave === selectedLlave)) {
      setSelectedLlave(selectorLlaves[0].llave);
    }
  }, [selectorLlaves, selectedLlave]);

  // Sugiere el muelle asignado de la llave seleccionada.
  useEffect(() => {
    const row = activeLlaves.find((t) => t.llave === selectedLlave);
    if (row?.muelleAsignado) setSuggestedDock(row.muelleAsignado);
  }, [selectedLlave, activeLlaves]);

  const selectedTieneSolicitud = !!selectedLlave && tieneSolicitud(selectedLlave);
  const selectedTieneAsignacion = !!selectedLlave && tieneAsignacion(selectedLlave);
  const selectedCompletada = !!selectedLlave && llaveCompletada(selectedLlave);

  // Habilitación por rol + estado de la llave seleccionada:
  // - PORTERÍA: lista de llaves + "+ Solicitud Muelle" (agrega el n° de llave al chat).
  // - SUPERVISOR: "+ Confirmar Muelle" + lista de muelles. Lo demás deshabilitado.
  // - DESPACHADOR/PLANEADOR/MONITOREO: chat en solo lectura.
  // - ADMIN: todo habilitado.
  const textEnabled = canInteract && role === 'ADMIN';
  const llaveSelectEnabled = canInteract && !isSupervisor;
  const muelleSelectEnabled = !!selectedLlave && canInteract && !isPortero;
  const solicitudEnabled =
    !!selectedLlave &&
    canInteract &&
    !isSupervisor &&
    !(selectedTieneSolicitud || selectedCompletada);
  const confirmarEnabled =
    !!selectedLlave &&
    canInteract &&
    !isPortero &&
    !(selectedTieneAsignacion || selectedCompletada);

  let banner: string | null = null;
  if (!canSend) {
    banner = 'Chat deshabilitado: todas las llaves están en SALIO DE PORTERIA.';
  } else if (isReadOnly) {
    banner = 'Chat en solo lectura para tu rol.';
  } else if (selectorLlaves.length === 0) {
    banner = 'Todas las llaves activas ya tienen solicitud y muelle asignado.';
  } else if (selectedTieneSolicitud) {
    banner = `Llave ${selectedLlave} ya tiene solicitud de muelle en espera de asignación.`;
  } else if (selectedTieneAsignacion) {
    banner = `Llave ${selectedLlave} ya tiene muelle asignado.`;
  }

  const toggleOpen = () => {
    if (!isOpen) {
      markChatRead();
    }
    setIsOpen(!isOpen);
  };

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canSend || !currentUser || !textEnabled) return;
    if (!inputText.trim()) return;

    const senderModule = senderModuleFor(currentUser);
    sendMessage({
      senderRole: currentUser.roleName,
      senderName: `${currentUser.name} (${senderModule})`,
      senderModule,
      llaveRelacionada: selectedLlave || undefined,
      muelleSugerido: suggestedDock,
      content: inputText,
    });

    setInputText('');
  };

  const handleSolicitudMuelle = () => {
    if (!canSend || !currentUser || !solicitudEnabled || !selectedLlave) return;
    const senderModule = senderModuleFor(currentUser);
    sendMessage({
      senderRole: currentUser.roleName,
      senderName: `${currentUser.name} (${senderModule})`,
      senderModule,
      llaveRelacionada: selectedLlave,
      muelleSugerido: undefined,
      content: `Solicitud de muelle para la LLAVE ${selectedLlave}.`,
    });
  };

  const handleConfirmarMuelle = () => {
    if (!canSend || !currentUser || !confirmarEnabled || !selectedLlave) return;
    const senderModule = senderModuleFor(currentUser);
    sendMessage({
      senderRole: currentUser.roleName,
      senderName: `${currentUser.name} (${senderModule})`,
      senderModule,
      llaveRelacionada: selectedLlave,
      muelleSugerido: suggestedDock,
      content: `Confirmado ingreso del vehículo ${selectedLlave} en ${suggestedDock}.`,
    });
  };

  const muelleOptions = suggestedDock && !MUELLES.includes(suggestedDock)
    ? [suggestedDock, ...MUELLES]
    : MUELLES;

  return (
    <>
      {/* Fondo invisible: un clic fuera del chat lo cierra sin guardar el borrador. */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setInputText('');
            setIsOpen(false);
          }}
        />
      )}

      <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end pointer-events-none">
      {/* Expanded Floating Messenger Window */}
      {isOpen && (
        <div className="pointer-events-auto bg-[#121726] rounded-2xl shadow-2xl border border-zinc-800 w-80 sm:w-96 h-[460px] flex flex-col mb-3 overflow-hidden animate-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="bg-[#0b0f19] text-white p-3.5 flex items-center justify-between border-b border-zinc-800">
            <div className="flex items-center space-x-2">
              <div className="bg-blue-600/20 p-1.5 rounded-lg border border-blue-500/30">
                <MessageSquare className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Chat Operativo Muelle & Portería</h4>
                <p className="text-[10px] text-zinc-400">Coordinación en vivo (Supabase Realtime)</p>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              <button
                onClick={toggleOpen}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {banner && (
            <div className="bg-rose-500/10 border-b border-rose-500/20 px-3 py-1.5 text-[10px] text-rose-400 font-semibold">
              {banner}
            </div>
          )}

          {/* Context Selector Bar for LLAVE & Muelle */}
          <div className="bg-zinc-900/80 border-b border-zinc-800 p-2 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center space-x-1">
              <span className="text-zinc-400 text-[10px] font-bold">LLAVE:</span>
              <select
                value={selectedLlave}
                onChange={(e) => setSelectedLlave(e.target.value)}
                disabled={!canSend || !llaveSelectEnabled}
                className="bg-zinc-900 text-zinc-100 border border-zinc-700 rounded font-mono font-bold text-[11px] px-1 py-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {selectorLlaves.map((d) => (
                  <option key={d.id} value={d.llave}>
                    {d.llave} ({d.placa})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-1">
              <span className="text-zinc-400 text-[10px] font-bold">Muelle:</span>
              <select
                value={suggestedDock}
                onChange={(e) => setSuggestedDock(e.target.value)}
                disabled={!canSend || !muelleSelectEnabled}
                className="bg-zinc-900 text-zinc-100 border border-zinc-700 rounded font-bold text-[11px] px-1 py-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {muelleOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Presets Ribbon */}
          <div className="bg-zinc-900 px-2 py-1.5 border-b border-zinc-800 flex gap-1 overflow-x-auto no-scrollbar text-[10px]">
            <button
              onClick={handleSolicitudMuelle}
              disabled={!canSend || !solicitudEnabled}
              className="bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-600/20 px-2 py-1 rounded font-semibold whitespace-nowrap shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-600/10"
            >
              + Solicitud Muelle {selectedLlave}
            </button>
            <button
              onClick={handleConfirmarMuelle}
              disabled={!canSend || !confirmarEnabled}
              className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded font-semibold whitespace-nowrap shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-emerald-500/10"
            >
              + Confirmar Muelle
            </button>
          </div>

          {/* Messages Body */}
          <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-[#080b13] text-xs">
            {messages.map((msg) => {
              const isPorteroMsg = msg.senderModule === 'Portería';

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col max-w-[85%] ${
                    isPorteroMsg ? 'mr-auto items-start' : 'ml-auto items-end'
                  }`}
                >
                  <div className="flex items-center space-x-1 text-[10px] text-zinc-400 mb-0.5">
                    <span className="font-bold text-zinc-200">{msg.senderName}</span>
                    <span>• {formatTimestamp(msg.timestamp)}</span>
                  </div>

                  <div
                    className={`p-2.5 rounded-2xl shadow-2xs ${
                      isPorteroMsg
                        ? 'bg-emerald-700 text-white rounded-tl-xs'
                        : 'bg-blue-600 text-white rounded-tr-xs'
                    }`}
                  >
                    {msg.llaveRelacionada && (
                      <div className="text-[10px] bg-black/30 font-mono px-1.5 py-0.5 rounded font-bold mb-1 inline-block">
                        {msg.llaveRelacionada} {msg.muelleSugerido && `(${msg.muelleSugerido})`}
                      </div>
                    )}
                    <p className="leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Input Form */}
          <form onSubmit={handleSend} className="p-2.5 bg-[#121726] border-t border-zinc-800 flex items-center space-x-2">
            <input
              type="text"
              placeholder="Escribe un mensaje de coordinación..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={!canSend || !textEnabled}
              className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:ring-2 focus:ring-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={!canSend || !textEnabled || !inputText.trim()}
              className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-xl transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Floating Launcher Button */}
      <button
        onClick={toggleOpen}
        className="pointer-events-auto bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-xl shadow-xl flex items-center space-x-1.5 transition-all transform active:scale-95 border border-blue-400/30"
      >
        <MessageSquare className="w-2.5 h-2.5" />
        <span className="text-[10px] font-bold hidden sm:inline">Chat Operativo</span>
        {unreadChatCount > 0 && !isOpen && (
          <span className="bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-bounce">
            {unreadChatCount}
          </span>
        )}
      </button>
    </div>
    </>
  );
};
