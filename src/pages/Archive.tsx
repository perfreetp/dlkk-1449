import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useStore } from '@/store/useStore';
import { api } from '@/utils/api';
import { formatDate } from '@/utils/format';
import { Archive as ArchiveIcon, Package, Calendar, Users, Trophy, ArrowUpCircle, AlertCircle, Eye } from 'lucide-react';
import type { Activity } from '../../shared/types';

export default function Archive() {
  const { activities, setActivities, currentUser } = useStore();
  const [archivedActivities, setArchivedActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    loadArchivedActivities();
  }, []);

  const loadArchivedActivities = async () => {
    try {
      const res = await api.activities.list();
      if (res.success) {
        const allActivities = res.data || [];
        setArchivedActivities(allActivities.filter(a => a.status === 'archived'));
        setActivities(allActivities.filter(a => a.status !== 'archived'));
      }
    } catch (error) {
      console.error('Load archived activities failed:', error);
    }
  };

  const handleArchive = async (activityId: string) => {
    if (!confirm('确定要归档这个活动吗？归档后活动将移至归档列表。')) return;

    setLoading(activityId);
    try {
      const res = await api.activities.archive(activityId);
      if (res.success) {
        loadArchivedActivities();
      }
    } catch (error) {
      console.error('Archive activity failed:', error);
    } finally {
      setLoading(null);
    }
  };

  const handleUnarchive = async (activityId: string) => {
    if (!confirm('确定要恢复这个活动吗？')) return;

    setLoading(activityId);
    try {
      const res = await api.activities.unarchive(activityId);
      if (res.success) {
        loadArchivedActivities();
      }
    } catch (error) {
      console.error('Unarchive activity failed:', error);
    } finally {
      setLoading(null);
    }
  };

  const isHost = currentUser?.role === 'host';

  return (
    <Layout>
      <div className="p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl font-bold text-white">活动归档</h1>
              <p className="text-gray-400 mt-1">管理已结束的活动归档</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Package className="text-primary-400" size={20} />
              可归档的活动
            </h2>
            <div className="space-y-4">
              {activities.filter(a => a.status === 'completed').length > 0 ? (
                activities.filter(a => a.status === 'completed').map((activity) => (
                  <div
                    key={activity.id}
                    className="card-neon hover:border-primary-500/50 transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-white text-lg">{activity.name}</h3>
                        <p className="text-sm text-gray-400 mt-1">{activity.description || '无描述'}</p>
                      </div>
                      {isHost && (
                        <button
                          onClick={() => handleArchive(activity.id)}
                          disabled={loading === activity.id}
                          className="btn-outline px-4 py-2 text-sm flex items-center gap-1.5"
                        >
                          {loading === activity.id ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <ArchiveIcon size={16} />
                          )}
                          归档
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-6 text-sm text-gray-500">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={14} />
                        创建于 {formatDate(activity.createdAt)}
                      </span>
                      {activity.endedAt && (
                        <span className="flex items-center gap-1.5">
                          <Calendar size={14} />
                          结束于 {formatDate(activity.endedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="card-neon text-center py-16">
                  <Package className="mx-auto text-gray-600 mb-4" size={48} />
                  <p className="text-gray-500">暂无可归档的活动</p>
                  <p className="text-xs text-gray-600 mt-2">已结束的活动可以在这里进行归档</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <ArchiveIcon className="text-neon-purple" size={20} />
              已归档的活动
              <span className="text-sm font-normal text-gray-500">({archivedActivities.length})</span>
            </h2>
            <div className="space-y-4">
              {archivedActivities.length > 0 ? (
                archivedActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="card-neon border-gray-700/30 opacity-80 hover:opacity-100 transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-300 text-lg">{activity.name}</h3>
                        <p className="text-sm text-gray-500 mt-1">{activity.description || '无描述'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isHost && (
                          <button
                            onClick={() => handleUnarchive(activity.id)}
                            disabled={loading === activity.id}
                            className="btn-outline px-4 py-2 text-sm flex items-center gap-1.5 border-neon-purple/50 text-neon-purple hover:bg-neon-purple/10"
                          >
                            {loading === activity.id ? (
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <ArrowUpCircle size={16} />
                            )}
                            恢复
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm text-gray-600">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={14} />
                        创建于 {formatDate(activity.createdAt)}
                      </span>
                      {activity.endedAt && (
                        <span className="flex items-center gap-1.5">
                          <Calendar size={14} />
                          结束于 {formatDate(activity.endedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="card-neon text-center py-16 border-gray-700/30">
                  <ArchiveIcon className="mx-auto text-gray-600 mb-4" size={48} />
                  <p className="text-gray-500">暂无已归档的活动</p>
                  <p className="text-xs text-gray-600 mt-2">归档的活动将保存在这里</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {!isHost && (
          <div className="mt-6 p-4 rounded-xl bg-neon-gold/10 border border-neon-gold/30">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-neon-gold flex-shrink-0 mt-0.5" size={20} />
              <div>
                <h4 className="font-medium text-neon-gold mb-1">权限提示</h4>
                <p className="text-sm text-gray-300">
                  只有主播账号可以进行归档和恢复操作，助播账号仅可查看。
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 card-neon">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Eye className="text-neon-green" size={20} />
            归档说明
          </h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-medium text-white">归档规则</h4>
              <ul className="text-sm text-gray-400 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-neon-gold">•</span>
                  只有已结束（completed）状态的活动可以归档
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-neon-gold">•</span>
                  归档后的活动不会出现在活动列表中
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-neon-gold">•</span>
                  归档的活动数据会被永久保留，可随时恢复
                </li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="font-medium text-white">归档后的数据</h4>
              <ul className="text-sm text-gray-400 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-primary-400">•</span>
                  候选名单、中奖记录、操作日志全部保留
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-400">•</span>
                  可在结果公示页切换查看已归档活动
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-400">•</span>
                  恢复后活动回到已结束状态，可重新开始
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
