import React, { useState, useEffect } from 'react';
import type { Skill } from '../../types';
import { listSkills, uploadSkill, toggleSkill, deleteSkill } from '../../services/tauriBridge';
import { getCurrentWindow } from '@tauri-apps/api/window';

type TabKey = 'model' | 'skill' | 'general';

const SettingsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('model');
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

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'model', label: '模型' },
    { key: 'skill', label: '角色' },
    { key: 'general', label: '通用' },
  ];

  const renderModelSettings = () => (
    <div style={{ padding: '0 16px' }}>
      <div style={{ marginBottom: 16 }}>
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

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>API Key</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Base URL</label>
        <input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>模型</label>
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Temperature ({temperature})</label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            style={{ width: '100%' }}
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
    <div style={{ padding: '0 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
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
                style={{
                  color: 'var(--text-muted)',
                  fontSize: 14,
                  cursor: 'pointer',
                  padding: '4px 8px',
                }}
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
    <div style={{ padding: '0 16px' }}>
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>桌面浮窗</label>
        <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 4 }}>
          关闭后需要通过 Dock 打开会话界面
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>主动推送</label>
        <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 4 }}>
          AI 会主动向你发送消息
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>免打扰时段</label>
        <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 4 }}>
          设置后该时段不会收到主动推送
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ height: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div onClick={handleClose} style={{ color: 'var(--text-secondary)', fontSize: 18, cursor: 'pointer' }}>
          ‹
        </div>
        <div style={{ flex: 1, color: 'var(--text-primary)', fontWeight: 600, fontSize: 14 }}>
          设置
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        {tabs.map((tab) => (
          <div
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1,
              padding: '12px 0',
              textAlign: 'center',
              color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: activeTab === tab.key ? 600 : 400,
              borderBottom: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </div>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', paddingTop: 16 }}>
        {activeTab === 'model' && renderModelSettings()}
        {activeTab === 'skill' && renderSkillSettings()}
        {activeTab === 'general' && renderGeneralSettings()}
      </div>
    </div>
  );
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

export default SettingsView;
