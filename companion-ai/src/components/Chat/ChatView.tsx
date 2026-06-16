import React, { useRef, useEffect } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { openSettingsWindow } from '../../services/tauriBridge';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';

const ChatView: React.FC = () => {
  const { messages, isLoading, send } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSettings = async () => {
    await openSettingsWindow();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <div
        style={{
          padding: '14px 16px',
          background: 'var(--bg-primary)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <img
          src="/ashin.jpg"
          alt="AI"
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            objectFit: 'cover',
          }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 14 }}>
            Companion AI
          </div>
        </div>
        <div
          onClick={handleSettings}
          style={{
            color: 'var(--text-secondary)',
            fontSize: 18,
            cursor: 'pointer',
          }}
        >
          ⚙
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          padding: '16px',
          overflowY: 'auto',
          background: 'var(--bg-primary)',
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--text-muted)',
              marginTop: '30vh',
              fontSize: 14,
            }}
          >
            开始对话吧~
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isLoading && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'flex-start' }}>
            <img
              src="/ashin.jpg"
              alt="AI"
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                flexShrink: 0,
                objectFit: 'cover',
              }}
            />
            <div
              style={{
                background: 'var(--bg-bubble-assistant)',
                borderRadius: '2px 14px 14px 14px',
                padding: '10px 14px',
                color: 'var(--text-secondary)',
                fontSize: 13,
              }}
            >
              思考中...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <MessageInput onSend={send} disabled={isLoading} />
    </div>
  );
};

export default ChatView;
