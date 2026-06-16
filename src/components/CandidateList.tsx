import { useState, useRef } from 'react';
import { Upload, Plus, Search, Trash2, UserPlus, X, AlertTriangle } from 'lucide-react';
import { api } from '@/utils/api';
import type { Candidate } from '../../shared/types';

interface CandidateListProps {
  activityId: string;
  candidates: Candidate[];
  onUpdate: () => void;
}

export function CandidateList({ activityId, candidates, onUpdate }: CandidateListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCandidate, setNewCandidate] = useState({ number: '', nickname: '' });
  const [loading, setLoading] = useState(false);
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

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.activities.importCandidates(activityId, formData);
      if (response.success) {
        onUpdate();
      }
    } catch (error) {
      console.error('Failed to import candidates:', error);
    } finally {
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
            className="btn-outline flex items-center gap-2 text-sm py-2"
          >
            <Upload size={16} />
            导入名单
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
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{candidate.number}</span>
                    {candidate.isBlacklisted && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-red-500/20 text-red-400">
                        <AlertTriangle size={10} />
                        黑名单
                      </span>
                    )}
                  </div>
                  {candidate.nickname && (
                    <p className="text-sm text-gray-400">{candidate.nickname}</p>
                  )}
                </div>
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
