import React, { useState, useEffect } from 'react';
import type { RoleInfo } from '../../types';
import { getRoles, reloadRoles } from '../../services/agentClient';
import { getSettings, saveSettings } from '../../services/tauriBridge';
import { getCurrentWindow } from '@tauri-apps/api/window';

type MenuKey = 'model' | 'role' | 'general';

interface MenuItem {
  key: MenuKey;
  label: string;
  icon: string;
}

const menuItems: MenuItem[] = [
  { key: 'model', label: '模型配置', icon: '⚙' },
  { key: 'role', label: '角色管理', icon: '👤' },
  { key: 'general', label: '通用设置', icon: '🔧' },
];

const SettingsView: React.FC = () => {
  const [activeMenu, setActiveMenu] = useState<MenuKey>('model');
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Model config state
  const [provider, setProvider] = useState('deepseek');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://api.deepseek.com/v1');
  const [modelName, setModelName] = useState('deepseek-chat');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [rolesResult, settings] = await Promise.all([
        getRoles(),
        getSettings(),
      ]);
      setRoles(rolesResult);
      if (settings.model) {
        setProvider(settings.model.provider || 'deepseek');
        setApiKey(settings.model.api_key || '');
        setBaseUrl(settings.model.base_url || 'https://api.deepseek.com/v1');
        setModelName(settings.model.model_name || 'deepseek-chat');
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async () => {
    const win = getCurrentWindow();
    await win.hide();
  };

  const handleSaveModel = async () => {
    try {
      await saveSettings({
        model: { provider, api_key: apiKey, base_url: baseUrl, model_name: modelName },
        agent: { port: 3456, auto_start: true },
      });
      // 通知 Agent 后端重新加载配置
      await reloadRoles();
      alert('保存成功');
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const renderModelSettings = () => (
    <div>
      <h3 style={sectionTitle}>模型配置</h3>

      <div style={fieldGroup}>
        <label style={labelStyle}>提供商</label>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          style={inputStyle}
        >
          <option value="deepseek">DeepSeek</option>
          <option value="openai">OpenAI</option>
          <option value="custom">自定义</option>
        </select>
      </div>

      <div style={fieldGroup}>
        <label style={labelStyle}>API Key</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
          style={inputStyle}
        />
      </div>

      <div style={fieldGroup}>
        <label style={labelStyle}>Base URL</label>
        <input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={fieldGroup}>
        <label style={labelStyle}>模型</label>
        <input
          value={modelName}
          onChange={(e) => setModelName(e.target.value)}
          style={inputStyle}
        />
      </div>

      <button onClick={handleSaveModel} style={saveButtonStyle}>
        保存配置
      </button>
    </div>
  );

  const renderRoleSettings = () => (
    <div>
      <h3 style={sectionTitle}>角色管理</h3>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
          加载中...
        </div>
      ) : roles.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
          还没有角色，请导入角色 Skill 包到 ~/.souldesk/roles/ 目录
        </div>
      ) : (
        roles.map((role) => (
          <div
            key={role.id}
            style={{
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 8,
              padding: 14,
              marginBottom: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 14 }}>
                  {role.name}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 4 }}>
                  {role.description || '无描述'}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>
                  ID: {role.id}
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const renderGeneralSettings = () => (
    <div>
      <h3 style={sectionTitle}>通用设置</h3>

      <div style={fieldGroup}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={labelStyle}>桌面浮窗</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>
              关闭后需要通过 Dock 打开会话界面
            </div>
          </div>
          <div style={toggleTrack}>
            <div style={toggleThumb} />
          </div>
        </div>
      </div>

      <div style={fieldGroup}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={labelStyle}>主动推送</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>
              AI 会主动向你发送消息
            </div>
          </div>
          <div style={toggleTrack}>
            <div style={toggleThumb} />
          </div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeMenu) {
      case 'model': return renderModelSettings();
      case 'role': return renderRoleSettings();
      case 'general': return renderGeneralSettings();
    }
  };

  return (
    <div style={{ height: '100vh', background: 'var(--bg-primary)', display: 'flex' }}>
      {/* Left sidebar */}
      <div
        style={{
          width: 180,
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <div
            onClick={handleClose}
            style={{ color: 'var(--text-secondary)', fontSize: 16, cursor: 'pointer' }}
          >
            ‹
          </div>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 14 }}>设置</span>
        </div>

        <div style={{ flex: 1, padding: '8px 0' }}>
          {menuItems.map((item) => (
            <div
              key={item.key}
              onClick={() => setActiveMenu(item.key)}
              style={{
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
                background: activeMenu === item.key ? 'rgba(233, 69, 96, 0.1)' : 'transparent',
                borderLeft: activeMenu === item.key ? '3px solid var(--accent)' : '3px solid transparent',
                color: activeMenu === item.key ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: 13,
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 14 }}>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {renderContent()}
      </div>
    </div>
  );
};

const sectionTitle: React.CSSProperties = {
  color: 'var(--text-primary)',
  fontSize: 16,
  fontWeight: 600,
  marginBottom: 20,
  marginTop: 0,
};

const fieldGroup: React.CSSProperties = {
  marginBottom: 18,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  color: 'var(--text-primary)',
  fontSize: 13,
  fontWeight: 500,
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 6,
  padding: '8px 12px',
  color: 'var(--text-primary)',
  fontSize: 13,
  outline: 'none',
};

const saveButtonStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: 'var(--accent)',
  borderRadius: 6,
  color: 'white',
  fontSize: 13,
  cursor: 'pointer',
  border: 'none',
  marginTop: 8,
};

const toggleTrack: React.CSSProperties = {
  width: 40,
  height: 22,
  borderRadius: 11,
  background: 'var(--accent)',
  position: 'relative',
  cursor: 'pointer',
  flexShrink: 0,
};

const toggleThumb: React.CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: '50%',
  background: 'white',
  position: 'absolute',
  top: 2,
  left: 20,
};

export default SettingsView;
