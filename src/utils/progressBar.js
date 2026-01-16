const { emojis } = require('./constants');

module.exports = {
    createProgressBar(current, total, length = 15) {
        if (!current || !total) return '░'.repeat(length);
        
        const percentage = current / total;
        const progress = Math.round(length * percentage);
        const empty = length - progress;

        const progressText = '▓'.repeat(progress);
        const emptyText = '░'.repeat(empty);

        return `${progressText}${emptyText}`;
    },

    createVolumeBar(volume, length = 10) {
        const filled = Math.round((volume / 100) * length);
        const empty = length - filled;

        return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
    },

    // Custom emoji progress bar (if you have custom emojis)
    createCustomProgressBar(current, total, length = 12) {
        if (!current || !total) {
            return `${emojis.bar_start_empty}${'<:bm_e:id>'.repeat(length - 2)}${emojis.bar_end_empty}`;
        }
        
        const percentage = current / total;
        const progress = Math.round((length - 2) * percentage);
        const empty = (length - 2) - progress;

        let bar = progress > 0 ? emojis.bar_start_full : emojis.bar_start_empty;
        bar += emojis.bar_mid_full.repeat(Math.max(0, progress - 1));
        bar += emojis.bar_mid_empty.repeat(empty);
        bar += progress >= length - 2 ? emojis.bar_end_full : emojis.bar_end_empty;

        return bar;
    }
};