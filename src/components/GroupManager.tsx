import { useState, useMemo } from 'react';
import { Plus, Trash2, Users, X, Palette, Search, MoveRight, CheckSquare, Square, Filter, Target } from 'lucide-react';
import { api } from '@/utils/api';
import type { Group, Candidate, DrawRound } from '../../shared/types';

interface GroupManagerProps {
  activityId: string;
  groups: Group[];
  candidates: Candidate[];
  rounds?: DrawRound[];
  onUpdate: () => void;
}

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#ec4899',
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
];

export function GroupManager({ activityId, groups, candidates, rounds = [], onUpdate }: GroupManagerProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: '', color: PRESET_COLORS[0] });
  const [loading, setLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterGroupId, setFilterGroupId] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchTargetGroup, setBatchTargetGroup] = useState<string>('');

  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      if (filterGroupId) {
        if (filterGroupId === '__ungrouped__') {
          if (c.groupId) return false;
        } else if (c.groupId !== filterGroupId) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchNum = c.number.toLowerCase().includes(q);
        const matchNick = c.nickname && c.nickname.toLowerCase().includes(q);
        if (!matchNum && !matchNick) return false;
      }
      return true;
    });
  }, [candidates, searchQuery, filterGroupId]);

  const allSelected = filteredCandidates.length > 0 && filteredCandidates.every(c => selectedIds.has(c.id));
  const someSelected = filteredCandidates.some(c => selectedIds.has(c.id)) && !allSelected;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredCandidates.forEach(c => next.delete(c.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredCandidates.forEach(c => next.add(c.id));
        return next;
      });
    }
  };

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
      const res = await api.candidates.update(activityId, candidateId, {
        groupId: targetGroupId !== undefined ? targetGroupId : ''
      });
      if (res.success) {
        onUpdate();
      } else {
        console.error('Move failed:', res.message);
      }
    } catch (error) {
      console.error('Move candidate failed:', error);
    }
  };

  const handleBatchMove = async () => {
    if (selectedIds.size === 0) {
      alert('请先选择要移动的候选者');
      return;
    }
    const targetName = batchTargetGroup === '' ? '未分组' : groups.find(g => g.id === batchTargetGroup)?.name || batchTargetGroup;
    if (!confirm(`将 ${selectedIds.size} 个候选者移动到「${targetName}」？`)) return;
    setLoading(true);
    let success = 0;
    let failed = 0;
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      try {
        const res = await api.candidates.update(activityId, id, { groupId: batchTargetGroup });
        if (res.success) success++; else failed++;
      } catch {
        failed++;
      }
    }
    setLoading(false);
    setSelectedIds(new Set());
    if (failed === 0) {
      setFeedbackMsg({ type: 'success', text: `已成功移动 ${success} 人到「${targetName}」分组` });
    } else {
      setFeedbackMsg({ type: 'error', text: `移动完成，成功 ${success} 人，失败 ${failed} 人` });
    }
    setTimeout(() => setFeedbackMsg(null), 5000);
    onUpdate();
  };

  const getGroupInfo = (gid?: string) => gid ? groups.find(g => g.id === gid) : null;
  const ungrouped = candidates.filter(c => !c.groupId);

  // 按分组统计
  const groupStats = useMemo(() => {
    const map: Record<string, { valid: number; total: number; blacklist: number }> = {};
    map[''] = { valid: 0, total: 0, blacklist: 0 };
    groups.forEach(g => { map[g.id] = { valid: 0, total: 0, blacklist: 0 }; });
    candidates.forEach(c => {
      const key = c.groupId || '';
      if (map[key]) {
        map[key].total++;
        if (c.isBlacklisted) map[key].blacklist++; else map[key].valid++;
      } else {
        map[key] = { total: 1, valid: c.isBlacklisted ? 0 : 1, blacklist: c.isBlacklisted ? 1 : 0 };
      }
    });
    return map;
  }, [candidates, groups]);

  return (
    <div className="space-y-6">
      <div className="card-neon">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Users className="text-primary-400" size={20} />
              分组管理
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              共 {groups.length} 个分组 · {candidates.length} 个候选者（有效 {candidates.filter(c => !c.isBlacklisted).length} · 黑名单 {candidates.filter(c => c.isBlacklisted).length}）
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

        {/* 批量操作栏 */}
        <div className="p-4 rounded-xl bg-dark-300/50 border border-dashed border-white/10 space-y-3 mb-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm text-gray-300 flex items-center gap-2">
              <Target size={16} className="text-primary-400" />
              候选者筛选与批量移动
            </div>
            {selectedIds.size > 0 && (
              <div className="text-sm text-primary-300">
                已选中 <span className="font-bold text-white">{selectedIds.size}</span> 人
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="按编号或昵称搜索..."
                className="input-neon !py-2 pl-9 text-sm"
              />
            </div>
            <div className="flex items-center gap-2 min-w-[220px]">
              <Filter size={16} className="text-gray-500" />
              <select
                value={filterGroupId}
                onChange={(e) => setFilterGroupId(e.target.value)}
                className="input-neon !py-2 !text-white text-sm flex-1"
              >
                <option value="">全部分组</option>
                <option value="__ungrouped__">仅未分组</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <button
              onClick={toggleSelectAll}
              className="btn-outline flex items-center gap-1.5 !py-2 text-sm"
            >
              {allSelected ? <CheckSquare size={16} className="text-primary-400" /> : someSelected ? <CheckSquare size={16} className="text-primary-400 opacity-60" /> : <Square size={16} />}
              {allSelected ? '取消全选' : '全选当前'}
            </button>
          </div>

          <div className={`flex items-center gap-2 flex-wrap pt-2 border-t border-white/5 ${selectedIds.size === 0 ? 'opacity-50 pointer-events-none' : ''}`}>
            <MoveRight size={16} className="text-gray-500" />
            <span className="text-sm text-gray-400">将选中移动到：</span>
            <select
              value={batchTargetGroup}
              onChange={(e) => setBatchTargetGroup(e.target.value)}
              className="bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500"
            >
              <option value="">未分组（移出分组）</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <button
              onClick={handleBatchMove}
              disabled={selectedIds.size === 0 || loading}
              className="btn-neon !py-2 text-sm px-4 disabled:opacity-50"
            >
              {loading ? '移动中...' : '批量移动'}
            </button>
          </div>
        </div>

        {/* 筛选结果列表（带复选框） */}
        {(searchQuery || filterGroupId || selectedIds.size > 0) && filteredCandidates.length > 0 && (
          <div className="p-4 rounded-xl bg-dark-300/40 border border-white/5 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-gray-400">
                筛选结果 <span className="text-white font-semibold">{filteredCandidates.length}</span> 人
                {searchQuery && <> · 关键字：<span className="text-primary-300">{searchQuery}</span></>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto p-1">
              {filteredCandidates.map(c => {
                const selected = selectedIds.has(c.id);
                const g = getGroupInfo(c.groupId);
                return (
                  <div
                    key={c.id}
                    onClick={() => toggleSelect(c.id)}
                    className={`group flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer border transition-all ${
                      selected
                        ? 'bg-primary-500/15 border-primary-500/40'
                        : 'bg-dark-200 border-white/5 hover:border-primary-500/30'
                    } ${c.isBlacklisted ? 'opacity-70' : ''}`}
                  >
                    {selected ? <CheckSquare size={15} className="text-primary-400 shrink-0" /> : <Square size={15} className="text-gray-600 group-hover:text-gray-400 shrink-0" />}
                    <span className={`font-medium ${c.isBlacklisted ? 'text-red-400' : 'text-white'}`}>{c.number}</span>
                    {c.nickname && <span className="text-gray-400 text-xs truncate max-w-[120px]">{c.nickname}</span>}
                    {g ? (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border" style={{ backgroundColor: `${g.color}22`, borderColor: `${g.color}55`, color: g.color }}>
                        {g.name}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] text-gray-500 bg-gray-500/10 border border-gray-500/20">未分组</span>
                    )}
                    {c.isBlacklisted && <span className="text-[10px] text-red-400">[黑]</span>}
                  </div>
                );
              })}
            </div>
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
              const stat = groupStats[group.id] || { valid: 0, total: 0, blacklist: 0 };
              const members = candidates.filter(c => c.groupId === group.id);
              return (
                <div key={group.id} className="p-4 rounded-xl bg-dark-300/50 border border-white/5">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${group.color}22` }}>
                        <Users size={18} style={{ color: group.color }} />
                      </div>
                      <div>
                        <div className="font-semibold text-white flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: group.color }} />
                          {group.name}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-3">
                          <span><span className="text-green-400">{stat.valid}</span> 有效</span>
                          {stat.blacklist > 0 && <span><span className="text-red-400">{stat.blacklist}</span> 黑名单</span>}
                          <span className="text-gray-600">共 {stat.total}</span>
                          <span className="text-primary-400">
                            {rounds.filter(r => r.groupId === group.id).length} 轮
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">
                        {rounds.filter(r => r.groupId === group.id).reduce((s, r) => s + r.drawCount, 0)} 个中奖配额
                      </span>
                      <button
                        onClick={() => handleDelete(group.id, group.name)}
                        className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="删除分组"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {members.length === 0 ? (
                    <p className="text-sm text-gray-500 py-4 text-center">此分组暂无成员，使用上方批量移动功能添加成员</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {members.map((c) => (
                        <div
                          key={c.id}
                          className="group flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-200 text-sm"
                        >
                          <span className={`font-medium ${c.isBlacklisted ? 'text-red-400' : 'text-white'}`}>{c.number}</span>
                          {c.nickname && <span className="text-gray-400 text-xs">{c.nickname}</span>}
                          <select
                            value={c.groupId || ''}
                            onChange={(e) => handleMoveCandidate(c.id, e.target.value || undefined)}
                            onClick={(e) => e.stopPropagation()}
                            className="ml-2 bg-dark-300 text-xs text-gray-300 rounded px-1.5 py-0.5 border border-white/5 focus:outline-none focus:border-primary-500"
                          >
                            <option value="">未分组</option>
                            {groups.map(g => (
                              <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                          </select>
                          {c.isBlacklisted && <span className="text-xs text-red-400">[黑]</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {ungrouped.length > 0 && (
              <div className="p-4 rounded-xl bg-dark-300/30 border border-dashed border-white/10">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="font-medium text-gray-300">
                    未分组
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-3">
                    <span><span className="text-green-400">{(groupStats[''] || groupStats['__ungrouped__'] || { valid: 0 }).valid}</span> 有效</span>
                    <span>{ungrouped.filter(c => c.isBlacklisted).length > 0 && <>
                      <span className="text-red-400">{ungrouped.filter(c => c.isBlacklisted).length}</span> 黑名单
                    </>}</span>
                    <span className="text-gray-600">共 {ungrouped.length}</span>
                  </div>
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
