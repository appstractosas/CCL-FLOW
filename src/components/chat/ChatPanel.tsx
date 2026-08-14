import React from 'react';
import { MessageSquare, Minimize2, Send } from 'lucide-react';
import { MUELLES } from '../../lib/muelles';
import { ChatBubble } from './ChatBubble';
import type { ChatMessage } from '../../types';

interface ChatPanelProps {
  messages: ChatMessage[];
  banner: string | null;
  selectedLlave: string;
  selectorLlaves: { id: string; llave: string; placa?: string }[];
  suggestedDock: string;
  canSend: boolean;
  llaveSelectEnabled: boolean;
  muelleSelectEnabled: boolean;
  textEnabled: boolean;
  solicitudEnabled: boolean;
  confirmarEnabled: boolean;
  inputText: string;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onToggleOpen: () => void;
  onClaveChange: (v: string) => void;
  onMuelleChange: (v: string) => void;
  onSolicitudMuelle: () => void;
  onConfirmarMuelle: () => void;
  onInputChange: (v: string) => void;
  onSend: (e?: React.FormEvent) => void;
}

/** Ventana expandida del chat operativo: contexto (llave/muelle), presets, mensajes e input. */
export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  banner,
  selectedLlave,
  selectorLlaves,
  suggestedDock,
  canSend,
  llaveSelectEnabled,
  muelleSelectEnabled,
  textEnabled,
  solicitudEnabled,
  confirmarEnabled,
  inputText,
  scrollRef,
  onToggleOpen,
  onClaveChange,
  onMuelleChange,
  onSolicitudMuelle,
  onConfirmarMuelle,
  onInputChange,
  onSend,
}) => {
  const muelleOptions = suggestedDock && !MUELLES.includes(suggestedDock)
    ? [suggestedDock, ...MUELLES]
    : MUELLES;

  return (
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
            onClick={onToggleOpen}
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
            onChange={(e) => onClaveChange(e.target.value)}
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
            onChange={(e) => onMuelleChange(e.target.value)}
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
          onClick={onSolicitudMuelle}
          disabled={!canSend || !solicitudEnabled}
          className="bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-600/20 px-2 py-1 rounded font-semibold whitespace-nowrap shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-600/10"
        >
          + Solicitud Muelle {selectedLlave}
        </button>
        <button
          onClick={onConfirmarMuelle}
          disabled={!canSend || !confirmarEnabled}
          className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded font-semibold whitespace-nowrap shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-emerald-500/10"
        >
          + Confirmar Muelle
        </button>
      </div>

      {/* Messages Body */}
      <div ref={scrollRef} className="flex-1 p-3 overflow-y-auto space-y-3 bg-[#080b13] text-xs">
        {messages.map((msg) => (
          <ChatBubble key={msg.id} msg={msg} />
        ))}
      </div>

      {/* Input Form */}
      <form onSubmit={onSend} className="p-2.5 bg-[#121726] border-t border-zinc-800 flex items-center space-x-2">
        <input
          type="text"
          placeholder="Escribe un mensaje de coordinación..."
          value={inputText}
          onChange={(e) => onInputChange(e.target.value)}
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
  );
};