import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import type {
  User,
  Activity,
  Candidate,
  DrawRound,
  Winner,
  Danmaku,
  Blacklist,
  OperationLog,
  Group,
} from '../shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Database {
  users: User[];
  activities: Activity[];
  candidates: Candidate[];
  rounds: DrawRound[];
  winners: Winner[];
  danmaku: Danmaku[];
  blacklist: Blacklist[];
  operationLogs: OperationLog[];
  groups: Group[];
}

const defaultData: Database = {
  users: [],
  activities: [],
  candidates: [],
  rounds: [],
  winners: [],
  danmaku: [],
  blacklist: [],
  operationLogs: [],
  groups: [],
};

const file = path.join(__dirname, 'data', 'db.json');
const adapter = new JSONFile<Database>(file);
export const db = new Low<Database>(adapter, defaultData);

export async function initDatabase() {
  await db.read();

  if (db.data.users.length === 0) {
    const defaultUsers: User[] = [
      {
        id: 'user-host-001',
        username: 'host',
        role: 'host',
        passwordHash: bcrypt.hashSync('host123', 10),
        createdAt: new Date().toISOString(),
      },
      {
        id: 'user-assistant-001',
        username: 'assistant',
        role: 'assistant',
        passwordHash: bcrypt.hashSync('assist123', 10),
        createdAt: new Date().toISOString(),
      },
    ];
    db.data.users = defaultUsers;
    await db.write();
  }
}
