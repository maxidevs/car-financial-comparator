import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
export const root=path.resolve(process.env.DATA_DIR || './data');
mkdirSync(path.join(root,'media'),{recursive:true});
export const db=new DatabaseSync(path.join(root,'comparador.sqlite'));
db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS vehicles (id INTEGER PRIMARY KEY, data TEXT NOT NULL)');
