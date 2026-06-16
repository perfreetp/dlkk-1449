import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useStore } from '@/store/useStore';
import { api } from '@/utils/api';
import { useSocket } from '@/hooks/useSocket';
import { formatDate, formatTime, exportToCSV } from '@/utils/format';
import { Trophy, Search, Download, ListOrdered, History, CheckCircle, XCircle, Package, Clock, Filter, Ban, AlertTriangle, TrendingUp, Users2, UserPlus, ArrowRightLeft, RefreshCw, FileDown, FileWarning, X } from 'lucide-react';
import type { Winner, DrawRound, Activity, Candidate, OperationLog } from '../../shared/types';

type SearchStatus = 'valid_winner' | 'invalid_winner' | 'not_won' | 'not_found' | 'multi_matches';

interface TimelineEvent {
  id: string;
  type: 'signup' | 'group_change' | 'win' | 'replenishment' | 'invalidated' | 'redraw' | 'blacklist_add' | 'blacklist_remove' | 'candidate_delete';
  time: string;
  title: string;
  description?: string;
  icon: React.ComponentType<any>;
  tone: 'green' | 'gold' | 'red' | 'blue' | 'purple' | 'gray';
  roundName?: string;
  drawOrder?: number;
  isReplenishment?: boolean;
  invalidReason?: string;
}

interface SearchResult {
  status: SearchStatus;
  matches: Winner[];
  candidate?: Candidate;
  timeline: TimelineEvent[];
}

export default function Results() {
  const { activities, rounds, winners, candidates, groups, setActivities, setRounds, setWinners, operationLogs, setOperationLogs, setCandidates, setGroups } = useStore();
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [activeTab, setActiveTab] = useState<'winners' | 'order' | 'query' | 'logs'>('winners');
  const [filterRound, setFilterRound] = useState<string | null>(null);
  const [exportMode, setExportMode] = useState<'valid' | 'all'>('valid');

  useSocket(selectedActivityId);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const activitiesRes = await api.activities.list();
      if (activitiesRes.success) {
        const activeActivities = (activitiesRes.data || []).filter(a => a.status !== 'archived');
        setActivities(activeActivities);
        if (activeActivities.length > 0 && !selectedActivityId) {
          setSelectedActivityId(activeActivities[0].id);
          loadActivityData(activeActivities[0].id);
        }
      }
    } catch (error) {
      console.error('Load data failed:', error);
    }
  };

  const loadActivityData = async (activityId: string) => {
    try {
      const [roundsRes, winnersRes, logsRes, candidatesRes] = await Promise.all([
        api.rounds.list(activityId),
        api.winners.list(activityId),
        api.logs.list(activityId),
        api.candidates.list(activityId),
      ]);

      if (roundsRes.success) setRounds(roundsRes.data || []);
      if (winnersRes.success) setWinners(winnersRes.data || []);
      if (logsRes.success) setOperationLogs(logsRes.data || []);
      if (candidatesRes.success) setCandidates(candidatesRes.data || []);
    } catch (error) {
      console.error('Load activity data failed:', error);
    }
  };

  useEffect(() => {
    if (selectedActivityId) {
      loadActivityData(selectedActivityId);
    }
  }, [selectedActivityId]);

  const handleActivityChange = (activityId: string) => {
    setSelectedActivityId(activityId);
    setSearchResult(null);
    setSearchQuery('');
    setFilterRound(null);
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setSearchResult(null);
      return;
    }

    const query = searchQuery.trim().toLowerCase();
    const matches = winners.filter(w =>
      w.candidate?.number.toLowerCase() === query ||
      (w.candidate?.nickname && w.candidate?.nickname.toLowerCase() === query)
    );
    const matchCandidate = candidates.find(c =>
      c.number.toLowerCase() === query ||
      (c.nickname && c.nickname.toLowerCase() === query)
    );

    const targetNumber = matchCandidate?.number || matches[0]?.candidate?.number || query;
    const timeline = buildTimeline(targetNumber, matchCandidate, matches, operationLogs, rounds);

    if (matches.length === 0 && !matchCandidate) {
      setSearchResult({ status: 'not_found', matches: [], timeline: [] });
      return;
    }
    if (matches.length === 0 && matchCandidate) {
      setSearchResult({ status: 'not_won', matches: [], candidate: matchCandidate, timeline });
      return;
    }
    const hasValid = matches.some(m => !m.isInvalid);
    if (matches.length === 1) {
      const m = matches[0];
      setSearchResult({
        status: !m.isInvalid ? 'valid_winner' : 'invalid_winner',
        matches,
        candidate: m.candidate || matchCandidate,
        timeline,
      });
      return;
    }
    if (hasValid && matches.filter(m => !m.isInvalid).length === 1) {
      const m = matches.find(m => !m.isInvalid)!;
      setSearchResult({ status: 'valid_winner', matches, candidate: m.candidate || matchCandidate, timeline });
      return;
    }
    setSearchResult({ status: 'multi_matches', matches, candidate: matchCandidate, timeline });
  };

  function buildTimeline(
    number: string,
    candidate: Candidate | undefined,
    matches: Winner[],
    logs: OperationLog[],
    rounds: DrawRound[]
  ): TimelineEvent[] {
    const events: TimelineEvent[] = [];

    if (candidate) {
      events.push({
        id: `signup-${candidate.id}`,
        type: 'signup',
        time: candidate.createdAt,
        title: '报名成功',
        description: candidate.nickname ? `昵称「${candidate.nickname}」` : undefined,
        icon: UserPlus,
        tone: 'green',
      });
      if (candidate.groupId) {
        const g = groups.find(grp => grp.id === candidate.groupId);
        events.push({
          id: `group-init-${candidate.id}`,
          type: 'group_change',
          time: candidate.createdAt,
          title: `进入分组「${g?.name || candidate.groupId}」`,
          icon: Users2,
          tone: 'blue',
        });
      }
      if (candidate.isBlacklisted) {
        events.push({
          id: `blacklist-curr-${candidate.id}`,
          type: 'blacklist_add',
          time: candidate.createdAt,
          title: '已在黑名单中',
          description: '该编号不会参与任何抽取',
          icon: Ban,
          tone: 'red',
        });
      }
    }

    const groupRe = /分组=(.+)/;
    logs.forEach(log => {
      if (log.actionType === 'candidate_add' && log.details.includes(number)) {
        const m = log.details.match(groupRe);
        if (m) {
          const groupName = m[1];
          events.push({
            id: `group-${log.id}`,
            type: 'group_change',
            time: log.timestamp,
            title: groupName === '未分组' ? '移出分组' : `分组变更为「${groupName}」`,
            icon: ArrowRightLeft,
            tone: 'blue',
          });
        }
      }
      if (log.actionType === 'candidate_delete' && log.details.includes(number)) {
        events.push({
          id: `delete-${log.id}`,
          type: 'candidate_delete',
          time: log.timestamp,
          title: '从候选池删除',
          icon: X,
          tone: 'gray',
        });
      }
      if (log.actionType === 'blacklist_add' && log.details.includes(number)) {
        events.push({
          id: `bl-add-${log.id}`,
          type: 'blacklist_add',
          time: log.timestamp,
          title: '加入黑名单',
          description: log.details,
          icon: Ban,
          tone: 'red',
        });
      }
      if (log.actionType === 'draw_redraw' && log.details.includes(number)) {
        events.push({
          id: `redraw-${log.id}`,
          type: 'redraw',
          time: log.timestamp,
          title: '异常重抽补位',
          description: log.details,
          icon: RefreshCw,
          tone: 'purple',
        });
      }
    });

    matches.forEach(w => {
      const round = rounds.find(r => r.id === w.roundId);
      if (w.isReplenishment) {
        events.push({
          id: `win-${w.id}-rep`,
          type: 'replenishment',
          time: w.createdAt,
          title: `补位中奖 · 第 ${round?.roundNumber} 轮 ${round?.name || ''}`,
          description: `抽取顺序 #${w.drawOrder}`,
          icon: TrendingUp,
          tone: 'gold',
          roundName: round?.name,
          drawOrder: w.drawOrder,
          isReplenishment: true,
        });
      } else {
        events.push({
          id: `win-${w.id}`,
          type: 'win',
          time: w.createdAt,
          title: `抽中 · 第 ${round?.roundNumber} 轮 ${round?.name || ''}`,
          description: `抽取顺序 #${w.drawOrder}`,
          icon: Trophy,
          tone: 'gold',
          roundName: round?.name,
          drawOrder: w.drawOrder,
        });
      }
      if (w.isInvalid) {
        events.push({
          id: `invalid-${w.id}`,
          type: 'invalidated',
          time: w.createdAt,
          title: '中奖记录失效',
          description: w.invalidReason || '已移除',
          icon: FileWarning,
          tone: 'red',
          invalidReason: w.invalidReason,
        });
      }
    });

    return events.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }

  const handleExport = () => {
    const exportWinners = exportMode === 'valid' 
      ? winners.filter(w => !w.isInvalid) 
      : winners;
    const exportData = exportWinners.map(w => ({
      '中奖编号': w.candidate?.number || '',
      '昵称': w.candidate?.nickname || '',
      '所属轮次': rounds.find(r => r.id === w.roundId)?.name || '',
      '中奖顺序': w.drawOrder || '',
      '是否补位': w.isReplenishment ? '是' : '否',
      '状态': w.isInvalid ? '已失效' : '有效',
      '失效原因': w.invalidReason || '',
      '中奖时间': formatDate(w.createdAt),
    }));
    const activity = activities.find(a => a.id === selectedActivityId);
    const filename = `${activity?.name || '中奖名单'}_${exportMode === 'valid' ? '仅有效' : '含失效明细'}_${new Date().toLocaleDateString()}`;
    exportToCSV(exportData, filename);
  };

  const selectedActivity = activities.find(a => a.id === selectedActivityId);
  const validWinners = winners.filter(w => !w.isInvalid);
  const filteredWinners = filterRound 
    ? validWinners.filter(w => w.roundId === filterRound)
    : validWinners;

  const sortedWinners = [...filteredWinners].sort((a, b) => {
    const roundA = rounds.find(r => r.id === a.roundId)?.roundNumber || 0;
    const roundB = rounds.find(r => r.id === b.roundId)?.roundNumber || 0;
    if (roundA !== roundB) return roundA - roundB;
    return (a.drawOrder || 0) - (b.drawOrder || 0);
  });

  const unpackOrder = sortedWinners; // 已有相同的排序

  const stats = {
    totalPrizes: rounds.reduce((sum, r) => sum + r.drawCount, 0),
    totalWinners: validWinners.length,
    completedRounds: rounds.filter(r => r.status === 'completed').length,
    totalRounds: rounds.length,
    replenishmentCount: validWinners.filter(w => w.isReplenishment).length,
  };

  return (
    <Layout requireAuth={false}>
      <div className="p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl font-bold text-white">结果公示</h1>
              <p className="text-gray-400 mt-1">中奖名单、拆盒顺序和回放记录</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedActivityId || ''}
                onChange={(e) => handleActivityChange(e.target.value)}
                className="input-neon py-2.5 text-sm w-64"
              >
                <option value="">选择活动</option>
                {activities.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              {activeTab === 'winners' && validWinners.length > 0 && (
                <div className="flex items-center gap-2">
                  <select
                    value={exportMode}
                    onChange={(e) => setExportMode(e.target.value as typeof exportMode)}
                    className="bg-dark-300 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary-500"
                  >
                    <option value="valid">仅导出有效名单</option>
                    <option value="all">含失效明细</option>
                  </select>
                  <button
                    onClick={handleExport}
                    className="btn-outline flex items-center gap-2 py-2.5"
                  >
                    <Download size={18} />
                    导出名单
                  </button>
                </div>
              )}
              {activeTab !== 'winners' && validWinners.length > 0 && (
                <button
                  onClick={handleExport}
                  className="btn-outline flex items-center gap-2 py-2.5"
                >
                  <Download size={18} />
                  导出名单
                </button>
              )}
            </div>
          </div>

          {selectedActivity && (
            <div className="grid grid-cols-5 gap-4 mt-6">
              <div className="card-neon p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-500/20 flex items-center justify-center">
                    <Package className="text-primary-400" size={20} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">{stats.totalRounds}</div>
                    <div className="text-xs text-gray-500">总轮次</div>
                  </div>
                </div>
              </div>
              <div className="card-neon p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-neon-purple/20 flex items-center justify-center">
                    <CheckCircle className="text-neon-purple" size={20} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">{stats.completedRounds}</div>
                    <div className="text-xs text-gray-500">已完成轮次</div>
                  </div>
                </div>
              </div>
              <div className="card-neon p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-neon-gold/20 flex items-center justify-center">
                    <Trophy className="text-neon-gold" size={20} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">{stats.totalPrizes}</div>
                    <div className="text-xs text-gray-500">总奖品数</div>
                  </div>
                </div>
              </div>
              <div className="card-neon p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-neon-green/20 flex items-center justify-center">
                    <CheckCircle className="text-neon-green" size={20} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">{stats.totalWinners}</div>
                    <div className="text-xs text-gray-500">已中奖人数</div>
                  </div>
                </div>
              </div>
              <div className="card-neon p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-neon-pink/20 flex items-center justify-center">
                    <History className="text-neon-pink" size={20} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">{stats.replenishmentCount}</div>
                    <div className="text-xs text-gray-500">补位中奖</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 mb-6 border-b border-white/5 pb-2">
          {[
            { key: 'winners', label: '中奖名单', icon: Trophy },
            { key: 'order', label: '拆盒顺序', icon: ListOrdered },
            { key: 'query', label: '中奖查询', icon: Search },
            { key: 'logs', label: '操作记录', icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`px-6 py-2.5 rounded-t-xl font-medium transition-all flex items-center gap-2 ${
                  activeTab === tab.key
                    ? 'bg-dark-300 text-white border-t border-x border-primary-500/30'
                    : 'text-gray-500 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {selectedActivity ? (
          <>
            {activeTab === 'winners' && (
              <div className="card-neon">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Trophy className="text-neon-gold" size={20} />
                    中奖名单
                    {filterRound && (
                      <span className="text-sm font-normal text-gray-400">
                        （{rounds.find(r => r.id === filterRound)?.name}）
                      </span>
                    )}
                  </h3>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                      <Filter size={16} className="text-gray-500" />
                      <select
                        value={filterRound || ''}
                        onChange={(e) => setFilterRound(e.target.value || null)}
                        className="bg-dark-300 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary-500"
                      >
                        <option value="">全部轮次</option>
                        {rounds.map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </div>
                    <span className="text-sm text-gray-400">
                      共 {sortedWinners.length} 人
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">序号</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">编号</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">昵称</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">轮次</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">抽取顺序</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">补位</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">中奖时间</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedWinners.map((winner, index) => {
                        const round = rounds.find(r => r.id === winner.roundId);
                        return (
                          <tr 
                            key={winner.id} 
                            className="border-b border-white/5 hover:bg-white/5 transition-colors"
                          >
                            <td className="py-3 px-4">
                              <span className="w-8 h-8 rounded-lg bg-neon-gold/20 text-neon-gold flex items-center justify-center text-sm font-bold">
                                {index + 1}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-bold text-white">{winner.candidate?.number}</span>
                            </td>
                            <td className="py-3 px-4 text-gray-300">
                              {winner.candidate?.nickname || '-'}
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2.5 py-1 rounded-full bg-primary-500/20 text-primary-300 text-xs">
                                {round?.name || '-'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-gray-300">
                              #{winner.drawOrder || '-'}
                            </td>
                            <td className="py-3 px-4">
                              {winner.isReplenishment ? (
                                <span className="px-2.5 py-1 rounded-full bg-neon-pink/20 text-neon-pink text-xs">
                                  补位
                                </span>
                              ) : (
                                <span className="text-gray-500">-</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-gray-400 text-sm">
                              {formatDate(winner.createdAt)}
                            </td>
                          </tr>
                        );
                      })}
                      {sortedWinners.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-gray-500">
                            暂无中奖记录
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'order' && (
              <div className="card-neon">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <ListOrdered className="text-primary-400" size={20} />
                    拆盒顺序
                  </h3>
                  <span className="text-sm text-gray-400">
                    按轮次和抽取顺序排列
                  </span>
                </div>

                <div className="space-y-6">
                  {rounds.sort((a, b) => a.roundNumber - b.roundNumber).map((round) => {
                    const roundWinners = unpackOrder.filter(w => w.roundId === round.id);
                    return (
                      <div key={round.id} className="border-l-2 border-primary-500/30 pl-6 pb-6 last:pb-0">
                        <div className="flex items-center gap-3 mb-4 -ml-8">
                          <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-white font-bold">
                            {round.roundNumber}
                          </div>
                          <div>
                            <h4 className="font-semibold text-white">{round.name}</h4>
                            <p className="text-xs text-gray-500">
                              抽取 {round.drawCount} 人 · {round.mode === 'single' ? '单抽' : '连抽'}模式
                            </p>
                          </div>
                        </div>

                        {roundWinners.length > 0 ? (
                          <div className="grid grid-cols-4 gap-3">
                            {roundWinners.map((winner) => (
                              <div
                                key={winner.id}
                                className={`p-4 rounded-xl border ${
                                  winner.isReplenishment
                                    ? 'bg-primary-500/10 border-primary-500/30'
                                    : 'bg-dark-300/50 border-white/5'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                                    winner.isReplenishment
                                      ? 'bg-primary-500/30 text-primary-300'
                                      : 'bg-neon-gold/20 text-neon-gold'
                                  }`}>
                                    {winner.drawOrder ?? '?'}
                                  </div>
                                  <div>
                                    <div className="font-bold text-white">
                                      {winner.candidate?.number}
                                    </div>
                                    <div className="text-xs text-gray-400">
                                      {winner.candidate?.nickname || '匿名'}
                                    </div>
                                  </div>
                                  {winner.isReplenishment && (
                                    <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-primary-500/20 text-primary-300">
                                      补位
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 italic">本轮暂无中奖记录</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'query' && (
              <div className="card-neon">
                <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                  <Search className="text-neon-purple" size={20} />
                  中奖查询
                </h3>

                <div className="max-w-xl mx-auto">
                  <div className="flex gap-3 mb-8">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="input-neon text-lg text-center"
                      placeholder="输入编号或昵称查询是否中奖"
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <button
                      onClick={handleSearch}
                      className="btn-neon px-8 flex items-center gap-2"
                    >
                      <Search size={20} />
                      查询
                    </button>
                  </div>

                  {searchResult && (
                    <div className={`p-8 rounded-2xl border-2 ${
                      searchResult.status === 'valid_winner'
                        ? 'bg-neon-gold/10 border-neon-gold/50'
                        : searchResult.status === 'invalid_winner'
                          ? 'bg-red-500/10 border-red-500/40'
                          : searchResult.status === 'not_won'
                            ? 'bg-dark-300/50 border-primary-500/20'
                            : searchResult.status === 'not_found'
                              ? 'bg-dark-300/50 border-white/10'
                              : 'bg-dark-300/50 border-primary-500/30'
                    }`}>
                      {searchResult.status === 'valid_winner' && searchResult.matches.find(m => !m.isInvalid) ? (
                        (() => {
                          const winner = searchResult.matches.find(m => !m.isInvalid)!;
                          const round = rounds.find(r => r.id === winner.roundId);
                          return (
                            <>
                              <div className="w-20 h-20 rounded-full bg-neon-gold/20 flex items-center justify-center mx-auto mb-4">
                                <Trophy className="text-neon-gold" size={40} />
                              </div>
                              <h4 className="text-2xl font-bold text-neon-gold mb-2">恭喜！已中奖</h4>
                              <div className="space-y-2.5 text-left max-w-md mx-auto mt-4 text-gray-300">
                                <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                                  <span className="text-gray-500">编号</span>
                                  <span className="font-bold text-white text-lg">{winner.candidate?.number}</span>
                                </div>
                                {winner.candidate?.nickname && (
                                  <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                                    <span className="text-gray-500">昵称</span>
                                    <span className="text-white">{winner.candidate.nickname}</span>
                                  </div>
                                )}
                                <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                                  <span className="text-gray-500">所属轮次</span>
                                  <span className="px-2.5 py-1 rounded-full bg-primary-500/20 text-primary-300 text-xs font-medium">
                                    {round ? `第 ${round.roundNumber} 轮 · ${round.name}` : winner.roundId}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                                  <span className="text-gray-500">抽取顺序</span>
                                  <span className="text-white">#{winner.drawOrder}</span>
                                </div>
                                <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                                  <span className="text-gray-500">中奖时间</span>
                                  <span className="text-white">{formatDate(winner.createdAt)} {formatTime(winner.createdAt)}</span>
                                </div>
                                {winner.isReplenishment && (
                                  <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                                    <span className="text-gray-500">中奖类型</span>
                                    <span className="px-2.5 py-1 rounded-full bg-neon-pink/20 text-neon-pink text-xs font-medium flex items-center gap-1">
                                      <TrendingUp size={12} /> 补位中奖
                                    </span>
                                  </div>
                                )}
                              </div>
                            </>
                          );
                        })()
                      ) : searchResult.status === 'invalid_winner' && searchResult.matches[0] ? (
                        (() => {
                          const winner = searchResult.matches[0];
                          const round = rounds.find(r => r.id === winner.roundId);
                          return (
                            <>
                              <div className="w-20 h-20 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-4">
                                <Ban className="text-red-400" size={40} />
                              </div>
                              <h4 className="text-2xl font-bold text-red-300 mb-1">中奖记录已失效</h4>
                              <p className="text-sm text-red-400/80 mb-4">原中奖结果已被主播取消或对应编号被拉黑</p>
                              <div className="space-y-2.5 text-left max-w-md mx-auto mt-4 text-gray-300">
                                <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                                  <span className="text-gray-500">编号</span>
                                  <span className="font-bold text-white text-lg">{winner.candidate?.number}</span>
                                </div>
                                <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                                  <span className="text-gray-500">所属轮次</span>
                                  <span className="px-2.5 py-1 rounded-full bg-gray-500/20 text-gray-300 text-xs font-medium">
                                    {round ? `第 ${round.roundNumber} 轮 · ${round.name}` : winner.roundId}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                                  <span className="text-gray-500">原中奖时间</span>
                                  <span className="text-white">{formatDate(winner.createdAt)}</span>
                                </div>
                                <div className="flex items-start justify-between py-1.5 border-b border-white/5">
                                  <span className="text-gray-500 flex items-center gap-1">
                                    <AlertTriangle size={14} /> 失效原因
                                  </span>
                                  <span className="text-red-300 text-right ml-2 max-w-[70%] text-sm">
                                    {winner.invalidReason || '已取消'}
                                  </span>
                                </div>
                                {winner.isReplenishment && (
                                  <p className="text-xs text-gray-500 pt-1 text-center">
                                    此为补位中奖记录
                                  </p>
                                )}
                              </div>
                            </>
                          );
                        })()
                      ) : searchResult.status === 'not_won' && searchResult.candidate ? (
                        <>
                          <div className="w-20 h-20 rounded-full bg-primary-500/15 flex items-center justify-center mx-auto mb-4">
                            <Users2 className="text-primary-400" size={40} />
                          </div>
                          <h4 className="text-2xl font-bold text-primary-300 mb-1">已进入候选池</h4>
                          <p className="text-sm text-gray-400 mb-4">暂未抽中，请继续关注开奖</p>
                          <div className="space-y-2.5 text-left max-w-md mx-auto mt-4 text-gray-300">
                            <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                              <span className="text-gray-500">编号</span>
                              <span className="font-bold text-white text-lg">{searchResult.candidate.number}</span>
                            </div>
                            {searchResult.candidate.nickname && (
                              <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                                <span className="text-gray-500">昵称</span>
                                <span className="text-white">{searchResult.candidate.nickname}</span>
                              </div>
                            )}
                            {searchResult.candidate.isBlacklisted ? (
                              <div className="flex items-start justify-between py-1.5 border-b border-white/5">
                                <span className="text-gray-500">参与状态</span>
                                <span className="text-red-400 text-right">编号已在黑名单，不会参与抽取</span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                                <span className="text-gray-500">参与状态</span>
                                <span className="text-green-300">正常参与抽取</span>
                              </div>
                            )}
                            <div className="text-xs text-gray-500 pt-2 text-center">
                              共 {winners.filter(w => !w.isInvalid).length} 位已中奖 / {rounds.reduce((s, r) => s + r.drawCount, 0)} 个名额
                            </div>
                          </div>
                        </>
                      ) : searchResult.status === 'not_found' ? (
                        <>
                          <div className="w-20 h-20 rounded-full bg-dark-300 flex items-center justify-center mx-auto mb-4">
                            <XCircle className="text-gray-500" size={40} />
                          </div>
                          <h4 className="text-2xl font-bold text-gray-400 mb-2">未找到该编号</h4>
                          <p className="text-gray-500">当前活动候选池和中奖名单中都没有此编号，请确认活动是否正确或联系主播</p>
                        </>
                      ) : searchResult.status === 'multi_matches' ? (
                        <>
                          <h4 className="text-xl font-bold text-white mb-4">查询到 {searchResult.matches.length} 条相关记录</h4>
                          <div className="space-y-3 text-left">
                            {searchResult.matches.map((winner) => {
                              const round = rounds.find(r => r.id === winner.roundId);
                              const valid = !winner.isInvalid;
                              return (
                                <div key={winner.id} className={`p-4 rounded-xl border ${
                                  valid ? 'bg-neon-gold/5 border-neon-gold/30' : 'bg-red-500/5 border-red-500/20'
                                }`}>
                                  <div className="flex items-center justify-between mb-2">
                                    <span className={`font-bold ${valid ? 'text-neon-gold' : 'text-red-300'}`}>
                                      {valid ? '中奖' : '已失效'}
                                    </span>
                                    <span className="text-xs text-gray-400">
                                      {round ? `第 ${round.roundNumber} 轮 · ${round.name}` : ''}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-4 text-sm">
                                    <span className="text-white font-semibold">{winner.candidate?.number}</span>
                                    <span className="text-gray-400">{winner.candidate?.nickname || '匿名'}</span>
                                    <span className="text-gray-500">#{winner.drawOrder ?? '?'}</span>
                                    <span className="text-gray-500">{formatDate(winner.createdAt)}</span>
                                  </div>
                                  {!valid && winner.invalidReason && (
                                    <div className="text-xs text-red-400 mt-2">失效原因：{winner.invalidReason}</div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </>
                      ) : null}

                      {searchResult.timeline.length > 0 && (
                        <div className="mt-8 pt-6 border-t border-white/10">
                          <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                            <Clock size={16} className="text-gray-400" />
                            完整时间线
                          </h4>
                          <div className="space-y-0">
                            {searchResult.timeline.map((event, idx) => {
                              const Icon = event.icon;
                              const toneMap = {
                                green: { bg: 'bg-green-500/20', border: 'border-green-500/30', text: 'text-green-300', dot: 'bg-green-500' },
                                gold: { bg: 'bg-[#FFD700]/20', border: 'border-[#FFD700]/30', text: 'text-[#FFD700]', dot: 'bg-[#FFD700]' },
                                red: { bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'text-red-300', dot: 'bg-red-500' },
                                blue: { bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-300', dot: 'bg-blue-500' },
                                purple: { bg: 'bg-purple-500/20', border: 'border-purple-500/30', text: 'text-purple-300', dot: 'bg-purple-500' },
                                gray: { bg: 'bg-gray-500/20', border: 'border-gray-500/30', text: 'text-gray-300', dot: 'bg-gray-500' },
                              } as const;
                              const t = toneMap[event.tone];
                              const isLast = idx === searchResult.timeline.length - 1;

                              return (
                                <div key={event.id} className="flex gap-3 relative">
                                  <div className="flex flex-col items-center">
                                    <div className={`w-8 h-8 rounded-full ${t.bg} ${t.border} border flex items-center justify-center flex-shrink-0 z-10`}>
                                      <Icon size={14} className={t.text} />
                                    </div>
                                    {!isLast && (
                                      <div className={`w-0.5 flex-1 ${t.dot} opacity-30`} />
                                    )}
                                  </div>
                                  <div className="pb-4 pt-0.5 flex-1">
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="flex-1">
                                        <div className={`font-medium ${t.text}`}>
                                          {event.title}
                                        </div>
                                        {event.description && (
                                          <div className="text-sm text-gray-400 mt-0.5">
                                            {event.description}
                                          </div>
                                        )}
                                        {event.invalidReason && (
                                          <div className="text-sm text-red-400 mt-0.5">
                                            原因：{event.invalidReason}
                                          </div>
                                        )}
                                      </div>
                                      <div className="text-xs text-gray-500 whitespace-nowrap ml-2">
                                        {formatDate(event.time)}
                                        <div className="text-right">{formatTime(event.time)}</div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {!searchResult && (
                    <div className="text-center py-12 text-gray-500">
                      <Search className="mx-auto mb-4 opacity-30" size={48} />
                      <p>输入编号或昵称查询是否中奖</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'logs' && (
              <div className="card-neon">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <History className="text-neon-pink" size={20} />
                  操作记录（回放）
                </h3>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {operationLogs.slice().reverse().map((log) => (
                    <div 
                      key={log.id} 
                      className="flex items-start gap-4 p-4 rounded-xl bg-dark-300/50 border border-white/5"
                    >
                      <div className="w-10 h-10 rounded-full bg-dark-200 flex items-center justify-center flex-shrink-0">
                        {log.actionType === 'draw' ? (
                          <Trophy className="text-neon-gold" size={18} />
                        ) : log.actionType === 'redraw' ? (
                          <Clock className="text-neon-pink" size={18} />
                        ) : log.actionType === 'candidate_add' ? (
                          <CheckCircle className="text-neon-green" size={18} />
                        ) : (
                          <History className="text-gray-500" size={18} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-white">{log.action}</span>
                          <span className="text-xs text-gray-500">{formatTime(log.createdAt)}</span>
                        </div>
                        <p className="text-sm text-gray-400 mt-1">
                          操作者：{log.operatorName}
                        </p>
                        {log.details && (
                          <p className="text-xs text-gray-500 mt-1">{log.details}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {operationLogs.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      <History className="mx-auto mb-4 opacity-30" size={48} />
                      <p>暂无操作记录</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="card-neon text-center py-20">
            <Package className="mx-auto text-gray-600 mb-4" size={64} />
            <h3 className="text-xl font-semibold text-white mb-2">请选择一个活动</h3>
            <p className="text-gray-400">从上方下拉框选择要查看的活动</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
