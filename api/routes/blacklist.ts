import { Router } from 'express';
import { db } from '../db.js';
import { generateId, sendSuccess, sendError, requireAuth } from '../utils.js';
import type { Blacklist } from '../../shared/types.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    await db.read();
    const blacklist = [...db.data.blacklist].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    sendSuccess(res, blacklist);
  } catch (error) {
    sendError(res, '获取黑名单失败', 500);
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { number, reason, autoRedraw = false } = req.body;
    if (!number) {
      return sendError(res, '编号不能为空');
    }
    const numStr = String(number).trim();
    await db.read();
    const existing = db.data.blacklist.find(b => b.number === numStr);
    if (existing) {
      return sendError(res, '该编号已在黑名单中');
    }
    const item: Blacklist = {
      id: generateId(),
      number: numStr,
      reason: reason || '',
      createdAt: new Date().toISOString(),
    };
    db.data.blacklist.push(item);
    db.data.candidates.forEach(c => {
      if (c.number === numStr) {
        c.isBlacklisted = true;
      }
    });

    const affectedWinners: Array<{ winnerId: string; roundId: string; activityId: string }> = [];
    db.data.winners.forEach(w => {
      if (w.isInvalid) return;
      const candidate = db.data.candidates.find(c => c.id === w.candidateId);
      if (candidate && candidate.number === numStr) {
        w.isInvalid = true;
        w.invalidReason = reason ? `黑名单：${reason}` : '加入黑名单';
        const round = db.data.rounds.find(r => r.id === w.roundId);
        if (round) {
          round.status = round.drawCount > db.data.winners.filter(ww => ww.roundId === w.roundId && !ww.isInvalid).length ? 'drawing' : round.status;
          affectedWinners.push({ winnerId: w.id, roundId: w.roundId, activityId: round.activityId });
        }
      }
    });

    if (req.session.user) {
      db.data.operationLogs.push({
        id: generateId(),
        activityId: 'system',
        operatorId: req.session.user.id,
        operatorName: req.session.user.username,
        action: '加入黑名单',
        actionType: 'blacklist_add',
        details: `编号 ${numStr}${reason ? `（${reason}）` : ''}，已使 ${affectedWinners.length} 条中奖记录失效${autoRedraw ? '，已自动补抽' : ''}`,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
    }

    await db.write();

    const io = req.app.get('io');
    if (io) {
      affectedWinners.forEach(aw => {
        io.to(aw.activityId).emit('draw:invalidated', {
          winnerId: aw.winnerId,
          roundId: aw.roundId,
          reason: w => w.reason,
        });
      });
    }

    sendSuccess(res, {
      blacklist: item,
      invalidatedWinnerCount: affectedWinners.length,
      affectedWinners,
      message: affectedWinners.length > 0
        ? `已加入黑名单，并使 ${affectedWinners.length} 条中奖记录失效${autoRedraw ? '，正在补抽...' : '，可手动进行异常重抽补位'}`
        : '已添加到黑名单',
    }, undefined);
  } catch (error) {
    sendError(res, '添加黑名单失败', 500);
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await db.read();
    const index = db.data.blacklist.findIndex(b => b.id === id);
    if (index === -1) {
      return sendError(res, '记录不存在', 404);
    }
    const item = db.data.blacklist[index];
    db.data.blacklist.splice(index, 1);
    db.data.candidates.forEach(c => {
      if (c.number === item.number) {
        c.isBlacklisted = false;
      }
    });
    await db.write();
    sendSuccess(res, null, '已从黑名单移除');
  } catch (error) {
    sendError(res, '移除黑名单失败', 500);
  }
});

export default router;
