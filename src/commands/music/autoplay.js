const { EmbedBuilder } = require('discord.js');
const { emojis, colors } = require('../../utils/constants');

module.exports = {
    name: 'autoplay',
    aliases: ['ap', 'auto'],
    description: 'Toggle autoplay mode (オートプレイ)',
    usage: 'a!autoplay',
    category: 'music',
    voiceChannel: true,
    requireQueue: true,
    sameChannel: true,

    async execute(message, args, client) {
        const queue = client.queue.get(message.guild.id);

        queue.autoplay = !queue.autoplay;

        const status = queue.autoplay ? 'Enabled / 有効' : 'Disabled / 無効';
        const statusEmoji = queue.autoplay ? emojis.success : '❌';

        const embed = new EmbedBuilder()
            .setColor(queue.autoplay ? colors.success : colors.warning)
            .setDescription(`${statusEmoji} Autoplay: **${status}**\n(オートプレイ: ${status})`)
            .addFields({
                name: 'Info / 情報',
                value: queue.autoplay 
                    ? 'I will automatically play similar tracks when the queue ends!'
                    : 'Autoplay has been disabled.'
            })
            .setFooter({ text: `Aori v${client.version}` })
            .setTimestamp();

        message.reply({ embeds: [embed] });
    }
};