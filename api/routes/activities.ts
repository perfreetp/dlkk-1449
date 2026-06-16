import { Router } from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import { db } from '../db.js';
import { generateId, sendSuccess, sendError, requireAuth, requireHost } from '../utils.js';
import type { Activity, Candidate } from '../../shared/types.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', requireAuth, async (req, res) => {
  try {
    await db.read();
    const activities = [...db.data.activities].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    sendSuccess(res, activities);
  } catch (error) {
    sendError(res, '获取活动列表失败', 500);
  }
});

router.get('/public', async (req, res) => {
  try {
    await db.read();
    const activities = db.data.activities
      .filter(a => a.status === 'active' || a.status === 'completed')
      .map(({ password, ...rest }) => rest);
    sendSuccess(res, activities);
  } catch (error) {
    sendError(res, '获取活动列表失败', 500);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.read();
    const activity = db.data.activities.find(a => a.id === id);
    if (!activity) {
      return sendError(res, '活动不存在', 404);
    }
    const { password, ...publicActivity } = activity as Activity & { password?: string };
    sendSuccess(res, publicActivity || activity);
  } catch (error) {
    sendError(res, '获取活动详情失败', 500);
  }
});

router.post('/', requireHost, async (req, res) => {
  try {
    const { name, description, password } = req.body;
    if (!name) {
      return sendError(res, '活动名称不能为空');
    }
    await db.read();
    const activity: Activity = {
      id: generateId(),
      name,
      description: description || '',
      status: 'draft',
      password,
      createdAt: new Date().toISOString(),
    };
    db.data.activities.push(activity);
    await db.write();
    sendSuccess(res, activity, '活动创建成功');
  } catch (error) {
    sendError(res, '创建活动失败', 500);
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status, password } = req.body;
    await db.read();
    const activity = db.data.activities.find(a => a.id === id);
    if (!activity) {
      return sendError(res, '活动不存在', 404);
    }
    if (name) activity.name = name;
    if (description !== undefined) activity.description = description;
    if (status) activity.status = status;
    if (password !== undefined) activity.password = password;
    await db.write();
    sendSuccess(res, activity, '活动更新成功');
  } catch (error) {
    sendError(res, '更新活动失败', 500);
  }
});

router.post('/:id/start', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await db.read();
    const activity = db.data.activities.find(a => a.id === id);
    if (!activity) {
      return sendError(res, '活动不存在', 404);
    }
    if (activity.status !== 'draft') {
      return sendError(res, '只有草稿状态的活动可以开始');
    }
    activity.status = 'active';
    activity.startedAt = new Date().toISOString();
    await db.write();
    sendSuccess(res, activity, '活动已开始');
  } catch (error) {
    sendError(res, '开始活动失败', 500);
  }
});

router.post('/:id/end', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await db.read();
    const activity = db.data.activities.find(a => a.id === id);
    if (!activity) {
      return sendError(res, '活动不存在', 404);
    }
    if (activity.status !== 'active') {
      return sendError(res, '只有进行中的活动可以结束');
    }
    activity.status = 'completed';
    activity.endedAt = new Date().toISOString();
    await db.write();
    sendSuccess(res, activity, '活动已结束');
  } catch (error) {
    sendError(res, '结束活动失败', 500);
  }
});

router.post('/:id/archive', requireHost, async (req, res) => {
  try {
    const { id } = req.params;
    await db.read();
    const activity = db.data.activities.find(a => a.id === id);
    if (!activity) {
      return sendError(res, '活动不存在', 404);
    }
    activity.status = 'archived';
    await db.write();
    sendSuccess(res, activity, '活动已归档');
  } catch (error) {
    sendError(res, '归档活动失败', 500);
  }
});

router.post('/:id/unarchive', requireHost, async (req, res) => {
  try {
    const { id } = req.params;
    await db.read();
    const activity = db.data.activities.find(a => a.id === id);
    if (!activity) {
      return sendError(res, '活动不存在', 404);
    }
    activity.status = 'completed';
    await db.write();
    sendSuccess(res, activity, '活动已恢复');
  } catch (error) {
    sendError(res, '恢复活动失败', 500);
  }
});

router.post('/:id/import', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    const file = req.file;
    if (!file) {
      return sendError(res, '请上传文件');
    }
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet) as Array<{ number?: string; nickname?: string; 编号?: string; 昵称?: string }>;
    await db.read();
    const candidates: Candidate[] = [];
    const existingNumbers = new Set(
      db.data.candidates
        .filter(c => c.activityId === id)
        .map(c => c.number)
    );
    for (const row of data) {
      const number = row.number || row.编号;
      const nickname = row.nickname || row.昵称;
      if (!number) continue;
      const numStr = String(number).trim();
      if (existingNumbers.has(numStr)) continue;
      candidates.push({
        id: generateId(),
        activityId: id,
        number: numStr,
        nickname: nickname ? String(nickname).trim() : undefined,
        isBlacklisted: false,
        createdAt: new Date().toISOString(),
      });
      existingNumbers.add(numStr);
    }
    db.data.candidates.push(...candidates);
    await db.write();
    sendSuccess(res, { imported: candidates.length }, `成功导入 ${candidates.length} 条数据`);
  } catch (error) {
    console.error('Import error:', error);
    sendError(res, '导入失败', 500);
  }
});

router.get('/:id/candidates', async (req, res) => {
  try {
    const { id } = req.params;
    await db.read();
    const candidates = db.data.candidates.filter(c => c.activityId === id);
    sendSuccess(res, candidates);
  } catch (error) {
    sendError(res, '获取候选名单失败', 500);
  }
});

router.post('/:id/candidates', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { number, nickname, groupId } = req.body;
    if (!number) {
      return sendError(res, '编号不能为空');
    }
    await db.read();
    const existing = db.data.candidates.find(c => c.activityId === id && c.number === number);
    if (existing) {
      return sendError(res, '该编号已存在');
    }
    const candidate: Candidate = {
      id: generateId(),
      activityId: id,
      number: String(number),
      nickname: nickname?.toString() || undefined,
      groupId,
      isBlacklisted: false,
      createdAt: new Date().toISOString(),
    };
    db.data.candidates.push(candidate);
    await db.write();
    sendSuccess(res, candidate, '添加成功');
  } catch (error) {
    sendError(res, '添加候选者失败', 500);
  }
});

router.delete('/:id/candidates/:candidateId', requireAuth, async (req, res) => {
  try {
    const { id, candidateId } = req.params;
    await db.read();
    const index = db.data.candidates.findIndex(c => c.id === candidateId && c.activityId === id);
    if (index === -1) {
      return sendError(res, '候选者不存在', 404);
    }
    db.data.candidates.splice(index, 1);
    await db.write();
    sendSuccess(res, null, '删除成功');
  } catch (error) {
    sendError(res, '删除候选者失败', 500);
  }
});

export default router;
