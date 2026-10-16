import React from 'react';
import { Minimize2, Send } from 'lucide-react';
import { ChatBubble } from './ChatBubble';
import type { ChatMessage } from '../../types';

interface ChatPanelProps {
  messages: ChatMessage[];
  banner: string | null;
  canSend: boolean;
  textEnabled: boolean;
  inputText: string;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onToggleOpen: () => void;
  onInputChange: (v: string) => void;
  onSend: (e?: React.FormEvent) => void;
}

/** Ventana expandida del chat operativo optimizada: mensajes e input. */
export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  banner,
  canSend,
  textEnabled,
  inputText,
  scrollRef,
  onToggleOpen,
  onInputChange,
  onSend,
}) => {
  return (
    <div className="relative pointer-events-auto bg-[#121726] rounded-2xl shadow-2xl border border-zinc-800 w-80 sm:w-96 h-[460px] flex flex-col mb-3 overflow-hidden animate-in slide-in-from-bottom-5 duration-200">
      {/* Botón discreto de minimizar en esquina superior */}
      <button
        onClick={onToggleOpen}
        aria-label="Minimizar chat"
        className="absolute top-2.5 right-2.5 z-10 p-1.5 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors border border-zinc-700/50 backdrop-blur-xs"
      >
        <Minimize2 className="w-3.5 h-3.5" />
      </button>

      {banner && (
        <div className="bg-rose-500/10 border-b border-rose-500/20 px-3 py-1.5 text-[10px] text-rose-400 font-semibold pr-10">
          {banner}
        </div>
      )}

      {/* Messages Body */}
      <div ref={scrollRef} className="flex-1 p-3 overflow-y-auto space-y-3 bg-[#080b13] text-xs pt-3">
        {messages.map((msg) => (
          <ChatBubble key={msg.id} msg={msg} />
        ))}
      </div>

      {/* Input Form */}
      <form
        onSubmit={onSend}
        className="p-2.5 bg-[#121726] border-t border-zinc-800 flex items-center space-x-2"
      >
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
