const { EmbedBuilder } = require('discord.js');
const { emojis, colors } = require('../../utils/constants');

module.exports = {
    name: 'vaporwave',
    aliases: ['vw', 'vapor', 'slowed'],
    description: 'Toggle vaporwave/slowed effect (ヴェイパーウェイブ)',
    usage: 'a!vaporwave',
    category: 'music',
    voiceChannel: true,
    requireQueue: true,
    sameChannel: true,

    async execute(message, args, client) {
        const queue = client.queue.get(message.guild.id);

        try {
            if (queue.filters.vaporwave) {
                await queue.player.setFilters({});
                queue.filters.vaporwave = false;

                const embed = new EmbedBuilder()
                    .setColor(colors.warning)
                    .setDescription(`🌊 Vaporwave: **Disabled**\n(ヴェイパーウェイブ: 無効)`)
                    .setFooter({ text: `Aori v${client.version}` });

                return message.reply({ embeds: [embed] });
            }

            // Disable nightcore if active
            queue.filters.nightcore = false;

            await queue.player.setFilters({
                timescale: { speed: 0.85, pitch: 0.9, rate: 1.0 }
            });
            queue.filters.vaporwave = true;

            const embed = new EmbedBuilder()
                .setColor(colors.success)
                .setDescription(`🌊 Vaporwave: **Enabled**\n(ヴェイパーウェイブ: 有効)\n\n*A E S T H E T I C ～*`)
                .setFooter({ text: `Aori v${client.version}` })
                .setTimestamp();

            message.reply({ embeds: [embed] });

        } catch (error) {
            console.error('[Aori] Vaporwave error:', error);
            
            const embed = new EmbedBuilder()
                .setColor(colors.error)
                .setDescription(`${emojis.error} Failed to apply vaporwave!\n(ヴェイパーウェイブの適用に失敗しました!)`)
                .setFooter({ text: `Aori v${client.version}` });

            message.reply({ embeds: [embed] });
        }
    }
};