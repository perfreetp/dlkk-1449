export interface User {
  id: string;
  username: string;
  role: 'host' | 'assistant';
  passwordHash: string;
  createdAt: string;
}

export interface Activity {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
  password?: string;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
}

export interface Candidate {
  id: string;
  activityId: string;
  number: string;
  nickname?: string;
  groupId?: string;
  isBlacklisted: boolean;
  createdAt: string;
}

export interface DrawRound {
  id: string;
  activityId: string;
  roundNumber: number;
  name: string;
  drawCount: number;
  allowRepeat: boolean;
  mode: 'single' | 'multi';
  status: 'pending' | 'drawing' | 'completed';
  createdAt: string;
}

export interface Winner {
  id: string;
  candidateId: string;
  candidate?: Candidate;
  roundId: string;
  drawTime: string;
  drawOrder?: number;
  isReplenishment: boolean;
  replacedWinnerId?: string;
  operatorId?: string;
  operatorName?: string;
  isInvalid?: boolean;
  invalidReason?: string;
  createdAt: string;
}

export interface Danmaku {
  id: string;
  activityId: string;
  content: string;
  senderNickname: string;
  isApproved: boolean;
  color?: string;
  createdAt: string;
}

export interface Blacklist {
  id: string;
  number: string;
  reason: string;
  createdAt: string;
}

export interface OperationLog {
  id: string;
  activityId: string;
  operatorId?: string;
  operatorName: string;
  action: string;
  actionType?: 'draw' | 'redraw' | 'candidate_add' | 'candidate_delete' | 'round_create' | 'round_update' | 'activity_start' | 'activity_end' | 'blacklist_add' | 'blacklist_remove' | 'other';
  details: string;
  timestamp: string;
  createdAt: string;
}

export interface Group {
  id: string;
  activityId: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface DrawState {
  isDrawing: boolean;
  currentRoundId: string | null;
  currentNumber: string | null;
  animationProgress: number;
}

export type SocketEvent =
  | 'draw:start'
  | 'draw:update'
  | 'draw:complete'
  | 'draw:redraw'
  | 'danmaku:new'
  | 'danmaku:approved'
  | 'round:update'
  | 'activity:update';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
