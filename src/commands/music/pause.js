const { EmbedBuilder } = require('discord.js');
const { emojis, colors } = require('../../utils/constants');

module.exports = {
    name: 'pause',
    aliases: ['pa'],
    description: 'Pause the current song (一時停止)',
    usage: 'a!pause',
    category: 'music',
    voiceChannel: true,
    requireQueue: true,
    sameChannel: true,

    async execute(message, args, client) {
        const queue = client.queue.get(message.guild.id);

        if (queue.paused) {
            const embed = new EmbedBuilder()
                .setColor(colors.warning)
                .setDescription(`${emojis.warning} Music is already paused! Use \`a!resume\` to continue.\n(すでに一時停止中です!)`)
                .setFooter({ text: `Aori v${client.version}` });

            return message.reply({ embeds: [embed] });
        }

        await queue.pause();

        const embed = new EmbedBuilder()
            .setColor(colors.success)
            .setDescription(`${emojis.pause} Music paused! Use \`a!resume\` to continue.\n(一時停止しました!)`)
            .setFooter({ text: `Aori v${client.version}` })
            .setTimestamp();

        message.reply({ embeds: [embed] });
    }
};