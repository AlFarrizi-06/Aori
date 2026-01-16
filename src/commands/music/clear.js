const { EmbedBuilder } = require('discord.js');
const { emojis, colors } = require('../../utils/constants');

module.exports = {
    name: 'clear',
    aliases: ['clr', 'empty', 'clearqueue', 'cq'],
    description: 'Clear the entire queue (クリア)',
    usage: 'a!clear',
    category: 'music',
    voiceChannel: true,
    requireQueue: true,
    sameChannel: true,

    async execute(message, args, client) {
        const queue = client.queue.get(message.guild.id);

        if (queue.tracks.length === 0) {
            const embed = new EmbedBuilder()
                .setColor(colors.warning)
                .setDescription(`${emojis.warning} The queue is already empty!\n(キューはすでに空です!)`)
                .setFooter({ text: `Aori v${client.version}` });

            return message.reply({ embeds: [embed] });
        }

        const clearedCount = queue.tracks.length;
        queue.clear();

        const embed = new EmbedBuilder()
            .setColor(colors.success)
            .setDescription(`${emojis.success} Cleared **${clearedCount}** tracks from the queue!\n(${clearedCount}曲をキューから削除しました!)`)
            .setFooter({ text: `Aori v${client.version}` })
            .setTimestamp();

        message.reply({ embeds: [embed] });
    }
};