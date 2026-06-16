import { useState, useEffect, useRef } from 'react';
import { Send, Check, X, MessageSquare } from 'lucide-react';
import { api } from '@/utils/api';
import { useStore } from '@/store/useStore';
import type { Danmaku } from '../../shared/types';

interface DanmakuPanelProps {
  activityId: string;
  onUpdate: () => void;
}

export function DanmakuPanel({ activityId, onUpdate }: DanmakuPanelProps) {
  const { danmaku: danmakuList } = useStore();
  const [newMessage, setNewMessage] = useState('');
  const [senderNickname, setSenderNickname] = useState('');
  const [sending, setSending] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const pendingDanmaku = danmakuList.filter(d => !d.isApproved);
  const approvedDanmaku = danmakuList.filter(d => d.isApproved);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !senderNickname.trim()) return;

    setSending(true);
    try {
      const response = await api.danmaku.send(activityId, {
        content: newMessage.trim(),
        senderNickname: senderNickname.trim(),
      });
      if (response.success) {
        setNewMessage('');
        onUpdate();
      }
    } catch (error) {
      console.error('Failed to send danmaku:', error);
    } finally {
      setSending(false);
    }
  };

  const handleApprove = async (danmakuId: string) => {
    try {
      await api.danmaku.approve(activityId, danmakuId);
      onUpdate();
    } catch (error) {
      console.error('Failed to approve danmaku:', error);
    }
  };

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [approvedDanmaku]);

  return (
    <div className="card-neon flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="text-neon-pink" size={20} />
          <h3 className="text-lg font-semibold text-white">弹幕互动</h3>
        </div>
        {pendingDanmaku.length > 0 && (
          <span className="px-2 py-0.5 text-xs rounded-full bg-neon-pink/20 text-neon-pink border border-neon-pink/30">
            {pendingDanmaku.length} 待审核
          </span>
        )}
      </div>

      <form onSubmit={handleSend} className="space-y-3 mb-4">
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            value={senderNickname}
            onChange={(e) => setSenderNickname(e.target.value)}
            className="input-neon py-2 text-sm"
            placeholder="你的昵称"
            maxLength={20}
          />
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="input-neon py-2 text-sm"
            placeholder="发送弹幕..."
            maxLength={50}
          />
        </div>
        <button
          type="submit"
          disabled={sending || !newMessage.trim() || !senderNickname.trim()}
          className="btn-neon-pink w-full py-2 text-sm flex items-center justify-center gap-2"
        >
          <Send size={16} />
          发送弹幕
        </button>
      </form>

      {pendingDanmaku.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-400 mb-2">待审核</h4>
          <div className="space-y-2 max-h-[150px] overflow-y-auto">
            {pendingDanmaku.map((danmaku) => (
              <div
                key={danmaku.id}
                className="p-3 rounded-xl bg-dark-300/50 border border-white/5 flex items-center justify-between"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">{danmaku.content}</div>
                  <div className="text-xs text-gray-500">{danmaku.senderNickname}</div>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={() => handleApprove(danmaku.id)}
                    className="p-1.5 rounded-lg text-neon-green hover:bg-neon-green/10 transition-colors"
                    title="通过"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                    title="拒绝"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h4 className="text-sm font-medium text-gray-400 mb-2">已通过弹幕</h4>
        <div
          ref={containerRef}
          className="space-y-2 max-h-[200px] overflow-y-auto pr-2"
        >
          {approvedDanmaku.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              暂无弹幕，快来发送第一条吧！
            </div>
          ) : (
            approvedDanmaku.slice(-20).map((danmaku) => (
              <div
                key={danmaku.id}
                className="p-3 rounded-xl bg-dark-300/30"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-neon-pink">
                    {danmaku.senderNickname}
                  </span>
                  <Check size={12} className="text-neon-green" />
                </div>
                <p className="text-sm text-white">{danmaku.content}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
