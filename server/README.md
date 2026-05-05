# Obsync Server

This folder contains the backend API/WebSocket service and the frontend dashboard.

## Infrastructure
Use Docker Compose to start Postgres and Redis:

```
cd server

cp .env.example .env

docker-compose up -d
```

## Backend (server/backend)
1) Configure environment:

```
cd ..
cp .env.example .env
```

Set values in .env (JWT_PUBLIC_KEY, JWT_PRIVATE_KEY, JWT_ISSUER, JWT_AUDIENCE). For local
(non-Docker) runs, add DATABASE_URL and REDIS_URL to the same file.

On first run (when no users exist), the backend prints a bootstrap admin username
and password to the logs. Optional overrides: BOOTSTRAP_ADMIN_USERNAME and
BOOTSTRAP_ADMIN_PASSWORD.

2) Install and run:

```
npm install
npm run dev
```

3) Tests:

```
npm test
```

## Frontend (server/frontend)
1) Install and run:

```
cd ../frontend
npm install
npm run dev
```

2) Tests:

```
npm test
```

3) E2E tests:

```
npx playwright install
npm run test:e2e
```

## Notes
- The backend requires an RS256 public key in JWT_PUBLIC_KEY.
- The backend requires JWT_PRIVATE_KEY to sign login cookies.
- The frontend stores obsync.baseUrl and obsync.vaultId in localStorage.
- Docker Compose exposes the frontend on http://localhost:5173 and backend on http://localhost:3000.
- Docker Compose exposes the frontend on http://localhost:5173 and backend on http://localhost:3000.
