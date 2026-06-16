import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  User,
  Activity,
  Candidate,
  DrawRound,
  Winner,
  Danmaku,
  Blacklist,
  Group,
  OperationLog,
  DrawState,
} from '../../shared/types';

interface AppState {
  currentUser: User | null;
  currentActivity: Activity | null;
  activities: Activity[];
  candidates: Candidate[];
  rounds: DrawRound[];
  winners: Winner[];
  danmaku: Danmaku[];
  blacklist: Blacklist[];
  groups: Group[];
  operationLogs: OperationLog[];
  drawState: DrawState;
  showHostTip: boolean;

  setCurrentUser: (user: User | null) => void;
  setCurrentActivity: (activity: Activity | null) => void;
  setActivities: (activities: Activity[]) => void;
  setCandidates: (candidates: Candidate[]) => void;
  setRounds: (rounds: DrawRound[]) => void;
  setWinners: (winners: Winner[]) => void;
  addWinner: (winner: Winner) => void;
  removeWinner: (winnerId: string) => void;
  setDanmaku: (danmaku: Danmaku[]) => void;
  addDanmaku: (danmaku: Danmaku) => void;
  approveDanmaku: (danmakuId: string) => void;
  setBlacklist: (blacklist: Blacklist[]) => void;
  addBlacklist: (item: Blacklist) => void;
  removeBlacklist: (id: string) => void;
  setGroups: (groups: Group[]) => void;
  setOperationLogs: (logs: OperationLog[]) => void;
  setDrawState: (state: Partial<DrawState>) => void;
  setShowHostTip: (show: boolean) => void;
  resetDrawState: () => void;
  invalidateWinner: (winnerId: string, reason?: string) => void;
  updateRound: (roundId: string, patch: Partial<DrawRound>) => void;
  addCandidate: (candidate: Candidate) => void;
  logout: () => void;
}

const initialDrawState: DrawState = {
  isDrawing: false,
  currentRoundId: null,
  currentNumber: null,
  animationProgress: 0,
};

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      currentUser: null,
      currentActivity: null,
      activities: [],
      candidates: [],
      rounds: [],
      winners: [],
      danmaku: [],
      blacklist: [],
      groups: [],
      operationLogs: [],
      announcements: [],
      pendingAnnouncements: [],
      drawState: initialDrawState,
      showHostTip: true,

      setCurrentUser: (user) => set({ currentUser: user }),
      setCurrentActivity: (activity) => set({ currentActivity: activity }),
      setActivities: (activities) => set({ activities }),
      setCandidates: (candidates) => set({ candidates }),
      setRounds: (rounds) => set({ rounds }),
      setWinners: (winners) => set({ winners }),
      addWinner: (winner) =>
        set((state) => ({ winners: [...state.winners, winner] })),
      removeWinner: (winnerId) =>
        set((state) => ({
          winners: state.winners.map((w) =>
            w.id === winnerId ? { ...w, isInvalid: true } : w
          ),
        })),
      setDanmaku: (danmaku) => set({ danmaku }),
      addDanmaku: (item) =>
        set((state) => ({ danmaku: [...state.danmaku, item] })),
      approveDanmaku: (danmakuId) =>
        set((state) => ({
          danmaku: state.danmaku.map((d) =>
            d.id === danmakuId ? { ...d, isApproved: true } : d
          ),
        })),
      setBlacklist: (blacklist) => set({ blacklist }),
      addBlacklist: (item) =>
        set((state) => ({ blacklist: [...state.blacklist, item] })),
      removeBlacklist: (id) =>
        set((state) => ({
          blacklist: state.blacklist.filter((b) => b.id !== id),
        })),
      setGroups: (groups) => set({ groups }),
      setOperationLogs: (logs) => set({ operationLogs: logs }),
      setDrawState: (newState) =>
        set((state) => ({
          drawState: { ...state.drawState, ...newState },
        })),
      setShowHostTip: (show) => set({ showHostTip: show }),
      resetDrawState: () => set({ drawState: initialDrawState }),
      invalidateWinner: (winnerId, reason) =>
        set((state) => ({
          winners: state.winners.map((w) =>
            w.id === winnerId ? { ...w, isInvalid: true, invalidReason: reason || w.invalidReason } : w
          ),
        })),
      updateRound: (roundId, patch) =>
        set((state) => ({
          rounds: state.rounds.map((r) =>
            r.id === roundId ? { ...r, ...patch } : r
          ),
        })),
      addCandidate: (candidate) =>
        set((state) => {
          if (state.candidates.some(c => c.id === candidate.id)) {
            return { candidates: state.candidates };
          }
          return { candidates: [...state.candidates, candidate] };
        }),
      logout: () =>
        set({
          currentUser: null,
          currentActivity: null,
          drawState: initialDrawState,
        }),
    }),
    {
      name: 'draw-system-storage',
      partialize: (state) => ({
        currentUser: state.currentUser,
        currentActivity: state.currentActivity,
        showHostTip: state.showHostTip,
      }),
    }
  )
);
