import { useDroppable } from '@dnd-kit/core';
import TaskCard from './TaskCard';

export default function Column({ column, tasks, onDelete }) {
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
