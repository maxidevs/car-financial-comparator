import { endSession } from '../lib/auth.js';

export const POST = ({ cookies, redirect }) => {
  endSession(cookies);
  return redirect('/login');
};
