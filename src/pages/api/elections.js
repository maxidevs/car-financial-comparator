import { db } from '../../lib/db.js';

// Una elección guarda solo qué se combinó (vehículo + oferta + póliza): los
// números se recalculan siempre con los valores actuales.
const list = () => db.prepare('SELECT id, data FROM elections ORDER BY id').all()
  .map((row) => ({ id: row.id, ...JSON.parse(row.data) }));

export const GET = () => Response.json(list());

export const POST = async ({ request }) => {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response('Datos inválidos', { status: 400 });
  }
  const election = {
    name: String(body?.name ?? '').trim().slice(0, 120),
    vehicleId: Number(body?.vehicleId),
    offerId: String(body?.offerId ?? ''),
    insuranceId: String(body?.insuranceId ?? ''),
    createdAt: new Date().toISOString(),
  };
  if (!db.prepare('SELECT 1 FROM vehicles WHERE id = ?').get(election.vehicleId)) {
    return new Response('Elige un vehículo', { status: 400 });
  }
  const id = Number(db.prepare('INSERT INTO elections (data) VALUES (?)').run(JSON.stringify(election)).lastInsertRowid);
  return Response.json({ id, ...election });
};

export const DELETE = async ({ request }) => {
  const { id } = await request.json().catch(() => ({}));
  db.prepare('DELETE FROM elections WHERE id = ?').run(Number(id));
  return new Response(null, { status: 204 });
};
