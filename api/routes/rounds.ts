import { Router } from 'express';
import { db } from '../db.js';
import { generateId, sendSuccess, sendError, requireAuth } from '../utils.js';
import { executeDraw, executeRedraw, getRemainingCount } from '../services/drawService.js';
import type { DrawRound } from '../../shared/types.js';

const router = Router();

router.get('/:activityId/rounds', async (req, res) => {
  try {
    const { activityId } = req.params;
    await db.read();
    const rounds = db.data.rounds
      .filter(r => r.activityId === activityId)
      .sort((a, b) => a.roundNumber - b.roundNumber);
    sendSuccess(res, rounds);
  } catch (error) {
    sendError(res, '获取轮次列表失败', 500);
  }
});

router.post('/:activityId/rounds', requireAuth, async (req, res) => {
  try {
    const { activityId } = req.params;
    const { name, drawCount, allowRepeat, mode, groupId } = req.body;
    if (!name || !drawCount) {
      return sendError(res, '轮次名称和抽取人数不能为空');
    }
    await db.read();
    const existingRounds = db.data.rounds.filter(r => r.activityId === activityId);
    const round: DrawRound = {
      id: generateId(),
      activityId,
      roundNumber: existingRounds.length + 1,
      name,
      drawCount: Number(drawCount),
      allowRepeat: allowRepeat ?? false,
      mode: mode || 'single',
      groupId,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    db.data.rounds.push(round);
    if (req.session.user) {
      db.data.operationLogs.push({
        id: generateId(),
        activityId,
        operatorId: req.session.user.id,
        operatorName: req.session.user.username,
        action: '创建轮次',
        actionType: 'round_create',
        details: `「${name}」抽取${drawCount}人，模式${mode === 'multi' ? '连抽' : '单抽'}${groupId ? '，分组抽取' : ''}`,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
    }
    await db.write();
    sendSuccess(res, round, '轮次创建成功');
  } catch (error) {
    sendError(res, '创建轮次失败', 500);
  }
});

router.put('/:activityId/rounds/:roundId', requireAuth, async (req, res) => {
  try {
    const { activityId, roundId } = req.params;
    const { name, drawCount, allowRepeat, mode, status, groupId } = req.body;
    await db.read();
    const round = db.data.rounds.find(r => r.id === roundId && r.activityId === activityId);
    if (!round) {
      return sendError(res, '轮次不存在', 404);
    }
    const validWinnerCount = db.data.winners.filter(w => w.roundId === roundId && !w.isInvalid).length;
    if (validWinnerCount > 0) {
      if (drawCount !== undefined && Number(drawCount) < validWinnerCount) {
        return sendError(res, `抽取人数不能小于已抽中的 ${validWinnerCount} 人`);
      }
    }
    if (name) round.name = name;
    if (drawCount !== undefined) round.drawCount = Number(drawCount);
    if (allowRepeat !== undefined) round.allowRepeat = allowRepeat;
    if (mode) round.mode = mode;
    if (status) round.status = status;
    if (groupId !== undefined) round.groupId = groupId || undefined;
    await db.write();
    sendSuccess(res, round, '轮次更新成功');
  } catch (error) {
    sendError(res, '更新轮次失败', 500);
  }
});

router.delete('/:activityId/rounds/:roundId', requireAuth, async (req, res) => {
  try {
    const { activityId, roundId } = req.params;
    await db.read();
    const roundIndex = db.data.rounds.findIndex(r => r.id === roundId && r.activityId === activityId);
    if (roundIndex === -1) {
      return sendError(res, '轮次不存在', 404);
    }
    const validWinners = db.data.winners.filter(w => w.roundId === roundId && !w.isInvalid);
    if (validWinners.length > 0) {
      return sendError(res, `该轮次已有 ${validWinners.length} 条中奖记录，无法删除。如需删除请先处理异常重抽或清空中奖结果。`, 400);
    }
    const removedRound = db.data.rounds.splice(roundIndex, 1)[0];
    db.data.winners = db.data.winners.filter(w => w.roundId !== roundId);
    const remainingRounds = db.data.rounds
      .filter(r => r.activityId === activityId)
      .sort((a, b) => a.roundNumber - b.roundNumber);
    remainingRounds.forEach((r, i) => { r.roundNumber = i + 1; });
    if (req.session.user) {
      db.data.operationLogs.push({
        id: generateId(),
        activityId,
        operatorId: req.session.user.id,
        operatorName: req.session.user.username,
        action: '删除轮次',
        actionType: 'round_update',
        details: `删除轮次「${removedRound.name}」`,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
    }
    await db.write();
    sendSuccess(res, null, '轮次已删除');
  } catch (error) {
    sendError(res, '删除轮次失败', 500);
  }
});

router.post('/:activityId/rounds/:roundId/draw', requireAuth, async (req, res) => {
  try {
    const { activityId, roundId } = req.params;
    const { drawCount } = req.body;
    const operatorId = req.session?.user?.id;
    const operatorName = req.session?.user?.username || '未知';

    if (!operatorId) {
      return sendError(res, '未登录', 401);
    }

    const result = await executeDraw(activityId, roundId, operatorId, operatorName, drawCount ? Number(drawCount) : undefined);

    const io = req.app.get('io');
    if (io) {
      io.to(activityId).emit('draw:complete', {
        roundId,
        winners: result.winners,
      });
      io.to(activityId).emit('round:update', {
        roundId,
        remaining: getRemainingCount(roundId, db.data.rounds.find(r => r.id === roundId)?.drawCount || 0),
      });
    }

    sendSuccess(res, result, '抽取成功');
  } catch (error) {
    sendError(res, error instanceof Error ? error.message : '抽取失败', 400);
  }
});

router.post('/:activityId/rounds/:roundId/redraw', requireAuth, async (req, res) => {
  try {
    const { activityId, roundId } = req.params;
    const { winnerId } = req.body;
    const operatorId = req.session?.user?.id;
    const operatorName = req.session?.user?.username || '未知';

    if (!operatorId) {
      return sendError(res, '未登录', 401);
    }

    if (!winnerId) {
      return sendError(res, '请指定要重抽的中奖记录');
    }

    const result = await executeRedraw(activityId, roundId, winnerId, operatorId, operatorName);

    const io = req.app.get('io');
    if (io) {
      io.to(activityId).emit('draw:redraw', {
        roundId,
        replacedWinnerId: winnerId,
        newWinners: result.winners,
      });
    }

    sendSuccess(res, result, '重抽成功');
  } catch (error) {
    sendError(res, error instanceof Error ? error.message : '重抽失败', 400);
  }
});

router.get('/:activityId/winners', async (req, res) => {
  try {
    const { activityId } = req.params;
    await db.read();
    const winners = db.data.winners
      .filter(w => {
        const round = db.data.rounds.find(r => r.id === w.roundId);
        return round?.activityId === activityId && !w.isInvalid;
      })
      .map(w => ({
        ...w,
        candidate: db.data.candidates.find(c => c.id === w.candidateId),
      }))
      .sort((a, b) => new Date(b.drawTime).getTime() - new Date(a.drawTime).getTime());
    sendSuccess(res, winners);
  } catch (error) {
    sendError(res, '获取中奖名单失败', 500);
  }
});

export default router;
