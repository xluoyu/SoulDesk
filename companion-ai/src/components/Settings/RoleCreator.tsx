import React, { useState, useRef, useEffect } from 'react';
import { Modal, Input, Button, Space, Spin } from 'antd';
import { SendOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons';

interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const AGENT_URL = 'http://localhost:3456';

const NUWA_SYSTEM_PROMPT = `你是女娲，一个角色创造助手。你的任务是通过对话引导用户描述他们想要的角色，然后调用 create_role 工具生成角色文件。

执行流程：
1. 先问用户想要什么角色（名称、来源、核心特质）
2. 再问性格特征（3-5个，用行为描述而非形容词）
3. 问说话风格（口癖、语气词、句式偏好）
4. 问人物关系和世界观（如果适用）
5. 信息收集完成后，直接调用 create_role 工具

品味守则：
- 行为 > 形容：用具体行为描述性格，不用抽象形容词
- 矛盾 > 完美：好的角色有内在矛盾
- 具体 > 抽象：口癖要具体到词汇
- 克制 > 堆砌：3个深刻的特征好过10个浅薄的标签`;

const RoleCreator: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef(crypto.randomUUID());

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content:
            '你好！我是女娲，你的角色创造助手。\n\n告诉我你想要什么样的角色吧——可以是一个动漫人物、游戏人物，或者完全原创的角色。说说 TA 的名字和核心特质？',
        },
      ]);
    }
  }, [open]);

  const handleClose = () => {
    setMessages([]);
    setInput('');
    onClose();
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMsg = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch(`${AGENT_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          session_id: sessionIdRef.current,
          role_id: '__nuwa__',
          system_prompt: NUWA_SYSTEM_PROMPT,
        }),
      });

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === 'token') {
                fullContent += event.content;
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === 'assistant' && last.id === 'streaming') {
                    updated[updated.length - 1] = { ...last, content: fullContent };
                  } else {
                    updated.push({ id: 'streaming', role: 'assistant', content: fullContent });
                  }
                  return updated;
                });
              } else if (event.type === 'done') {
                fullContent = event.content || fullContent;
              }
            } catch {}
          }
        }
      }

      setMessages((prev) => {
        const updated = prev.map((m) =>
          m.id === 'streaming' ? { ...m, id: crypto.randomUUID() } : m
        );
        return updated;
      });

      const jsonMatch = fullContent.match(/```json\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          const roleData = JSON.parse(jsonMatch[1]);
          if (roleData.action === 'create_role') {
            setCreating(true);
            // Agent 的 create_role 工具已经写入了文件，这里只需要通知前端刷新
            setMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: `角色「${roleData.name}」已创建成功！可以关闭这个窗口了。`,
              },
            ]);
            onCreated();
          }
        } catch (e) {
          console.error('Failed to parse role data:', e);
        } finally {
          setCreating(false);
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '连接 Agent 失败，请确保 Agent 后端已启动。',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <RobotOutlined />
          <span>创建新角色</span>
        </Space>
      }
      open={open}
      onCancel={handleClose}
      footer={null}
      width={600}
      styles={{ body: { padding: 0, height: 500, display: 'flex', flexDirection: 'column' } }}
    >
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          background: 'var(--bg-primary)',
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              gap: 10,
              marginBottom: 14,
              alignItems: 'flex-start',
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: msg.role === 'user' ? 'var(--accent)' : 'var(--bg-tertiary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {msg.role === 'user' ? (
                <UserOutlined style={{ color: '#fff', fontSize: 14 }} />
              ) : (
                <RobotOutlined style={{ color: 'var(--text-secondary)', fontSize: 14 }} />
              )}
            </div>
            <div
              style={{
                background:
                  msg.role === 'user' ? 'var(--accent)' : 'var(--bg-bubble-assistant)',
                color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                borderRadius:
                  msg.role === 'user' ? '14px 2px 14px 14px' : '2px 14px 14px 14px',
                padding: '10px 14px',
                fontSize: 13,
                lineHeight: 1.6,
                maxWidth: '80%',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: 'var(--bg-tertiary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <RobotOutlined style={{ color: 'var(--text-secondary)', fontSize: 14 }} />
            </div>
            <div
              style={{
                background: 'var(--bg-bubble-assistant)',
                borderRadius: '2px 14px 14px 14px',
                padding: '10px 14px',
                color: 'var(--text-secondary)',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Spin size="small" />
              思考中...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          gap: 8,
          background: 'var(--bg-secondary)',
        }}
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPressEnter={handleSend}
          placeholder="描述你想要的角色..."
          disabled={loading || creating}
          style={{ background: 'var(--bg-primary)', borderColor: 'var(--border)' }}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSend}
          loading={loading}
          disabled={!input.trim() || creating}
        >
          发送
        </Button>
      </div>
    </Modal>
  );
};

export default RoleCreator;
