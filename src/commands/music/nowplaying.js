const { EmbedBuilder } = require('discord.js');
const { emojis, colors } = require('../../utils/constants');

module.exports = {
    name: 'nowplaying',
    aliases: ['np', 'now', 'current', 'playing'],
    description: 'Show the current playing song (現在再生中)',
    usage: 'a!nowplaying',
    category: 'music',
    requireQueue: true,

    async execute(message, args, client) {
        const queue = client.queue.get(message.guild.id);

        if (!queue.current) {
            const embed = new EmbedBuilder()
                .setColor(colors.error)
                .setDescription(`${emojis.error} Nothing is playing right now!\n(現在再生中の曲がありません!)`);

            return message.reply({ embeds: [embed] });
        }

        const track = queue.current;
        const position = queue.player.position || 0;
        const duration = track.info.length;
        const progress = createProgressBar(position, duration);

        // Get platform emoji
        const platformEmoji = getPlatformEmoji(track.info.uri || track.info.sourceName);

        const embed = new EmbedBuilder()
            .setColor(colors.music)
            .setAuthor({
                name: queue.paused ? '⏸️ Paused / 一時停止中' : '🎵 Now Playing / 再生中',
                iconURL: client.user.displayAvatarURL(),
            })
            .setTitle(`${platformEmoji} ${track.info.title}`)
            .setURL(track.info.uri)
            .setThumbnail(track.info.artworkUrl || client.user.displayAvatarURL())
            .setDescription(`
**Artist / アーティスト:** ${track.info.author}

\`${progress}\`
\`${formatDuration(position)} / ${formatDuration(duration)}\`

${emojis.volume} **Volume:** ${queue.volume}%
${emojis.loop} **Loop:** ${queue.loop === 'none' ? 'Off' : queue.loop === 'track' ? '🔂 Track' : '🔁 Queue'}
${emojis.queue} **Queue:** ${queue.tracks.length} tracks
            `)
            .setFooter({
                text: `Requested by ${track.info.requester?.tag || 'Unknown'}`,
                iconURL: track.info.requester?.displayAvatarURL() || null,
            })
            .setTimestamp();

        message.reply({ embeds: [embed] });
    }
};

/**
 * Create progress bar with slider style
 * Example: ▬▬▬▬▬🔘▬▬▬▬▬▬▬▬▬
 */
function createProgressBar(current, total, length = 25) {
    if (!total || total === 0) return '🔘' + '▬'.repeat(length - 1);
    
    const percentage = Math.min(current / total, 1);
    const progress = Math.round(length * percentage);
    
    let bar = '';
    
    for (let i = 0; i < length; i++) {
        if (i === progress) {
            bar += '🔘';
        } else {
            bar += '▬';
        }
    }
    
    if (progress >= length) {
        bar = '▬'.repeat(length - 1) + '🔘';
    }
    
    return bar;
}

/**
 * Format duration from ms to readable string
 */
function formatDuration(ms) {
    if (!ms || isNaN(ms)) return '00:00';
    
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Get platform emoji based on URL or source name
 */
function getPlatformEmoji(source) {
    if (!source) return emojis.disc;
    
    const sourceLower = source.toLowerCase();
    
    if (sourceLower.includes('spotify')) return emojis.spotify || '🟢';
    if (sourceLower.includes('soundcloud')) return emojis.soundcloud || '🟠';
    if (sourceLower.includes('deezer')) return emojis.deezer || '💜';
    if (sourceLower.includes('apple') || sourceLower.includes('music.apple')) return emojis.applemusic || '🍎';
    if (sourceLower.includes('bandcamp')) return emojis.bandcamp || '🎵';
    if (sourceLower.includes('youtube') || sourceLower.includes('youtu.be')) return emojis.link || '🔴';
    
    return emojis.disc;
}