const { EmbedBuilder } = require('discord.js');
const { emojis, colors } = require('../../utils/constants');

module.exports = {
    name: 'resume',
    aliases: ['rs', 'unpause', 'continue'],
    description: 'Resume the paused song (再開)',
    usage: 'a!resume',
    category: 'music',
    voiceChannel: true,
    requireQueue: true,
    sameChannel: true,

    async execute(message, args, client) {
        const queue = client.queue.get(message.guild.id);

        if (!queue.paused) {
            const embed = new EmbedBuilder()
                .setColor(colors.warning)
                .setDescription(`${emojis.warning} Music is not paused!\n(一時停止していません!)`)
                .setFooter({ text: `Aori v${client.version}` });

            return message.reply({ embeds: [embed] });
        }

        await queue.resume();

        const embed = new EmbedBuilder()
            .setColor(colors.success)
            .setDescription(`${emojis.play} Music resumed! ♪\n(再生を再開しました!)`)
            .setFooter({ text: `Aori v${client.version}` })
            .setTimestamp();

        message.reply({ embeds: [embed] });
    }
};