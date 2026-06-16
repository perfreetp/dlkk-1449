/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import session from 'express-session'
import MemoryStore from 'memorystore'
import fs from 'fs'
import { initDatabase } from './db.js'
import authRoutes from './routes/auth.js'
import activityRoutes from './routes/activities.js'
import roundRoutes from './routes/rounds.js'
import danmakuRoutes from './routes/danmaku.js'
import blacklistRoutes from './routes/blacklist.js'
import groupRoutes from './routes/groups.js'
import { sendError } from './utils.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const dataDir = path.join(__dirname, 'data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

await initDatabase()

const app: express.Application = express()

const MemoryStoreSession = MemoryStore(session)

app.use(cors({
  origin: true,
  credentials: true,
}))

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use(session({
  secret: process.env.SESSION_SECRET || 'draw-system-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  store: new MemoryStoreSession({
    checkPeriod: 86400000,
  }),
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
  },
}))

app.use('/api/auth', authRoutes)
app.use('/api/activities', activityRoutes)
app.use('/api/activities', roundRoutes)
app.use('/api/activities', danmakuRoutes)
app.use('/api/activities', groupRoutes)
app.use('/api/blacklist', blacklistRoutes)

app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Server error:', error)
  sendError(res, '服务器内部错误', 500, error.message)
})

app.use((req: Request, res: Response) => {
  sendError(res, 'API not found', 404)
})

export default app
