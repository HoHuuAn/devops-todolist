import { useDraggable } from '@dnd-kit/core';
import { STATUS_LABELS } from '../constants';
import { truncateDescription } from '../utils/text';

export default function TaskCard({ task, onDelete, isOverlay }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: isOverlay ? `overlay-task-${task.id}` : `task-${task.id}`,
        data: { task },
        disabled: isOverlay,
    });

    const style = {
        transform: transform && !isOverlay ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        opacity: isDragging && !isOverlay ? 0.3 : 1,
        cursor: isOverlay ? 'grabbing' : 'grab',
    };

    const description = truncateDescription(task.description ?? '');

    return (
        <article ref={isOverlay ? undefined : setNodeRef} className={`task-card ${isOverlay ? 'task-card--overlay' : ''}`} style={style} {...(isOverlay ? {} : attributes)} {...(isOverlay ? {} : listeners)}>
            <div className="task-card__topline">
                <span className={`status-pill status-pill--${task.status}`}>{STATUS_LABELS[task.status]}</span>
                {onDelete && (
                    <button type="button" className="icon-button" onClick={(e) => { e.stopPropagation(); onDelete(task.id); }} aria-label={`Delete ${task.text}`}>
                        Delete
                    </button>
                )}
            </div>
            <h3>{task.text}</h3>
            <p>{description}</p>
        </article>
    );
}
