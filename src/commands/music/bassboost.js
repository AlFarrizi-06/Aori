const { EmbedBuilder } = require('discord.js');
const { emojis, colors } = require('../../utils/constants');

module.exports = {
    name: 'bassboost',
    aliases: ['bb', 'bass'],
    description: 'Toggle bass boost (バスブースト)',
    usage: 'a!bassboost [level: low/medium/high/off]',
    category: 'music',
    voiceChannel: true,
    requireQueue: true,
    sameChannel: true,

    async execute(message, args, client) {
        const queue = client.queue.get(message.guild.id);

        const levels = {
            off: [],
            low: [{ band: 0, gain: 0.2 }, { band: 1, gain: 0.15 }, { band: 2, gain: 0.1 }],
            medium: [{ band: 0, gain: 0.4 }, { band: 1, gain: 0.3 }, { band: 2, gain: 0.2 }],
            high: [{ band: 0, gain: 0.6 }, { band: 1, gain: 0.5 }, { band: 2, gain: 0.4 }],
        };

        let level = args[0]?.toLowerCase() || 'medium';

        if (!levels[level]) {
            level = queue.filters.bassboost ? 'off' : 'medium';
        }

        try {
            if (level === 'off') {
                await queue.player.setFilters({});
                queue.filters.bassboost = false;

                const embed = new EmbedBuilder()
                    .setColor(colors.warning)
                    .setDescription(`🔊 Bass Boost: **Disabled**\n(バスブースト: 無効)`)
                    .setFooter({ text: `Aori v${client.version}` });

                return message.reply({ embeds: [embed] });
            }

            await queue.player.setFilters({ equalizer: levels[level] });
            queue.filters.bassboost = level;

            const embed = new EmbedBuilder()
                .setColor(colors.success)
                .setDescription(`🔊 Bass Boost: **${level.charAt(0).toUpperCase() + level.slice(1)}**\n(バスブースト: ${level})`)
                .addFields({
                    name: 'Levels / レベル',
                    value: '`low` | `medium` | `high` | `off`'
                })
                .setFooter({ text: `Aori v${client.version}` })
                .setTimestamp();

            message.reply({ embeds: [embed] });

        } catch (error) {
            console.error('[Aori] Bass boost error:', error);
            
            const embed = new EmbedBuilder()
                .setColor(colors.error)
                .setDescription(`${emojis.error} Failed to apply bass boost!\n(バスブーストの適用に失敗しました!)`)
                .setFooter({ text: `Aori v${client.version}` });

            message.reply({ embeds: [embed] });
        }
    }
};