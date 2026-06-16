import React, { useState, useEffect } from 'react';
import type { Skill } from '../../types';
import { listSkills, uploadSkill, toggleSkill, deleteSkill } from '../../services/tauriBridge';
import { getCurrentWindow } from '@tauri-apps/api/window';

type MenuKey = 'model' | 'skill' | 'general';

interface MenuItem {
  key: MenuKey;
  label: string;
  icon: string;
}

const menuItems: MenuItem[] = [
  { key: 'model', label: '模型配置', icon: '⚙' },
  { key: 'skill', label: '角色管理', icon: '👤' },
  { key: 'general', label: '通用设置', icon: '🔧' },
];

const SettingsView: React.FC = () => {
  const [activeMenu, setActiveMenu] = useState<MenuKey>('model');
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Model config state
  const [providerType, setProviderType] = useState('openai');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com');
  const [model, setModel] = useState('gpt-4o');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2048);

  useEffect(() => {
    loadSkills();
  }, []);

  const loadSkills = async () => {
    try {
      const result = await listSkills();
      setSkills(result);
    } catch (error) {
      console.error('Failed to load skills:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async () => {
    const win = getCurrentWindow();
    await win.hide();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const content = await file.text();
      await uploadSkill({ dir_path: file.name, content });
      await loadSkills();
    } catch (error) {
      console.error('Failed to upload skill:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleToggle = async (skillId: string, currentActive: boolean) => {
    try {
      await toggleSkill(skillId, !currentActive);
      await loadSkills();
    } catch (error) {
      console.error('Failed to toggle skill:', error);
    }
  };

  const handleDelete = async (skillId: string) => {
    if (!confirm('确定要删除这个角色设定吗？')) return;
    try {
      await deleteSkill(skillId);
      await loadSkills();
    } catch (error) {
      console.error('Failed to delete skill:', error);
    }
  };

  const renderModelSettings = () => (
    <div>
      <h3 style={sectionTitle}>模型配置</h3>

      <div style={fieldGroup}>
        <label style={labelStyle}>提供商</label>
        <select
          value={providerType}
          onChange={(e) => setProviderType(e.target.value)}
          style={inputStyle}
        >
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
          value={model}
          onChange={(e) => setModel(e.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Temperature ({temperature})</label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            style={{ width: '100%', marginTop: 8 }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Max Tokens</label>
          <input
            type="number"
            value={maxTokens}
            onChange={(e) => setMaxTokens(parseInt(e.target.value))}
            style={inputStyle}
          />
        </div>
      </div>
    </div>
  );

  const renderSkillSettings = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={sectionTitle}>角色管理</h3>
        <label style={buttonStyle}>
          {uploading ? '上传中...' : '导入角色'}
          <input
            type="file"
            accept=".md,.txt"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
            disabled={uploading}
          />
        </label>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
          加载中...
        </div>
      ) : skills.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
          还没有角色设定
        </div>
      ) : (
        skills.map((skill) => (
          <div
            key={skill.id}
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
                  {skill.name}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 4 }}>
                  {skill.description || '无描述'}
                </div>
              </div>
              <div
                onClick={() => handleToggle(skill.id, skill.is_active)}
                style={{
                  width: 40,
                  height: 22,
                  borderRadius: 11,
                  background: skill.is_active ? 'var(--accent)' : '#444',
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: 'white',
                    position: 'absolute',
                    top: 2,
                    left: skill.is_active ? 20 : 2,
                    transition: 'left 0.2s',
                  }}
                />
              </div>
              <div
                onClick={() => handleDelete(skill.id)}
                style={{ color: 'var(--text-muted)', fontSize: 14, cursor: 'pointer', padding: '4px 8px' }}
              >
                ×
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

      <div style={fieldGroup}>
        <label style={labelStyle}>免打扰时段</label>
        <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 4 }}>
          设置后该时段不会收到主动推送
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeMenu) {
      case 'model': return renderModelSettings();
      case 'skill': return renderSkillSettings();
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
        {/* Sidebar header */}
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

        {/* Menu items */}
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

const buttonStyle: React.CSSProperties = {
  padding: '6px 12px',
  background: 'var(--accent)',
  borderRadius: 6,
  color: 'white',
  fontSize: 12,
  cursor: 'pointer',
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
