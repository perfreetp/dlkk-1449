import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { api } from '@/utils/api';
import { useSocket } from '@/hooks/useSocket';
import { formatTime } from '@/utils/format';
import { Mic, Copy, Send, CheckCircle, XCircle, AlertTriangle, TrendingUp, RefreshCw, Ban, Trophy, Volume2 } from 'lucide-react';
import type { Announcement, Winner, DrawRound } from '../../shared/types';

interface LiveAnnouncerProps {
  activityId: string;
  rounds: DrawRound[];
}

interface PendingAnnouncement {
  id: string;
  type: Announcement['type'];
  title: string;
  script: string;
  content: string;
  timestamp: string;
}

export function LiveAnnouncer({ activityId, rounds }: LiveAnnouncerProps) {
  const { announcements, addAnnouncement } = useStore();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pushedId, setPushedId] = useState<string | null>(null);
  const [customContent, setCustomContent] = useState('');
  const [pushedPendingId, setPushedPendingId] = useState<string | null>(null);
  const [copiedPendingId, setCopiedPendingId] = useState<string | null>(null);

  useSocket(activityId);

  const recentAnnouncements = announcements.filter(a => a.activityId === activityId).slice(-5).reverse();

  const getTypeIcon = (type: Announcement['type']) => {
    switch (type) {
      case 'win': return Trophy;
      case 'replenishment': return TrendingUp;
      case 'blacklist': return Ban;
      case 'redraw': return RefreshCw;
      case 'custom': return Mic;
    }
  };

  const getTypeColor = (type: Announcement['type']) => {
    switch (type) {
      case 'win': return 'text-[#FFD700] bg-[#FFD700]/10 border-[#FFD700]/30';
      case 'replenishment': return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
      case 'blacklist': return 'text-red-400 bg-red-500/10 border-red-500/30';
      case 'redraw': return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
      case 'custom': return 'text-green-400 bg-green-500/10 border-green-500/30';
    }
  };

  const getTypeLabel = (type: Announcement['type']) => {
    switch (type) {
      case 'win': return '抽中';
      case 'replenishment': return '补位';
      case 'blacklist': return '拉黑';
      case 'redraw': return '重抽';
      case 'custom': return '自定义';
    }
  };

  const pendingAnnouncements = useStore(state => state.pendingAnnouncements);
  const removePendingAnnouncement = useStore(state => state.removePendingAnnouncement);

  const handleCopy = async (text: string, id: string, isPending: boolean) => {
    try {
      await navigator.clipboard.writeText(text);
      if (isPending) {
        setCopiedPendingId(id);
        setTimeout(() => setCopiedPendingId(null), 1500);
      } else {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 1500);
      }
    } catch (e) {
      console.error('Copy failed:', e);
    }
  };

  const handlePush = async (ann: PendingAnnouncement | Announcement, isPending: boolean) => {
    try {
      await api.announcements.push(activityId, {
        type: ann.type,
        title: ann.title,
        content: ann.content,
        script: 'script' in ann ? ann.script : undefined,
      });
      if (isPending) {
        setPushedPendingId(ann.id);
        setTimeout(() => setPushedPendingId(null), 1500);
        removePendingAnnouncement(ann.id);
      } else {
        setPushedId(ann.id);
        setTimeout(() => setPushedId(null), 1500);
      }
    } catch (e) {
      console.error('Push failed:', e);
    }
  };

  const handleSendCustom = async () => {
    if (!customContent.trim()) return;
    try {
      await api.announcements.push(activityId, {
        type: 'custom',
        title: '主播通知',
        content: customContent.trim(),
      });
      setCustomContent('');
    } catch (e) {
      console.error('Send custom failed:', e);
    }
  };

  const handleDismissPending = (id: string) => {
    removePendingAnnouncement(id);
  };

  const handleEditPendingScript = (id: string, newScript: string) => {
    useStore.getState().updatePendingAnnouncementScript(id, newScript);
  };

  return (
    <div className="card-neon p-4 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-neon-pink/20 flex items-center justify-center">
          <Mic size={16} className="text-neon-pink" />
        </div>
        <div>
          <h3 className="font-semibold text-white">现场播报</h3>
          <p className="text-xs text-gray-500">自动生成口播，一键推送观众</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
          <span className="text-xs text-gray-500">监听中</span>
        </div>
      </div>

      {pendingAnnouncements.length > 0 && (
        <div className="mb-4 space-y-2">
          <h4 className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-1.5">
            <AlertTriangle size={12} className="text-amber-400" />
            待处理播报
          </h4>
          {pendingAnnouncements.map(ann => {
            const Icon = getTypeIcon(ann.type);
            const color = getTypeColor(ann.type);
            return (
              <div key={ann.id} className={`rounded-lg border p-3 ${color} bg-opacity-10`}>
                <div className="flex items-start gap-2">
                  <Icon size={16} className="mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">{getTypeLabel(ann.type)} · {formatTime(ann.timestamp)}</span>
                    </div>
                    <div className="font-medium text-white text-sm mt-1">{ann.title}</div>
                    <textarea
                      value={ann.script}
                      onChange={(e) => handleEditPendingScript(ann.id, e.target.value)}
                      className="mt-2 w-full p-2 text-xs bg-dark-300 border border-white/10 rounded-lg text-gray-300 focus:outline-none focus:border-primary-500 resize-none"
                      rows={2}
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => handleCopy(ann.script, ann.id, true)}
                        className="flex-1 py-1.5 text-xs rounded-lg bg-dark-300 hover:bg-dark-200 text-gray-300 flex items-center justify-center gap-1.5 transition-all"
                      >
                        {copiedPendingId === ann.id ? <CheckCircle size={12} className="text-neon-green" /> : <Copy size={12} />}
                        {copiedPendingId === ann.id ? '已复制' : '复制口播'}
                      </button>
                      <button
                        onClick={() => handlePush(ann, true)}
                        className="flex-1 py-1.5 text-xs rounded-lg bg-primary-500 hover:bg-primary-600 text-white flex items-center justify-center gap-1.5 transition-all"
                      >
                        {pushedPendingId === ann.id ? <CheckCircle size={12} /> : <Send size={12} />}
                        {pushedPendingId === ann.id ? '已推送' : '推送观众'}
                      </button>
                      <button
                        onClick={() => handleDismissPending(ann.id)}
                        className="py-1.5 px-2 text-xs rounded-lg bg-dark-300 hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-all"
                        title="忽略"
                      >
                        <XCircle size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mb-4">
        <h4 className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-1.5">
          <Volume2 size={12} className="text-primary-400" />
          快速播报
        </h4>
        <div className="flex gap-2">
          <input
            value={customContent}
            onChange={(e) => setCustomContent(e.target.value)}
            placeholder="输入要广播的消息..."
            className="flex-1 px-3 py-2 text-sm bg-dark-300 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
            onKeyDown={(e) => e.key === 'Enter' && handleSendCustom()}
          />
          <button
            onClick={handleSendCustom}
            disabled={!customContent.trim()}
            className="px-3 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-white text-sm flex items-center gap-1.5 transition-all"
          >
            <Send size={16} />
            推送
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <h4 className="text-xs font-medium text-gray-400 mb-2 sticky top-0 bg-dark-400/90 backdrop-blur py-1">已推送历史</h4>
        {recentAnnouncements.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            <Mic className="mx-auto mb-2 opacity-30" size={24} />
            <p>暂无播报记录</p>
            <p className="text-xs mt-1">抽中、拉黑、重抽时自动生成</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentAnnouncements.map(ann => {
              const Icon = getTypeIcon(ann.type);
              const color = getTypeColor(ann.type);
              return (
                <div key={ann.id} className={`rounded-lg border p-3 ${color}`}>
                  <div className="flex items-start gap-2">
                    <Icon size={16} className="mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{getTypeLabel(ann.type)}</span>
                        <span className="text-xs text-gray-500">{formatTime(ann.createdAt)}</span>
                      </div>
                      <div className="font-medium text-white text-sm mt-0.5">{ann.title}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{ann.content}</div>
                      {ann.script && (
                        <>
                          <div className="text-xs text-gray-500 mt-2 border-t border-white/5 pt-2 font-mono">{ann.script}</div>
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              onClick={() => handleCopy(ann.script, ann.id, false)}
                              className="flex-1 py-1 text-xs rounded bg-dark-300/80 hover:bg-dark-200 text-gray-300 flex items-center justify-center gap-1 transition-all"
                            >
                              {copiedId === ann.id ? <CheckCircle size={12} className="text-neon-green" /> : <Copy size={12} />}
                              {copiedId === ann.id ? '已复制' : '复制口播'}
                            </button>
                            <button
                              onClick={() => handlePush(ann, false)}
                              className="flex-1 py-1 text-xs rounded bg-primary-500/80 hover:bg-primary-600 text-white flex items-center justify-center gap-1 transition-all"
                            >
                              {pushedId === ann.id ? <CheckCircle size={12} /> : <Send size={12} />}
                              {pushedId === ann.id ? '已推送' : '再次推送'}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
