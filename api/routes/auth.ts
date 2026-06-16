import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { sendSuccess, sendError } from '../utils.js';

const router = Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return sendError(res, '用户名和密码不能为空');
    }

    await db.read();
    const user = db.data.users.find(u => u.username === username);

    if (!user) {
      return sendError(res, '用户名或密码错误');
    }

    const isValid = bcrypt.compareSync(password, user.passwordHash);
    if (!isValid) {
      return sendError(res, '用户名或密码错误');
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      role: user.role,
    };

    sendSuccess(res, {
      id: user.id,
      username: user.username,
      role: user.role,
    }, '登录成功');
  } catch (error) {
    console.error('Login error:', error);
    sendError(res, '登录失败', 500);
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    sendSuccess(res, null, '登出成功');
  });
});

router.get('/me', (req, res) => {
  if (req.session.user) {
    sendSuccess(res, req.session.user);
  } else {
    sendError(res, '未登录', 401);
  }
});

export default router;
