# Week 2 — Docker Hands-On: Full-Stack App (FE + BE + DB)

## Overview

This project demonstrates a **multi-container Docker application** built during Week 2 of the SCC Internship Training Program.

```
┌─────────────────────────────────────────────────────────┐
│                    nginx reverse proxy                   │
│                  (port 80 — single entry)                │
│     /api/*  ───────────────────────►  BE (Node.js :3000) │
│     /*     ───────────────────────►  FE (Nginx :80)      │
└──────────────────┬──────────────────────────────────────┘
                   │
         ┌─────────┼─────────────┐
         │         │             │
       ┌──┴──┐  ┌──┴──┐    ┌────┴────┐
       │  FE │  │  BE │    │  Redis  │
       │:8080│  │:3000│    │  :6379  │
       └──┬──┘  └──┬──┘    └─────────┘
          │       │
     ┌────┴───┐   │
     │Nginx   │   │
     │static  │   │
     └────────┘   │
                 │ (SQLite on named volume)
           ┌─────┴──────┐
           │  db-data   │
           └────────────┘
```

## Services

| Service | Image | Port (host) | Description |
|---------|-------|-------------|-------------|
| `nginx-proxy` | `nginx:alpine` | `80` | Reverse proxy — routes `/api/*` to BE, all else to FE |
| `fe` | custom (`./FE/Dockerfile`) | `8080` | Nginx serving static HTML (Todo UI) |
| `be` | custom (`./BE/Dockerfile`) | `3000` | Node.js + Express REST API |
| `redis` | `redis:7-alpine` | `6379` | In-memory cache (optional) |

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/macOS) **or** Docker Engine on Linux
- Docker Compose v2 (bundled with Docker Desktop)

Verify installation:
```bash
docker --version        # Docker version 20.x+
docker compose version  # Docker Compose version v2.x+
```

## Quick Start

### 1. Navigate to the week2 folder
```bash
cd week2/
```

### 2. Build & start all services
```bash
docker compose up --build -d
```

### 3. Verify containers are running
```bash
docker compose ps
```

Expected output:
```
NAME           IMAGE            STATUS          PORTS
week2_be       week2-be         Up (healthy)    0.0.0.0:3000->3000/tcp
week2_fe       week2-fe         Up             0.0.0.0:8080->80/tcp
week2_nginx_proxy nginx-proxy   Up             0.0.0.0:80->80/tcp
week2_redis    week2-redis      Up             0.0.0.0:6379->6379/tcp
```

### 4. Access the app

| URL | Description |
|-----|-------------|
| http://localhost/ | App via Nginx reverse proxy |
| http://localhost:8080/ | Frontend (Nginx static) direct |
| http://localhost:3000/health | Backend health check |
| http://localhost:3000/api/todos | REST API |

### 5. View logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f be
docker compose logs -f fe
```

## Common Docker Commands

```bash
# Stop all services
docker compose down

# Stop and remove named volumes (wipes DB!)
docker compose down -v

# Rebuild after code changes
docker compose up --build -d

# Inspect a running container
docker exec -it week2_be sh
docker exec -it week2_fe sh

# Check resource usage
docker stats

# Restart a single service
docker compose restart be
```

## Project Structure

```
week2/
├── FE/
│   ├── index.html          # Todo UI (static HTML/JS/CSS)
│   └── Dockerfile          # Multi-stage: nginx:alpine
│
├── BE/
│   ├── server.js           # Express REST API
│   ├── package.json         # Node.js dependencies
│   └── Dockerfile           # Multi-stage: node:20-alpine
│
├── nginx.conf               # Reverse proxy configuration
├── docker-compose.yml       # Orchestrates all services
├── .env.example             # Environment variable template
└── README.md                # This file
```

## API Reference

### Health Check
```
GET /health
Response 200:
{
  "status":    "ok",
  "version":   "1.0.0",
  "hostname":  "<container-id>",
  "uptime":    123.45,
  "db":        "/data/app.db",
  "timestamp": "2026-04-03T..."
}
```

### List Todos
```
GET /api/todos
Response 200: [{ "id": 1, "text": "...", "done": false, "created_at": "..." }]
```

### Create Todo
```
POST /api/todos
Body:    { "text": "My new todo" }
Response 201: { "id": 2, "text": "My new todo", "done": false }
```

### Toggle Todo
```
PATCH /api/todos/:id/toggle
Response 200: { "id": 1, "text": "...", "done": true }
```

### Delete Todo
```
DELETE /api/todos/:id
Response 200: { "success": true }
```

## Key Docker Concepts Practiced (Week 2)

| Concept | Where it is used |
|---------|-----------------|
| **Multi-stage Dockerfile** | `FE/Dockerfile` (build → production) |
| **Named volumes** | `db-data` for SQLite persistence |
| **Bridge networking** | `week2net` isolates containers |
| **Health checks** | `be` service uses `/health` endpoint |
| **Non-root user** | `BE/Dockerfile` switches to `appuser` |
| **Reverse proxy** | `nginx-proxy` routes traffic |
| **Environment variables** | `BE` uses `DB_PATH`, `PORT` env vars |
| **Named volumes + restart policy** | Data survives container restarts |

## Troubleshooting

**Frontend shows "OFFLINE" on backend badge**
```bash
docker compose logs be          # Check BE is healthy
curl http://localhost:3000/health
```

**Database not persisting after restart**
```bash
# Verify volume exists
docker volume ls | grep week2

# Inspect volume
docker volume inspect week2_db_data
```

**Port already in use**
```bash
# Change port mapping in docker-compose.yml, e.g.:
#   ports: "8081:80"
```

**Permission denied on DB volume**
```bash
docker compose down
docker compose down -v  # wipe volume
docker compose up --build -d
```
