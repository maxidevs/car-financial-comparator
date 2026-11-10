import { defineMiddleware } from 'astro:middleware';
import { hasSession } from './lib/auth.js';

const PUBLIC_PATHS = new Set(['/login']);
const DATA_PREFIXES = ['/api/', '/media/'];

export const onRequest = defineMiddleware((context, next) => {
  const { pathname } = context.url;
  if (PUBLIC_PATHS.has(pathname) || hasSession(context.cookies)) return next();
  if (DATA_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return new Response('No autorizado', { status: 401 });
  }
  // Ruta relativa: detrás del proxy la app no conoce su URL pública.
  return context.redirect('/login');
});
