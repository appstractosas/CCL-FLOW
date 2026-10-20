import React, { createRef } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ChatBubble } from '../components/chat/ChatBubble';
import { ChatPanel } from '../components/chat/ChatPanel';
import type { ChatMessage } from '../types';

const porteriaMsg: ChatMessage = {
  id: 'C-1',
  senderRole: 'portero',
  senderName: 'Ramiro (Portería)',
  senderModule: 'Portería',
  llaveRelacionada: 'LL-60533',
  muelleSugerido: 'Muelle 3',
  content: 'Solicitud de muelle para la LLAVE LL-60533.',
  timestamp: '2026-08-13T10:00:00Z',
  isRead: false,
};

const operMsg: ChatMessage = {
  id: 'C-2',
  senderRole: 'despachador',
  senderName: 'Juan (Despachos)',
  senderModule: 'Despachos',
  content: 'Confirmado',
  timestamp: '2026-08-13T10:05:00Z',
  isRead: true,
};

describe('ChatBubble', () => {
  it('renderiza un mensaje de portería con llave y muelle referenciados', () => {
    render(<ChatBubble msg={porteriaMsg} />);
    expect(screen.getByText(/Ramiro/)).toBeInTheDocument();
    expect(screen.getByText(/Solicitud de muelle para la LLAVE LL-60533/)).toBeInTheDocument();
    expect(screen.getAllByText(/LL-60533/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Muelle 3/)).toBeInTheDocument();
  });

  it('renderiza un mensaje de operador que no es portería', () => {
    render(<ChatBubble msg={operMsg} />);
    expect(screen.getByText(/Juan/)).toBeInTheDocument();
    expect(screen.getByText('Confirmado')).toBeInTheDocument();
  });
});

describe('ChatPanel', () => {
  const scrollRef = createRef<HTMLDivElement>();

  it('renderiza mensajes, botón de minimizar, input de texto y dispara acciones', () => {
    const onSend = vi.fn((e?: React.FormEvent) => e?.preventDefault());
    const onToggleOpen = vi.fn();
    const onInputChange = vi.fn();

    render(
      <ChatPanel
        messages={[porteriaMsg, operMsg]}
        banner={null}
        canSend
        textEnabled
        inputText="Hola equipo"
        scrollRef={scrollRef}
        onToggleOpen={onToggleOpen}
        onInputChange={onInputChange}
        onSend={onSend}
      />,
    );

    expect(screen.getByText(/Ramiro/)).toBeInTheDocument();
    expect(screen.getByText('Confirmado')).toBeInTheDocument();
    expect(screen.getByLabelText('Minimizar chat')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Escribe un mensaje de coordinación...'),
    ).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: '' });
    fireEvent.click(submitBtn);
    expect(onSend).toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Minimizar chat'));
    expect(onToggleOpen).toHaveBeenCalled();
  });

  it('muestra el banner cuando se provee', () => {
    render(
      <ChatPanel
        messages={[]}
        banner="Chat deshabilitado para tu rol."
        canSend={false}
        textEnabled={false}
        inputText=""
        scrollRef={scrollRef}
        onToggleOpen={() => {}}
        onInputChange={() => {}}
        onSend={() => {}}
      />,
    );
    expect(screen.getByText('Chat deshabilitado para tu rol.')).toBeInTheDocument();
  });
});
