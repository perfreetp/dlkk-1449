import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useStore } from '@/store/useStore';
import { api } from '@/utils/api';
import { formatDate } from '@/utils/format';
import { Settings as SettingsIcon, Ban, Plus, Trash2, UserX, AlertCircle, Search } from 'lucide-react';

export default function Settings() {
  const { blacklist, setBlacklist, currentUser } = useStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newBlacklist, setNewBlacklist] = useState({ number: '', reason: '' });
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadBlacklist();
  }, []);

  const loadBlacklist = async () => {
    try {
      const res = await api.blacklist.list();
      if (res.success) {
        setBlacklist(res.data || []);
      }
    } catch (error) {
      console.error('Load blacklist failed:', error);
    }
  };

  const handleAddBlacklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlacklist.number.trim()) return;

    setLoading(true);
    setFeedbackMsg(null);
    try {
      const res = await api.blacklist.add({
        number: newBlacklist.number.trim(),
        reason: newBlacklist.reason.trim(),
      });
      if (res.success && res.data) {
        setShowAddModal(false);
        setNewBlacklist({ number: '', reason: '' });
        const { invalidatedWinnerCount, message } = res.data;
        if (invalidatedWinnerCount > 0) {
          setFeedbackMsg({
            type: 'success',
            text: `已加入黑名单，并使 ${invalidatedWinnerCount} 条中奖记录失效。${message || ''} 建议到控制台对应轮次进行异常重抽补位。`,
          });
        } else {
          setFeedbackMsg({ type: 'success', text: res.data.message || '已加入黑名单' });
        }
        loadBlacklist();
        setTimeout(() => setFeedbackMsg(null), 8000);
      } else {
        setFeedbackMsg({ type: 'error', text: res.message || res.error || '添加失败' });
      }
    } catch (error) {
      console.error('Add blacklist failed:', error);
      setFeedbackMsg({ type: 'error', text: '添加失败，请稍后重试' });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveBlacklist = async (id: string) => {
    if (!confirm('确定要将该编号从黑名单中移除吗？')) return;

    try {
      const res = await api.blacklist.remove(id);
      if (res.success) {
        loadBlacklist();
      }
    } catch (error) {
      console.error('Remove blacklist failed:', error);
    }
  };

  const filteredBlacklist = blacklist.filter(item =>
    item.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.reason.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (currentUser?.role !== 'host') {
    return (
      <Layout>
        <div className="p-8">
          <div className="card-neon text-center py-20">
            <AlertCircle className="mx-auto text-gray-600 mb-4" size={64} />
            <h3 className="text-xl font-semibold text-white mb-2">权限不足</h3>
            <p className="text-gray-400">只有主播账号可以访问系统设置</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl font-bold text-white">系统设置</h1>
              <p className="text-gray-400 mt-1">黑名单管理和系统配置</p>
            </div>
          </div>
        </div>

        {feedbackMsg && (
          <div className={`mb-6 px-5 py-4 rounded-xl border ${
            feedbackMsg.type === 'success'
              ? 'bg-green-500/10 border-green-500/30 text-green-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}>
            {feedbackMsg.text}
          </div>
        )}

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2">
            <div className="card-neon">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Ban className="text-red-400" size={20} />
                  黑名单管理
                </h3>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="btn-neon flex items-center gap-2 text-sm py-2"
                >
                  <Plus size={16} />
                  添加黑名单
                </button>
              </div>

              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input-neon pl-10"
                    placeholder="搜索编号或原因..."
                  />
                </div>
              </div>

              <div className="space-y-3">
                {filteredBlacklist.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-dark-300/50 border border-red-500/10 hover:border-red-500/30 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                        <UserX className="text-red-400" size={22} />
                      </div>
                      <div>
                        <div className="font-bold text-white text-lg">{item.number}</div>
                        <div className="text-sm text-gray-400">{item.reason || '未填写原因'}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          添加时间：{formatDate(item.createdAt)}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveBlacklist(item.id)}
                      className="p-2.5 rounded-xl text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                      title="移除黑名单"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
                {filteredBlacklist.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <Ban className="mx-auto mb-4 opacity-30" size={48} />
                    <p>{searchQuery ? '未找到匹配的黑名单记录' : '暂无黑名单记录'}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="card-neon">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <SettingsIcon className="text-primary-400" size={20} />
                统计信息
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-dark-300/50">
                  <span className="text-gray-400">黑名单总数</span>
                  <span className="font-bold text-white text-xl">{blacklist.length}</span>
                </div>
                <div className="p-4 rounded-xl bg-dark-300/30 border border-white/5">
                  <h4 className="font-medium text-white mb-2">功能说明</h4>
                  <ul className="text-sm text-gray-400 space-y-2">
                    <li>• 黑名单中的编号将无法参与任何抽奖</li>
                    <li>• 添加黑名单后实时生效</li>
                    <li>• 移除后该编号可重新参与抽奖</li>
                    <li>• 只有主播账号可以管理黑名单</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="card-neon">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <AlertCircle className="text-neon-gold" size={20} />
                使用提示
              </h3>
              <div className="space-y-3 text-sm text-gray-400">
                <p>
                  <span className="text-neon-gold font-medium">1. </span>
                  黑名单适用于违规用户或重复报名的编号
                </p>
                <p>
                  <span className="text-neon-gold font-medium">2. </span>
                  添加时请填写清楚拉黑原因，便于后续追溯
                </p>
                <p>
                  <span className="text-neon-gold font-medium">3. </span>
                  已中奖用户被拉黑后，其获奖记录会被标记为无效
                </p>
                <p>
                  <span className="text-neon-gold font-medium">4. </span>
                  所有黑名单操作都会被记录在操作日志中
                </p>
              </div>
            </div>
          </div>
        </div>

        {showAddModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="gradient-border w-full max-w-md p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-xl font-bold text-white">添加黑名单</h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <span className="text-gray-400 text-2xl">&times;</span>
                </button>
              </div>

              <form onSubmit={handleAddBlacklist} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    编号 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={newBlacklist.number}
                    onChange={(e) => setNewBlacklist({ ...newBlacklist, number: e.target.value })}
                    className="input-neon"
                    placeholder="请输入要拉黑的编号"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    拉黑原因
                  </label>
                  <textarea
                    value={newBlacklist.reason}
                    onChange={(e) => setNewBlacklist({ ...newBlacklist, reason: e.target.value })}
                    className="input-neon min-h-[100px] resize-none"
                    placeholder="请输入拉黑原因（可选）"
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
                    disabled={loading || !newBlacklist.number.trim()}
                    className="btn-neon flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:shadow-[0_0_20px_rgba(239,68,68,0.6)]"
                  >
                    {loading ? '添加中...' : '确认拉黑'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
