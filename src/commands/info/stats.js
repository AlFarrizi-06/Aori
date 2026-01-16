const { EmbedBuilder, version: djsVersion } = require('discord.js');
const { emojis, colors } = require('../../utils/constants');
const os = require('os');

module.exports = {
    name: 'stats',
    aliases: ['statistics', 'botinfo', 'bi'],
    description: 'Show bot statistics (統計)',
    usage: 'a!stats',
    category: 'info',

    async execute(message, args, client) {
        const uptime = formatUptime(client.uptime);
        const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        const totalMemory = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);

        // Count total queue tracks across all servers
        let totalQueues = 0;
        let totalTracks = 0;
        client.queue.forEach(queue => {
            totalQueues++;
            totalTracks += queue.tracks.length + (queue.current ? 1 : 0);
        });

        const embed = new EmbedBuilder()
            .setColor(colors.primary)
            .setAuthor({
                name: `${client.config.bot.name} Statistics / 統計`,
                iconURL: client.user.displayAvatarURL(),
            })
            .setThumbnail(client.user.displayAvatarURL({ size: 512 }))
            .addFields(
                {
                    name: `${emojis.bot} Bot Info`,
                    value: `**Name:** ${client.user.tag}\n**ID:** ${client.user.id}\n**Version:** v${client.version}`,
                    inline: true
                },
                {
                    name: `${emojis.server} Servers`,
                    value: `**Guilds:** ${client.guilds.cache.size}\n**Users:** ${client.users.cache.size}\n**Channels:** ${client.channels.cache.size}`,
                    inline: true
                },
                {
                    name: `${emojis.music} Music`,
                    value: `**Active Players:** ${totalQueues}\n**Tracks in Queue:** ${totalTracks}\n**Commands:** ${client.commands.size}`,
                    inline: true
                },
                {
                    name: `${emojis.clock} Uptime`,
                    value: `\`${uptime}\``,
                    inline: true
                },
                {
                    name: '💾 Memory',
                    value: `\`${memoryUsage} MB / ${totalMemory} GB\``,
                    inline: true
                },
                {
                    name: '⚙️ System',
                    value: `**Node.js:** ${process.version}\n**Discord.js:** v${djsVersion}\n**Platform:** ${os.platform()}`,
                    inline: true
                },
                {
                    name: '🌐 Supported Platforms',
                    value: `${emojis.deezer} Deezer\n${emojis.soundcloud} SoundCloud\n${emojis.spotify} Spotify\n${emojis.bandcamp} Bandcamp\n${emojis.applemusic} Apple Music`,
                    inline: false
                }
            )
            .setFooter({ text: `Aori v${client.version} | Uptime: ${uptime}` })
            .setTimestamp();

        message.reply({ embeds: [embed] });
    }
};

function formatUptime(ms) {
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
}