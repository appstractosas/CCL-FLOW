import React from 'react';
import { formatTimestamp } from '../../lib/dateUtils';
import type { ChatMessage } from '../../types';

/** Burbuja de un mensaje del chat estilo WhatsApp (portería a la izquierda, el resto a la derecha). */
export const ChatBubble: React.FC<{ msg: ChatMessage }> = ({ msg }) => {
  const isPorteroMsg = msg.senderModule === 'Portería';

  return (
    <div className={`flex flex-col max-w-[85%] ${isPorteroMsg ? 'mr-auto items-start' : 'ml-auto items-end'}`}>
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
};