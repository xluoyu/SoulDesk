import React from 'react';
import type { ChatMessage } from '../../types';

interface Props {
  message: ChatMessage;
  isStreaming?: boolean;
  avatarUrl?: string;
}

const MessageBubble: React.FC<Props> = ({ message, isStreaming, avatarUrl }) => {
  const isUser = message.role === 'user';
  const time = new Date(message.timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        marginBottom: 14,
        alignItems: 'flex-start',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
      }}
    >
      {!isUser && (
        <img
          src={avatarUrl || '/ashin.jpg'}
          alt="AI"
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            flexShrink: 0,
            objectFit: 'cover',
          }}
        />
      )}
      <div style={{ maxWidth: '72%' }}>
        <div
          style={{
            background: isUser ? 'var(--bg-bubble-user)' : 'var(--bg-bubble-assistant)',
            borderRadius: isUser ? '14px 2px 14px 14px' : '2px 14px 14px 14px',
            padding: '10px 14px',
            color: isUser ? 'white' : 'var(--text-primary)',
            lineHeight: 1.55,
            fontSize: 13,
            whiteSpace: 'pre-wrap',
          }}
        >
          {message.content}
          {isStreaming && (
            <span
              style={{
                display: 'inline-block',
                width: 6,
                height: 14,
                background: 'var(--text-primary)',
                marginLeft: 2,
                verticalAlign: 'text-bottom',
                animation: 'blink 1s step-end infinite',
              }}
            />
          )}
        </div>
        {!isStreaming && (
          <div
            style={{
              color: 'var(--text-muted)',
              fontSize: 9,
              marginTop: 4,
              paddingLeft: isUser ? 0 : 4,
              paddingRight: isUser ? 4 : 0,
              textAlign: isUser ? 'right' : 'left',
            }}
          >
            {time}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
