const { EmbedBuilder } = require('discord.js');
const { emojis, colors } = require('../../utils/constants');

module.exports = {
    name: 'remove',
    aliases: ['rm', 'delete', 'del'],
    description: 'Remove a song from queue (削除)',
    usage: 'a!remove <position>',
    category: 'music',
    voiceChannel: true,
    requireQueue: true,
    sameChannel: true,

    async execute(message, args, client) {
        const queue = client.queue.get(message.guild.id);

        if (!args[0]) {
            const embed = new EmbedBuilder()
                .setColor(colors.error)
                .setDescription(`${emojis.error} Please provide a track position to remove!\n(削除する曲の位置を指定してください!)`)
                .addFields({
                    name: 'Usage / 使い方',
                    value: '`a!remove 3` - Remove track at position 3'
                })
                .setFooter({ text: `Aori v${client.version}` });

            return message.reply({ embeds: [embed] });
        }

        const position = parseInt(args[0]) - 1;

        if (isNaN(position) || position < 0 || position >= queue.tracks.length) {
            const embed = new EmbedBuilder()
                .setColor(colors.error)
                .setDescription(`${emojis.error} Invalid position! Queue has **${queue.tracks.length}** tracks.\n(無効な位置です!)`)
                .setFooter({ text: `Aori v${client.version}` });

            return message.reply({ embeds: [embed] });
        }

        const removedTrack = queue.remove(position);

        const embed = new EmbedBuilder()
            .setColor(colors.success)
            .setDescription(`${emojis.success} Removed **${removedTrack.info.title}** from the queue!\n(キューから削除しました!)`)
            .setFooter({ text: `Aori v${client.version}` })
            .setTimestamp();

        message.reply({ embeds: [embed] });
    }
};