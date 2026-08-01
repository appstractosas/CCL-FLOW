import React, { useState } from 'react';
import { 
  MessageSquare, 
  X, 
  Minimize2, 
  Maximize2, 
  Send, 
  ShieldCheck, 
  Package, 
  CornerDownRight, 
  Sparkles,
  CheckCheck
} from 'lucide-react';
import { useLogisticsStore } from '../../store/useLogisticsStore';
import { useAuthStore } from '../../store/useAuthStore';

interface FloatingChatWidgetProps {
  isOpenExternal?: boolean;
  setIsOpenExternal?: (open: boolean) => void;
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
  const [selectedLlave, setSelectedLlave] = useState<string>('LL-60533');
  const [suggestedDock, setSuggestedDock] = useState<string>('Muelle 4');

  const toggleOpen = () => {
    if (!isOpen) {
      markChatRead();
    }
    setIsOpen(!isOpen);
  };

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    const senderModule: 'Portería' | 'Despachos' | 'Planeación' | 'General' =
      currentUser.roleName === 'PORTERO'
        ? 'Portería'
        : currentUser.roleName === 'DESPACHADOR'
        ? 'Despachos'
        : currentUser.roleName === 'PLANEADOR'
        ? 'Planeación'
        : 'General';

    sendMessage({
      senderRole: currentUser.roleName,
      senderName: `${currentUser.name} (${senderModule})`,
      senderModule,
      llaveRelacionada: selectedLlave,
      muelleSugerido: suggestedDock,
      content: inputText,
    });

    setInputText('');
  };

  const sendQuickPreset = (presetText: string) => {
    const senderModule: 'Portería' | 'Despachos' | 'Planeación' | 'General' =
      currentUser.roleName === 'PORTERO' ? 'Portería'
      : currentUser.roleName === 'DESPACHADOR' ? 'Despachos'
      : currentUser.roleName === 'PLANEADOR' ? 'Planeación'
      : 'General';

    sendMessage({
      senderRole: currentUser.roleName,
      senderName: `${currentUser.name} (${senderModule})`,
      senderModule,
      llaveRelacionada: selectedLlave,
      muelleSugerido: suggestedDock,
      content: presetText,
    });
  };

  return (
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

          {/* Context Selector Bar for LLAVE & Muelle */}
          <div className="bg-zinc-900/80 border-b border-zinc-800 p-2 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center space-x-1">
              <span className="text-zinc-400 text-[10px] font-bold">LLAVE:</span>
              <select
                value={selectedLlave}
                onChange={(e) => setSelectedLlave(e.target.value)}
                className="bg-zinc-900 text-zinc-100 border border-zinc-700 rounded font-mono font-bold text-[11px] px-1 py-0.5"
              >
                {transportes.map((d) => (
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
                className="bg-zinc-900 text-zinc-100 border border-zinc-700 rounded font-bold text-[11px] px-1 py-0.5"
              >
                <option value="Muelle 1">Muelle 1</option>
                <option value="Muelle 2">Muelle 2</option>
                <option value="Muelle 3">Muelle 3</option>
                <option value="Muelle 4">Muelle 4</option>
                <option value="Muelle 5">Muelle 5</option>
              </select>
            </div>
          </div>

          {/* Quick Presets Ribbon */}
          <div className="bg-zinc-900 px-2 py-1.5 border-b border-zinc-800 flex gap-1 overflow-x-auto no-scrollbar text-[10px]">
            <button
              onClick={() => sendQuickPreset(`Asignar ${suggestedDock} para la LLAVE ${selectedLlave}. Carga en alistamiento.`)}
              className="bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-600/20 px-2 py-1 rounded font-semibold whitespace-nowrap shadow-2xs"
            >
              + Solicitud Muelle {selectedLlave}
            </button>
            <button
              onClick={() => sendQuickPreset(`Confirmado ingreso de vehículo ${selectedLlave} en ${suggestedDock}.`)}
              className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded font-semibold whitespace-nowrap shadow-2xs"
            >
              + Confirmar Muelle
            </button>
          </div>

          {/* Messages Body */}
          <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-[#080b13] text-xs">
            {messages.map((msg) => {
              const isPortero = msg.senderModule === 'Portería';

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col max-w-[85%] ${
                    isPortero ? 'mr-auto items-start' : 'ml-auto items-end'
                  }`}
                >
                  <div className="flex items-center space-x-1 text-[10px] text-zinc-400 mb-0.5">
                    <span className="font-bold text-zinc-200">{msg.senderName}</span>
                    <span>• {msg.timestamp}</span>
                  </div>

                  <div
                    className={`p-2.5 rounded-2xl shadow-2xs ${
                      isPortero
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
              className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-xl transition-all shadow-sm"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Floating Launcher Button */}
      <button
        onClick={toggleOpen}
        className="pointer-events-auto bg-blue-600 hover:bg-blue-500 text-white p-3.5 rounded-2xl shadow-xl flex items-center space-x-2 transition-all transform active:scale-95 border border-blue-400/30"
      >
        <MessageSquare className="w-5 h-5" />
        <span className="text-xs font-bold hidden sm:inline">Chat Operativo</span>
        {unreadChatCount > 0 && !isOpen && (
          <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-bounce">
            {unreadChatCount}
          </span>
        )}
      </button>
    </div>
  );
};
