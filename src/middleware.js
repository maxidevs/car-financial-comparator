import { defineMiddleware } from 'astro:middleware';
import { getSessionUser } from './lib/auth.js';

const PUBLIC_PATHS = new Set(['/login']);
const DATA_PREFIXES = ['/api/', '/media/'];

export const onRequest = defineMiddleware((context, next) => {
  const { pathname } = context.url;
  const user = getSessionUser(context.cookies);
  if (user) context.locals.user = user;
  if (user || PUBLIC_PATHS.has(pathname)) return next();
  if (DATA_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return new Response('No autorizado', { status: 401 });
  }
  // Ruta relativa: detrás del proxy la app no conoce su URL pública.
  return context.redirect('/login');
});
