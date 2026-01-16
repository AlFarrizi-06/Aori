const { EmbedBuilder } = require('discord.js');
const { emojis, colors } = require('../../utils/constants');

module.exports = {
    name: 'stop',
    aliases: ['st', 'disconnect', 'dc', 'leave'],
    description: 'Stop the music and leave the channel (停止)',
    usage: 'a!stop',
    category: 'music',
    voiceChannel: true,
    requireQueue: true,
    sameChannel: true,

    async execute(message, args, client) {
        const queue = client.queue.get(message.guild.id);

        await queue.destroy();

        const embed = new EmbedBuilder()
            .setColor(colors.success)
            .setDescription(`${emojis.stop} Music stopped and disconnected! さようなら~\n(音楽を停止し、切断しました!)`)
            .setFooter({ text: `Aori v${client.version}` })
            .setTimestamp();

        message.reply({ embeds: [embed] });
    }
};