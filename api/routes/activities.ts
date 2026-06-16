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

    let data: Array<Record<string, unknown>> = [];
    const ext = (file.originalname || '').toLowerCase().split('.').pop();

    if (ext === 'csv') {
      const csvString = file.buffer.toString('utf8');
      const lines = csvString.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length === 0) {
        return sendError(res, 'CSV 文件为空');
      }
      const headerLine = lines[0];
      const headers = headerLine.split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const isHeader = headers.some(h => ['编号', 'number', '昵称', 'nickname', '序号'].includes(h));
      for (let i = isHeader ? 1 : 0; i < lines.length; i++) {
        const cols = lines[i].match(/("([^"]|"")*"|[^,]*)(,|$)/g) || [];
        const values = cols.slice(0, headers.length || 2).map(c => c.replace(/,$/, '').trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
        if (isHeader) {
          const row: Record<string, unknown> = {};
          headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
          data.push(row);
        } else {
          data.push({
            编号: values[0] || '',
            昵称: values[1] || '',
          } as Record<string, unknown>);
        }
      }
    } else {
      try {
        const workbook = XLSX.read(file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        data = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Array<Record<string, unknown>>;
      } catch (e) {
        return sendError(res, '无法解析 Excel 文件，请检查格式');
      }
    }

    await db.read();
    const activity = db.data.activities.find(a => a.id === id);
    if (!activity) {
      return sendError(res, '活动不存在', 404);
    }

    const blacklistNumbers = new Set(db.data.blacklist.map(b => b.number.trim()));
    const existingNumbers = new Set(
      db.data.candidates
        .filter(c => c.activityId === id)
        .map(c => c.number.trim())
    );

    const candidates: Candidate[] = [];
    let skippedDup = 0;
    let skippedBlacklist = 0;
    let skippedEmpty = 0;

    for (const row of data) {
      const number = (row.number ?? row['编号'] ?? row['序号'] ?? row['ID'] ?? row['id'] ?? '') as string;
      const nickname = (row.nickname ?? row['昵称'] ?? row['姓名'] ?? row['name'] ?? row['Name'] ?? '') as string;
      if (!number || !String(number).trim()) {
        skippedEmpty++;
        continue;
      }
      const numStr = String(number).trim();
      if (existingNumbers.has(numStr)) {
        skippedDup++;
        continue;
      }
      const isBl = blacklistNumbers.has(numStr);
      const candidate: Candidate = {
        id: generateId(),
        activityId: id,
        number: numStr,
        nickname: nickname && String(nickname).trim() ? String(nickname).trim() : undefined,
        isBlacklisted: isBl,
        createdAt: new Date().toISOString(),
      };
      candidates.push(candidate);
      existingNumbers.add(numStr);
      if (isBl) skippedBlacklist++;
    }

    db.data.candidates.push(...candidates);
    await db.write();

    if (req.session.user) {
      db.data.operationLogs.push({
        id: generateId(),
        activityId: id,
        operatorId: req.session.user.id,
        operatorName: req.session.user.username,
        action: `导入名单`,
        actionType: 'candidate_add',
        details: `成功导入 ${candidates.length} 人，跳过重复 ${skippedDup} 个，黑名单 ${skippedBlacklist} 个，空行 ${skippedEmpty} 个`,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
      await db.write();
    }

    sendSuccess(res, {
      imported: candidates.length,
      skippedDuplicate: skippedDup,
      skippedBlacklist,
      skippedEmpty,
      blacklistedInImported: skippedBlacklist,
    }, `成功导入 ${candidates.length} 条数据，跳过重复 ${skippedDup} 个${skippedBlacklist > 0 ? `，含黑名单 ${skippedBlacklist} 个` : ''}`);
  } catch (error) {
    console.error('Import error:', error);
    sendError(res, '导入失败，请检查文件格式', 500, error instanceof Error ? error.message : undefined);
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
    const numStr = String(number).trim();
    await db.read();
    const existing = db.data.candidates.find(c => c.activityId === id && c.number === numStr);
    if (existing) {
      return sendError(res, '该编号已存在');
    }
    const isBlacklisted = db.data.blacklist.some(b => b.number.trim() === numStr);
    const candidate: Candidate = {
      id: generateId(),
      activityId: id,
      number: numStr,
      nickname: nickname?.toString().trim() || undefined,
      groupId,
      isBlacklisted,
      createdAt: new Date().toISOString(),
    };
    db.data.candidates.push(candidate);
    if (req.session.user) {
      db.data.operationLogs.push({
        id: generateId(),
        activityId: id,
        operatorId: req.session.user.id,
        operatorName: req.session.user.username,
        action: `新增候选者`,
        actionType: 'candidate_add',
        details: `编号 ${numStr}${nickname ? `(${nickname})` : ''}${isBlacklisted ? ' [已在黑名单]' : ''}`,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
    }
    await db.write();
    sendSuccess(res, candidate, isBlacklisted ? '添加成功（该编号已在黑名单）' : '添加成功');
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
    const removed = db.data.candidates.splice(index, 1)[0];
    if (req.session.user) {
      db.data.operationLogs.push({
        id: generateId(),
        activityId: id,
        operatorId: req.session.user.id,
        operatorName: req.session.user.username,
        action: `删除候选者`,
        actionType: 'candidate_delete',
        details: `编号 ${removed.number} ${removed.nickname ? `(${removed.nickname})` : ''}`,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
    }
    await db.write();
    sendSuccess(res, null, '删除成功');
  } catch (error) {
    sendError(res, '删除候选者失败', 500);
  }
});

router.put('/:id/candidates/:candidateId', requireAuth, async (req, res) => {
  try {
    const { id, candidateId } = req.params;
    const { nickname, groupId } = req.body;
    await db.read();
    const candidate = db.data.candidates.find(c => c.id === candidateId && c.activityId === id);
    if (!candidate) {
      return sendError(res, '候选者不存在', 404);
    }
    if (nickname !== undefined) {
      candidate.nickname = String(nickname).trim() || undefined;
    }
    if (groupId !== undefined) {
      candidate.groupId = String(groupId).trim() || undefined;
    }
    if (req.session.user) {
      db.data.operationLogs.push({
        id: generateId(),
        activityId: id,
        operatorId: req.session.user.id,
        operatorName: req.session.user.username,
        action: `更新候选者`,
        actionType: 'candidate_add',
        details: `编号 ${candidate.number} 更新${groupId !== undefined ? `，分组=${candidate.groupId || '未分组'}` : ''}${nickname !== undefined ? `，昵称=${candidate.nickname || '无'}` : ''}`,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
    }
    await db.write();
    sendSuccess(res, candidate, '更新成功');
  } catch (error) {
    sendError(res, '更新候选者失败', 500);
  }
});

router.post('/:id/signup', async (req, res) => {
  try {
    const { id } = req.params;
    const { number, nickname, password } = req.body;
    if (!number) {
      return sendError(res, '编号不能为空');
    }
    await db.read();
    const activity = db.data.activities.find(a => a.id === id);
    if (!activity) {
      return sendError(res, '活动不存在', 404);
    }
    if (activity.status !== 'active') {
      return sendError(res, '活动未开始或已结束');
    }
    if (activity.password) {
      if (!password || String(password).trim() !== String(activity.password).trim()) {
        return sendError(res, '报名口令不正确', 401);
      }
    }
    const numStr = String(number).trim();
    if (!numStr) {
      return sendError(res, '编号不能为空');
    }
    const existing = db.data.candidates.find(c => c.activityId === id && c.number === numStr);
    if (existing) {
      if (existing.isBlacklisted) {
        return sendError(res, '该编号已被禁止参与', 403);
      }
      return sendSuccess(res, existing, '该编号已报名，无需重复提交');
    }
    const inBlacklist = db.data.blacklist.some(b => b.number === numStr);
    if (inBlacklist) {
      return sendError(res, '该编号已被禁止参与', 403);
    }
    const candidate: Candidate = {
      id: generateId(),
      activityId: id,
      number: numStr,
      nickname: nickname?.toString().trim() || undefined,
      isBlacklisted: false,
      createdAt: new Date().toISOString(),
    };
    db.data.candidates.push(candidate);

    db.data.operationLogs.push({
      id: generateId(),
      activityId: id,
      operatorName: '观众口令报名',
      action: `口令报名`,
      actionType: 'candidate_add',
      details: `编号 ${numStr}${nickname ? `(${nickname})` : ''}`,
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });

    await db.write();

    const io = req.app.get('io');
    if (io) {
      io.to(id).emit('candidate:new', candidate);
    }

    sendSuccess(res, candidate, '报名成功！你的编号已进入候选池');
  } catch (error) {
    console.error('Signup error:', error);
    sendError(res, '报名失败，请稍后重试', 500);
  }
});

export default router;
