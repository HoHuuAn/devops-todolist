import { useEffect, useMemo, useState } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { createTask, deleteTask, getTasks, updateTaskStatus } from './api';
import { COLUMNS } from './constants';
import Column from './components/Column';
import TaskCard from './components/TaskCard';

export default function App() {
    const [tasks, setTasks] = useState([]);
    const [taskText, setTaskText] = useState('');
    const [taskDescription, setTaskDescription] = useState('');
    const [error, setError] = useState('');
    const [activeTask, setActiveTask] = useState(null);
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
            const taskResponse = await getTasks();
            setTasks(taskResponse);
            setError('');
        } catch (requestError) {
            setError(requestError.message);
        }
    }

    async function handleSubmit(event) {
        event.preventDefault();
        const text = taskText.trim();
        const description = taskDescription.trim();

        if (!text) {
            return;
        }

        try {
            const createdTask = await createTask(text, description);
            setTasks((currentTasks) => [createdTask, ...currentTasks]);
            setTaskText('');
            setTaskDescription('');
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

    function handleDragStart(event) {
        const { active } = event;
        setActiveTask(active.data.current?.task);
    }

    function handleDragCancel() {
        setActiveTask(null);
    }

    async function handleDragEnd(event) {
        setActiveTask(null);
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
                        <h1>Task board</h1>
                    </div>
                </section>

                <form className="task-form" onSubmit={handleSubmit}>
                    <label className="sr-only" htmlFor="task-text">Task title</label>
                    <input
                        id="task-text"
                        value={taskText}
                        onChange={(event) => setTaskText(event.target.value)}
                        placeholder="Task title"
                        autoComplete="off"
                    />
                    <label className="sr-only" htmlFor="task-description">Task description</label>
                    <textarea
                        id="task-description"
                        value={taskDescription}
                        onChange={(event) => setTaskDescription(event.target.value)}
                        placeholder="Task description"
                        rows={2}
                    />
                    <button type="submit">Add task</button>
                </form>

                {error ? <div className="error-banner">{error}</div> : null}

                <DndContext 
                    sensors={sensors} 
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragCancel={handleDragCancel}
                >
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
                    <DragOverlay>
                        {activeTask ? <TaskCard task={activeTask} isOverlay /> : null}
                    </DragOverlay>
                </DndContext>
            </main>
        </div>
    );
}
