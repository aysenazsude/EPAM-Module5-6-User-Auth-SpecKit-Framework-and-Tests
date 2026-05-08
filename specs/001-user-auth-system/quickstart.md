# Quickstart: User Authentication System

**Feature**: `001-user-auth-system`  
**Stack**: Express.js · TypeScript · PostgreSQL · Prisma · Jest

---

## Prerequisites

| Tool | Minimum Version | Check |
|------|----------------|-------|
| Node.js | 20 LTS | `node --version` |
| npm | 10 | `npm --version` |
| PostgreSQL | 14 | `psql --version` |
| Git | any | `git --version` |

---

## 1. Clone & Install

```bash
git clone <repository-url>
cd speckit-lab

npm install
```

---

## 2. Database Setup

Create a PostgreSQL database and user for local development:

```sql
-- run in psql
CREATE DATABASE authdb_dev;
CREATE USER authdb_user WITH PASSWORD 'dev_password';
GRANT ALL PRIVILEGES ON DATABASE authdb_dev TO authdb_user;
```

---

## 3. Environment Configuration

Copy the example environment file and fill in values:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Server
PORT=3000

# Database (Prisma connection string)
DATABASE_URL="postgresql://authdb_user:dev_password@localhost:5432/authdb_dev"

# JWT — NEVER commit a real secret; rotate by redeployment
JWT_SECRET="change-me-to-a-long-random-string-at-least-32-chars"

# Email (SMTP — use Ethereal https://ethereal.email for local testing)
SMTP_HOST="smtp.ethereal.email"
SMTP_PORT=587
SMTP_USER="your-ethereal-user@ethereal.email"
SMTP_PASS="your-ethereal-password"
SMTP_FROM="noreply@example.com"
```

> **Security**: `JWT_SECRET` must be at least 32 characters of random data.  
> Generate one with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

---

## 4. Run Database Migrations

```bash
npx prisma migrate dev --name init
```

This creates all tables (`users`, `password_reset_tokens`, `revoked_tokens`, `login_attempts`)
and generates the Prisma Client TypeScript types.

---

## 5. Build & Start

**Development** (ts-node-dev with hot reload):

```bash
npm run dev
```

**Production build**:

```bash
npm run build       # tsc → dist/
npm start           # node dist/server.js
```

The API is available at `http://localhost:3000`.

---

## 6. Verify the API

```bash
# Register a new user
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"P@ssw0rd1"}'
# → 201 {"message":"Account created successfully"}

# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"P@ssw0rd1"}'
# → 200 {"token":"eyJ...","expiresAt":"..."}

# Access protected endpoint (replace TOKEN)
curl http://localhost:3000/users/me \
  -H "Authorization: Bearer TOKEN"
# → 200 {"id":"...","email":"alice@example.com","createdAt":"..."}
```

---

## 7. Run Tests

```bash
# All tests (unit + integration) with coverage report
npm test

# Unit tests only
npm run test:unit

# Integration tests only (requires running PostgreSQL with TEST_DATABASE_URL set)
npm run test:integration

# Watch mode during development
npm run test:watch
```

**Coverage gate**: The build fails if business-logic coverage drops below **80%**.
Coverage reports are written to `coverage/`.

> **Integration tests** use a separate test database. Set `TEST_DATABASE_URL` in `.env.test`
> or in the environment. Migrations are applied automatically before the test suite runs.

---

## 8. Linting & Type Checking

```bash
# Type-check (strict: true)
npm run typecheck

# Lint (ESLint)
npm run lint

# Fix auto-fixable lint issues
npm run lint:fix
```

---

## 9. Prisma Studio (optional)

Browse the database with a local GUI:

```bash
npx prisma studio
```

---

## 10. Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | HTTP server port |
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string (Prisma format) |
| `JWT_SECRET` | **Yes** | — | HMAC-SHA256 signing key (≥ 32 chars) |
| `SMTP_HOST` | **Yes** | — | SMTP server hostname |
| `SMTP_PORT` | **Yes** | — | SMTP server port (587 for STARTTLS) |
| `SMTP_USER` | **Yes** | — | SMTP authentication username |
| `SMTP_PASS` | **Yes** | — | SMTP authentication password |
| `SMTP_FROM` | **Yes** | — | From address for outgoing emails |
| `TEST_DATABASE_URL` | For integration tests | — | Separate DB for test isolation |

---

## 11. Project Scripts Reference

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `ts-node-dev src/server.ts` | Development server with hot reload |
| `build` | `tsc` | Compile TypeScript → `dist/` |
| `start` | `node dist/server.ts` | Start production build |
| `test` | `jest --coverage` | All tests with coverage |
| `test:unit` | `jest --testPathPattern=tests/unit` | Unit tests only |
| `test:integration` | `jest --testPathPattern=tests/integration` | Integration tests only |
| `test:watch` | `jest --watch` | Watch mode |
| `typecheck` | `tsc --noEmit` | Type check without building |
| `lint` | `eslint src tests` | ESLint check |
| `lint:fix` | `eslint src tests --fix` | ESLint auto-fix |
