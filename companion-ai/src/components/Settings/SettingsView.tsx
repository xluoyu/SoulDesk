import React, { useState, useEffect } from 'react';
import { Input, Select, Switch, Button, Form, Divider, Typography, Spin, Card, Tag, Popconfirm, message } from 'antd';
import {
  SettingOutlined,
  UserOutlined,
  SaveOutlined,
  SearchOutlined,
  ApiOutlined,
  KeyOutlined,
  LinkOutlined,
  ThunderboltOutlined,
  PlusOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import RoleCreator from './RoleCreator';
import type { RoleInfo } from '../../types';
import { getRoles, reloadRoles, deleteRole } from '../../services/agentClient';
import { getSettings, saveSettings, type Settings } from '../../services/tauriBridge';
import { setThemeMode } from '../../services/theme';

const { Title, Text } = Typography;

type MenuKey = 'model' | 'role' | 'general';

interface MenuItem {
  key: MenuKey;
  label: string;
  icon: React.ReactNode;
}

const menuItems: MenuItem[] = [
  { key: 'model', label: '模型配置', icon: <ApiOutlined /> },
  { key: 'role', label: '角色管理', icon: <UserOutlined /> },
  { key: 'general', label: '通用设置', icon: <SettingOutlined /> },
];

interface Props {
  onThemeChange?: (mode: 'dark' | 'light') => void;
}

const SettingsView: React.FC<Props> = ({ onThemeChange }) => {
  const [activeMenu, setActiveMenu] = useState<MenuKey>('model');
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roleCreatorOpen, setRoleCreatorOpen] = useState(false);

  // Model config
  const [accessMode, setAccessMode] = useState<string>('openai');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [modelName, setModelName] = useState('');

  // Search config
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [tavilyKey, setTavilyKey] = useState('');

  // General config
  const [themeMode, setThemeModeState] = useState<string>('dark');
  const [floatingWidget, setFloatingWidget] = useState(true);
  const [proactivePush, setProactivePush] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [rolesResult, settings] = await Promise.all([getRoles(), getSettings()]);
      setRoles(rolesResult);

      if (settings.model) {
        setAccessMode(settings.model.access_mode || 'openai');
        setApiKey(settings.model.api_key || '');
        setBaseUrl(settings.model.base_url || '');
        setModelName(settings.model.model_name || '');
      }
      if (settings.search) {
        setSearchEnabled(settings.search.enabled ?? false);
        setTavilyKey(settings.search.tavily_api_key || '');
      }
      if (settings.general) {
        setThemeModeState(settings.general.theme_mode || 'dark');
        setFloatingWidget(settings.general.floating_widget ?? true);
        setProactivePush(settings.general.proactive_push ?? false);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const buildSettings = (): Settings => ({
    model: {
      access_mode: accessMode,
      api_key: apiKey,
      base_url: baseUrl,
      model_name: modelName,
    },
    general: {
      theme_mode: themeMode,
      floating_widget: floatingWidget,
      proactive_push: proactivePush,
    },
    search: {
      enabled: searchEnabled,
      tavily_api_key: tavilyKey,
    },
    agent: { port: 3456, auto_start: true },
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSettings(buildSettings());
      await reloadRoles();
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleThemeModeChange = (mode: string) => {
    setThemeModeState(mode);
    const resolved = setThemeMode(mode as any);
    onThemeChange?.(resolved);
  };

  const renderModelSettings = () => (
    <div>
      <Title level={5} style={{ color: 'var(--text-primary)', marginBottom: 24 }}>
        <ApiOutlined style={{ marginRight: 8 }} />
        模型配置
      </Title>

      <Form layout="vertical">
        <Form.Item label={<Text style={{ color: 'var(--text-primary)' }}>接入模式</Text>}>
          <Select
            value={accessMode}
            onChange={setAccessMode}
            options={[
              { value: 'openai', label: 'OpenAI 兼容' },
              { value: 'anthropic', label: 'Anthropic' },
            ]}
          />
        </Form.Item>

        <Form.Item label={<Text style={{ color: 'var(--text-primary)' }}>Base URL</Text>}>
          <Input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            prefix={<LinkOutlined style={{ color: 'var(--text-secondary)' }} />}
            placeholder={
              accessMode === 'openai'
                ? 'https://api.openai.com/v1'
                : 'https://api.anthropic.com'
            }
          />
        </Form.Item>

        <Form.Item label={<Text style={{ color: 'var(--text-primary)' }}>API Key</Text>}>
          <Input.Password
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            prefix={<KeyOutlined style={{ color: 'var(--text-secondary)' }} />}
            placeholder="sk-..."
          />
        </Form.Item>

        <Form.Item label={<Text style={{ color: 'var(--text-primary)' }}>模型名称</Text>}>
          <Input
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            prefix={<ThunderboltOutlined style={{ color: 'var(--text-secondary)' }} />}
            placeholder={
              accessMode === 'openai' ? 'gpt-4o' : 'claude-sonnet-4-20250514'
            }
          />
        </Form.Item>
      </Form>

      <Divider style={{ borderColor: 'var(--border)' }} />

      <Title level={5} style={{ color: 'var(--text-primary)', marginBottom: 24 }}>
        <SearchOutlined style={{ marginRight: 8 }} />
        联网搜索
      </Title>

      <Form layout="vertical">
        <Form.Item
          label={<Text style={{ color: 'var(--text-primary)' }}>启用搜索</Text>}
          extra={
            <Text style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
              开启后 AI 可以搜索互联网获取实时信息
            </Text>
          }
        >
          <Switch checked={searchEnabled} onChange={setSearchEnabled} />
        </Form.Item>

        {searchEnabled && (
          <Form.Item label={<Text style={{ color: 'var(--text-primary)' }}>Tavily API Key</Text>}>
            <Input.Password
              value={tavilyKey}
              onChange={(e) => setTavilyKey(e.target.value)}
              prefix={<KeyOutlined style={{ color: 'var(--text-secondary)' }} />}
              placeholder="tvly-..."
            />
          </Form.Item>
        )}
      </Form>

      <Button
        type="primary"
        icon={<SaveOutlined />}
        onClick={handleSave}
        loading={saving}
        block
      >
        保存配置
      </Button>
    </div>
  );

  const renderRoleSettings = () => (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <Title level={5} style={{ color: 'var(--text-primary)', margin: 0 }}>
          <UserOutlined style={{ marginRight: 8 }} />
          角色管理
        </Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setRoleCreatorOpen(true)}
        >
          新建角色
        </Button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin />
        </div>
      ) : roles.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Text style={{ color: 'var(--text-muted)' }}>
            还没有角色，请导入角色到 ~/.souldesk/roles/ 目录
          </Text>
        </div>
      ) : (
        roles.map((role) => (
          <Card
            key={role.id}
            size="small"
            style={{
              marginBottom: 10,
              background: 'var(--bg-tertiary)',
              borderColor: 'var(--border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <Text strong style={{ color: 'var(--text-primary)', fontSize: 14 }}>
                  {role.name}
                </Text>
                <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 4 }}>
                  {role.description || '无描述'}
                </div>
                <Tag style={{ marginTop: 4, fontSize: 11 }}>{role.id}</Tag>
              </div>
              <Popconfirm
                title="确定删除这个角色？"
                onConfirm={async () => {
                  try {
                    await deleteRole(role.id);
                    message.success('角色已删除');
                    loadData();
                  } catch (e) {
                    message.error('删除失败');
                  }
                }}
                okText="删除"
                cancelText="取消"
              >
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  size="small"
                />
              </Popconfirm>
            </div>
          </Card>
        ))
      )}
    </div>
  );

  const renderGeneralSettings = () => (
    <div>
      <Title level={5} style={{ color: 'var(--text-primary)', marginBottom: 24 }}>
        <SettingOutlined style={{ marginRight: 8 }} />
        通用设置
      </Title>

      <Form layout="vertical">
        <Form.Item label={<Text style={{ color: 'var(--text-primary)' }}>外观</Text>}>
          <Select
            value={themeMode}
            onChange={handleThemeModeChange}
            options={[
              { value: 'dark', label: '深色模式' },
              { value: 'light', label: '浅色模式' },
              { value: 'system', label: '跟随系统' },
            ]}
          />
        </Form.Item>

        <Divider style={{ borderColor: 'var(--border)' }} />

        <Form.Item
          label={<Text style={{ color: 'var(--text-primary)' }}>桌面浮窗</Text>}
          extra={
            <Text style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
              关闭后需要通过 Dock 打开会话界面
            </Text>
          }
        >
          <Switch checked={floatingWidget} onChange={setFloatingWidget} />
        </Form.Item>

        <Form.Item
          label={<Text style={{ color: 'var(--text-primary)' }}>主动推送</Text>}
          extra={
            <Text style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
              AI 会主动向你发送消息
            </Text>
          }
        >
          <Switch checked={proactivePush} onChange={setProactivePush} />
        </Form.Item>
      </Form>

      <Button
        type="primary"
        icon={<SaveOutlined />}
        onClick={handleSave}
        loading={saving}
        block
      >
        保存配置
      </Button>
    </div>
  );

  const renderContent = () => {
    switch (activeMenu) {
      case 'model':
        return renderModelSettings();
      case 'role':
        return renderRoleSettings();
      case 'general':
        return renderGeneralSettings();
    }
  };

  return (
    <div style={{ height: '100vh', background: 'var(--bg-primary)', display: 'flex' }}>
      {/* Left sidebar */}
      <div
        style={{
          width: 156,
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '16px 16px 12px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <Text strong style={{ color: 'var(--text-primary)', fontSize: 14 }}>
            设置
          </Text>
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
                background:
                  activeMenu === item.key ? 'rgba(233, 69, 96, 0.1)' : 'transparent',
                borderLeft:
                  activeMenu === item.key
                    ? '3px solid var(--accent)'
                    : '3px solid transparent',
                color:
                  activeMenu === item.key ? 'var(--accent)' : 'var(--text-secondary)',
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
      <div style={{ flex: 1, overflowY: 'auto', padding: 28 }}>{renderContent()}</div>

      <RoleCreator
        open={roleCreatorOpen}
        onClose={() => setRoleCreatorOpen(false)}
        onCreated={() => {
          setRoleCreatorOpen(false);
          loadData();
        }}
      />
    </div>
  );
};

export default SettingsView;
