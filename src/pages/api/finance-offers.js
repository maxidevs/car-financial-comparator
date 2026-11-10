import { db } from '../../lib/db.js';

// Ofertas de financiación compartidas por todos los vehículos.
const list = () => db.prepare('SELECT id, data FROM finance_offers ORDER BY position').all()
  .map((row) => ({ id: row.id, ...JSON.parse(row.data) }));

function parseOffer(o) {
  const offer = {
    name: String(o?.name ?? '').trim(),
    percent: Number(o?.percent),
    rate: Number(o?.rate),
    months: Number(o?.months),
  };
  const valid = typeof o?.id === 'string' && o.id && offer.name
    && offer.percent >= 0 && offer.percent <= 100 && offer.rate >= 0
    && Number.isInteger(offer.months) && offer.months > 0;
  return valid ? { id: o.id, offer } : null;
}

export const GET = () => Response.json(list());

// Reemplaza la lista completa: el formulario edita todas las ofertas a la vez.
export const PUT = async ({ request }) => {
  let items;
  try {
    items = (await request.json()).map(parseOffer);
  } catch {
    return new Response('Datos inválidos', { status: 400 });
  }
  if (items.some((item) => !item)) return new Response('Revisa los datos de las ofertas', { status: 400 });
  const insert = db.prepare('INSERT INTO finance_offers (id, position, data) VALUES (?, ?, ?)');
  db.exec('BEGIN');
  try {
    db.exec('DELETE FROM finance_offers');
    items.forEach(({ id, offer }, position) => insert.run(id, position, JSON.stringify(offer)));
    db.exec('COMMIT');
  } catch {
    db.exec('ROLLBACK');
    return new Response('No se pudieron guardar las ofertas', { status: 400 });
  }
  return Response.json(list());
};
