import { useState, useEffect, useRef } from 'react';
import { Layout } from '@/components/Layout';
import { useStore } from '@/store/useStore';
import { api } from '@/utils/api';
import { useSocket } from '@/hooks/useSocket';
import { formatTime } from '@/utils/format';
import { Users, Gift, Trophy, MessageCircle, Send, Lock, Unlock, RefreshCw, Sparkles, Clock, AlertCircle } from 'lucide-react';
import type { Danmaku, DrawRound, Candidate, Winner } from '../../shared/types';

export default function Draw() {
  const { currentActivity, candidates, rounds, winners, danmaku, drawState, setCandidates, setRounds, setWinners, setDanmaku } = useStore();
  const [danmakuInput, setDanmakuInput] = useState('');
  const [nickname, setNickname] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [signupNumber, setSignupNumber] = useState('');
  const [signupNickname, setSignupNickname] = useState('');
  const [signupCode, setSignupCode] = useState('');
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [signupLoading, setSignupLoading] = useState(false);
  const [visibleDanmaku, setVisibleDanmaku] = useState<Danmaku[]>([]);
  const danmakuContainerRef = useRef<HTMLDivElement>(null);
  const danmakuTrackRef = useRef<number[]>([0, 0, 0, 0, 0]);

  useSocket(currentActivity?.id);

  useEffect(() => {
    if (currentActivity) {
      loadData();
    }
  }, [currentActivity?.id]);

  useEffect(() => {
    if (currentActivity?.password) {
      setShowPasswordModal(true);
    } else {
      setIsUnlocked(true);
    }
  }, [currentActivity]);

  useEffect(() => {
    const approvedDanmaku = danmaku.filter(d => d.isApproved);
    const newDanmaku = approvedDanmaku.slice(-10);
    setVisibleDanmaku(newDanmaku);
  }, [danmaku]);

  const loadData = async () => {
    if (!currentActivity) return;
    
    try {
      const [candidatesRes, roundsRes, winnersRes, danmakuRes] = await Promise.all([
        api.candidates.list(currentActivity.id),
        api.rounds.list(currentActivity.id),
        api.winners.list(currentActivity.id),
        api.danmaku.list(currentActivity.id),
      ]);

      if (candidatesRes.success) setCandidates(candidatesRes.data || []);
      if (roundsRes.success) setRounds(roundsRes.data || []);
      if (winnersRes.success) setWinners(winnersRes.data || []);
      if (danmakuRes.success) setDanmaku(danmakuRes.data || []);
    } catch (error) {
      console.error('Load data failed:', error);
    }
  };

  const handlePasswordSubmit = () => {
    if (password === currentActivity?.password) {
      setIsUnlocked(true);
      setShowPasswordModal(false);
    } else {
      alert('口令错误，请重试');
    }
  };

  const handleSendDanmaku = async () => {
    if (!danmakuInput.trim() || !nickname.trim() || !currentActivity) return;
    
    try {
      await api.danmaku.send(currentActivity.id, {
        content: danmakuInput.trim(),
        senderNickname: nickname.trim(),
      });
      setDanmakuInput('');
    } catch (error) {
      console.error('Send danmaku failed:', error);
    }
  };

  const handleSignup = async () => {
    if (!signupNumber.trim() || !currentActivity) return;
    setSignupLoading(true);
    setSignupError(null);
    
    try {
      const res = await api.activities.signup(currentActivity.id, {
        number: signupNumber.trim(),
        nickname: signupNickname.trim() || undefined,
        password: signupCode.trim(),
      });
      if (res.success) {
        setSignupSuccess(true);
        setTimeout(() => {
          setShowSignupModal(false);
          setSignupSuccess(false);
          setSignupNumber('');
          setSignupNickname('');
          setSignupCode('');
          setSignupError(null);
          loadData();
        }, 2500);
      } else {
        setSignupError(res.message || res.error || '报名失败，请检查信息');
      }
    } catch (error) {
      console.error('Signup failed:', error);
      setSignupError('网络错误，请稍后重试');
    } finally {
      setSignupLoading(false);
    }
  };

  const currentRound = rounds.find(r => r.status === 'drawing') || rounds.find(r => r.status === 'pending') || null;
  const validCandidates = candidates.filter(c => !c.isBlacklisted);
  const roundWinners = currentRound ? winners.filter(w => w.roundId === currentRound.id && !w.isInvalid) : [];
  const remainingCount = currentRound ? currentRound.drawCount - roundWinners.length : 0;
  const wonCandidateIds = new Set(winners.filter(w => !w.isInvalid).map(w => w.candidateId));
  let currentRoundPool = currentRound
    ? (currentRound.groupId ? validCandidates.filter(c => c.groupId === currentRound.groupId) : validCandidates)
    : validCandidates;
  if (currentRound && !currentRound.allowRepeat) {
    const roundWonIds = new Set(roundWinners.map(w => w.candidateId));
    currentRoundPool = currentRoundPool.filter(c => !roundWonIds.has(c.id));
  }
  const availablePool = currentRound ? currentRoundPool : validCandidates.filter(c => !wonCandidateIds.has(c.id));

  const stats = {
    total: validCandidates.length,
    available: availablePool.length,
    won: wonCandidateIds.size,
    remaining: remainingCount,
  };

  if (!currentActivity) {
    return (
      <Layout requireAuth={false}>
        <div className="p-8">
          <div className="card-neon text-center py-20">
            <AlertCircle className="mx-auto text-gray-600 mb-4" size={64} />
            <h3 className="text-xl font-semibold text-white mb-2">请先选择一个活动</h3>
            <p className="text-gray-400">从活动管理页面选择一个活动</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!isUnlocked) {
    return (
      <Layout requireAuth={false}>
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="gradient-border w-full max-w-md p-8">
            <div className="text-center mb-8">
              <Lock className="mx-auto text-primary-400 mb-4" size={48} />
              <h2 className="font-display text-2xl font-bold text-white mb-2">输入活动口令</h2>
              <p className="text-gray-400 text-sm">{currentActivity.name}</p>
            </div>
            <div className="space-y-4">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-neon text-center text-xl"
                placeholder="请输入口令"
                onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
              />
              <button
                onClick={handlePasswordSubmit}
                className="btn-neon w-full flex items-center justify-center gap-2"
              >
                <Unlock size={20} />
                进入直播间
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout requireAuth={false}>
      <div className="p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold bg-gradient-to-r from-primary-400 via-neon-purple to-neon-pink bg-clip-text text-transparent">
                {currentActivity.name}
              </h1>
              <p className="text-gray-400 mt-1">盲盒拆盒直播抽签</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadData}
                className="p-2.5 rounded-xl bg-dark-300/80 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                title="刷新数据"
              >
                <RefreshCw size={18} />
              </button>
              <button
                onClick={() => setShowSignupModal(true)}
                className="btn-neon-pink px-6 py-2.5 flex items-center gap-2 text-sm"
              >
                <Sparkles size={16} />
                口令报名
              </button>
            </div>
          </div>
        </div>

        {currentRound && (
          <div className="rule-banner mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Trophy className="text-neon-gold" size={20} />
                  <span className="font-bold text-lg">{currentRound.name}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1.5">
                    <Users size={14} />
                    候选池: {stats.available} 人
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Gift size={14} />
                    剩余名额: {stats.remaining} / {currentRound.drawCount}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock size={14} />
                    {currentRound.mode === 'single' ? '单抽模式' : '连抽模式'} · {currentRound.allowRepeat ? '可重复' : '不可重复'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`status-dot ${currentRound.status === 'drawing' ? 'active' : currentRound.status === 'pending' ? 'pending' : 'completed'}`} />
                <span className="text-sm">
                  {currentRound.status === 'drawing' ? '抽取中' : currentRound.status === 'pending' ? '待抽取' : '已完成'}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-4 gap-6 mb-6">
          <div className="card-neon p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500 mb-1">总候选人数</div>
                <div className="text-3xl font-bold text-white">{stats.total}</div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary-500/20 flex items-center justify-center">
                <Users className="text-primary-400" size={24} />
              </div>
            </div>
          </div>
          <div className="card-neon p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500 mb-1">可抽取人数</div>
                <div className="text-3xl font-bold text-neon-green">{stats.available}</div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-neon-green/20 flex items-center justify-center">
                <Sparkles className="text-neon-green" size={24} />
              </div>
            </div>
          </div>
          <div className="card-neon p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500 mb-1">已中奖人数</div>
                <div className="text-3xl font-bold text-neon-gold">{stats.won}</div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-neon-gold/20 flex items-center justify-center">
                <Trophy className="text-neon-gold" size={24} />
              </div>
            </div>
          </div>
          <div className="card-neon p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500 mb-1">本轮剩余</div>
                <div className="text-3xl font-bold text-neon-pink">{stats.remaining}</div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-neon-pink/20 flex items-center justify-center">
                <Gift className="text-neon-pink" size={24} />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-6">
            <div className="gradient-border">
              <div className="p-8">
                <div className="relative flex flex-col items-center justify-center min-h-[350px]">
                  {drawState.isDrawing && <div className="draw-ring w-72 h-72" />}
                  
                  <div className="relative z-10 text-center">
                    {drawState.currentNumber ? (
                      <div className={`number-display ${drawState.isDrawing ? '' : 'animate-bounce-in winner-glow'}`}>
                        {drawState.currentNumber}
                      </div>
                    ) : (
                      <div className="number-display opacity-30">
                        ???
                      </div>
                    )}
                    
                    {!drawState.isDrawing && drawState.currentNumber && (
                      <div className="mt-6">
                        <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-neon-gold/20 border border-neon-gold/50 text-neon-gold">
                          <Trophy size={20} />
                          <span className="font-bold text-lg">
                            恭喜编号 {drawState.currentNumber} 中奖！
                          </span>
                        </div>
                      </div>
                    )}

                    {drawState.isDrawing && (
                      <div className="mt-6">
                        <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary-500/20 border border-primary-500/50 text-primary-300">
                          <RefreshCw size={20} className="animate-spin" />
                          <span className="font-medium text-lg">正在抽取中...</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div ref={danmakuContainerRef} className="relative h-32 mt-6 overflow-hidden">
                  {visibleDanmaku.map((d, index) => (
                    <div
                      key={d.id}
                      className="danmaku-item absolute"
                      style={{
                        top: `${(index % 5) * 24 + 8}px`,
                        animationDelay: `${index * 0.5}s`,
                        left: `${100 + Math.random() * 50}%`,
                      }}
                    >
                      <span className="text-primary-300 mr-2">{d.senderNickname}:</span>
                      <span className="text-white">{d.content}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {currentRound && roundWinners.length > 0 && (
              <div className="card-neon">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Trophy className="text-neon-gold" size={20} />
                    本轮中奖名单（按抽取顺序）
                  </h3>
                  <span className="text-sm text-gray-400">
                    已抽中 {roundWinners.length} / {currentRound.drawCount} 人
                    {currentRound.mode === 'single' && remainingCount > 0 && ` · 单抽剩余 ${remainingCount} 次`}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[...roundWinners]
                    .sort((a, b) => (a.drawOrder || 0) - (b.drawOrder || 0))
                    .map((winner) => (
                    <div
                      key={winner.id}
                      className={`p-4 rounded-xl border ${
                        winner.isReplenishment
                          ? 'bg-primary-500/10 border-primary-500/30'
                          : 'bg-dark-300/50 border-white/5 hover:border-neon-gold/30'
                      } transition-all`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                          winner.isReplenishment
                            ? 'bg-primary-500/30 text-primary-300'
                            : 'bg-neon-gold/20 text-neon-gold'
                        }`}>
                          {winner.drawOrder ?? '?'}
                        </div>
                        <div>
                          <div className="font-bold text-white text-lg">
                            {winner.candidate?.number}
                          </div>
                          {winner.candidate?.nickname && (
                            <div className="text-sm text-gray-400">
                              {winner.candidate.nickname}
                            </div>
                          )}
                          <div className="text-xs text-gray-500 mt-1">
                            {formatTime(winner.createdAt)}
                          </div>
                        </div>
                        {winner.isReplenishment && (
                          <span className="ml-auto text-xs px-2 py-1 rounded-full bg-primary-500/20 text-primary-300">
                            补位
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="card-neon">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <MessageCircle className="text-primary-400" size={20} />
                发送弹幕
              </h3>
              <div className="space-y-3">
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="input-neon text-sm"
                  placeholder="你的昵称"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={danmakuInput}
                    onChange={(e) => setDanmakuInput(e.target.value)}
                    className="input-neon text-sm flex-1"
                    placeholder="发送弹幕互动..."
                    onKeyDown={(e) => e.key === 'Enter' && handleSendDanmaku()}
                  />
                  <button
                    onClick={handleSendDanmaku}
                    disabled={!danmakuInput.trim() || !nickname.trim()}
                    className="btn-neon px-4 py-2 disabled:opacity-50"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </div>

            <div className="card-neon">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Users className="text-neon-purple" size={20} />
                编号池预览
              </h3>
              <div className="max-h-80 overflow-y-auto space-y-2">
                {availablePool.slice(0, 30).map((candidate) => (
                  <div
                    key={candidate.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-dark-300/50 hover:bg-dark-300 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary-500/20 flex items-center justify-center text-primary-300 font-mono text-sm font-bold">
                        {candidate.number.slice(-2)}
                      </div>
                      <div>
                        <div className="font-medium text-white">{candidate.number}</div>
                        {candidate.nickname && (
                          <div className="text-xs text-gray-500">{candidate.nickname}</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {availablePool.length > 30 && (
                  <div className="text-center text-sm text-gray-500 py-2">
                    ...还有 {availablePool.length - 30} 个编号
                  </div>
                )}
                {availablePool.length === 0 && (
                  <div className="text-center text-sm text-gray-500 py-8">
                    暂无可抽取的编号
                  </div>
                )}
              </div>
            </div>

            <div className="card-neon">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Gift className="text-neon-gold" size={20} />
                中奖公示
              </h3>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {winners.filter(w => !w.isInvalid).slice(-10).reverse().map((winner) => {
                  const round = rounds.find(r => r.id === winner.roundId);
                  return (
                    <div
                      key={winner.id}
                      className="p-3 rounded-xl bg-gradient-to-r from-neon-gold/10 to-transparent border border-neon-gold/20"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-neon-gold">{winner.candidate?.number}</div>
                          <div className="text-xs text-gray-500">
                            {winner.candidate?.nickname || '匿名'} · {round?.name}
                          </div>
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatTime(winner.createdAt)}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {winners.filter(w => !w.isInvalid).length === 0 && (
                  <div className="text-center text-sm text-gray-500 py-8">
                    暂无中奖记录
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showSignupModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="gradient-border w-full max-w-md p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-xl font-bold text-white">口令报名</h2>
              <button
                onClick={() => {
                  setShowSignupModal(false);
                  setSignupError(null);
                  setSignupSuccess(false);
                }}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <span className="text-gray-400 text-2xl">&times;</span>
              </button>
            </div>

            {signupSuccess ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-neon-green/20 flex items-center justify-center mx-auto mb-4">
                  <Trophy className="text-neon-green" size={32} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">报名成功！</h3>
                <p className="text-gray-400">
                  编号 <span className="text-neon-gold font-bold">{signupNumber}</span>
                  {signupNickname && ` (${signupNickname})`} 已加入候选池
                </p>
                <p className="text-xs text-gray-500 mt-3">刷新页面也能在编号池中看到自己</p>
              </div>
            ) : (
              <div className="space-y-4">
                {signupError && (
                  <div className="px-4 py-3 rounded-xl border bg-red-500/10 border-red-500/30 text-red-300 text-sm">
                    {signupError}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    你的编号 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={signupNumber}
                    onChange={(e) => setSignupNumber(e.target.value)}
                    className="input-neon"
                    placeholder="例如：A001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    你的昵称（可选）
                  </label>
                  <input
                    type="text"
                    value={signupNickname}
                    onChange={(e) => setSignupNickname(e.target.value)}
                    className="input-neon"
                    placeholder="显示在中奖名单上的昵称"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    报名口令 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={signupCode}
                    onChange={(e) => setSignupCode(e.target.value)}
                    className="input-neon"
                    placeholder="主播提供的报名口令，口令不对无法加入"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => {
                      setShowSignupModal(false);
                      setSignupError(null);
                    }}
                    className="btn-outline flex-1"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSignup}
                    disabled={!signupNumber.trim() || signupLoading}
                    className="btn-neon flex-1 disabled:opacity-50"
                  >
                    {signupLoading ? '报名中...' : '立即报名'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
