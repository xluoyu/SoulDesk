import React, { useState, useEffect } from 'react';
import type { Skill } from '../../types';
import { listSkills, uploadSkill, toggleSkill, deleteSkill } from '../../services/tauriBridge';

interface SkillManagerProps {
  onClose?: () => void;
}

const SkillManager: React.FC<SkillManagerProps> = ({ onClose }) => {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const content = await file.text();
      await uploadSkill({
        dir_path: file.name,
        content,
      });
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

  return (
    <div
      style={{
        height: '100vh',
        background: 'var(--bg-primary)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
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
        {onClose && (
          <div
            onClick={onClose}
            style={{ color: 'var(--text-secondary)', fontSize: 18, cursor: 'pointer' }}
          >
            ‹
          </div>
        )}
        <div style={{ flex: 1, color: 'var(--text-primary)', fontWeight: 600, fontSize: 14 }}>
          角色管理
        </div>
        <label
          style={{
            padding: '6px 12px',
            background: 'var(--accent)',
            borderRadius: 6,
            color: 'white',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
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

      {/* Skills list */}
      <div style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 40 }}>
            加载中...
          </div>
        ) : skills.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 40 }}>
            还没有角色设定
            <br />
            <span style={{ fontSize: 12 }}>点击右上角"导入角色"添加</span>
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
    </div>
  );
};

export default SkillManager;
