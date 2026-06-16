import { Router } from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import { db } from '../db.js';
import { generateId, sendSuccess, sendError, requireAuth } from '../utils.js';
import type { Blacklist } from '../../shared/types.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

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

    const affectedRounds = new Set<string>();
    const affectedWinners: Array<{ winnerId: string; roundId: string; activityId: string; invalidReason: string }> = [];
    db.data.winners.forEach(w => {
      if (w.isInvalid) return;
      const candidate = db.data.candidates.find(c => c.id === w.candidateId);
      if (candidate && candidate.number === numStr) {
        w.isInvalid = true;
        w.invalidReason = reason ? `黑名单：${reason}` : '加入黑名单';
        const round = db.data.rounds.find(r => r.id === w.roundId);
        if (round) {
          round.status = round.drawCount > db.data.winners.filter(ww => ww.roundId === w.roundId && !ww.isInvalid).length ? 'drawing' : round.status;
          affectedWinners.push({ winnerId: w.id, roundId: w.roundId, activityId: round.activityId, invalidReason: w.invalidReason });
          affectedRounds.add(w.roundId);
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
      const activityToRounds: Record<string, string[]> = {};
      affectedWinners.forEach(aw => {
        if (!activityToRounds[aw.activityId]) activityToRounds[aw.activityId] = [];
        if (!activityToRounds[aw.activityId].includes(aw.roundId)) {
          activityToRounds[aw.activityId].push(aw.roundId);
        }
      });
      affectedWinners.forEach(aw => {
        io.to(aw.activityId).emit('draw:invalidated', {
          winnerId: aw.winnerId,
          roundId: aw.roundId,
          reason: aw.invalidReason,
        });
      });
      Object.entries(activityToRounds).forEach(([activityId, roundIds]) => {
        roundIds.forEach(roundId => {
          const round = db.data.rounds.find(r => r.id === roundId);
          if (!round) return;
          const validWinners = db.data.winners.filter(w => w.roundId === roundId && !w.isInvalid).length;
          io.to(activityId).emit('round:update', {
            roundId,
            remaining: Math.max(0, round.drawCount - validWinners),
            status: round.status,
            validWinners,
          });
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

router.post('/import', requireAuth, upload.single('file'), async (req, res) => {
  try {
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
      const isHeader = headers.some(h => ['编号', 'number', '原因', 'reason', '备注'].includes(h));
      for (let i = isHeader ? 1 : 0; i < lines.length; i++) {
        const cols = lines[i].match(/("([^"]|"")*"|[^,]*)(,|$)/g) || [];
        const values = cols.slice(0, Math.max(headers.length, 2)).map(c => c.replace(/,$/, '').trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
        if (isHeader) {
          const row: Record<string, unknown> = {};
          headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
          data.push(row);
        } else {
          data.push({
            编号: values[0] || '',
            原因: values[1] || '',
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
    const existingNumbers = new Set(db.data.blacklist.map(b => b.number.trim()));

    const imported: Blacklist[] = [];
    let skippedDup = 0;
    let skippedEmpty = 0;
    let invalidatedTotal = 0;
    const activityInvalidatedMap: Record<string, { winners: Array<{ winnerId: string; roundId: string }>; rounds: Set<string> }> = {};

    for (const row of data) {
      const number = (row.number ?? row['编号'] ?? row['序号'] ?? row['ID'] ?? row['id'] ?? '') as string;
      const reason = (row.reason ?? row['原因'] ?? row['备注'] ?? row['说明'] ?? '') as string;
      if (!number || !String(number).trim()) {
        skippedEmpty++;
        continue;
      }
      const numStr = String(number).trim();
      if (existingNumbers.has(numStr)) {
        skippedDup++;
        continue;
      }
      const item: Blacklist = {
        id: generateId(),
        number: numStr,
        reason: reason?.toString().trim() || '',
        createdAt: new Date().toISOString(),
      };
      db.data.blacklist.push(item);
      existingNumbers.add(numStr);
      imported.push(item);

      db.data.candidates.forEach(c => {
        if (c.number === numStr) {
          c.isBlacklisted = true;
        }
      });

      db.data.winners.forEach(w => {
        if (w.isInvalid) return;
        const candidate = db.data.candidates.find(c => c.id === w.candidateId);
        if (candidate && candidate.number === numStr) {
          w.isInvalid = true;
          w.invalidReason = reason ? `黑名单：${reason}` : '加入黑名单';
          const round = db.data.rounds.find(r => r.id === w.roundId);
          if (round) {
            round.status = round.drawCount > db.data.winners.filter(ww => ww.roundId === w.roundId && !ww.isInvalid).length ? 'drawing' : round.status;
            if (!activityInvalidatedMap[round.activityId]) {
              activityInvalidatedMap[round.activityId] = { winners: [], rounds: new Set() };
            }
            activityInvalidatedMap[round.activityId].winners.push({ winnerId: w.id, roundId: w.roundId });
            activityInvalidatedMap[round.activityId].rounds.add(w.roundId);
            invalidatedTotal++;
          }
        }
      });
    }

    if (req.session.user && imported.length > 0) {
      db.data.operationLogs.push({
        id: generateId(),
        activityId: 'system',
        operatorId: req.session.user.id,
        operatorName: req.session.user.username,
        action: '批量导入黑名单',
        actionType: 'blacklist_add',
        details: `成功导入 ${imported.length} 条，跳过重复 ${skippedDup} 条，空行 ${skippedEmpty} 条，已使 ${invalidatedTotal} 条中奖记录失效（这些编号不会参与任何抽取）`,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
    }

    await db.write();

    const io = req.app.get('io');
    if (io) {
      Object.entries(activityInvalidatedMap).forEach(([activityId, info]) => {
        info.winners.forEach(aw => {
          const winner = db.data.winners.find(w => w.id === aw.winnerId);
          io.to(activityId).emit('draw:invalidated', {
            winnerId: aw.winnerId,
            roundId: aw.roundId,
            reason: winner?.invalidReason,
          });
        });
        info.rounds.forEach(roundId => {
          const round = db.data.rounds.find(r => r.id === roundId);
          if (!round) return;
          const validWinners = db.data.winners.filter(w => w.roundId === roundId && !w.isInvalid).length;
          io.to(activityId).emit('round:update', {
            roundId,
            remaining: Math.max(0, round.drawCount - validWinners),
            status: round.status,
            validWinners,
          });
        });
      });
    }

    sendSuccess(res, {
      imported: imported.length,
      skippedDuplicate: skippedDup,
      skippedEmpty,
      invalidatedWinnerCount: invalidatedTotal,
    }, `成功导入 ${imported.length} 条黑名单（这些编号不会参与任何抽取）${skippedDup > 0 ? `，跳过重复 ${skippedDup} 条` : ''}${invalidatedTotal > 0 ? `，已使 ${invalidatedTotal} 条中奖记录失效，请到对应轮次补位重抽` : ''}`);
  } catch (error) {
    console.error('Blacklist import error:', error);
    sendError(res, '导入失败，请检查文件格式', 500, error instanceof Error ? error.message : undefined);
  }
});

export default router;
