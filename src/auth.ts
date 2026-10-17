import NextAuth from 'next-auth';
import { authAdapter } from '@/lib/server/auth-mongo';

const secureCookie = process.env.AUTH_COOKIE_SECURE !== 'false';

export const { handlers, auth } = NextAuth({
  adapter: authAdapter,
  session: { strategy: 'database', maxAge: 60 * 60 * 24 * 30 },
  // Email/password routes issue database sessions through the same adapter.
  // Auth.js Credentials itself requires JWT sessions, so it is intentionally
  // not used for this database-session flow.
  providers: [],
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  useSecureCookies: secureCookie,
  cookies: {
    sessionToken: {
      name: secureCookie ? '__Secure-authjs.session-token' : 'authjs.session-token',
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: secureCookie },
    },
  },
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.role = (user as typeof user & { role?: 'user' | 'admin' }).role ?? 'user';
      }
      return session;
    },
  },
});
