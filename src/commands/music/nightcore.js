const { EmbedBuilder } = require('discord.js');
const { emojis, colors } = require('../../utils/constants');

module.exports = {
    name: 'nightcore',
    aliases: ['nc'],
    description: 'Toggle nightcore effect (ナイトコア)',
    usage: 'a!nightcore',
    category: 'music',
    voiceChannel: true,
    requireQueue: true,
    sameChannel: true,

    async execute(message, args, client) {
        const queue = client.queue.get(message.guild.id);

        try {
            if (queue.filters.nightcore) {
                await queue.player.setFilters({});
                queue.filters.nightcore = false;

                const embed = new EmbedBuilder()
                    .setColor(colors.warning)
                    .setDescription(`🌙 Nightcore: **Disabled**\n(ナイトコア: 無効)`)
                    .setFooter({ text: `Aori v${client.version}` });

                return message.reply({ embeds: [embed] });
            }

            // Disable vaporwave if active
            queue.filters.vaporwave = false;

            await queue.player.setFilters({
                timescale: { speed: 1.3, pitch: 1.3, rate: 1.0 }
            });
            queue.filters.nightcore = true;

            const embed = new EmbedBuilder()
                .setColor(colors.success)
                .setDescription(`🌙 Nightcore: **Enabled**\n(ナイトコア: 有効)\n\n*Speed and pitch increased for that anime vibe!*`)
                .setFooter({ text: `Aori v${client.version}` })
                .setTimestamp();

            message.reply({ embeds: [embed] });

        } catch (error) {
            console.error('[Aori] Nightcore error:', error);
            
            const embed = new EmbedBuilder()
                .setColor(colors.error)
                .setDescription(`${emojis.error} Failed to apply nightcore!\n(ナイトコアの適用に失敗しました!)`)
                .setFooter({ text: `Aori v${client.version}` });

            message.reply({ embeds: [embed] });
        }
    }
};