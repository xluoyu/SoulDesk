import { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import ChatView from './components/Chat/ChatView';
import SettingsView from './components/Settings/SettingsView';
import './styles/global.css';

function App() {
  const [windowLabel, setWindowLabel] = useState<string>('');

  useEffect(() => {
    const win = getCurrentWindow();
    setWindowLabel(win.label);
  }, []);

  if (windowLabel === 'settings') {
    return <SettingsView />;
  }

  return <ChatView />;
}

export default App;
