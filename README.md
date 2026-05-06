# DevOps Todolist: Full-Stack App (FE + BE + DB)

## Overview

This project demonstrates a **multi-container Docker application** with a React/Vite task board, an Express API backed by SQLite, and an Nginx reverse proxy.

```
┌─────────────────────────────────────────────────────────┐
│                    nginx reverse proxy                  │
│                  (port 80 — single entry)               │
│     /api/*  ───────────────────────►  BE (Node.js :3000)│
│     /*     ───────────────────────►  FE (React/Vite :80)│
└──────────────────┬──────────────────────────────────────┘
                   │
         ┌─────────┼─────────────┐
         │         │             │
      ┌──┴──┐   ┌──┴──┐     ┌────┴────┐
      │  FE │   │  BE │     │  Redis  │
      │:8080│   │:3000│     │  :6379  │
      └──┬──┘   └──┬──┘     └─────────┘
         │         │
    ┌────┴───┐     │
    │Nginx   │     │
    │static  │     │
    └────────┘     │
                   │ (SQLite on named volume)
             ┌─────┴──────┐
             │  db-data   │
             └────────────┘
```

## Services

| Service | Image | Port (host) | Description |
|---------|-------|-------------|-------------|
| `nginx-proxy` | `nginx:alpine` | `80` | Reverse proxy — routes `/api/*` to BE, all else to FE |
| `fe` | custom (`./FE/Dockerfile`) | `8080` | React/Vite build served by Nginx |
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

### 1. Navigate to the devops-todolist folder
```bash
cd devops-todolist/
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
be             be               Up (healthy)   0.0.0.0:3000->3000/tcp
fe             fe               Up             0.0.0.0:8080->80/tcp
nginx_proxy    nginx-proxy      Up             0.0.0.0:80->80/tcp
redis          redis            Up             0.0.0.0:6379->6379/tcp
```

### 4. Access the app

| URL | Description |
|-----|-------------|
| http://localhost/ | App via Nginx reverse proxy |
| http://localhost:8080/ | Frontend (Nginx static) direct |
| http://localhost:3000/health | Backend health check |
| http://localhost:3000/api/tasks | Task REST API |
| http://localhost:3000/api/todos | Legacy todo API (compat) |

### 5. View logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f be
docker compose logs -f fe
```

## Production Deployment (Port 80)

Production uses the Nginx reverse proxy on port 80 with images pulled from Docker Hub via [docker-compose.prod.yml](docker-compose.prod.yml). The CI/CD workflow lives at [.github/workflows/ci-cd.yml](.github/workflows/ci-cd.yml) and uses `vars.HOST`, `secrets.SSH_KEY`, `secrets.DOCKER_USERNAME`, and `secrets.DOCKER_TOKEN`.

Manual deploy on a Linux host:
```bash
export DOCKER_USERNAME=<your-dockerhub-username>
scp docker-compose.prod.yml nginx.conf azureuser@<host>:/home/azureuser/
ssh azureuser@<host> "DOCKER_USERNAME=$DOCKER_USERNAME docker compose -f /home/azureuser/docker-compose.prod.yml up -d"
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
docker exec -it be sh
docker exec -it fe sh

# Check resource usage
docker stats

# Restart a single service
docker compose restart be
```

## Project Structure

```
devops-todolist/
├── FE/
│   ├── index.html          # Vite entry
│   ├── src/                # React task board UI
│   └── Dockerfile          # Vite build -> nginx
│
├── BE/
│   ├── server.js           # Express task API
│   ├── package.json         # Node.js dependencies
│   └── Dockerfile           # Multi-stage: node:20-alpine
│
├── nginx.conf               # Reverse proxy configuration
├── docker-compose.yml       # Local development compose
├── docker-compose.prod.yml  # Production compose (pulls Docker Hub images)
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

### List Tasks
```
GET /api/tasks
Response 200: [{ "id": 1, "text": "...", "status": "todo", "created_at": "..." }]
```

### Create Task
```
POST /api/tasks
Body:    { "text": "My new task", "status": "todo" }
Response 201: { "id": 2, "text": "My new task", "status": "todo" }
```

### Update Task Status
```
PATCH /api/tasks/:id/status
Body:    { "status": "done" }
Response 200: { "id": 1, "text": "...", "status": "done" }
```

### Delete Task
```
DELETE /api/tasks/:id
Response 204
```

### Legacy Todos (compat)
```
GET /api/todos
POST /api/todos
PATCH /api/todos/:id/toggle
DELETE /api/todos/:id
```

## Key Docker Concepts Practiced

| Concept | Where it is used |
|---------|-----------------|
| **Multi-stage Dockerfile** | `FE/Dockerfile` (Vite build → nginx) |
| **Named volumes** | `db-data` for SQLite persistence |
| **Bridge networking** | `net` isolates containers |
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
docker volume ls 

# Inspect volume
docker volume inspect db_data
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
## Bicep deployment
```bash
az deployment group create --name vm-linux --resource-group rg-intern-an --template-file ./infra/vm-linux.bicep --parameters ./infra/vm-linux.bicepparam --no-wait
```