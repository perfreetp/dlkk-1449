import { v4 as uuidv4 } from 'uuid';
import type { Request, Response, NextFunction } from 'express';
import type { ApiResponse } from '../shared/types.js';

export function generateId(): string {
  return uuidv4();
}

export function sendSuccess<T = unknown>(
  res: Response,
  data?: T,
  message?: string
): void {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message,
  };
  res.json(response);
}

export function sendError(
  res: Response,
  error: string,
  statusCode = 400,
  message?: string
): void {
  const response: ApiResponse = {
    success: false,
    error,
    message,
  };
  res.status(statusCode).json(response);
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !req.session.user) {
    return sendError(res, '未登录', 401);
  }
  next();
}

export function requireHost(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.user) {
    return sendError(res, '未登录', 401);
  }
  if (req.session.user.role !== 'host') {
    return sendError(res, '需要主播权限', 403);
  }
  next();
}

export function drawRandom<T>(items: T[], count: number, excludeIds: string[] = [], getId: (item: T) => string = (item) => (item as { id: string }).id): T[] {
  const available = items.filter(item => !excludeIds.includes(getId(item)));
  if (available.length === 0) return [];
  
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  const result: T[] = [];
  
  for (let i = 0; i < Math.min(count, shuffled.length); i++) {
    result.push(shuffled[i]);
  }
  
  return result;
}

declare module 'express-session' {
  interface SessionData {
    user?: {
      id: string;
      username: string;
      role: 'host' | 'assistant';
    };
  }
}
