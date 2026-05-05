This technical specification outlines a custom, self-hosted synchronization system for Obsidian. It balances simple file persistence with a pessimistic concurrency model for multi-device editing.

---

## 1. Project Overview
The system provides a private alternative to Obsidian Sync, allowing for real-time collaboration or multi-device consistency using a **Hybrid Sync Protocol**. 

* **Mode A (Solo):** Periodic file-level snapshots via REST.
* **Mode B (Collaborative):** Real-time, line-level locking via WebSockets when multiple clients are active.

---

## 2. System Architecture

The architecture utilizes a monolithic backend to manage state, with Redis handling ephemeral coordination and PostgreSQL ensuring long-term data integrity.



### Component Stack
* **Obsidian Plugin:** TypeScript, CodeMirror 6 API.
* **Server Backend:** Node.js (Express), Socket.io for WebSockets.
* **Server Frontend:** React for vault observability and status monitoring.
* **Data Layer:** * **PostgreSQL:** Persistent storage for notes, version history, and user metadata.
    * **Redis:** Real-time presence tracking and distributed line-level locks.

---

## 3. Data Models

### PostgreSQL: `vault_entries`
Used for durable storage. Instead of storing a single file, we store versions to allow for recovery.
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key. |
| `path` | TEXT | Relative path within the vault (e.g., `work/notes.md`). |
| `content` | TEXT/BYTEA | The actual note data. |
| `hash` | VARCHAR(64) | SHA-256 hash for change detection. |
| `updated_at` | TIMESTAMP | Last write time. |

### Redis: `sync_locks`
Used for the pessimistic locking mechanism.
* **Key:** `lock:{file_path}:{line_number}`
* **Value:** `client_id`
* **TTL:** 10 Seconds (Auto-releases if a client disconnects).

---

## 4. The Hybrid Sync Protocol

The system transitions between modes based on a global **Presence Registry** maintained in Redis.



1.  **Presence Check:** Every client sends a heartbeat every 5s. 
2.  **Mode Switching:**
    * If `active_clients(file_path) == 1`: Enable **Mode A**. The plugin debounces saves and pushes the full file every 30s or on manual save.
    * If `active_clients(file_path) > 1`: Enable **Mode B**. The plugin requests a Redis lock whenever the cursor enters a line. If granted, changes are streamed character-by-character over WebSockets.

---

## 5. Folder Structure

The repository is organized to separate the Obsidian environment from the server-side infrastructure while keeping the server's concerns localized. This is simply a recommendation and can be altered.

```text
/root
├── /common              # THE SHARED LAYER (Types, DTOs, Enums)
│   ├── types.ts         # SyncMessage, LockStatus
│   └── rbac-schema.ts   # Role definitions
├── /plugin
│   ├── manifest.json       # Obsidian plugin metadata
│   ├── main.ts            # Entry point for Vault & Editor logic
│   ├── src/
│   │   ├── sync-engine.ts  # Logic for Mode A/B switching
│   │   ├── editor-hook.ts  # CodeMirror 6 extensions for locking
│   │   └── api-client.ts   # Axios/WS wrappers (Imports common)
│   ├── tests/              # Unit, integration and E2E tests
│   └── esbuild.config.mjs  # Bundler config
└── /server
    ├── /backend
    │   ├── src/
    │   │   ├── index.ts     # Server entry point
    │   │   ├── websocket.ts # Socket.io handlers
    │   │   └── routes/      # REST API for file uploads
    │   ├── tests/          # Unit and integration tests
    │   ├── prisma/          # Database schema (Postgres)
    │   └── redis-client.ts  # Locking logic
    ├── /frontend
    │   ├── src/             # Vault dashboard (Observability UI)
    │   ├── tests/           # Unit and integration tests
    │   └── vite.config.ts
    ├── /tests               # E2E tests
    └── docker-compose.yml   # Postgres, Redis, and Backend orchestration
```

---

## 6. Implementation Strategy

### Phase 1: The "Dumb" Sync
* Implement basic REST endpoints in `/backend` to `POST` and `GET` files.
* Configure the `/plugin` to calculate SHA-256 hashes of local files and compare them with the server.

### Phase 2: Presence & WebSockets
* Integrate Socket.io.
* Implement the heartbeat mechanism.
* Update the `/server/frontend` to visualize which files are currently being "watched" by active clients.

### Phase 3: Pessimistic Locking
* Extend the `/plugin` to detect the line number of the cursor using `editor.getCursor()`.
* Implement the `LOCK_REQUEST` flow in `/backend` using Redis.
* Add a UI overlay in the plugin (e.g., a gutter icon) to show if a line is locked by another user.

### Phase 4: Observability & Configuration
* Build out the `/server/frontend` to show sync logs, conflict history, and storage usage metrics.
* This `/server/frontend` should also serve as the main method for configuring the server, setting up authentication, API keys etc

---

## 7. Security Considerations
* **JWT Authentication:** All REST and WebSocket connections must carry a token.
* **TLS/SSL:** The entire `/server` directory should be deployed behind a reverse proxy to ensure data in transit is encrypted.
* **E2EE (Optional):** If implemented, the `/plugin` will encrypt `content` using a user-provided key before sending it to the `/backend`.