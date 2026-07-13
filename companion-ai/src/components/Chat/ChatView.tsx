import React, { useRef, useEffect } from 'react';
import { SettingOutlined } from '@ant-design/icons';
import { useChatStore } from '../../stores/chatStore';
import { openSettingsWindow } from '../../services/tauriBridge';
import { getRoles, AGENT_URL } from '../../services/agentClient';
import { applyRoleTheme } from '../../services/theme';
import type { RoleInfo } from '../../types';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';

const ChatView: React.FC = () => {
  const { messages, isLoading, streamingContent, streamingMsgId, roleId, roleAvatar, roleName, send, setRoleId, setRoleInfo } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  useEffect(() => {
    getRoles().then((roles: RoleInfo[]) => {
      if (roles.length > 0) {
        const currentRole = roles.find(r => r.id === roleId) || roles[0];
        setRoleId(currentRole.id);
        setRoleInfo(currentRole);
        applyRoleTheme(currentRole.theme_color || '#e94560');
      }
    });
  }, []);

  const avatarUrl = roleAvatar
    ? `${AGENT_URL}/roles/${roleId}/avatar`
    : '/ashin.jpg';

  const handleSettings = async () => {
    await openSettingsWindow();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          background: 'var(--bg-primary)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <img
          src={avatarUrl}
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
            {roleName}
          </div>
        </div>
        <SettingOutlined
          onClick={handleSettings}
          style={{
            color: 'var(--text-secondary)',
            fontSize: 16,
            cursor: 'pointer',
            padding: 4,
          }}
        />
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
          <MessageBubble key={msg.id} message={msg} avatarUrl={avatarUrl} />
        ))}
        {isLoading && streamingMsgId && (
          <MessageBubble
            message={{
              id: streamingMsgId,
              session_id: '',
              role: 'assistant',
              content: streamingContent || '',
              timestamp: new Date().toISOString(),
            }}
            avatarUrl={avatarUrl}
            isStreaming
          />
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <MessageInput onSend={send} disabled={isLoading} />
    </div>
  );
};

export default ChatView;
