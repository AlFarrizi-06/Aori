const { EmbedBuilder } = require('discord.js');
const { emojis, colors } = require('../../utils/constants');

module.exports = {
    name: 'skip',
    aliases: ['s', 'sk', 'next'],
    description: 'Skip the current song (スキップ)',
    usage: 'a!skip',
    category: 'music',
    voiceChannel: true,
    requireQueue: true,
    sameChannel: true,

    async execute(message, args, client) {
        const queue = client.queue.get(message.guild.id);

        if (!queue.current) {
            const embed = new EmbedBuilder()
                .setColor(colors.error)
                .setDescription(`${emojis.error} There's nothing playing right now!\n(現在再生中の曲がありません!)`)
                .setFooter({ text: `Aori v${client.version}` });

            return message.reply({ embeds: [embed] });
        }

        const skippedTrack = queue.current;
        await queue.skip();

        const embed = new EmbedBuilder()
            .setColor(colors.success)
            .setDescription(`${emojis.skip} Skipped: **${skippedTrack.info.title}**\n(スキップしました!)`)
            .setFooter({
                text: `Requested by ${message.author.tag} | Aori v${client.version}`,
                iconURL: message.author.displayAvatarURL(),
            })
            .setTimestamp();

        message.reply({ embeds: [embed] });
    }
};