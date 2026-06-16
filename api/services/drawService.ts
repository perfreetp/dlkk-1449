import { db } from '../db.js';
import { generateId, drawRandom } from '../utils.js';
import type { Candidate, Winner, DrawRound, OperationLog } from '../../shared/types.js';

export interface DrawResult {
  winners: Winner[];
  logs: OperationLog[];
}

export async function executeDraw(
  activityId: string,
  roundId: string,
  operatorId: string,
  operatorName: string
): Promise<DrawResult> {
  await db.read();

  const round = db.data.rounds.find(r => r.id === roundId && r.activityId === activityId);
  if (!round) {
    throw new Error('轮次不存在');
  }
  if (round.status === 'completed') {
    throw new Error('该轮次已完成');
  }

  const activity = db.data.activities.find(a => a.id === activityId);
  if (!activity) {
    throw new Error('活动不存在');
  }

  let candidates = db.data.candidates.filter(
    c => c.activityId === activityId && !c.isBlacklisted
  );

  if (!round.allowRepeat) {
    const existingWinnerIds = db.data.winners
      .filter(w => w.roundId === roundId && !w.isInvalid)
      .map(w => w.candidateId);
    candidates = candidates.filter(c => !existingWinnerIds.includes(c.id));
  }

  if (candidates.length === 0) {
    throw new Error('没有可抽取的候选者');
  }

  const remainingCount = round.drawCount - db.data.winners.filter(w => w.roundId === roundId && !w.isInvalid).length;
  const drawCount = Math.min(remainingCount, candidates.length);

  const existingWinnerIds = db.data.winners
    .filter(w => w.roundId === roundId && !w.isInvalid)
    .map(w => w.candidateId);

  const drawnCandidates = drawRandom<Candidate>(
    candidates,
    drawCount,
    round.allowRepeat ? [] : existingWinnerIds,
    (c) => c.id
  );

  const currentDrawOrder = db.data.winners.filter(w => w.roundId === roundId && !w.isInvalid).length;

  const winners: Winner[] = drawnCandidates.map((candidate, idx) => ({
    id: generateId(),
    candidateId: candidate.id,
    candidate,
    roundId: roundId,
    drawTime: new Date().toISOString(),
    drawOrder: currentDrawOrder + idx + 1,
    isReplenishment: false,
    operatorId,
    operatorName,
    createdAt: new Date().toISOString(),
  }));

  const logs: OperationLog[] = drawnCandidates.map(candidate => ({
    id: generateId(),
    activityId,
    operatorId,
    operatorName,
    action: '抽取',
    actionType: 'draw',
    details: `抽中编号 ${candidate.number} ${candidate.nickname ? `(${candidate.nickname})` : ''}`,
    timestamp: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  }));

  db.data.winners.push(...winners);
  db.data.operationLogs.push(...logs);

  const completedCount = db.data.winners.filter(w => w.roundId === roundId && !w.isInvalid).length;
  if (completedCount >= round.drawCount) {
    round.status = 'completed';
  } else {
    round.status = 'drawing';
  }

  await db.write();

  return { winners, logs };
}

export async function executeRedraw(
  activityId: string,
  roundId: string,
  winnerId: string,
  operatorId: string,
  operatorName: string
): Promise<DrawResult> {
  await db.read();

  const round = db.data.rounds.find(r => r.id === roundId && r.activityId === activityId);
  if (!round) {
    throw new Error('轮次不存在');
  }

  const invalidWinner = db.data.winners.find(w => w.id === winnerId);
  if (!invalidWinner) {
    throw new Error('中奖记录不存在');
  }

  invalidWinner.isInvalid = true;
  invalidWinner.invalidReason = '异常重抽';

  let candidates = db.data.candidates.filter(
    c => c.activityId === activityId && !c.isBlacklisted
  );

  const existingWinnerIds = db.data.winners
    .filter(w => w.roundId === roundId && !w.isInvalid)
    .map(w => w.candidateId);

  if (!round.allowRepeat) {
    candidates = candidates.filter(c => !existingWinnerIds.includes(c.id));
  }

  if (candidates.length === 0) {
    throw new Error('没有可补位的候选者');
  }

  const drawnCandidates = drawRandom<Candidate>(
    candidates,
    1,
    round.allowRepeat ? [] : existingWinnerIds,
    (c) => c.id
  );

  if (drawnCandidates.length === 0) {
    throw new Error('没有可补位的候选者');
  }

  const newCandidate = drawnCandidates[0];
  const currentDrawOrder = db.data.winners.filter(w => w.roundId === roundId && !w.isInvalid).length;
  const newWinner: Winner = {
    id: generateId(),
    candidateId: newCandidate.id,
    candidate: newCandidate,
    roundId: roundId,
    drawTime: new Date().toISOString(),
    drawOrder: currentDrawOrder + 1,
    isReplenishment: true,
    replacedWinnerId: winnerId,
    operatorId,
    operatorName,
    createdAt: new Date().toISOString(),
  };

  const logs: OperationLog[] = [
    {
      id: generateId(),
      activityId,
      operatorId,
      operatorName,
      action: '异常重抽',
      actionType: 'redraw',
      details: `将编号 ${invalidWinner.candidate?.number} 替换为 ${newCandidate.number} ${newCandidate.nickname ? `(${newCandidate.nickname})` : ''}`,
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    },
  ];

  db.data.winners.push(newWinner);
  db.data.operationLogs.push(...logs);

  await db.write();

  return { winners: [newWinner], logs };
}

export function getAvailableCandidates(
  activityId: string,
  roundId: string,
  allowRepeat: boolean
): Candidate[] {
  const candidates = db.data.candidates.filter(
    c => c.activityId === activityId && !c.isBlacklisted
  );

  if (!allowRepeat) {
    const existingWinnerIds = db.data.winners
      .filter(w => w.roundId === roundId && !w.isInvalid)
      .map(w => w.candidateId);
    return candidates.filter(c => !existingWinnerIds.includes(c.id));
  }

  return candidates;
}

export function getRemainingCount(roundId: string, drawCount: number): number {
  const wonCount = db.data.winners.filter(
    w => w.roundId === roundId && !w.isInvalid
  ).length;
  return Math.max(0, drawCount - wonCount);
}
