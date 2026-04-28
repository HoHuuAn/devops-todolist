const API_BASE = import.meta.env.VITE_API_URL ?? '';

async function request(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers ?? {}),
        },
        ...options,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Request failed');
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
}

export function getHealth() {
    return request('/health');
}

export function getTasks() {
    return request('/api/tasks');
}

export function createTask(text) {
    return request('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({ text }),
    });
}

export function updateTaskStatus(taskId, status) {
    return request(`/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
    });
}

export function deleteTask(taskId) {
    return request(`/api/tasks/${taskId}`, {
        method: 'DELETE',
    });
}
