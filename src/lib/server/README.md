# Authentication API

All authentication routes run on the server. Configure the variables in the repository `.env.example` before using them.

- `POST /api/auth/register` accepts `{ "email", "password", "name?" }`, creates a standard user, and returns a database session cookie.
- `POST /api/auth/login` accepts `{ "email", "password" }` and returns a database session cookie.
- `POST /api/auth/logout` deletes the current session and expires its cookie.
- `GET /api/auth/me` returns the current user or HTTP 401.
- `/api/auth/[...nextauth]` exposes the Auth.js v5 handlers.

Passwords must be 12-128 Unicode characters and are hashed with Argon2id. Session cookies are HttpOnly, SameSite=Lax, and Secure by default. Set `AUTH_COOKIE_SECURE=false` only for local development over plain HTTP. Public registration always assigns `user`; create the initial administrator with `ADMIN_EMAIL` and `ADMIN_PASSWORD` via `npm run seed:admin`.
