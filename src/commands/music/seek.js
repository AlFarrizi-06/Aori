const { EmbedBuilder } = require('discord.js');
const { emojis, colors } = require('../../utils/constants');

module.exports = {
    name: 'seek',
    aliases: ['jumpto', 'goto'],
    description: 'Seek to a specific time (シーク)',
    usage: 'a!seek <time> (e.g., 1:30, 90, 2:00:30)',
    category: 'music',
    voiceChannel: true,
    requireQueue: true,
    sameChannel: true,

    async execute(message, args, client) {
        const queue = client.queue.get(message.guild.id);

        if (!queue.current) {
            const embed = new EmbedBuilder()
                .setColor(colors.error)
                .setDescription(`${emojis.error} Nothing is playing right now!\n(現在再生中の曲がありません!)`)
                .setFooter({ text: `Aori v${client.version}` });

            return message.reply({ embeds: [embed] });
        }

        if (!args[0]) {
            const embed = new EmbedBuilder()
                .setColor(colors.error)
                .setDescription(`${emojis.error} Please provide a time to seek to!\n(シーク先の時間を指定してください!)`)
                .addFields({
                    name: 'Examples / 例',
                    value: '`a!seek 1:30` - Seek to 1:30\n`a!seek 90` - Seek to 90 seconds\n`a!seek 2:00:30` - Seek to 2h 0m 30s'
                })
                .setFooter({ text: `Aori v${client.version}` });

            return message.reply({ embeds: [embed] });
        }

        const time = parseTime(args[0]);

        if (time === null) {
            const embed = new EmbedBuilder()
                .setColor(colors.error)
                .setDescription(`${emojis.error} Invalid time format!\n(無効な時間形式です!)`)
                .setFooter({ text: `Aori v${client.version}` });

            return message.reply({ embeds: [embed] });
        }

        const duration = queue.current.info.length;

        if (time > duration) {
            const embed = new EmbedBuilder()
                .setColor(colors.error)
                .setDescription(`${emojis.error} Cannot seek beyond track duration! (${formatDuration(duration)})\n(曲の長さを超えてシークできません!)`)
                .setFooter({ text: `Aori v${client.version}` });

            return message.reply({ embeds: [embed] });
        }

        await queue.seek(time);

        const embed = new EmbedBuilder()
            .setColor(colors.success)
            .setDescription(`${emojis.clock} Seeked to **${formatDuration(time)}**!\n(${formatDuration(time)}にシークしました!)`)
            .setFooter({ text: `Aori v${client.version}` })
            .setTimestamp();

        message.reply({ embeds: [embed] });
    }
};

function parseTime(timeStr) {
    // Handle pure seconds (e.g., "90")
    if (/^\d+$/.test(timeStr)) {
        return parseInt(timeStr) * 1000;
    }

    // Handle mm:ss or hh:mm:ss format
    const parts = timeStr.split(':').map(p => parseInt(p));
    
    if (parts.some(p => isNaN(p))) return null;

    if (parts.length === 2) {
        // mm:ss
        const [minutes, seconds] = parts;
        return (minutes * 60 + seconds) * 1000;
    } else if (parts.length === 3) {
        // hh:mm:ss
        const [hours, minutes, seconds] = parts;
        return (hours * 3600 + minutes * 60 + seconds) * 1000;
    }

    return null;
}

function formatDuration(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}