import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useStore } from '@/store/useStore';
import { api } from '@/utils/api';
import { formatDate, formatTime, exportToCSV } from '@/utils/format';
import { Trophy, Search, Download, ListOrdered, History, CheckCircle, XCircle, Package, Clock, Filter } from 'lucide-react';
import type { Winner, DrawRound, Activity } from '../../shared/types';

export default function Results() {
  const { activities, rounds, winners, setActivities, setRounds, setWinners, operationLogs, setOperationLogs } = useStore();
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<{ found: boolean; winner?: Winner } | null>(null);
  const [activeTab, setActiveTab] = useState<'winners' | 'order' | 'query' | 'logs'>('winners');
  const [filterRound, setFilterRound] = useState<string | null>(null);

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
      const [roundsRes, winnersRes, logsRes] = await Promise.all([
        api.rounds.list(activityId),
        api.winners.list(activityId),
        api.logs.list(activityId),
      ]);

      if (roundsRes.success) setRounds(roundsRes.data || []);
      if (winnersRes.success) setWinners(winnersRes.data || []);
      if (logsRes.success) setOperationLogs(logsRes.data || []);
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
    const found = winners.find(w => 
      !w.isInvalid && (
        w.candidate?.number.toLowerCase() === query ||
        w.candidate?.nickname?.toLowerCase() === query
      )
    );
    
    setSearchResult({
      found: !!found,
      winner: found,
    });
  };

  const handleExport = () => {
    const validWinners = winners.filter(w => !w.isInvalid);
    const exportData = validWinners.map(w => ({
      '中奖编号': w.candidate?.number || '',
      '昵称': w.candidate?.nickname || '',
      '所属轮次': rounds.find(r => r.id === w.roundId)?.name || '',
      '中奖顺序': w.drawOrder || '',
      '是否补位': w.isReplenishment ? '是' : '否',
      '中奖时间': formatDate(w.createdAt),
    }));
    
    const activity = activities.find(a => a.id === selectedActivityId);
    exportToCSV(exportData, `${activity?.name || '中奖名单'}_${new Date().toLocaleDateString()}`);
  };

  const selectedActivity = activities.find(a => a.id === selectedActivityId);
  const validWinners = winners.filter(w => !w.isInvalid);
  const filteredWinners = filterRound 
    ? validWinners.filter(w => w.roundId === filterRound)
    : validWinners;

  const sortedWinners = [...filteredWinners].sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const unpackOrder = [...sortedWinners].sort((a, b) => {
    const roundA = rounds.find(r => r.id === a.roundId)?.roundNumber || 0;
    const roundB = rounds.find(r => r.id === b.roundId)?.roundNumber || 0;
    if (roundA !== roundB) return roundA - roundB;
    return (a.drawOrder || 0) - (b.drawOrder || 0);
  });

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
              {validWinners.length > 0 && (
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
                            {roundWinners.map((winner, idx) => (
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
                                    {idx + 1}
                                  </div>
                                  <div>
                                    <div className="font-bold text-white">
                                      {winner.candidate?.number}
                                    </div>
                                    <div className="text-xs text-gray-400">
                                      {winner.candidate?.nickname || '匿名'}
                                    </div>
                                  </div>
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
                    <div className={`p-8 rounded-2xl border-2 text-center ${
                      searchResult.found 
                        ? 'bg-neon-gold/10 border-neon-gold/50' 
                        : 'bg-dark-300/50 border-white/10'
                    }`}>
                      {searchResult.found && searchResult.winner ? (
                        <>
                          <div className="w-20 h-20 rounded-full bg-neon-gold/20 flex items-center justify-center mx-auto mb-4">
                            <Trophy className="text-neon-gold" size={40} />
                          </div>
                          <h4 className="text-2xl font-bold text-neon-gold mb-2">恭喜！已中奖</h4>
                          <div className="space-y-2 text-gray-300">
                            <p>
                              <span className="text-gray-500">编号：</span>
                              <span className="font-bold text-white">{searchResult.winner.candidate?.number}</span>
                            </p>
                            <p>
                              <span className="text-gray-500">昵称：</span>
                              <span className="text-white">{searchResult.winner.candidate?.nickname || '匿名'}</span>
                            </p>
                            <p>
                              <span className="text-gray-500">轮次：</span>
                              <span className="text-white">
                                {rounds.find(r => r.id === searchResult.winner?.roundId)?.name}
                              </span>
                            </p>
                            <p>
                              <span className="text-gray-500">中奖时间：</span>
                              <span className="text-white">{formatDate(searchResult.winner.createdAt)}</span>
                            </p>
                            {searchResult.winner.isReplenishment && (
                              <p className="text-primary-300">
                                注：此为补位中奖
                              </p>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-20 h-20 rounded-full bg-dark-300 flex items-center justify-center mx-auto mb-4">
                            <XCircle className="text-gray-500" size={40} />
                          </div>
                          <h4 className="text-2xl font-bold text-gray-400 mb-2">未查询到中奖记录</h4>
                          <p className="text-gray-500">请确认输入的编号或昵称是否正确</p>
                        </>
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
