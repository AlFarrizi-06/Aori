const { EmbedBuilder } = require('discord.js');
const { emojis, colors } = require('../../utils/constants');

module.exports = {
    name: 'jump',
    aliases: ['j', 'skipto', 'jumpto'],
    description: 'Jump to a specific track in queue (ジャンプ)',
    usage: 'a!jump <position>',
    category: 'music',
    voiceChannel: true,
    requireQueue: true,
    sameChannel: true,

    async execute(message, args, client) {
        const queue = client.queue.get(message.guild.id);

        if (!args[0]) {
            const embed = new EmbedBuilder()
                .setColor(colors.error)
                .setDescription(`${emojis.error} Please provide a track position to jump to!\n(ジャンプ先の位置を指定してください!)`)
                .addFields({
                    name: 'Usage / 使い方',
                    value: '`a!jump 5` - Jump to track at position 5'
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

        const track = queue.jump(position);
        await queue.skip();

        const embed = new EmbedBuilder()
            .setColor(colors.success)
            .setDescription(`${emojis.skip} Jumped to **${track.info.title}**!\n(ジャンプしました!)`)
            .setFooter({ text: `Aori v${client.version}` })
            .setTimestamp();

        message.reply({ embeds: [embed] });
    }
};