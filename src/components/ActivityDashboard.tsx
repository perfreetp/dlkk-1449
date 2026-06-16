import { useMemo, useState } from 'react';
import { Users, UserCheck, Ban, Trophy, CircleDollarSign, Clock, BarChart3, Users2, Target, TrendingUp, CheckCircle2, XCircle } from 'lucide-react';
import type { Candidate, DrawRound, Winner, Group } from '../../shared/types';

interface ActivityDashboardProps {
  candidates: Candidate[];
  rounds: DrawRound[];
  winners: Winner[];
  groups: Group[];
  currentRoundId: string | null;
  onSelectRound: (roundId: string | null) => void;
}

interface RoundStats {
  round: DrawRound | null;
  roundNumber: string;
  poolTotal: number;       // 该轮次抽取池总候选数（含分组过滤前？这里按分组过滤后）
  poolValid: number;       // 可用抽取数（不拉黑的）
  poolBlacklist: number;   // 抽取池中的黑名单（不参与抽取的）
  poolWon: number;         // 轮次中已抽中的有效中奖人数（不包括失效）
  poolRemaining: number;   // 剩余名额
  poolInvalidWins: number; // 已抽中但后失效的数量
}

export function ActivityDashboard({ candidates, rounds, winners, groups, currentRoundId, onSelectRound }: ActivityDashboardProps) {
  const [showAll, setShowAll] = useState(false);

  const globalStats = useMemo(() => {
    const total = candidates.length;
    const valid = candidates.filter(c => !c.isBlacklisted).length;
    const blacklistCount = candidates.filter(c => c.isBlacklisted).length;
    const validWins = winners.filter(w => !w.isInvalid).length;
    const invalidWins = winners.filter(w => w.isInvalid).length;
    const roundCapacity = rounds.reduce((sum, r) => sum + r.drawCount, 0);
    const remainingCapacity = Math.max(0, roundCapacity - validWins);
    const wonCandidateIds = new Set(winners.filter(w => !w.isInvalid).map(w => w.candidateId));
    const remainingValid = valid - rounds.filter(r => !r.allowRepeat).reduce(
      (sum, r) => sum + Math.min(r.drawCount, winners.filter(w => w.roundId === r.id && !w.isInvalid).length),
      0
    );
    return {
      total, valid, blacklistCount, validWins, invalidWins, roundCapacity,
      remainingCapacity, remainingValid: Math.max(0, remainingValid),
      wonCandidateIds,
    };
  }, [candidates, rounds, winners]);

  const roundStats = useMemo<RoundStats[]>(() => {
    const stats: RoundStats[] = [];
    rounds.forEach((round) => {
      const poolCandidates = round.groupId
        ? candidates.filter(c => c.groupId === round.groupId)
        : candidates;
      const poolValid = poolCandidates.filter(c => !c.isBlacklisted).length;
      const poolBlacklist = poolCandidates.filter(c => c.isBlacklisted).length;

      const roundWinners = winners.filter(w => w.roundId === round.id);
      const validWins = roundWinners.filter(w => !w.isInvalid).length;
      const invalidWins = roundWinners.filter(w => w.isInvalid).length;

      let availableForRound = poolValid;
      if (!round.allowRepeat) {
        const wonInRound = new Set(roundWinners.filter(w => !w.isInvalid).map(w => w.candidateId));
        availableForRound = poolValid - wonInRound.size;
      }
      const remaining = Math.max(0, round.drawCount - validWins);

      stats.push({
        round,
        roundNumber: `第 ${round.roundNumber} 轮`,
        poolTotal: poolCandidates.length,
        poolValid,
        poolBlacklist,
        poolWon: validWins,
        poolRemaining: remaining,
        poolInvalidWins: invalidWins,
      });
    });
    return stats;
  }, [rounds, candidates, winners]);

  const getGroupInfo = (gid?: string) => gid ? groups.find(g => g.id === gid) : null;

  const StatCard = ({ icon: Icon, label, value, sub, tone }: {
    icon: React.ComponentType<any>;
    label: string;
    value: string | number;
    sub?: string;
    tone: 'blue' | 'green' | 'red' | 'gold' | 'purple' | 'gray';
  }) => {
    const toneMap = {
      blue: { iconBg: 'bg-blue-500/15 text-blue-400', border: 'border-blue-500/20', value: 'text-blue-300' },
      green: { iconBg: 'bg-green-500/15 text-green-400', border: 'border-green-500/20', value: 'text-green-300' },
      red: { iconBg: 'bg-red-500/15 text-red-400', border: 'border-red-500/20', value: 'text-red-300' },
      gold: { iconBg: 'bg-[#FFD700]/15 text-[#FFD700]', border: 'border-[#FFD700]/20', value: 'text-[#FFD700]' },
      purple: { iconBg: 'bg-purple-500/15 text-purple-400', border: 'border-purple-500/20', value: 'text-purple-300' },
      gray: { iconBg: 'bg-gray-500/15 text-gray-400', border: 'border-gray-500/20', value: 'text-gray-300' },
    } as const;
    const t = toneMap[tone];
    return (
      <div className={`p-4 rounded-xl bg-dark-300/50 border ${t.border}`}>
        <div className="flex items-start justify-between mb-2">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${t.iconBg}`}>
            <Icon size={18} />
          </div>
          {sub && <span className="text-xs text-gray-500">{sub}</span>}
        </div>
        <div className={`text-2xl font-bold ${t.value}`}>{value}</div>
        <div className="text-xs text-gray-400 mt-0.5">{label}</div>
      </div>
    );
  };

  const displayRounds = showAll ? roundStats : roundStats.slice(0, 4);

  return (
    <div className="space-y-5">
      <div className="card-neon">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <BarChart3 className="text-primary-400" size={20} />
              活动看板
            </h3>
            <p className="text-sm text-gray-400 mt-1">全局数据概览 · 实时同步</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Users} label="候选总数" value={globalStats.total} sub="录入名单" tone="blue" />
          <StatCard icon={UserCheck} label="有效候选" value={globalStats.valid} sub={`黑名单 ${globalStats.blacklistCount} 人`} tone="green" />
          <StatCard icon={Trophy} label="有效中奖" value={globalStats.validWins} sub={`失效 ${globalStats.invalidWins} 条`} tone="gold" />
          <StatCard icon={Target} label="剩余可抽" value={globalStats.remainingCapacity} sub={`名额总数 ${globalStats.roundCapacity}`} tone="purple" />
        </div>
      </div>

      <div className="card-neon">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <TrendingUp className="text-primary-400" size={20} />
              轮次进度
            </h3>
            <p className="text-sm text-gray-400 mt-1">点击轮次卡片切换当前控制目标</p>
          </div>
          {roundStats.length > 4 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-sm text-primary-400 hover:text-primary-300"
            >
              {showAll ? '收起' : `展开全部 ${roundStats.length} 轮`}
            </button>
          )}
        </div>

        {roundStats.length === 0 ? (
          <div className="py-10 text-center text-gray-500 text-sm border border-dashed border-white/10 rounded-xl">
            还未创建轮次，请到上方「抽签控制」Tab 中创建第一轮。
          </div>
        ) : (
          <div className="space-y-3">
            {displayRounds.map((stat) => {
              const round = stat.round!;
              const group = getGroupInfo(round.groupId);
              const progress = round.drawCount > 0 ? Math.min(100, (stat.poolWon / round.drawCount) * 100) : 0;
              const isActive = round.id === currentRoundId;

              return (
                <div
                  key={round.id}
                  onClick={() => onSelectRound(round.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    isActive
                      ? 'bg-primary-500/10 border-primary-500/50 ring-1 ring-primary-500/40'
                      : 'bg-dark-300/40 border-white/5 hover:bg-dark-300/70 hover:border-primary-500/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                        round.status === 'pending'
                          ? 'bg-gray-500/20 text-gray-400'
                          : round.status === 'drawing'
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-green-500/20 text-green-400'
                      }`}>
                        {round.status === 'pending' ? '待开始' : round.status === 'drawing' ? '进行中' : '已完成'}
                      </span>
                      <span className="font-semibold text-white">
                        第 {round.roundNumber} 轮 · {round.name}
                      </span>
                      {group && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border" style={{ backgroundColor: `${group.color}22`, borderColor: `${group.color}55`, color: group.color }}>
                          <Users2 size={10} />
                          {group.name}
                        </span>
                      )}
                      {round.mode === 'single' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">单抽模式</span>
                      )}
                      {round.mode === 'multi' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">连抽模式</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-300 font-medium">
                      <span className="text-[#FFD700]">{stat.poolWon}</span>
                      <span className="text-gray-500 mx-1">/</span>
                      <span>{round.drawCount}</span>
                      <span className="text-gray-500 ml-2 text-xs">已抽中/配额</span>
                    </div>
                  </div>

                  <div className="w-full h-2 rounded-full bg-dark-200 overflow-hidden mb-3">
                    <div
                      className={`h-full rounded-full transition-all ${
                        progress >= 100
                          ? 'bg-gradient-to-r from-green-500 to-emerald-400'
                          : 'bg-gradient-to-r from-primary-500 to-primary-400'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-5 gap-2 text-center text-xs">
                    <div className="p-2 rounded-lg bg-dark-200/60">
                      <div className="text-blue-300 font-semibold text-sm">{stat.poolTotal}</div>
                      <div className="text-gray-500 mt-0.5">候选池</div>
                    </div>
                    <div className="p-2 rounded-lg bg-dark-200/60">
                      <div className="text-green-300 font-semibold text-sm">{stat.poolValid}</div>
                      <div className="text-gray-500 mt-0.5">有效</div>
                    </div>
                    <div className="p-2 rounded-lg bg-dark-200/60">
                      <div className="text-red-300 font-semibold text-sm">{stat.poolBlacklist}</div>
                      <div className="text-gray-500 mt-0.5">黑名单</div>
                    </div>
                    <div className="p-2 rounded-lg bg-dark-200/60">
                      <div className="text-[#FFD700] font-semibold text-sm">
                        {stat.poolWon}<span className="text-gray-600 mx-0.5">+</span><span className="text-red-400">{stat.poolInvalidWins}</span>
                      </div>
                      <div className="text-gray-500 mt-0.5">已抽/失效</div>
                    </div>
                    <div className="p-2 rounded-lg bg-dark-200/60">
                      <div className={`font-semibold text-sm ${stat.poolRemaining > 0 ? 'text-purple-300' : 'text-gray-500'}`}>
                        {stat.poolRemaining}
                      </div>
                      <div className="text-gray-500 mt-0.5">剩余名额</div>
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
