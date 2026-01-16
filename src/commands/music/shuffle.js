const { EmbedBuilder } = require('discord.js');
const { emojis, colors } = require('../../utils/constants');

module.exports = {
    name: 'shuffle',
    aliases: ['sh', 'mix', 'random'],
    description: 'Shuffle the queue (シャッフル)',
    usage: 'a!shuffle',
    category: 'music',
    voiceChannel: true,
    requireQueue: true,
    sameChannel: true,

    async execute(message, args, client) {
        const queue = client.queue.get(message.guild.id);

        if (queue.tracks.length < 2) {
            const embed = new EmbedBuilder()
                .setColor(colors.error)
                .setDescription(`${emojis.error} Need at least 2 songs in queue to shuffle!\n(シャッフルするには2曲以上必要です!)`)
                .setFooter({ text: `Aori v${client.version}` });

            return message.reply({ embeds: [embed] });
        }

        queue.shuffle();

        const embed = new EmbedBuilder()
            .setColor(colors.success)
            .setDescription(`${emojis.shuffle} Queue shuffled! **${queue.tracks.length}** tracks randomized! ♪\n(${queue.tracks.length}曲をシャッフルしました!)`)
            .setFooter({ text: `Aori v${client.version}` })
            .setTimestamp();

        message.reply({ embeds: [embed] });
    }
};