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
    const { number, reason } = req.body;
    if (!number) {
      return sendError(res, '编号不能为空');
    }
    await db.read();
    const existing = db.data.blacklist.find(b => b.number === number);
    if (existing) {
      return sendError(res, '该编号已在黑名单中');
    }
    const item: Blacklist = {
      id: generateId(),
      number: String(number),
      reason: reason || '',
      createdAt: new Date().toISOString(),
    };
    db.data.blacklist.push(item);
    db.data.candidates.forEach(c => {
      if (c.number === number) {
        c.isBlacklisted = true;
      }
    });
    await db.write();
    sendSuccess(res, item, '已添加到黑名单');
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
