import { Router } from 'express';
import { db } from '../db.js';
import { generateId, sendSuccess, sendError, requireAuth } from '../utils.js';
import type { Danmaku } from '../../shared/types.js';

const router = Router();

router.get('/:activityId/danmaku', async (req, res) => {
  try {
    const { activityId } = req.params;
    const { approved } = req.query;
    await db.read();
    let danmaku = db.data.danmaku.filter(d => d.activityId === activityId);
    if (approved === 'true') {
      danmaku = danmaku.filter(d => d.isApproved);
    }
    danmaku = danmaku.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    sendSuccess(res, danmaku);
  } catch (error) {
    sendError(res, '获取弹幕列表失败', 500);
  }
});

router.post('/:activityId/danmaku', async (req, res) => {
  try {
    const { activityId } = req.params;
    const { content, senderNickname, color } = req.body;
    if (!content || !senderNickname) {
      return sendError(res, '内容和昵称不能为空');
    }
    if (content.length > 50) {
      return sendError(res, '弹幕内容不能超过50字');
    }
    await db.read();
    const danmaku: Danmaku = {
      id: generateId(),
      activityId,
      content: String(content),
      senderNickname: String(senderNickname),
      isApproved: false,
      color: color || '#ffffff',
      createdAt: new Date().toISOString(),
    };
    db.data.danmaku.push(danmaku);
    await db.write();

    const io = req.app.get('io');
    if (io) {
      io.to(activityId).emit('danmaku:new', danmaku);
    }

    sendSuccess(res, danmaku, '弹幕发送成功');
  } catch (error) {
    sendError(res, '发送弹幕失败', 500);
  }
});

router.post('/:activityId/danmaku/:danmakuId/approve', requireAuth, async (req, res) => {
  try {
    const { activityId, danmakuId } = req.params;
    await db.read();
    const danmaku = db.data.danmaku.find(
      d => d.id === danmakuId && d.activityId === activityId
    );
    if (!danmaku) {
      return sendError(res, '弹幕不存在', 404);
    }
    danmaku.isApproved = true;
    await db.write();

    const io = req.app.get('io');
    if (io) {
      io.to(activityId).emit('danmaku:approved', danmaku);
    }

    sendSuccess(res, danmaku, '弹幕已通过');
  } catch (error) {
    sendError(res, '审核弹幕失败', 500);
  }
});

export default router;
