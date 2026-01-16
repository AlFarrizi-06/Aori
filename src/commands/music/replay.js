const { EmbedBuilder } = require('discord.js');
const { emojis, colors } = require('../../utils/constants');

module.exports = {
    name: 'replay',
    aliases: ['restart', 'rewind'],
    description: 'Replay the current song from the beginning (リプレイ)',
    usage: 'a!replay',
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

        await queue.seek(0);

        const embed = new EmbedBuilder()
            .setColor(colors.success)
            .setDescription(`${emojis.loop} Replaying **${queue.current.info.title}** from the beginning!\n(最初からリプレイします!)`)
            .setFooter({ text: `Aori v${client.version}` })
            .setTimestamp();

        message.reply({ embeds: [embed] });
    }
};