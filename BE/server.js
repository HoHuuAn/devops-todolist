'use strict';

const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DB_PATH = process.env.DB_PATH || '/data/app.db';
const VALID_STATUSES = ['todo', 'in-progress', 'done'];
const STATUS_ORDER = "CASE status WHEN 'todo' THEN 0 WHEN 'in-progress' THEN 1 WHEN 'done' THEN 2 ELSE 3 END";

const dbDirectory = path.dirname(DB_PATH);
if (dbDirectory && !fs.existsSync(dbDirectory)) {
    fs.mkdirSync(dbDirectory, { recursive: true });
}

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'todo',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
`);

function hasColumn(tableName, columnName) {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
    return columns.some((column) => column.name === columnName);
}

if (!hasColumn('tasks', 'description')) {
    db.exec("ALTER TABLE tasks ADD COLUMN description TEXT NOT NULL DEFAULT ''");
}

function hasTable(tableName) {
    return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName));
}

function normalizeTask(row) {
    return {
        id: row.id,
        text: row.text,
        description: row.description ?? '',
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

function normalizeTodo(row) {
    return {
        id: row.id,
        text: row.text,
        description: row.description ?? '',
        done: row.status === 'done',
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

function validateStatus(status) {
    return typeof status === 'string' && VALID_STATUSES.includes(status);
}

function getTaskById(id) {
    return db.prepare('SELECT id, text, description, status, created_at, updated_at FROM tasks WHERE id = ?').get(id);
}

function listTasks() {
    return db.prepare(`
        SELECT id, text, description, status, created_at, updated_at
        FROM tasks
        ORDER BY ${STATUS_ORDER}, id ASC
    `).all();
}

function createTask(text, status = 'todo', description = '') {
    const result = db.prepare('INSERT INTO tasks (text, description, status) VALUES (?, ?, ?)').run(text, description, status);
    return getTaskById(result.lastInsertRowid);
}

function updateTaskStatus(id, status) {
    return db.prepare(`
        UPDATE tasks
        SET status = ?, updated_at = datetime('now')
        WHERE id = ?
        RETURNING id, text, description, status, created_at, updated_at
    `).get(status, id);
}

function deleteTask(id) {
    return db.prepare('DELETE FROM tasks WHERE id = ?').run(id).changes;
}

const tasksCount = db.prepare('SELECT COUNT(*) AS count FROM tasks').get();
if (tasksCount.count === 0 && hasTable('todos')) {
    const migratedTodos = db.prepare('SELECT id, text, done, created_at FROM todos ORDER BY id ASC').all();
    const migrate = db.transaction((records) => {
        const insertTaskRow = db.prepare('INSERT INTO tasks (text, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)');
        records.forEach((todo) => {
            insertTaskRow.run(
                todo.text,
                '',
                todo.done ? 'done' : 'todo',
                todo.created_at || new Date().toISOString(),
                todo.created_at || new Date().toISOString(),
            );
        });
    });
    migrate(migratedTodos);
}

const currentCount = db.prepare('SELECT COUNT(*) AS count FROM tasks').get();
if (currentCount.count === 0) {
    createTask('Write the first task', 'todo');
    createTask('Move one task across the board', 'in-progress');
    createTask('Finish one task and place it here', 'done');
}

console.log(`[DB] Connected — ${DB_PATH}`);

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        version: '2.0.0',
        hostname: os.hostname(),
        uptime: process.uptime(),
        db: DB_PATH,
        timestamp: new Date().toISOString(),
    });
});

app.get('/api/tasks', (_req, res) => {
    try {
        res.json(listTasks().map(normalizeTask));
    } catch (err) {
        console.error('[GET /api/tasks]', err.message);
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
});

app.post('/api/tasks', (req, res) => {
    const { text, status = 'todo', description = '' } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ error: 'Field "text" is required and must be non-empty.' });
    }

    if (!validateStatus(status)) {
        return res.status(400).json({ error: 'Field "status" must be todo, in-progress, or done.' });
    }

    try {
        const safeDescription = typeof description === 'string' ? description.trim() : '';
        const task = createTask(text.trim(), status, safeDescription);
        res.status(201).json(normalizeTask(task));
    } catch (err) {
        console.error('[POST /api/tasks]', err.message);
        res.status(500).json({ error: 'Failed to create task' });
    }
});

app.patch('/api/tasks/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!validateStatus(status)) {
        return res.status(400).json({ error: 'Field "status" must be todo, in-progress, or done.' });
    }

    try {
        const updatedTask = updateTaskStatus(id, status);
        if (!updatedTask) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.json(normalizeTask(updatedTask));
    } catch (err) {
        console.error('[PATCH /api/tasks/:id/status]', err.message);
        res.status(500).json({ error: 'Failed to update task' });
    }
});

app.delete('/api/tasks/:id', (req, res) => {
    const { id } = req.params;

    try {
        const changes = deleteTask(id);
        if (changes === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.status(204).end();
    } catch (err) {
        console.error('[DELETE /api/tasks/:id]', err.message);
        res.status(500).json({ error: 'Failed to delete task' });
    }
});

app.get('/api/todos', (_req, res) => {
    try {
        res.json(listTasks().map(normalizeTodo));
    } catch (err) {
        console.error('[GET /api/todos]', err.message);
        res.status(500).json({ error: 'Failed to fetch todos' });
    }
});

app.post('/api/todos', (req, res) => {
    const { text, done = false } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ error: 'Field "text" is required and must be non-empty.' });
    }

    try {
        const task = createTask(text.trim(), done ? 'done' : 'todo');
        res.status(201).json(normalizeTodo(task));
    } catch (err) {
        console.error('[POST /api/todos]', err.message);
        res.status(500).json({ error: 'Failed to create todo' });
    }
});

app.patch('/api/todos/:id/toggle', (req, res) => {
    const { id } = req.params;

    try {
        const currentTask = getTaskById(id);
        if (!currentTask) {
            return res.status(404).json({ error: 'Todo not found' });
        }

        const nextStatus = currentTask.status === 'done' ? 'todo' : 'done';
        const updatedTask = updateTaskStatus(id, nextStatus);
        res.json(normalizeTodo(updatedTask));
    } catch (err) {
        console.error('[PATCH /api/todos/:id/toggle]', err.message);
        res.status(500).json({ error: 'Failed to toggle todo' });
    }
});

app.delete('/api/todos/:id', (req, res) => {
    const { id } = req.params;

    try {
        const changes = deleteTask(id);
        if (changes === 0) {
            return res.status(404).json({ error: 'Todo not found' });
        }
        res.status(204).end();
    } catch (err) {
        console.error('[DELETE /api/todos/:id]', err.message);
        res.status(500).json({ error: 'Failed to delete todo' });
    }
});

app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
});

app.use((err, _req, res, _next) => {
    console.error('[Unhandled error]', err);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, HOST, () => {
    console.log(`[Server] Listening on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
});
