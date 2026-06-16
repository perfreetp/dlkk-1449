import { useState, useEffect, useCallback, useRef } from 'react';
import { Play, RotateCcw, AlertTriangle, FastForward, Users, Gift, Trophy, X, Info } from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '@/utils/api';
import { useStore } from '@/store/useStore';
import { generateRandomNumber, shuffleArray } from '@/utils/format';
import type { DrawRound, Candidate, Winner } from '../../shared/types';

interface DrawControlProps {
  activityId: string;
  currentRound: DrawRound | null;
  candidates: Candidate[];
  winners: Winner[];
  onUpdate: () => void;
}

export function DrawControl({ activityId, currentRound, candidates, winners, onUpdate }: DrawControlProps) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [displayNumber, setDisplayNumber] = useState<string | null>(null);
  const [newWinners, setNewWinners] = useState<Winner[]>([]);
  const [showHostTip, setShowHostTip] = useState(true);
  const animationRef = useRef<number | null>(null);
  const { drawState, setDrawState } = useStore();

  const availableCandidates = candidates.filter(c => !c.isBlacklisted);
  const groupedCandidates = currentRound?.groupId
    ? availableCandidates.filter(c => c.groupId === currentRound.groupId)
    : availableCandidates;
  const roundWinners = winners.filter(w => w.roundId === currentRound?.id && !w.isInvalid);
  const remainingCount = currentRound ? currentRound.drawCount - roundWinners.length : 0;
  const progress = currentRound ? (roundWinners.length / currentRound.drawCount) * 100 : 0;

  const getAvailablePool = useCallback(() => {
    if (!currentRound) return [];
    const pool = groupedCandidates;
    if (!currentRound.allowRepeat) {
      const wonIds = new Set(roundWinners.map(w => w.candidateId));
      return pool.filter(c => !wonIds.has(c.id));
    }
    return pool;
  }, [currentRound, groupedCandidates, roundWinners]);

  const availablePool = getAvailablePool();

  const triggerConfetti = () => {
    const count = 200;
    const defaults = { origin: { y: 0.7 }, zIndex: 9999 };

    function fire(particleRatio: number, opts: confetti.Options) {
      confetti({
        ...defaults,
        particleCount: Math.floor(count * particleRatio),
        ...opts,
      });
    }

    fire(0.25, {
      spread: 26,
      startVelocity: 55,
      colors: ['#6366f1', '#a855f7', '#ec4899'],
    });
    fire(0.2, {
      spread: 60,
      colors: ['#f59e0b', '#10b981', '#06b6d4'],
    });
    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.8,
      colors: ['#6366f1', '#a855f7', '#ec4899', '#f59e0b'],
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2,
      colors: ['#f59e0b'],
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 45,
      colors: ['#6366f1', '#a855f7'],
    });
  };

  const startAnimation = () => {
    const pool = getAvailablePool();
    if (pool.length === 0) return;

    let frame = 0;
    const totalFrames = 60;

    const animate = () => {
      frame++;
      const progress = frame / totalFrames;
      const speed = Math.max(1, Math.floor(20 * (1 - progress * 0.9)));

      if (frame % speed === 0) {
        const randomCandidate = pool[Math.floor(Math.random() * pool.length)];
        setDisplayNumber(randomCandidate.number);
        setDrawState({ currentNumber: randomCandidate.number });
      }

      if (frame < totalFrames) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animate();
  };

  const stopAnimation = (finalNumber: string) => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setDisplayNumber(finalNumber);
    setDrawState({ currentNumber: finalNumber, isDrawing: false });
    triggerConfetti();
  };

  const handleDraw = async () => {
    if (!currentRound || isDrawing) return;
    if (availablePool.length === 0) {
      alert('没有可抽取的候选者了！');
      return;
    }

    setIsDrawing(true);
    setDrawState({ isDrawing: true, currentRoundId: currentRound.id });
    setNewWinners([]);
    startAnimation();

    try {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const response = await api.rounds.draw(activityId, currentRound.id);

      if (response.success && response.data) {
        const drawResult = response.data as { winners: Winner[] };
        setNewWinners(drawResult.winners);

        if (drawResult.winners.length > 0) {
          stopAnimation(drawResult.winners[0].candidate?.number || '');
        }

        onUpdate();
      }
    } catch (error) {
      console.error('Draw failed:', error);
      setIsDrawing(false);
      setDrawState({ isDrawing: false });
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    } finally {
      setIsDrawing(false);
    }
  };

  const handleRedraw = async (winnerId: string) => {
    if (!currentRound || !confirm('确定要重抽这个中奖者吗？原结果将被标记为无效。')) return;

    try {
      const response = await api.rounds.redraw(activityId, currentRound.id, winnerId);
      if (response.success) {
        triggerConfetti();
        onUpdate();
      }
    } catch (error) {
      console.error('Redraw failed:', error);
    }
  };

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  if (!currentRound) {
    return (
      <div className="card-neon text-center py-16">
        <Gift className="mx-auto text-gray-600 mb-4" size={64} />
        <h3 className="text-xl font-semibold text-white mb-2">请选择一个轮次</h3>
        <p className="text-gray-400">从左侧列表选择要进行抽取的轮次</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showHostTip && (
        <div className="relative p-4 rounded-xl bg-neon-gold/10 border border-neon-gold/30">
          <div className="flex items-start gap-3">
            <Info className="text-neon-gold flex-shrink-0 mt-0.5" size={20} />
            <div className="flex-1">
              <h4 className="font-medium text-neon-gold mb-1">主持提示</h4>
              <p className="text-sm text-gray-300">
                本轮规则：{currentRound.name}，抽取 {currentRound.drawCount} 人，
                {currentRound.allowRepeat ? '允许' : '不允许'}重复中奖，
                <span className={currentRound.mode === 'single' ? 'text-blue-300' : 'text-purple-300'}>
                  {currentRound.mode === 'single' ? '单抽模式（点一次出1人）' : '连抽模式（一次抽完整轮）'}
                </span>
                {currentRound.groupId ? `，分组抽取` : ''}
                。点击下方按钮开始抽取！
              </p>
            </div>
            <button
              onClick={() => setShowHostTip(false)}
              className="p-1 rounded hover:bg-white/10 transition-colors"
            >
              <X size={16} className="text-gray-400" />
            </button>
          </div>
        </div>
      )}

      <div className="rule-banner flex items-center justify-between">
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <Trophy className="text-neon-gold" size={18} />
            <span className="font-medium">{currentRound.name}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-white/80">
            <Users size={16} />
            <span>候选池：{availablePool.length} 人</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-white/80">
            <Gift size={16} />
            <span>剩余名额：{remainingCount} / {currentRound.drawCount}</span>
          </div>
          {remainingCount > 0 && remainingCount < currentRound.drawCount && currentRound.mode === 'single' && (
            <div className="text-xs px-2 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300">
              单抽进行中（还需 {remainingCount} 次）
            </div>
          )}
        </div>
        <div className="text-sm text-white/80">
          <span className={currentRound.mode === 'single' ? 'text-blue-300' : 'text-purple-300'}>
            {currentRound.mode === 'single' ? '单抽模式' : '连抽模式'}
          </span>
          {' · '}
          {currentRound.allowRepeat ? '可重复' : '不可重复'}
          {currentRound.groupId && ' · 分组抽取'}
        </div>
      </div>

      <div className="gradient-border">
        <div className="p-8">
          <div className="relative flex flex-col items-center justify-center min-h-[300px]">
            {isDrawing && <div className="draw-ring w-64 h-64" />}

            <div className="relative z-10 text-center">
              {displayNumber ? (
                <div className={`number-display ${isDrawing ? '' : 'animate-bounce-in'}`}>
                  {displayNumber}
                </div>
              ) : (
                <div className="number-display opacity-30">
                  ???
                </div>
              )}

              {newWinners.length > 0 && !isDrawing && (
                <div className="mt-6 space-y-2">
                  {newWinners.map((winner, index) => (
                    <div
                      key={winner.id}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-neon-gold/20 border border-neon-gold/50 text-neon-gold"
                      style={{ animationDelay: `${index * 0.2}s` }}
                    >
                      <Trophy size={16} />
                      <span className="font-medium">
                        {winner.candidate?.number}
                        {winner.candidate?.nickname && ` (${winner.candidate.nickname})`}
                      </span>
                      {winner.isReplenishment && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary-500/20 text-primary-300">
                          补位
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-8">
            <div className="h-2 bg-dark-300 rounded-full overflow-hidden mb-6">
              <div
                className="h-full bg-gradient-to-r from-primary-500 to-neon-purple transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handleDraw}
                disabled={isDrawing || remainingCount <= 0 || currentRound.status === 'completed'}
                className="btn-neon-gold px-12 py-4 text-lg font-bold flex items-center gap-3 disabled:opacity-50"
              >
                {isDrawing ? (
                  <>
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    抽取中...
                  </>
                ) : currentRound.mode === 'multi' ? (
                  <>
                    <FastForward size={24} />
                    一键抽取
                  </>
                ) : (
                  <>
                    <Play size={24} />
                    开始抽取
                  </>
                )}
              </button>

              {newWinners.length > 0 && !isDrawing && (
                <button
                  onClick={() => {
                    setDisplayNumber(null);
                    setNewWinners([]);
                  }}
                  className="btn-outline px-8 py-4 flex items-center gap-2"
                >
                  <RotateCcw size={20} />
                  重置显示
                </button>
              )}
            </div>

            {currentRound.status === 'completed' && (
              <p className="text-center text-neon-green mt-4">
                ✓ 本轮抽取已完成
              </p>
            )}
          </div>
        </div>
      </div>

      {roundWinners.length > 0 && (
        <div className="card-neon">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">本轮中奖名单（按抽取顺序）</h3>
            <span className="text-sm text-gray-400">
              已抽中 {roundWinners.length} / {currentRound.drawCount} 人
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[...roundWinners]
              .sort((a, b) => (a.drawOrder || 0) - (b.drawOrder || 0))
              .map((winner) => (
              <div
                key={winner.id}
                className={`p-4 rounded-xl border ${
                  winner.isReplenishment
                    ? 'bg-primary-500/10 border-primary-500/30'
                    : 'bg-dark-300/50 border-white/5'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                      winner.isReplenishment
                        ? 'bg-primary-500/30 text-primary-300'
                        : 'bg-neon-gold/20 text-neon-gold'
                    }`}>
                      {winner.drawOrder ?? '?'}
                    </div>
                    <div>
                      <div className="font-medium text-white">
                        {winner.candidate?.number}
                      </div>
                      {winner.candidate?.nickname && (
                        <div className="text-xs text-gray-400">
                          {winner.candidate.nickname}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {winner.isReplenishment && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary-500/20 text-primary-300">
                        补位
                      </span>
                    )}
                    <button
                      onClick={() => handleRedraw(winner.id)}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="异常重抽（原结果无效，抽取新的补位）"
                    >
                      <AlertTriangle size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
