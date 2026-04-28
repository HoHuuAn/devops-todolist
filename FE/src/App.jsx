import { useEffect, useMemo, useState } from 'react';
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { createTask, deleteTask, getHealth, getTasks, updateTaskStatus } from './api';

const COLUMNS = [
    { id: 'todo', title: 'To Do', hint: 'Backlog and ready work' },
    { id: 'in-progress', title: 'In Progress', hint: 'Currently being worked on' },
    { id: 'done', title: 'Done', hint: 'Completed and shipped' },
];

const STATUS_LABELS = {
    todo: 'To Do',
    'in-progress': 'In Progress',
    done: 'Done',
};

function TaskCard({ task, onDelete }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `task-${task.id}`,
        data: { task },
    });

    const style = {
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        opacity: isDragging ? 0.55 : 1,
    };

    return (
        <article ref={setNodeRef} className="task-card" style={style} {...attributes} {...listeners}>
            <div className="task-card__topline">
                <span className={`status-pill status-pill--${task.status}`}>{STATUS_LABELS[task.status]}</span>
                <button type="button" className="icon-button" onClick={() => onDelete(task.id)} aria-label={`Delete ${task.text}`}>
                    Delete
                </button>
            </div>
            <h3>{task.text}</h3>
            <p>Drag this card to another column to update its status.</p>
        </article>
    );
}

function Column({ column, tasks, onDelete }) {
    const { setNodeRef, isOver } = useDroppable({
        id: column.id,
        data: { status: column.id },
    });

    return (
        <section ref={setNodeRef} className={`board-column ${isOver ? 'board-column--over' : ''}`}>
            <header className="board-column__header">
                <div>
                    <h2>{column.title}</h2>
                    <p>{column.hint}</p>
                </div>
                <span className="board-column__count">{tasks.length}</span>
            </header>
            <div className="board-column__body">
                {tasks.length === 0 ? (
                    <div className="empty-state">Drop a task here</div>
                ) : (
                    tasks.map((task) => <TaskCard key={task.id} task={task} onDelete={onDelete} />)
                )}
            </div>
        </section>
    );
}

export default function App() {
    const [tasks, setTasks] = useState([]);
    const [taskText, setTaskText] = useState('');
    const [health, setHealth] = useState({ state: 'checking', message: 'Checking backend...' });
    const [error, setError] = useState('');
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

    const tasksByStatus = useMemo(
        () =>
            COLUMNS.reduce((accumulator, column) => {
                accumulator[column.id] = tasks.filter((task) => task.status === column.id);
                return accumulator;
            }, {}),
        [tasks],
    );

    useEffect(() => {
        loadInitialData();
    }, []);

    async function loadInitialData() {
        try {
            const [taskResponse, healthResponse] = await Promise.all([getTasks(), getHealth()]);
            setTasks(taskResponse);
            setHealth({
                state: 'ok',
                message: `Backend online on ${healthResponse.hostname} · ${healthResponse.db}`,
            });
            setError('');
        } catch (requestError) {
            setHealth({ state: 'error', message: 'Backend unavailable' });
            setError(requestError.message);
        }
    }

    async function handleSubmit(event) {
        event.preventDefault();
        const text = taskText.trim();

        if (!text) {
            return;
        }

        try {
            const createdTask = await createTask(text);
            setTasks((currentTasks) => [createdTask, ...currentTasks]);
            setTaskText('');
            setError('');
        } catch (requestError) {
            setError(requestError.message);
        }
    }

    async function handleDelete(taskId) {
        try {
            await deleteTask(taskId);
            setTasks((currentTasks) => currentTasks.filter((task) => task.id !== taskId));
        } catch (requestError) {
            setError(requestError.message);
        }
    }

    async function handleDragEnd(event) {
        const { active, over } = event;

        if (!over || active.id === over.id) {
            return;
        }

        const task = active.data.current?.task;
        const nextStatus = over.data.current?.status;

        if (!task || !nextStatus || task.status === nextStatus) {
            return;
        }

        try {
            const updatedTask = await updateTaskStatus(task.id, nextStatus);
            setTasks((currentTasks) => currentTasks.map((item) => (item.id === updatedTask.id ? updatedTask : item)));
            setError('');
        } catch (requestError) {
            setError(requestError.message);
        }
    }

    return (
        <div className="app-shell">
            <main className="app-card">
                <section className="hero">
                    <div>
                        <p className="eyebrow">Week 2</p>
                        <h1>Task board with drag and drop</h1>
                        <p className="hero-copy">A light React board with three columns, backed by a small Express API.</p>
                    </div>
                    <div className={`health-badge health-badge--${health.state}`}>{health.message}</div>
                </section>

                <form className="task-form" onSubmit={handleSubmit}>
                    <label className="sr-only" htmlFor="task-text">Task title</label>
                    <input
                        id="task-text"
                        value={taskText}
                        onChange={(event) => setTaskText(event.target.value)}
                        placeholder="Add a task for the board"
                        autoComplete="off"
                    />
                    <button type="submit">Add task</button>
                </form>

                {error ? <div className="error-banner">{error}</div> : null}

                <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                    <section className="board-grid">
                        {COLUMNS.map((column) => (
                            <Column
                                key={column.id}
                                column={column}
                                tasks={tasksByStatus[column.id]}
                                onDelete={handleDelete}
                            />
                        ))}
                    </section>
                </DndContext>
            </main>
        </div>
    );
}
