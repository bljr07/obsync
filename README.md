# Obsync

Self-hosted sync service for Obsidian with a hybrid protocol:
- Mode A: periodic file snapshots over REST.
- Mode B: collaborative locking and per-character deltas over WebSockets.

## Repo layout
- common: shared types
- plugin: Obsidian plugin
- server/backend: API + WebSocket server
- server/frontend: observability dashboard

## Prerequisites
- Node.js 20+
- PostgreSQL and Redis (or Docker Compose in server)

## Quick start
1) Start infrastructure

```
cd server
# Starts Postgres and Redis
cp .env.example .env
docker-compose up -d
```

2) Backend

```
cd server
cp .env.example .env
cd backend
npm install
npm run dev

The backend prints a bootstrap admin username and password if no users exist.
```

3) Frontend

```
cd server/frontend
npm install
npm run dev
```

4) Plugin

```
cd plugin
npm install
npm run dev
```

Copy plugin/dist/main.js and plugin/manifest.json into your vault at:
.obsidian/plugins/obsync

## Tests
- Backend: `cd server/backend` then `npm test`
- Frontend: `cd server/frontend` then `npm test`
- Frontend E2E: `cd server/frontend` then `npx playwright install` and `npm run test:e2e`
- Plugin: `cd plugin` then `npm test`
