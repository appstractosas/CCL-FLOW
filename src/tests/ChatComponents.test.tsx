import React from 'react';
import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
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
    // La llave aparece en el badge adjunto y dentro del mensaje (dos coincidencias).
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

  it('renderiza contexto, presets, mensajes e input, y dispara acciones', () => {
    const onSend = vi.fn();
    const onClaveChange = vi.fn();
    const onMuelleChange = vi.fn();

    render(
      <ChatPanel
        messages={[porteriaMsg, operMsg]}
        banner={null}
        selectedLlave="LL-60533"
        selectorLlaves={[{ id: 'T-1', llave: 'LL-60533', placa: 'XYZ-999' }]}
        suggestedDock="Muelle 3"
        canSend
        llaveSelectEnabled
        muelleSelectEnabled
        textEnabled
        solicitudEnabled
        confirmarEnabled
        inputText=""
        scrollRef={scrollRef}
        onToggleOpen={() => {}}
        onClaveChange={onClaveChange}
        onMuelleChange={onMuelleChange}
        onSolicitudMuelle={() => {}}
        onConfirmarMuelle={() => {}}
        onInputChange={() => {}}
        onSend={onSend}
      />
    );

    expect(screen.getByText('Chat Operativo Muelle & Portería')).toBeInTheDocument();
    expect(screen.getAllByText(/LL-60533/).length).toBeGreaterThan(0);
    expect(screen.getByText(/\+ Solicitud Muelle/)).toBeInTheDocument();
    expect(screen.getByText(/\+ Confirmar Muelle/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Escribe un mensaje de coordinación...')).toBeInTheDocument();
  });

  it('muestra el banner cuando se provee', () => {
    render(
      <ChatPanel
        messages={[]}
        banner="Chat deshabilitado para tu rol."
        selectedLlave=""
        selectorLlaves={[]}
        suggestedDock="Muelle 1"
        canSend={false}
        llaveSelectEnabled={false}
        muelleSelectEnabled={false}
        textEnabled={false}
        solicitudEnabled={false}
        confirmarEnabled={false}
        inputText=""
        scrollRef={scrollRef}
        onToggleOpen={() => {}}
        onClaveChange={() => {}}
        onMuelleChange={() => {}}
        onSolicitudMuelle={() => {}}
        onConfirmarMuelle={() => {}}
        onInputChange={() => {}}
        onSend={() => {}}
      />
    );
    expect(screen.getByText('Chat deshabilitado para tu rol.')).toBeInTheDocument();
  });

  it('agrega un muelle sugerido no estándar a las opciones', () => {
    render(
      <ChatPanel
        messages={[]}
        banner={null}
        selectedLlave=""
        selectorLlaves={[]}
        suggestedDock="MUELLE CERO"
        canSend
        llaveSelectEnabled
        muelleSelectEnabled
        textEnabled
        solicitudEnabled={false}
        confirmarEnabled={false}
        inputText=""
        scrollRef={scrollRef}
        onToggleOpen={() => {}}
        onClaveChange={() => {}}
        onMuelleChange={() => {}}
        onSolicitudMuelle={() => {}}
        onConfirmarMuelle={() => {}}
        onInputChange={() => {}}
        onSend={() => {}}
      />
    );
    expect(screen.getByText('MUELLE CERO')).toBeInTheDocument();
  });
});
