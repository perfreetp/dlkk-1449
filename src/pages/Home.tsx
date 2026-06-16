import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Play,
  Archive,
  MoreVertical,
  Calendar,
  Users,
  Trophy,
  Settings,
  Edit2,
  Trash2,
  Eye,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { api } from '@/utils/api';
import { formatDate, getStatusText, getStatusColor } from '@/utils/format';
import type { Activity } from '../../shared/types';

export default function Home() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newActivity, setNewActivity] = useState({ name: '', description: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const { setCurrentActivity, currentActivity } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    loadActivities();
  }, []);

  const loadActivities = async () => {
    try {
      const response = await api.activities.list();
      if (response.success && response.data) {
        setActivities(response.data as Activity[]);
      }
    } catch (error) {
      console.error('Failed to load activities:', error);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.activities.create(newActivity);
      if (response.success && response.data) {
        setShowCreateModal(false);
        setNewActivity({ name: '', description: '', password: '' });
        loadActivities();
      }
    } catch (error) {
      console.error('Failed to create activity:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectActivity = (activity: Activity) => {
    setCurrentActivity(activity);
    navigate('/console');
  };

  const handleStart = async (activity: Activity) => {
    try {
      await api.activities.start(activity.id);
      loadActivities();
    } catch (error) {
      console.error('Failed to start activity:', error);
    }
  };

  const handleEnd = async (activity: Activity) => {
    try {
      await api.activities.end(activity.id);
      loadActivities();
    } catch (error) {
      console.error('Failed to end activity:', error);
    }
  };

  const handleArchive = async (activity: Activity) => {
    try {
      await api.activities.archive(activity.id);
      loadActivities();
    } catch (error) {
      console.error('Failed to archive activity:', error);
    }
  };

  const handleUnarchive = async (activity: Activity) => {
    try {
      await api.activities.unarchive(activity.id);
      loadActivities();
    } catch (error) {
      console.error('Failed to unarchive activity:', error);
    }
  };

  const stats = {
    total: activities.length,
    active: activities.filter(a => a.status === 'active').length,
    completed: activities.filter(a => a.status === 'completed').length,
    archived: activities.filter(a => a.status === 'archived').length,
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-white mb-2">活动管理</h1>
          <p className="text-gray-400">管理所有直播抽签活动</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-neon flex items-center gap-2"
        >
          <Plus size={20} />
          创建活动
        </button>
      </div>

      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="card-neon">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary-500/20 flex items-center justify-center">
              <Calendar className="text-primary-400" size={24} />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{stats.total}</div>
              <div className="text-sm text-gray-400">总活动数</div>
            </div>
          </div>
        </div>
        <div className="card-neon">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-neon-green/20 flex items-center justify-center">
              <Play className="text-neon-green" size={24} />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{stats.active}</div>
              <div className="text-sm text-gray-400">进行中</div>
            </div>
          </div>
        </div>
        <div className="card-neon">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary-500/20 flex items-center justify-center">
              <Trophy className="text-primary-400" size={24} />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{stats.completed}</div>
              <div className="text-sm text-gray-400">已完成</div>
            </div>
          </div>
        </div>
        <div className="card-neon">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gray-500/20 flex items-center justify-center">
              <Archive className="text-gray-400" size={24} />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{stats.archived}</div>
              <div className="text-sm text-gray-400">已归档</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card-neon p-0 overflow-hidden">
        <div className="p-6 border-b border-white/5">
          <h2 className="text-lg font-semibold text-white">活动列表</h2>
        </div>
        <div className="divide-y divide-white/5">
          {activities.length === 0 ? (
            <div className="p-12 text-center">
              <Settings className="mx-auto text-gray-600 mb-4" size={48} />
              <p className="text-gray-400">暂无活动，点击上方按钮创建</p>
            </div>
          ) : (
            activities.map((activity) => (
              <div
                key={activity.id}
                className="p-6 hover:bg-white/5 transition-colors cursor-pointer group"
                onClick={() => handleSelectActivity(activity)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-white">{activity.name}</h3>
                      <span className={`status-dot ${activity.status === 'active' ? 'active' : activity.status === 'draft' ? 'pending' : 'completed'}`} />
                      <span className={`text-sm ${getStatusColor(activity.status)}`}>
                        {getStatusText(activity.status)}
                      </span>
                      {currentActivity?.id === activity.id && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-primary-500/20 text-primary-400 border border-primary-500/30">
                          当前活动
                        </span>
                      )}
                    </div>
                    {activity.description && (
                      <p className="text-gray-400 text-sm mb-3">{activity.description}</p>
                    )}
                    <div className="flex items-center gap-6 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {formatDate(activity.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                    {activity.status === 'draft' && (
                      <button
                        onClick={() => handleStart(activity)}
                        className="px-4 py-2 rounded-lg text-sm bg-neon-green/20 text-neon-green hover:bg-neon-green/30 transition-colors"
                      >
                        开始活动
                      </button>
                    )}
                    {activity.status === 'active' && (
                      <button
                        onClick={() => handleEnd(activity)}
                        className="px-4 py-2 rounded-lg text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                      >
                        结束活动
                      </button>
                    )}
                    {activity.status === 'completed' && (
                      <button
                        onClick={() => handleArchive(activity)}
                        className="px-4 py-2 rounded-lg text-sm bg-gray-500/20 text-gray-400 hover:bg-gray-500/30 transition-colors"
                      >
                        归档
                      </button>
                    )}
                    {activity.status === 'archived' && (
                      <button
                        onClick={() => handleUnarchive(activity)}
                        className="px-4 py-2 rounded-lg text-sm bg-primary-500/20 text-primary-400 hover:bg-primary-500/30 transition-colors"
                      >
                        恢复
                      </button>
                    )}
                    <div className="relative">
                      <button
                        onClick={() => setMenuOpen(menuOpen === activity.id ? null : activity.id)}
                        className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                      >
                        <MoreVertical size={20} className="text-gray-400" />
                      </button>
                      {menuOpen === activity.id && (
                        <div className="absolute right-0 top-full mt-2 w-48 bg-dark-200 border border-white/10 rounded-xl shadow-xl overflow-hidden z-10">
                          <button
                            onClick={() => navigate('/results')}
                            className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-white/5 flex items-center gap-2"
                          >
                            <Eye size={16} />
                            查看结果
                          </button>
                          <button
                            onClick={() => {}}
                            className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-white/5 flex items-center gap-2"
                          >
                            <Edit2 size={16} />
                            编辑活动
                          </button>
                          <button
                            onClick={() => {}}
                            className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                          >
                            <Trash2 size={16} />
                            删除活动
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="gradient-border w-full max-w-md p-8">
            <h2 className="font-display text-2xl font-bold text-white mb-6">创建新活动</h2>
            <form onSubmit={handleCreate} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  活动名称 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newActivity.name}
                  onChange={(e) => setNewActivity({ ...newActivity, name: e.target.value })}
                  className="input-neon"
                  placeholder="请输入活动名称"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  活动描述
                </label>
                <textarea
                  value={newActivity.description}
                  onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
                  className="input-neon min-h-[100px] resize-none"
                  placeholder="请输入活动描述（可选）"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  访问密码（可选）
                </label>
                <input
                  type="password"
                  value={newActivity.password}
                  onChange={(e) => setNewActivity({ ...newActivity, password: e.target.value })}
                  className="input-neon"
                  placeholder="设置密码保护活动（可选）"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
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
    </div>
  );
}
