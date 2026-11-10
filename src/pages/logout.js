import { SESSION_COOKIE, sessionCookieOptions } from '../lib/auth.js';

export const POST = ({ cookies, redirect }) => {
  cookies.delete(SESSION_COOKIE, sessionCookieOptions);
  return redirect('/login');
};
