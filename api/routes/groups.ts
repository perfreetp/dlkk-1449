import { Router } from 'express';
import { db } from '../db.js';
import { generateId, sendSuccess, sendError, requireAuth } from '../utils.js';
import type { Group } from '../../shared/types.js';

const router = Router();

router.get('/:activityId/groups', async (req, res) => {
  try {
    const { activityId } = req.params;
    await db.read();
    const groups = db.data.groups
      .filter(g => g.activityId === activityId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    sendSuccess(res, groups);
  } catch (error) {
    sendError(res, '获取分组列表失败', 500);
  }
});

router.post('/:activityId/groups', requireAuth, async (req, res) => {
  try {
    const { activityId } = req.params;
    const { name, color } = req.body;
    if (!name) {
      return sendError(res, '分组名称不能为空');
    }
    await db.read();
    const group: Group = {
      id: generateId(),
      activityId,
      name: String(name),
      color: color || '#6366f1',
      createdAt: new Date().toISOString(),
    };
    db.data.groups.push(group);
    await db.write();
    sendSuccess(res, group, '分组创建成功');
  } catch (error) {
    sendError(res, '创建分组失败', 500);
  }
});

router.delete('/:activityId/groups/:groupId', requireAuth, async (req, res) => {
  try {
    const { activityId, groupId } = req.params;
    await db.read();
    const index = db.data.groups.findIndex(
      g => g.id === groupId && g.activityId === activityId
    );
    if (index === -1) {
      return sendError(res, '分组不存在', 404);
    }
    db.data.groups.splice(index, 1);
    db.data.candidates.forEach(c => {
      if (c.groupId === groupId) {
        c.groupId = undefined;
      }
    });
    await db.write();
    sendSuccess(res, null, '分组已删除');
  } catch (error) {
    sendError(res, '删除分组失败', 500);
  }
});

router.get('/:activityId/logs', requireAuth, async (req, res) => {
  try {
    const { activityId } = req.params;
    await db.read();
    const logs = db.data.operationLogs
      .filter(l => l.activityId === activityId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    sendSuccess(res, logs);
  } catch (error) {
    sendError(res, '获取操作日志失败', 500);
  }
});

export default router;
