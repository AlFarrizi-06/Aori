const { EmbedBuilder } = require('discord.js');
const { emojis, colors } = require('../../utils/constants');

module.exports = {
    name: '247',
    aliases: ['24/7', 'stay', 'alwayson'],
    description: 'Toggle 24/7 mode - bot stays in VC (24時間モード)',
    usage: 'a!247',
    category: 'music',
    voiceChannel: true,
    requireQueue: true,
    sameChannel: true,

    async execute(message, args, client) {
        const queue = client.queue.get(message.guild.id);

        queue.is247 = !queue.is247;

        const status = queue.is247 ? 'Enabled / 有効' : 'Disabled / 無効';
        const statusEmoji = queue.is247 ? '🌙' : '☀️';

        const embed = new EmbedBuilder()
            .setColor(queue.is247 ? colors.success : colors.warning)
            .setDescription(`${statusEmoji} 24/7 Mode: **${status}**`)
            .addFields({
                name: 'Info / 情報',
                value: queue.is247 
                    ? 'I will stay in the voice channel 24/7! (24時間ボイスチャンネルに留まります!)'
                    : 'I will leave when the queue ends and no one is in the channel.'
            })
            .setFooter({ text: `Aori v${client.version}` })
            .setTimestamp();

        message.reply({ embeds: [embed] });
    }
};