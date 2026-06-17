import { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ConfigProvider, theme as antdTheme } from 'antd';
import ChatView from './components/Chat/ChatView';
import SettingsView from './components/Settings/SettingsView';
import FloatingWidget from './components/Floating/FloatingWidget';
import { showChatWindow } from './services/tauriBridge';
import { initTheme } from './services/theme';
import './styles/global.css';

function App() {
  const [windowLabel, setWindowLabel] = useState<string>('');
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const win = getCurrentWindow();
    setWindowLabel(win.label);
    initTheme().then((mode) => setThemeMode(mode));
  }, []);

  const isDark = themeMode === 'dark';

  const antdThemeConfig = {
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: '#e94560',
      borderRadius: 6,
      ...(isDark
        ? {
            colorBgContainer: 'rgba(255,255,255,0.06)',
            colorBgElevated: '#1a1a2e',
            colorText: 'rgba(255,255,255,0.85)',
            colorTextSecondary: 'rgba(255,255,255,0.4)',
            colorBorder: 'rgba(255,255,255,0.1)',
          }
        : {
            colorBgContainer: '#ffffff',
            colorBgElevated: '#ffffff',
            colorText: 'rgba(0,0,0,0.85)',
            colorTextSecondary: 'rgba(0,0,0,0.45)',
            colorBorder: 'rgba(0,0,0,0.08)',
          }),
    },
  };

  if (windowLabel === 'floating') {
    return (
      <FloatingWidget
        onClick={async () => {
          await showChatWindow();
        }}
      />
    );
  }

  return (
    <ConfigProvider theme={antdThemeConfig}>
      {windowLabel === 'settings' ? (
        <SettingsView onThemeChange={setThemeMode} />
      ) : (
        <ChatView />
      )}
    </ConfigProvider>
  );
}

export default App;
