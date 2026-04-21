import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';

const sqlite = new SQLiteConnection(CapacitorSQLite);
let db = null;

const DB_NAME = 'hyeyoon_media';
const DB_VERSION = 1;

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS media_groups (
  id TEXT PRIMARY KEY,
  sourceUrl TEXT,
  platform TEXT NOT NULL,
  mode TEXT NOT NULL,
  thumbnailPath TEXT,
  totalCount INTEGER DEFAULT 1,
  createdAt TEXT NOT NULL,
  registeredAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS media_items (
  id TEXT PRIMARY KEY,
  groupId TEXT NOT NULL,
  filePath TEXT,
  remoteUrl TEXT,
  type TEXT NOT NULL,
  itemIndex INTEGER NOT NULL,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (groupId) REFERENCES media_groups(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  count INTEGER DEFAULT 0,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS group_tags (
  groupId TEXT NOT NULL,
  tagId TEXT NOT NULL,
  PRIMARY KEY (groupId, tagId),
  FOREIGN KEY (groupId) REFERENCES media_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (tagId) REFERENCES tags(id) ON DELETE CASCADE
);
`;

export async function initDB() {
  if (db) return db;

  if (Capacitor.isNativePlatform()) {
    await sqlite.checkConnectionsConsistency();
    const isConn = (await sqlite.isConnection(DB_NAME, false)).result;

    if (isConn) {
      db = await sqlite.retrieveConnection(DB_NAME, false);
    } else {
      db = await sqlite.createConnection(DB_NAME, false, 'no-encryption', DB_VERSION, false);
    }
  } else {
    console.warn('SQLite는 네이티브 환경에서만 동작합니다.');
    return null;
  }

  await db.open();
  await db.execute(CREATE_TABLES_SQL);
  return db;
}

export function getDB() {
  return db;
}
