import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
export const root=path.resolve(process.env.DATA_DIR || './data');
mkdirSync(path.join(root,'media'),{recursive:true});
export const db=new DatabaseSync(path.join(root,'comparador.sqlite'));
db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS vehicles (id INTEGER PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, session_secret TEXT NOT NULL); CREATE TABLE IF NOT EXISTS finance_offers (id TEXT PRIMARY KEY, position INTEGER NOT NULL, data TEXT NOT NULL)');

// Migración 1: las ofertas de financiación dejan de vivir dentro de cada
// vehículo y pasan a una lista compartida (un crédito depende del banco, no
// del vehículo). Las ofertas idénticas se fusionan y cada vehículo conserva la
// que tenía elegida.
if (db.prepare('PRAGMA user_version').get().user_version < 1) {
  db.exec('BEGIN');
  try {
    const shared = new Map();
    const insert = db.prepare('INSERT INTO finance_offers (id, position, data) VALUES (?, ?, ?)');
    const update = db.prepare('UPDATE vehicles SET data = ? WHERE id = ?');
    for (const row of db.prepare('SELECT * FROM vehicles ORDER BY id').all()) {
      const v = JSON.parse(row.data);
      const own = Array.isArray(v.financingOffers) ? v.financingOffers
        : Number(v.percent) > 0 ? [{ id: 'legacy', name: 'Financiación existente', percent: v.percent, rate: v.rate, months: v.months }]
        : [];
      const newIds = {};
      for (const o of own) {
        const offer = { name: String(o.name || '').trim() || 'Oferta', percent: Number(o.percent) || 0, rate: Number(o.rate) || 0, months: Number(o.months) || 60 };
        const key = JSON.stringify(offer);
        if (!shared.has(key)) {
          shared.set(key, randomUUID());
          insert.run(shared.get(key), shared.size - 1, key);
        }
        newIds[o.id] = shared.get(key);
      }
      const selected = own.find((o) => o.id === v.selectedFinanceId) ?? own[0];
      v.selectedFinanceId = selected ? newIds[selected.id] : '';
      delete v.financingOffers; delete v.percent; delete v.rate; delete v.months;
      update.run(JSON.stringify(v), row.id);
    }
    db.exec('PRAGMA user_version = 1; COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
