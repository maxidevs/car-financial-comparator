import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { AUTH_USER, AUTH_PASSWORD } from 'astro:env/server';

export const SESSION_COOKIE = 'volt_session';
const SESSION_DAYS = 30;

// Mismos atributos para poner y para borrar la cookie: si no coinciden, el
// navegador ignora el borrado. Astro descarta maxAge al borrar.
export const sessionCookieOptions = {
  path: '/',
  httpOnly: true,
  sameSite: 'lax',
  secure: import.meta.env.PROD,
  maxAge: SESSION_DAYS * 24 * 60 * 60,
};

// Sin credenciales configuradas no entra nadie (falla cerrado).
export const isAuthConfigured = () => Boolean(AUTH_USER && AUTH_PASSWORD);

const digest = (value) => createHash('sha256').update(String(value ?? '')).digest();
const safeEqual = (a, b) => timingSafeEqual(digest(a), digest(b));

// La firma depende de la contraseña: cambiarla cierra todas las sesiones.
const sign = (payload) => createHmac('sha256', AUTH_PASSWORD).update(payload).digest('base64url');

export function checkCredentials(user, password) {
  if (!isAuthConfigured()) return false;
  const userOk = safeEqual(user, AUTH_USER);
  const passwordOk = safeEqual(password, AUTH_PASSWORD);
  return userOk && passwordOk;
}

export function createSession() {
  const payload = `${AUTH_USER}:${Date.now() + sessionCookieOptions.maxAge * 1000}`;
  return `${Buffer.from(payload).toString('base64url')}.${sign(payload)}`;
}

export function isValidSession(token) {
  if (!isAuthConfigured() || !token) return false;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return false;
  const payload = Buffer.from(encoded, 'base64url').toString();
  if (!safeEqual(signature, sign(payload))) return false;
  const expiresAt = Number(payload.slice(payload.lastIndexOf(':') + 1));
  return expiresAt > Date.now();
}

export const hasSession = (cookies) => isValidSession(cookies.get(SESSION_COOKIE)?.value);
