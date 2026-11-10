import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { AUTH_USER, AUTH_PASSWORD } from 'astro:env/server';
import { db } from './db.js';

export const SESSION_COOKIE = 'volt_session';
export const PASSWORD_MIN_LENGTH = 10;
const SESSION_DAYS = 30;
const FAILURE_DELAY_MS = 800;

// Mismos atributos para poner y para borrar la cookie: si no coinciden, el
// navegador ignora el borrado. Astro descarta maxAge al borrar.
export const sessionCookieOptions = {
  path: '/',
  httpOnly: true,
  sameSite: 'lax',
  secure: import.meta.env.PROD,
  maxAge: SESSION_DAYS * 24 * 60 * 60,
};

function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString('base64')}:${hash.toString('base64')}`;
}

function verifyPassword(password, stored) {
  const [, salt, hash] = stored.split(':');
  const expected = Buffer.from(hash, 'base64');
  const actual = scryptSync(String(password ?? ''), Buffer.from(salt, 'base64'), expected.length);
  return timingSafeEqual(actual, expected);
}

const newSessionSecret = () => randomBytes(32).toString('base64url');
const sign = (payload, secret) => createHmac('sha256', secret).update(payload).digest('base64url');
const safeEqual = (a, b) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
const slowDown = () => new Promise((resolve) => setTimeout(resolve, FAILURE_DELAY_MS));
const publicUser = (user) => ({ id: user.id, username: user.username });

const findUserById = (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id);
const findUserByUsername = (username) => db.prepare('SELECT * FROM users WHERE username = ?').get(username);

// AUTH_USER / AUTH_PASSWORD solo crean el primer usuario. Después las
// credenciales viven en la base y se cambian desde /perfil.
if (!db.prepare('SELECT 1 FROM users LIMIT 1').get() && AUTH_USER && AUTH_PASSWORD) {
  db.prepare('INSERT INTO users (username, password_hash, session_secret) VALUES (?, ?, ?)')
    .run(AUTH_USER, hashPassword(AUTH_PASSWORD), newSessionSecret());
}

// Sin usuario creado no entra nadie (falla cerrado).
export const isAuthConfigured = () => Boolean(db.prepare('SELECT 1 FROM users LIMIT 1').get());

// Hash de relleno: con un usuario inexistente igual se calcula scrypt, para no
// delatar por el tiempo de respuesta qué usuarios existen.
const DUMMY_HASH = hashPassword(randomBytes(16).toString('hex'));

export async function authenticate(username, password) {
  const user = findUserByUsername(String(username ?? '').trim());
  const passwordOk = verifyPassword(password, user?.password_hash ?? DUMMY_HASH);
  if (user && passwordOk) return publicUser(user);
  await slowDown();
  return null;
}

export function startSession(cookies, { id }) {
  const { session_secret } = findUserById(id);
  const payload = `${id}:${Date.now() + sessionCookieOptions.maxAge * 1000}`;
  const token = `${Buffer.from(payload).toString('base64url')}.${sign(payload, session_secret)}`;
  cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
}

export const endSession = (cookies) => cookies.delete(SESSION_COOKIE, sessionCookieOptions);

export function getSessionUser(cookies) {
  const [encoded, signature] = (cookies.get(SESSION_COOKIE)?.value ?? '').split('.');
  if (!encoded || !signature) return null;
  const payload = Buffer.from(encoded, 'base64url').toString();
  const [id, expiresAt] = payload.split(':');
  const user = findUserById(Number(id));
  if (!user || !safeEqual(signature, sign(payload, user.session_secret))) return null;
  if (!(Number(expiresAt) > Date.now())) return null;
  return publicUser(user);
}

export async function updateCredentials(cookies, userId, { username, currentPassword, newPassword, confirmPassword }) {
  const user = findUserById(userId);
  const nextUsername = String(username ?? '').trim();
  const nextPassword = String(newPassword ?? '');

  if (!nextUsername) return { error: 'El usuario no puede quedar vacío.' };
  if (nextPassword && nextPassword.length < PASSWORD_MIN_LENGTH) {
    return { error: `La nueva contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.` };
  }
  if (nextPassword !== String(confirmPassword ?? '')) return { error: 'Las contraseñas nuevas no coinciden.' };
  if (nextUsername === user.username && !nextPassword) return { error: 'No hay cambios para guardar.' };
  if (!verifyPassword(currentPassword, user.password_hash)) {
    await slowDown();
    return { error: 'La contraseña actual no es correcta.' };
  }

  if (nextPassword) {
    // Rotar el secreto invalida todas las sesiones; la actual se renueva enseguida.
    db.prepare('UPDATE users SET username = ?, password_hash = ?, session_secret = ? WHERE id = ?')
      .run(nextUsername, hashPassword(nextPassword), newSessionSecret(), user.id);
    startSession(cookies, user);
  } else {
    db.prepare('UPDATE users SET username = ? WHERE id = ?').run(nextUsername, user.id);
  }

  return {
    user: publicUser(findUserById(user.id)),
    success: nextPassword
      ? 'Listo. Se cerraron las demás sesiones abiertas.'
      : 'Usuario actualizado.',
  };
}
