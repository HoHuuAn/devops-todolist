'use strict';

const express = require('express');
const cors    = require('cors');
const Database = require('better-sqlite3');
const path    = require('path');
const os      = require('os');

// ── App ────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// ── Database ───────────────────────────────────────────────
const DB_PATH = process.env.DB_PATH || '/data/app.db';
const db      = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

// Create todos table if it doesn't exist
db.exec(`
    CREATE TABLE IF NOT EXISTS todos (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        text    TEXT    NOT NULL,
        done    INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
`);

// Seed one welcome todo if table is empty
const count = db.prepare('SELECT COUNT(*) as c FROM todos').get();
if (count.c === 0) {
    const insert = db.prepare('INSERT INTO todos (text, done) VALUES (?, ?)');
    insert.run('Welcome to the Week 2 Docker App!', 0);
    insert.run('Try adding and completing todos', 0);
    insert.run('Data is persisted in SQLite inside the container', 1);
}

console.log(`[DB] Connected — ${DB_PATH}`);

// ── Middleware ─────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Serve FE static files in production (when not proxied)
app.use(express.static(path.join(__dirname, '../FE')));

// ── Health check ──────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({
        status:    'ok',
        version:   '1.0.0',
        hostname:  os.hostname(),
        uptime:    process.uptime(),
        db:        DB_PATH,
        timestamp: new Date().toISOString(),
    });
});

// ── Todo routes ────────────────────────────────────────────

// GET /api/todos — list all todos
app.get('/api/todos', (_req, res) => {
    try {
        const todos = db
            .prepare('SELECT id, text, done, created_at FROM todos ORDER BY id ASC')
            .all();
        // SQLite stores booleans as 0/1; normalise to JS booleans
        res.json(todos.map(t => ({ ...t, done: Boolean(t.done) })));
    } catch (err) {
        console.error('[GET /api/todos]', err.message);
        res.status(500).json({ error: 'Failed to fetch todos' });
    }
});

// POST /api/todos — create a todo
app.post('/api/todos', (req, res) => {
    const { text } = req.body;
    if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ error: 'Field "text" is required and must be non-empty.' });
    }
    try {
        const result = db
            .prepare('INSERT INTO todos (text) VALUES (?)')
            .run(text.trim());
        const todo = db
            .prepare('SELECT id, text, done, created_at FROM todos WHERE id = ?')
            .get(result.lastInsertRowid);
        res.status(201).json({ ...todo, done: Boolean(todo.done) });
    } catch (err) {
        console.error('[POST /api/todos]', err.message);
        res.status(500).json({ error: 'Failed to create todo' });
    }
});

// PATCH /api/todos/:id/toggle — toggle done state
app.patch('/api/todos/:id/toggle', (req, res) => {
    const { id } = req.params;
    try {
        const updated = db
            .prepare('UPDATE todos SET done = NOT done WHERE id = ? RETURNING *')
            .get(id);
        if (!updated) return res.status(404).json({ error: 'Todo not found' });
        res.json({ ...updated, done: Boolean(updated.done) });
    } catch (err) {
        console.error('[PATCH /api/todos/:id/toggle]', err.message);
        res.status(500).json({ error: 'Failed to toggle todo' });
    }
});

// DELETE /api/todos/:id — delete a todo
app.delete('/api/todos/:id', (req, res) => {
    const { id } = req.params;
    try {
        const info = db.prepare('DELETE FROM todos WHERE id = ?').run(id);
        if (info.changes === 0) return res.status(404).json({ error: 'Todo not found' });
        res.json({ success: true });
    } catch (err) {
        console.error('[DELETE /api/todos/:id]', err.message);
        res.status(500).json({ error: 'Failed to delete todo' });
    }
});

// ── 404 fallback ───────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// ── Error handler ──────────────────────────────────────────
app.use((err, _req, res, _next) => {
    console.error('[Unhandled error]', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ── Start ──────────────────────────────────────────────────
app.listen(PORT, HOST, () => {
    console.log(`[Server] Listening on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
});
