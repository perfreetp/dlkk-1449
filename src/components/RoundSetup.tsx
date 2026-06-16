import { useState, useEffect } from 'react';
import { Plus, Settings, Trash2, Edit2, X, Check, Users } from 'lucide-react';
import { api } from '@/utils/api';
import { getStatusText, getStatusColor } from '@/utils/format';
import type { DrawRound, Group } from '../../shared/types';

interface RoundSetupProps {
  activityId: string;
  rounds: DrawRound[];
  winners: Array<{ roundId: string; isInvalid?: boolean }>;
  currentRoundId: string | null;
  onUpdate: () => void;
  onSelectRound: (roundId: string) => void;
}

export function RoundSetup({ activityId, rounds, winners, currentRoundId, onUpdate, onSelectRound }: RoundSetupProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRound, setEditingRound] = useState<DrawRound | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [newRound, setNewRound] = useState({
    name: '',
    drawCount: 1,
    allowRepeat: false,
    mode: 'single' as 'single' | 'multi',
    groupId: '' as string,
  });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (activityId) {
      api.groups.list(activityId).then(r => {
        if (r.success && r.data) setGroups(r.data);
      });
    }
  }, [activityId, showAddModal, editingRound]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      const response = await api.rounds.create(activityId, {
        ...newRound,
        groupId: newRound.groupId || undefined,
      });
      if (response.success) {
        setShowAddModal(false);
        setNewRound({ name: '', drawCount: 1, allowRepeat: false, mode: 'single', groupId: '' });
        onUpdate();
      } else {
        setErrorMsg(response.message || response.error);
      }
    } catch (error) {
      console.error('Failed to create round:', error);
      setErrorMsg('创建轮次失败');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRound) return;
    setErrorMsg(null);
    setLoading(true);
    try {
      const response = await api.rounds.update(activityId, editingRound.id, {
        name: editingRound.name,
        drawCount: editingRound.drawCount,
        allowRepeat: editingRound.allowRepeat,
        mode: editingRound.mode,
        groupId: editingRound.groupId,
      });
      if (response.success) {
        setEditingRound(null);
        onUpdate();
      } else {
        setErrorMsg(response.message || response.error);
      }
    } catch (error) {
      console.error('Failed to update round:', error);
      setErrorMsg('更新轮次失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (roundId: string, roundName: string, winnerCount: number) => {
    if (winnerCount > 0) {
      alert(`该轮次已有 ${winnerCount} 条中奖记录，无法删除。\n如需删除请先处理异常重抽或清空中奖结果。`);
      return;
    }
    if (!confirm(`确定要删除轮次「${roundName}」吗？删除后无法恢复。`)) return;
    try {
      setErrorMsg(null);
      const response = await api.rounds.remove(activityId, roundId);
      if (response.success) {
        onUpdate();
      } else {
        alert(response.message || response.error || '删除失败');
      }
    } catch (error) {
      console.error('Failed to delete round:', error);
      setErrorMsg('删除轮次失败');
    }
  };

  const getGroupColor = (gid?: string) => {
    if (!gid) return null;
    return groups.find(g => g.id === gid);
  };

  return (
    <div className="card-neon">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">抽取轮次</h3>
          <p className="text-sm text-gray-400 mt-1">共 {rounds.length} 轮</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-neon flex items-center gap-2 text-sm py-2"
        >
          <Plus size={16} />
          添加轮次
        </button>
      </div>

      {errorMsg && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm border bg-red-500/10 border-red-500/30 text-red-300">
          {errorMsg}
        </div>
      )}

      <div className="space-y-3">
        {rounds.length === 0 ? (
          <div className="text-center py-12">
            <Settings className="mx-auto text-gray-600 mb-3" size={40} />
            <p className="text-gray-500">暂无轮次，请创建抽取轮次</p>
          </div>
        ) : (
          rounds.map((round) => {
            const grp = getGroupColor(round.groupId);
            const validWinnerCount = winners.filter(w => w.roundId === round.id && !w.isInvalid).length;
            return (
              <div
                key={round.id}
                onClick={() => onSelectRound(round.id)}
                className={`p-4 rounded-xl cursor-pointer transition-all ${
                  currentRoundId === round.id
                    ? 'bg-gradient-to-r from-primary-500/20 to-neon-purple/20 border-2 border-primary-500/50'
                    : 'bg-dark-300/50 hover:bg-dark-300 border-2 border-transparent'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${
                      currentRoundId === round.id
                        ? 'bg-primary-500 text-white'
                        : 'bg-dark-200 text-gray-400'
                    }`}>
                      {round.roundNumber}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-white">{round.name}</span>
                        {grp && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border" style={{ backgroundColor: `${grp.color}22`, borderColor: `${grp.color}55`, color: grp.color }}>
                            <Users size={10} />
                            {grp.name}
                          </span>
                        )}
                        <span className={`status-dot ${round.status === 'drawing' ? 'active' : round.status === 'pending' ? 'pending' : 'completed'}`} />
                        <span className={`text-xs ${getStatusColor(round.status)}`}>
                          {getStatusText(round.status)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span>抽取 {round.drawCount} 人</span>
                        {validWinnerCount > 0 && (
                          <>
                            <span>·</span>
                            <span className="text-green-400">已抽 {validWinnerCount}/{round.drawCount}</span>
                          </>
                        )}
                        <span>·</span>
                        <span className={round.mode === 'single' ? 'text-blue-400' : 'text-purple-400'}>
                          {round.mode === 'single' ? '单抽 (一次1人)' : '连抽 (一次全部)'}
                        </span>
                        <span>·</span>
                        <span>{round.allowRepeat ? '可重复' : '不可重复'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setEditingRound(round)}
                      className="p-2 rounded-lg text-gray-500 hover:text-primary-400 hover:bg-primary-500/10 transition-colors"
                      title="编辑轮次"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(round.id, round.name, validWinnerCount)}
                      className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="删除轮次"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="gradient-border w-full max-w-md p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-xl font-bold text-white">添加轮次</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  轮次名称 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newRound.name}
                  onChange={(e) => setNewRound({ ...newRound, name: e.target.value })}
                  className="input-neon"
                  placeholder="例如：第一轮 幸运抽奖"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  抽取人数 <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={newRound.drawCount}
                  onChange={(e) => setNewRound({ ...newRound, drawCount: parseInt(e.target.value) || 1 })}
                  className="input-neon"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  抽取模式
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setNewRound({ ...newRound, mode: 'single' })}
                    className={`flex-1 py-3 rounded-xl border-2 transition-all ${
                      newRound.mode === 'single'
                        ? 'border-primary-500 bg-primary-500/20 text-white'
                        : 'border-white/10 text-gray-400 hover:border-white/20'
                    }`}
                  >
                    单抽
                    <p className="text-xs mt-1 opacity-70">一次抽一个</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewRound({ ...newRound, mode: 'multi' })}
                    className={`flex-1 py-3 rounded-xl border-2 transition-all ${
                      newRound.mode === 'multi'
                        ? 'border-primary-500 bg-primary-500/20 text-white'
                        : 'border-white/10 text-gray-400 hover:border-white/20'
                    }`}
                  >
                    连抽
                    <p className="text-xs mt-1 opacity-70">一次全部抽出</p>
                  </button>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-300">
                    抽取分组（可选）
                  </label>
                  {groups.length === 0 && (
                    <button
                      type="button"
                      onClick={() => window.alert('请到控制台「分组管理」Tab 中创建分组后再选择')}
                      className="text-xs text-primary-400 hover:text-primary-300"
                    >
                      + 创建分组
                    </button>
                  )}
                </div>
                {groups.length > 0 ? (
                  <>
                    <select
                      value={newRound.groupId}
                      onChange={(e) => setNewRound({ ...newRound, groupId: e.target.value })}
                      className="input-neon !text-white"
                    >
                      <option value="">全部候选者</option>
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">选择分组后，该轮次仅从该分组成员中抽取</p>
                  </>
                ) : (
                  <div className="p-3 rounded-xl bg-dark-300/50 border border-dashed border-white/10 text-sm text-gray-400">
                    还没有分组，请到「分组管理」Tab 中创建分组。不分组则默认从所有候选者中抽取。
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-dark-300/50">
                <div>
                  <p className="text-white font-medium">允许重复中奖</p>
                  <p className="text-xs text-gray-500 mt-0.5">同一候选者可在本轮多次中奖</p>
                </div>
                <button
                  type="button"
                  onClick={() => setNewRound({ ...newRound, allowRepeat: !newRound.allowRepeat })}
                  className={`w-12 h-6 rounded-full transition-all ${
                    newRound.allowRepeat ? 'bg-primary-500' : 'bg-gray-600'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      newRound.allowRepeat ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-outline flex-1"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-neon flex-1"
                >
                  {loading ? '创建中...' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingRound && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="gradient-border w-full max-w-md p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-xl font-bold text-white">编辑轮次</h2>
              <button
                onClick={() => setEditingRound(null)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleUpdate} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  轮次名称 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={editingRound.name}
                  onChange={(e) => setEditingRound({ ...editingRound, name: e.target.value })}
                  className="input-neon"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  抽取人数 <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={editingRound.drawCount}
                  onChange={(e) => setEditingRound({ ...editingRound, drawCount: parseInt(e.target.value) || 1 })}
                  className="input-neon"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  抽取模式
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingRound({ ...editingRound, mode: 'single' })}
                    className={`flex-1 py-3 rounded-xl border-2 transition-all ${
                      editingRound.mode === 'single'
                        ? 'border-primary-500 bg-primary-500/20 text-white'
                        : 'border-white/10 text-gray-400 hover:border-white/20'
                    }`}
                  >
                    单抽
                    <p className="text-xs mt-1 opacity-70">一次抽一个</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingRound({ ...editingRound, mode: 'multi' })}
                    className={`flex-1 py-3 rounded-xl border-2 transition-all ${
                      editingRound.mode === 'multi'
                        ? 'border-primary-500 bg-primary-500/20 text-white'
                        : 'border-white/10 text-gray-400 hover:border-white/20'
                    }`}
                  >
                    连抽
                    <p className="text-xs mt-1 opacity-70">一次全部抽出</p>
                  </button>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-300">
                    抽取分组（可选）
                  </label>
                  {groups.length === 0 && (
                    <button
                      type="button"
                      onClick={() => window.alert('请到控制台「分组管理」Tab 中创建分组后再选择')}
                      className="text-xs text-primary-400 hover:text-primary-300"
                    >
                      + 创建分组
                    </button>
                  )}
                </div>
                {groups.length > 0 ? (
                  <>
                    <select
                      value={editingRound.groupId || ''}
                      onChange={(e) => setEditingRound({ ...editingRound, groupId: e.target.value || undefined })}
                      className="input-neon !text-white"
                    >
                      <option value="">全部候选者</option>
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">选择分组后，该轮次仅从该分组成员中抽取</p>
                  </>
                ) : (
                  <div className="p-3 rounded-xl bg-dark-300/50 border border-dashed border-white/10 text-sm text-gray-400">
                    还没有分组，请到「分组管理」Tab 中创建分组。不分组则默认从所有候选者中抽取。
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-dark-300/50">
                <div>
                  <p className="text-white font-medium">允许重复中奖</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingRound({ ...editingRound, allowRepeat: !editingRound.allowRepeat })}
                  className={`w-12 h-6 rounded-full transition-all ${
                    editingRound.allowRepeat ? 'bg-primary-500' : 'bg-gray-600'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      editingRound.allowRepeat ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingRound(null)}
                  className="btn-outline flex-1"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-neon flex-1"
                >
                  {loading ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
