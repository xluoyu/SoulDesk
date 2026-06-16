import React, { useState } from 'react';

interface Props {
  onSend: (content: string) => void;
  disabled: boolean;
}

const MessageInput: React.FC<Props> = ({ onSend, disabled }) => {
  const [value, setValue] = useState('');

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      style={{
        padding: '10px 12px',
        background: 'var(--bg-primary)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <div
        style={{
          flex: 1,
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 6,
          padding: '10px 14px',
        }}
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="输入消息..."
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontSize: 13,
          }}
        />
      </div>
      <div
        onClick={handleSend}
        style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          background: disabled ? '#666' : 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: 15,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        ↑
      </div>
    </div>
  );
};

export default MessageInput;
