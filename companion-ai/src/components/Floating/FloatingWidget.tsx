import React, { useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

interface FloatingWidgetProps {
  hasNotification?: boolean;
  notificationPreview?: string;
  onClick?: () => void;
}

const FloatingWidget: React.FC<FloatingWidgetProps> = ({
  hasNotification = false,
  notificationPreview,
  onClick,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleClick = async () => {
    if (isDragging) return;
    onClick?.();
  };

  const handleMouseDown = () => {
    setIsDragging(false);
  };

  const handleMouseMove = () => {
    setIsDragging(true);
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
    >
      {/* Notification preview tooltip */}
      {hasNotification && isHovered && notificationPreview && (
        <div
          style={{
            position: 'absolute',
            bottom: 76,
            right: 0,
            width: 220,
            background: 'rgba(20, 20, 35, 0.95)',
            backdropFilter: 'blur(20px)',
            borderRadius: 12,
            padding: 12,
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, marginBottom: 6 }}>
            阿信 · 刚刚
          </div>
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, lineHeight: 1.5 }}>
            {notificationPreview}
          </div>
        </div>
      )}

      {/* Widget */}
      <div
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          position: 'relative',
          cursor: 'pointer',
        }}
      >
        {/* Pulse animation rings for notification */}
        {hasNotification && (
          <>
            <div
              style={{
                position: 'absolute',
                top: -8,
                left: -8,
                width: 80,
                height: 80,
                borderRadius: '50%',
                border: '2px solid rgba(233, 69, 96, 0.3)',
                animation: 'pulse 2s infinite',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: -16,
                left: -16,
                width: 96,
                height: 96,
                borderRadius: '50%',
                border: '1px solid rgba(233, 69, 96, 0.15)',
                animation: 'pulse 2s infinite 0.5s',
              }}
            />
          </>
        )}

        {/* Avatar */}
        <img
          src="/ashin.jpg"
          alt="AI"
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            objectFit: 'cover',
            boxShadow: hasNotification
              ? '0 4px 20px rgba(233, 69, 96, 0.6)'
              : '0 4px 20px rgba(233, 69, 96, 0.4)',
            position: 'relative',
            zIndex: 1,
          }}
        />

        {/* Notification badge */}
        {hasNotification && (
          <div
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: '#ff4757',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: 10,
              fontWeight: 600,
              zIndex: 2,
            }}
          >
            1
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.3); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default FloatingWidget;
