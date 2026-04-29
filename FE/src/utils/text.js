import { MAX_DESCRIPTION_LENGTH } from '../constants';

export function truncateDescription(text, maxLength = MAX_DESCRIPTION_LENGTH) {
    if (typeof text !== 'string') {
        return '';
    }

    const trimmed = text.trim();

    if (trimmed.length <= maxLength) {
        return trimmed;
    }

    const safeLength = Math.max(maxLength - 3, 0);
    return `${trimmed.slice(0, safeLength)}...`;
}
