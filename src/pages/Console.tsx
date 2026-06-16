import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { CandidateList } from '@/components/CandidateList';
import { RoundSetup } from '@/components/RoundSetup';
import { GroupManager } from '@/components/GroupManager';
import { DrawControl } from '@/components/DrawControl';
import { DanmakuPanel } from '@/components/DanmakuPanel';
import { useStore } from '@/store/useStore';
import { Play, Square, Users, Trophy, Clock, AlertCircle } from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';
import { api } from '@/utils/api';

export default function Console() {
  const { currentActivity, candidates, rounds, winners, groups, setCandidates, setRounds, setWinners, setDanmaku, setGroups } = useStore();
  const [currentRoundId, setCurrentRoundId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'draw' | 'candidates' | 'groups' | 'danmaku'>('draw');
  const [loading, setLoading] = useState(false);

  useSocket(currentActivity?.id);

  useEffect(() => {
    if (currentActivity) {
      loadData();
    }
  }, [currentActivity?.id]);

  const loadData = async () => {
    if (!currentActivity) return;
    
    try {
      const [candidatesRes, roundsRes, winnersRes, danmakuRes, groupsRes] = await Promise.all([
        api.candidates.list(currentActivity.id),
        api.rounds.list(currentActivity.id),
        api.winners.list(currentActivity.id),
        api.danmaku.list(currentActivity.id),
        api.groups.list(currentActivity.id),
      ]);

      if (candidatesRes.success) setCandidates(candidatesRes.data || []);
      if (roundsRes.success) setRounds(roundsRes.data || []);
      if (winnersRes.success) setWinners(winnersRes.data || []);
      if (danmakuRes.success) setDanmaku(danmakuRes.data || []);
      if (groupsRes.success) setGroups(groupsRes.data || []);
    } catch (error) {
      console.error('Load data failed:', error);
    }
  };

  const handleStartActivity = async () => {
    if (!currentActivity) return;
    setLoading(true);
    try {
      const res = await api.activities.start(currentActivity.id);
      if (res.success) {
        useStore.getState().setCurrentActivity(res.data);
        loadData();
      }
    } catch (error) {
      console.error('Start activity failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEndActivity = async () => {
    if (!currentActivity || !confirm('确定要结束本次活动吗？结束后将无法继续抽取。')) return;
    setLoading(true);
    try {
      const res = await api.activities.end(currentActivity.id);
      if (res.success) {
        useStore.getState().setCurrentActivity(res.data);
        loadData();
      }
    } catch (error) {
      console.error('End activity failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentRound = rounds.find(r => r.id === currentRoundId) || null;

  const stats = {
    totalCandidates: candidates.length,
    validCandidates: candidates.filter(c => !c.isBlacklisted).length,
    totalRounds: rounds.length,
    completedRounds: rounds.filter(r => r.status === 'completed').length,
    totalWinners: winners.filter(w => !w.isInvalid).length,
    totalPrizes: rounds.reduce((sum, r) => sum + r.drawCount, 0),
  };

  if (!currentActivity) {
    return (
      <Layout>
        <div className="p-8">
          <div className="card-neon text-center py-20">
            <AlertCircle className="mx-auto text-gray-600 mb-4" size={64} />
            <h3 className="text-xl font-semibold text-white mb-2">请先选择一个活动</h3>
            <p className="text-gray-400">从活动管理页面选择或创建一个活动</p>
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
              <h1 className="font-display text-2xl font-bold text-white">直播间控制台</h1>
              <p className="text-gray-400 mt-1">{currentActivity.name}</p>
            </div>
            <div className="flex items-center gap-3">
              {currentActivity.status === 'draft' && (
                <button
                  onClick={handleStartActivity}
                  disabled={loading}
                  className="btn-neon px-6 py-2.5 flex items-center gap-2"
                >
                  <Play size={18} />
                  {loading ? '开始中...' : '开始活动'}
                </button>
              )}
              {currentActivity.status === 'active' && (
                <button
                  onClick={handleEndActivity}
                  disabled={loading}
                  className="btn-outline px-6 py-2.5 flex items-center gap-2 border-red-500/50 text-red-400 hover:bg-red-500/10"
                >
                  <Square size={18} />
                  {loading ? '结束中...' : '结束活动'}
                </button>
              )}
              {currentActivity.status === 'completed' && (
                <span className="px-4 py-2 rounded-full bg-neon-green/10 border border-neon-green/30 text-neon-green text-sm">
                  ✓ 活动已结束
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 mt-6">
            <div className="card-neon p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-500/20 flex items-center justify-center">
                  <Users className="text-primary-400" size={20} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">{stats.validCandidates}</div>
                  <div className="text-xs text-gray-500">有效候选者</div>
                </div>
              </div>
            </div>
            <div className="card-neon p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-neon-purple/20 flex items-center justify-center">
                  <Clock className="text-neon-purple" size={20} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">{stats.completedRounds}/{stats.totalRounds}</div>
                  <div className="text-xs text-gray-500">完成轮次</div>
                </div>
              </div>
            </div>
            <div className="card-neon p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-neon-gold/20 flex items-center justify-center">
                  <Trophy className="text-neon-gold" size={20} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">{stats.totalWinners}/{stats.totalPrizes}</div>
                  <div className="text-xs text-gray-500">已中奖/总名额</div>
                </div>
              </div>
            </div>
            <div className="card-neon p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-neon-pink/20 flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-neon-pink animate-pulse" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">
                    {currentActivity.status === 'active' ? '直播中' : 
                     currentActivity.status === 'draft' ? '准备中' : '已结束'}
                  </div>
                  <div className="text-xs text-gray-500">活动状态</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-6 border-b border-white/5 pb-2">
          {[
            { key: 'draw', label: '抽签控制' },
            { key: 'candidates', label: '候选名单' },
            { key: 'groups', label: '分组管理' },
            { key: 'danmaku', label: '弹幕管理' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`px-6 py-2.5 rounded-t-xl font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-dark-300 text-white border-t border-x border-primary-500/30'
                  : 'text-gray-500 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-1 space-y-6">
            <RoundSetup
              activityId={currentActivity.id}
              rounds={rounds}
              winners={winners}
              currentRoundId={currentRoundId}
              onUpdate={loadData}
              onSelectRound={setCurrentRoundId}
            />
          </div>

          <div className="col-span-2">
            {activeTab === 'draw' && (
              <DrawControl
                activityId={currentActivity.id}
                currentRound={currentRound}
                candidates={candidates}
                winners={winners}
                onUpdate={loadData}
              />
            )}
            {activeTab === 'candidates' && (
              <CandidateList
                activityId={currentActivity.id}
                candidates={candidates}
                groups={groups}
                onUpdate={loadData}
              />
            )}
            {activeTab === 'groups' && (
              <GroupManager
                activityId={currentActivity.id}
                groups={groups}
                candidates={candidates}
                onUpdate={loadData}
              />
            )}
            {activeTab === 'danmaku' && (
              <DanmakuPanel
                activityId={currentActivity.id}
                onUpdate={loadData}
              />
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
