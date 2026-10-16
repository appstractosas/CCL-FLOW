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
  const scrollRef = useRef<HTMLDivElement>(null);

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

  const textEnabled = canWrite;

  let banner: string | null = null;
  if (!canSend) {
    banner = 'Chat deshabilitado: todas las llaves están en SALIO DE PORTERIA.';
  } else if (!canWrite) {
    banner = 'Chat deshabilitado para tu rol. Actívalo en la matriz de permisos (ROLES).';
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
      content: inputText,
    });

    setInputText('');
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
            canSend={canSend}
            textEnabled={textEnabled}
            inputText={inputText}
            scrollRef={scrollRef}
            onToggleOpen={toggleOpen}
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
