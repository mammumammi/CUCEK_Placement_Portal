# Module Specification: Authentication & Authorization (`auth`)

> **Module Path:** `src/server/modules/auth/`  
> **Mounted At:** `/api/auth`  
> **Security Layer:** Async Scrypt + Jose JWT + HttpOnly Cookies + Express Rate Limit

---

## 1. Overview & Security Invariants

The `auth` module orchestrates session creation, password hashing, identity verification, role-based authorization, and rate-limited credential submission.

### Core Security Invariants
1. **Zero Credential Exposure:** `passwordHash` is never selected or serialized in any API response.
2. **Timing-Attack Resistance:** Password verification uses `crypto.timingSafeEqual` and returns generic error messages (*"Invalid username or password"*) regardless of whether the username was found or the password was incorrect.
3. **Asynchronous Non-Blocking Hashing:** Utilizes Node.js asynchronous `crypto.scrypt` with a cryptographically secure random 16-byte salt (`scrypt$<saltHex>$<hashHex>`).
4. **Edge/Worker JWT Sessions:** JWTs are signed and verified with `jose` using HS256 with an 8-hour expiration window.
5. **Secure Cookie Transport:** The session token is transmitted strictly via an `httpOnly` cookie (`sameSite: 'lax'`, `secure: true` in production, `maxAge: 8h`).
6. **Rate Limiting:** Failed login attempts are throttled by `express-rate-limit` per `IP + username` combination (default: 5 failures per 15 minutes, skipping successful logins).

---

## 2. API Endpoints

| Method | Endpoint | Access Control | Request Body | Response (200 / 201) | Error Codes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Public (Rate Limited) | `{ username, password }` | `{ user }` + `Set-Cookie: session=...` | `UNAUTHORIZED`, `RATE_LIMITED`, `VALIDATION_ERROR` |
| `POST` | `/api/auth/logout` | Public / Session | None | `{ message: 'Logged out successfully' }` | None |
| `GET` | `/api/auth/me` | Authenticated | None | `{ user }` | `UNAUTHORIZED` |
| `POST` | `/api/auth/change-password` | Authenticated | `{ currentPassword, newPassword }` | `{ message: 'Password changed successfully' }` | `UNAUTHORIZED`, `VALIDATION_ERROR` |
| `POST` | `/api/auth/coordinators` | `MAIN_COORDINATOR` | `{ username, password, branch }` | `{ user }` (Status 201) | `UNAUTHORIZED`, `FORBIDDEN`, `VALIDATION_ERROR` |

---

## 3. Authentication Flow Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Client as Web Browser / Client
    participant Limiter as Rate Limiter (IP+User)
    participant AuthRouter as /api/auth/login
    participant AuthService as auth.service.ts
    participant DB as SQLite (users)
    participant Token as token.ts (jose)

    Client->>Limiter: POST /api/auth/login { username, password }
    alt Too many failed attempts
        Limiter-->>Client: 429 Too Many Requests { error: { code: 'RATE_LIMITED' } }
    else Within limit
        Limiter->>AuthRouter: Forward request
        AuthRouter->>AuthService: login(db, { username, password })
        AuthService->>DB: Query user by username
        alt User not found or password invalid
            AuthService-->>AuthRouter: Throw PortalError('UNAUTHORIZED', 'Invalid username or password')
            AuthRouter-->>Client: 401 Unauthorized { error: { code: 'UNAUTHORIZED' } }
        else Password valid
            AuthService->>Token: signToken({ sub: user.id, role: user.role, branch: user.branch })
            Token-->>AuthService: JWT string
            AuthService-->>AuthRouter: { user (sanitized), token }
            AuthRouter-->>Client: 200 OK { user } + Set-Cookie: session=<jwt>; HttpOnly; SameSite=Lax
        end
    end
```

---

## 4. Middleware Contracts

### `requireAuth`
- Extracts JWT from `req.cookies.session`.
- Verifies token signature and expiration via `verifyToken`.
- Queries `users` table to ensure principal still exists in the database.
- Augments `Express.Request` with `req.user = { id, role, branch }`.

### `requireRoles(...roles)`
- Asserts that `req.user.role` matches at least one of the specified `UserRole` values (`STUDENT`, `BRANCH_COORDINATOR`, `MAIN_COORDINATOR`).
- Rejects unauthorized requests with `403 Forbidden` (`{ error: { code: 'FORBIDDEN', message: '...' } }`).

---

## 5. Seed Script (`scripts/seed-admin.ts`)

An idempotent administrative bootstrap script:
```bash
ADMIN_USERNAME=tpo_admin ADMIN_PASSWORD=SecurePassword123! npm run seed:admin
```
- Applies any pending migrations first.
- Checks if the user already exists.
- Creates the root `MAIN_COORDINATOR` with an asynchronous scrypt password hash if not present.

