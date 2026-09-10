import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { useLogisticsStore } from '../../store/useLogisticsStore';
import { useAuthStore } from '../../store/useAuthStore';
import { getEstadoPorteria } from '../../utils/porteria';
import type { UserSession } from '../../types';
import { ChatPanel } from './ChatPanel';

interface FloatingChatWidgetProps {
  isOpenExternal?: boolean;
  setIsOpenExternal?: (open: boolean) => void;
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
  const { currentUser, getActiveRole } = useAuthStore();

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
  const scrollRef = useRef<HTMLDivElement>(null);

  const role = currentUser?.roleName;
  const isAdmin = role === 'ADMIN';
  const isPortero = role === 'PORTERO';
  const isSupervisor = role === 'SUPERVISOR';
  // Solo ADMIN, PORTERÍA y SUPERVISOR usan los botones de solicitud/asignación de muelle.
  const canSolicitud = isPortero || isAdmin;
  const canConfirmar = isSupervisor || isAdmin;
  // Escribir mensajes de coordinación se habilita con el módulo CHAT en la matriz de permisos (ROLES).
  const activeRole = getActiveRole();
  const canWrite = Boolean(activeRole?.permissions['chat']?.canAccess) && !!currentUser;

  // Llaves aún en operación (estado diferente a SALIO DE PORTERIA).
  const activeLlaves = useMemo(
    () => transportes.filter((t) => getEstadoPorteria(t) !== 'SALIO DE PORTERIA'),
    [transportes],
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
    [activeLlaves, messages],
  );

  // Ajusta la llave seleccionada cuando cambia el conjunto disponible.
  useEffect(() => {
    if (selectorLlaves.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpieza intencional de selección
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
    if (row?.muelleAsignado) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sugerencia de muelle sincronizada con la selección
      setSuggestedDock(row.muelleAsignado);
    }
  }, [selectedLlave, activeLlaves]);

  const selectedTieneSolicitud = !!selectedLlave && tieneSolicitud(selectedLlave);
  const selectedTieneAsignacion = !!selectedLlave && tieneAsignacion(selectedLlave);
  const selectedCompletada = !!selectedLlave && llaveCompletada(selectedLlave);

  // Habilitación por rol + estado de la llave seleccionada:
  // - Chat de coordinación (escribir mensajes): habilitado si el rol tiene el módulo CHAT activado en ROLES.
  // - Botones "+ Solicitud Muelle": PORTERÍA y ADMIN. "+ Confirmar Muelle": SUPERVISOR y ADMIN.
  const textEnabled = canWrite;
  const llaveSelectEnabled = canWrite && !isSupervisor;
  const muelleSelectEnabled = !!selectedLlave && canWrite && !isPortero;
  const solicitudEnabled =
    !!selectedLlave && canSolicitud && !(selectedTieneSolicitud || selectedCompletada);
  const confirmarEnabled =
    !!selectedLlave && canConfirmar && !(selectedTieneAsignacion || selectedCompletada);

  let banner: string | null = null;
  if (!canSend) {
    banner = 'Chat deshabilitado: todas las llaves están en SALIO DE PORTERIA.';
  } else if (!canWrite) {
    banner = 'Chat deshabilitado para tu rol. Actívalo en la matriz de permisos (ROLES).';
  } else if (isPortero && selectorLlaves.length === 0) {
    banner = 'Todas las llaves activas ya tienen solicitud y muelle asignado.';
  } else if (isPortero && selectedTieneSolicitud) {
    banner = `Llave ${selectedLlave} ya tiene solicitud de muelle en espera de asignación.`;
  } else if (isSupervisor && selectedTieneAsignacion) {
    banner = `Llave ${selectedLlave} ya tiene muelle asignado.`;
  }

  // WhatsApp-style: los mensajes nuevos quedan abajo y el chat baja automáticamente al último.
  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

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

      <div className="fixed bottom-1 right-5 z-50 flex flex-col items-end pointer-events-none">
        {/* Expanded Floating Messenger Window */}
        {isOpen && (
          <ChatPanel
            messages={messages}
            banner={banner}
            selectedLlave={selectedLlave}
            selectorLlaves={selectorLlaves}
            suggestedDock={suggestedDock}
            canSend={canSend}
            llaveSelectEnabled={llaveSelectEnabled}
            muelleSelectEnabled={muelleSelectEnabled}
            textEnabled={textEnabled}
            solicitudEnabled={solicitudEnabled}
            confirmarEnabled={confirmarEnabled}
            inputText={inputText}
            scrollRef={scrollRef}
            onToggleOpen={toggleOpen}
            onClaveChange={setSelectedLlave}
            onMuelleChange={setSuggestedDock}
            onSolicitudMuelle={handleSolicitudMuelle}
            onConfirmarMuelle={handleConfirmarMuelle}
            onInputChange={setInputText}
            onSend={handleSend}
          />
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
