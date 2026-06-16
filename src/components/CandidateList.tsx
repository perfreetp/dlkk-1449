import { useState, useRef } from 'react';
import { Upload, Plus, Search, Trash2, UserPlus, X, AlertTriangle, Users } from 'lucide-react';
import { api } from '@/utils/api';
import type { Candidate, Group } from '../../shared/types';

interface CandidateListProps {
  activityId: string;
  candidates: Candidate[];
  groups?: Group[];
  onUpdate: () => void;
}

export function CandidateList({ activityId, candidates, groups = [], onUpdate }: CandidateListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCandidate, setNewCandidate] = useState({ number: '', nickname: '' });
  const [loading, setLoading] = useState(false);
  const [importMsg, setImportMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredCandidates = candidates.filter(
    (c) =>
      c.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.nickname?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.candidates.add(activityId, newCandidate);
      if (response.success) {
        setShowAddModal(false);
        setNewCandidate({ number: '', nickname: '' });
        onUpdate();
      }
    } catch (error) {
      console.error('Failed to add candidate:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validExts = ['.xlsx', '.xls', '.csv'];
    const fileName = file.name.toLowerCase();
    if (!validExts.some(ext => fileName.endsWith(ext))) {
      setImportMsg({ text: '只支持 .xlsx、.xls、.csv 格式文件', type: 'error' });
      setTimeout(() => setImportMsg(null), 4000);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    setLoading(true);
    setImportMsg(null);

    try {
      const response = await api.activities.importCandidates(activityId, formData);
      if (response.success && response.data) {
        const { imported, skippedDuplicate, skippedBlacklist, skippedEmpty } = response.data;
        const parts: string[] = [];
        parts.push(`成功导入 ${imported} 人`);
        if (skippedDuplicate > 0) parts.push(`跳过重复 ${skippedDuplicate} 个`);
        if (skippedBlacklist > 0) parts.push(`黑名单 ${skippedBlacklist} 个（不会参与抽取）`);
        if (skippedEmpty > 0) parts.push(`空行 ${skippedEmpty} 个`);
        setImportMsg({ text: parts.join('，'), type: 'success' });
        onUpdate();
      } else {
        setImportMsg({ text: `导入失败：${response.message || response.error || '未知错误'}`, type: 'error' });
      }
    } catch (error) {
      console.error('Failed to import candidates:', error);
      setImportMsg({ text: '导入失败，请检查文件格式', type: 'error' });
    } finally {
      setLoading(false);
      setTimeout(() => setImportMsg(null), 6000);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (candidateId: string) => {
    if (!confirm('确定要删除这个候选者吗？')) return;
    try {
      await api.candidates.delete(activityId, candidateId);
      onUpdate();
    } catch (error) {
      console.error('Failed to delete candidate:', error);
    }
  };

  const handleChangeGroup = async (candidateId: string, groupId: string) => {
    try {
      const res = await api.candidates.update(activityId, candidateId, { groupId });
      if (res.success) {
        onUpdate();
      }
    } catch (error) {
      console.error('Failed to change group:', error);
    }
  };

  const getGroupInfo = (gid?: string) => gid ? groups.find(g => g.id === gid) : null;

  const blacklistedCount = candidates.filter(c => c.isBlacklisted).length;

  return (
    <div className="card-neon">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">候选名单</h3>
          <p className="text-sm text-gray-400 mt-1">
            共 {candidates.length} 人
            {blacklistedCount > 0 && (
              <span className="text-red-400 ml-2">
                (含 {blacklistedCount} 个黑名单)
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImport}
          accept=".xlsx,.xls,.csv"
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="btn-outline flex items-center gap-2 text-sm py-2 disabled:opacity-50"
        >
          <Upload size={16} />
          {loading ? '导入中...' : '导入名单'}
        </button>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-neon flex items-center gap-2 text-sm py-2"
        >
          <Plus size={16} />
          添加
        </button>
      </div>
    </div>

    {importMsg && (
      <div className={`mb-4 px-4 py-3 rounded-xl text-sm border ${
        importMsg.type === 'success'
          ? 'bg-green-500/10 border-green-500/30 text-green-300' 
          : 'bg-red-500/10 border-red-500/30 text-red-300'
      }`}>
        {importMsg.text}
      </div>
    )}

      <div className="relative mb-4">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input-neon pl-12 py-2.5"
          placeholder="搜索编号或昵称..."
        />
      </div>

      <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2">
        {filteredCandidates.length === 0 ? (
          <div className="text-center py-12">
            <UserPlus className="mx-auto text-gray-600 mb-3" size={40} />
            <p className="text-gray-500">
              {searchTerm ? '未找到匹配的候选者' : '暂无候选者，请添加或导入'}
            </p>
          </div>
        ) : (
          filteredCandidates.map((candidate) => (
            <div
              key={candidate.id}
              className={`flex items-center justify-between p-3 rounded-xl transition-colors ${
                candidate.isBlacklisted
                  ? 'bg-red-500/10 border border-red-500/30'
                  : 'bg-dark-300/50 hover:bg-dark-300 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${
                  candidate.isBlacklisted
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-primary-500/20 text-primary-400'
                }`}>
                  {candidate.number.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-white">{candidate.number}</span>
                    {candidate.isBlacklisted && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-red-500/20 text-red-400">
                        <AlertTriangle size={10} />
                        黑名单（不会参与抽取）
                      </span>
                    )}
                    {(() => {
                      const g = getGroupInfo(candidate.groupId);
                      return g ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border" style={{ backgroundColor: `${g.color}22`, borderColor: `${g.color}55`, color: g.color }}>
                          <Users size={10} />
                          {g.name}
                        </span>
                      ) : null;
                    })()}
                  </div>
                  {candidate.nickname && (
                    <p className="text-sm text-gray-400">{candidate.nickname}</p>
                  )}
                </div>
                {groups.length > 0 && (
                  <select
                    value={candidate.groupId || ''}
                    onChange={(e) => handleChangeGroup(candidate.id, e.target.value)}
                    className="bg-dark-300 text-xs text-gray-300 rounded-lg px-2 py-1.5 border border-white/5 focus:outline-none focus:border-primary-500"
                    title="设置分组"
                  >
                    <option value="">未分组</option>
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                )}
              </div>
              <button
                onClick={() => handleDelete(candidate.id)}
                className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="gradient-border w-full max-w-md p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-xl font-bold text-white">添加候选者</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  编号 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newCandidate.number}
                  onChange={(e) => setNewCandidate({ ...newCandidate, number: e.target.value })}
                  className="input-neon"
                  placeholder="请输入编号"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  昵称（可选）
                </label>
                <input
                  type="text"
                  value={newCandidate.nickname}
                  onChange={(e) => setNewCandidate({ ...newCandidate, nickname: e.target.value })}
                  className="input-neon"
                  placeholder="请输入昵称"
                />
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
                  {loading ? '添加中...' : '添加'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
