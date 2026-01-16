module.exports = {
    /**
     * Format duration in MM:SS or HH:MM:SS format
     * Always uses 2 digits for all components (00:00 format)
     * @param {number} ms - Duration in milliseconds
     * @returns {string} Formatted duration string
     */
    formatDuration(ms) {
        if (!ms || isNaN(ms)) return '00:00';
        
        const seconds = Math.floor((ms / 1000) % 60);
        const minutes = Math.floor((ms / (1000 * 60)) % 60);
        const hours = Math.floor(ms / (1000 * 60 * 60));

        if (hours > 0) {
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    },

    /**
     * Format uptime in human readable format
     * @param {number} ms - Duration in milliseconds
     * @returns {string} Formatted uptime string (e.g., "1d 2h 30m 15s")
     */
    formatUptime(ms) {
        const seconds = Math.floor((ms / 1000) % 60);
        const minutes = Math.floor((ms / (1000 * 60)) % 60);
        const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
        const days = Math.floor(ms / (1000 * 60 * 60 * 24));

        const parts = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (seconds > 0) parts.push(`${seconds}s`);

        return parts.join(' ') || '0s';
    },

    /**
     * Parse time string to milliseconds
     * Supports: "123" (seconds), "1:30" (MM:SS), "1:30:00" (HH:MM:SS)
     * @param {string} timeStr - Time string to parse
     * @returns {number|null} Time in milliseconds or null if invalid
     */
    parseTime(timeStr) {
        if (/^\d+$/.test(timeStr)) {
            return parseInt(timeStr) * 1000;
        }

        const parts = timeStr.split(':').map(p => parseInt(p));
        
        if (parts.some(p => isNaN(p))) return null;

        if (parts.length === 2) {
            const [minutes, seconds] = parts;
            return (minutes * 60 + seconds) * 1000;
        } else if (parts.length === 3) {
            const [hours, minutes, seconds] = parts;
            return (hours * 3600 + minutes * 60 + seconds) * 1000;
        }

        return null;
    }
};