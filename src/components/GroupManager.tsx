import { useState } from 'react';
import { Plus, Trash2, Users, Edit2, Check, X, Palette } from 'lucide-react';
import { api } from '@/utils/api';
import type { Group, Candidate } from '../../shared/types';

interface GroupManagerProps {
  activityId: string;
  groups: Group[];
  candidates: Candidate[];
  onUpdate: () => void;
}

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#ec4899',
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
];

export function GroupManager({ activityId, groups, candidates, onUpdate }: GroupManagerProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: '', color: PRESET_COLORS[0] });
  const [loading, setLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroup.name.trim()) return;
    setLoading(true);
    try {
      const res = await api.groups.create(activityId, { name: newGroup.name.trim(), color: newGroup.color });
      if (res.success) {
        setShowCreate(false);
        setNewGroup({ name: '', color: PRESET_COLORS[0] });
        setFeedbackMsg({ type: 'success', text: '分组创建成功' });
        onUpdate();
        setTimeout(() => setFeedbackMsg(null), 3000);
      } else {
        setFeedbackMsg({ type: 'error', text: res.message || res.error || '创建失败' });
      }
    } catch (error) {
      console.error('Create group failed:', error);
      setFeedbackMsg({ type: 'error', text: '创建失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (groupId: string, groupName: string) => {
    const count = candidates.filter(c => c.groupId === groupId).length;
    if (!confirm(`确定删除分组「${groupName}」吗？\n${count > 0 ? `该分组下有 ${count} 个候选者将变为未分组。` : ''}`)) return;
    try {
      const res = await api.groups.delete(activityId, groupId);
      if (res.success) {
        onUpdate();
      } else {
        alert(res.message || res.error || '删除失败');
      }
    } catch (error) {
      console.error('Delete group failed:', error);
    }
  };

  const handleMoveCandidate = async (candidateId: string, targetGroupId: string | undefined) => {
    try {
      const res = await api.candidates.update(activityId, candidateId, { groupId: targetGroupId });
      if (res.success) {
        onUpdate();
      } else {
        console.error('Move failed:', res.message);
      }
    } catch (error) {
      console.error('Move candidate failed:', error);
    }
  };

  const ungrouped = candidates.filter(c => !c.groupId);

  return (
    <div className="space-y-6">
      <div className="card-neon">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Users className="text-primary-400" size={20} />
              分组管理
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              共 {groups.length} 个分组 · {candidates.length} 个候选者
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-neon flex items-center gap-2 text-sm py-2"
          >
            <Plus size={16} />
            创建分组
          </button>
        </div>

        {feedbackMsg && (
          <div className={`mb-4 px-4 py-3 rounded-xl text-sm border ${
            feedbackMsg.type === 'success'
              ? 'bg-green-500/10 border-green-500/30 text-green-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}>
            {feedbackMsg.text}
          </div>
        )}

        {groups.length === 0 && ungrouped.length === 0 ? (
          <div className="text-center py-12">
            <Users className="mx-auto text-gray-600 mb-3" size={40} />
            <p className="text-gray-500 mb-2">暂无分组</p>
            <p className="text-sm text-gray-500">点击上方「创建分组」按人群组织候选者，例如 VIP、粉丝团、特邀嘉宾等</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.length === 0 && (
              <div className="p-4 rounded-xl bg-primary-500/5 border border-primary-500/20">
                <p className="text-sm text-primary-300">
                  还没创建分组，当前所有候选者都在未分组中。点击右上角「创建分组」开始按人群组织。
                </p>
              </div>
            )}

            {groups.map((group) => {
              const members = candidates.filter(c => c.groupId === group.id && !c.isBlacklisted);
              return (
                <div key={group.id} className="p-4 rounded-xl bg-dark-300/50 border border-white/5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${group.color}22` }}>
                        <Users size={18} style={{ color: group.color }} />
                      </div>
                      <div>
                        <div className="font-semibold text-white flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: group.color }} />
                          {group.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {members.length} 人（不包含黑名单）
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(group.id, group.name)}
                      className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="删除分组"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {members.length === 0 ? (
                    <p className="text-sm text-gray-500 py-4 text-center">此分组暂无成员</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {members.map((c) => (
                        <div
                          key={c.id}
                          className="group flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-200 text-sm"
                        >
                          <span className="font-medium text-white">{c.number}</span>
                          {c.nickname && <span className="text-gray-400 text-xs">{c.nickname}</span>}
                          <select
                            value={c.groupId || ''}
                            onChange={(e) => handleMoveCandidate(c.id, e.target.value || undefined)}
                            className="ml-2 bg-dark-300 text-xs text-gray-300 rounded px-1.5 py-0.5 border border-white/5 focus:outline-none focus:border-primary-500"
                          >
                            <option value="">未分组</option>
                            {groups.map(g => (
                              <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {ungrouped.length > 0 && (
              <div className="p-4 rounded-xl bg-dark-300/30 border border-dashed border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-medium text-gray-300">未分组 ({ungrouped.filter(c => !c.isBlacklisted).length} 人有效)</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ungrouped.map((c) => (
                    <div
                      key={c.id}
                      className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
                        c.isBlacklisted ? 'bg-red-500/10 border border-red-500/20' : 'bg-dark-200'
                      }`}
                    >
                      <span className={`font-medium ${c.isBlacklisted ? 'text-red-400' : 'text-white'}`}>{c.number}</span>
                      {c.nickname && <span className="text-gray-400 text-xs">{c.nickname}</span>}
                      {c.isBlacklisted && <span className="text-xs text-red-400">[黑名单]</span>}
                      {groups.length > 0 && (
                        <select
                          value={c.groupId || ''}
                          onChange={(e) => handleMoveCandidate(c.id, e.target.value || undefined)}
                          className="ml-2 bg-dark-300 text-xs text-gray-300 rounded px-1.5 py-0.5 border border-white/5 focus:outline-none focus:border-primary-500"
                        >
                          <option value="">未分组</option>
                          {groups.map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="gradient-border w-full max-w-md p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-xl font-bold text-white">创建分组</h2>
              <button
                onClick={() => setShowCreate(false)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  分组名称 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newGroup.name}
                  onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                  className="input-neon"
                  placeholder="例如：VIP 用户、粉丝团"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                  <Palette size={16} />
                  标识颜色
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewGroup({ ...newGroup, color })}
                      className={`w-full aspect-square rounded-lg transition-all ${
                        newGroup.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-dark-200 scale-110' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="btn-outline flex-1"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={loading || !newGroup.name.trim()}
                  className="btn-neon flex-1"
                >
                  {loading ? '创建中...' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
