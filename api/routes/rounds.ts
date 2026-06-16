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
    const { name, drawCount, allowRepeat, mode } = req.body;
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
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    db.data.rounds.push(round);
    await db.write();
    sendSuccess(res, round, '轮次创建成功');
  } catch (error) {
    sendError(res, '创建轮次失败', 500);
  }
});

router.put('/:activityId/rounds/:roundId', requireAuth, async (req, res) => {
  try {
    const { activityId, roundId } = req.params;
    const { name, drawCount, allowRepeat, mode, status } = req.body;
    await db.read();
    const round = db.data.rounds.find(r => r.id === roundId && r.activityId === activityId);
    if (!round) {
      return sendError(res, '轮次不存在', 404);
    }
    if (name) round.name = name;
    if (drawCount !== undefined) round.drawCount = Number(drawCount);
    if (allowRepeat !== undefined) round.allowRepeat = allowRepeat;
    if (mode) round.mode = mode;
    if (status) round.status = status;
    await db.write();
    sendSuccess(res, round, '轮次更新成功');
  } catch (error) {
    sendError(res, '更新轮次失败', 500);
  }
});

router.post('/:activityId/rounds/:roundId/draw', requireAuth, async (req, res) => {
  try {
    const { activityId, roundId } = req.params;
    const operatorId = req.session?.user?.id;
    const operatorName = req.session?.user?.username || '未知';

    if (!operatorId) {
      return sendError(res, '未登录', 401);
    }

    const result = await executeDraw(activityId, roundId, operatorId, operatorName);

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
