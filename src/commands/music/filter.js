const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { emojis, colors } = require('../../utils/constants');

module.exports = {
    name: 'filter',
    aliases: ['filters', 'fx', 'effects'],
    description: 'Apply audio filters (フィルター)',
    usage: 'a!filter [filter name]',
    category: 'music',
    voiceChannel: true,
    requireQueue: true,
    sameChannel: true,

    async execute(message, args, client) {
        const queue = client.queue.get(message.guild.id);

        const filters = {
            bassboost: { name: 'Bass Boost', emoji: '🔊', equalizer: [{ band: 0, gain: 0.6 }, { band: 1, gain: 0.7 }, { band: 2, gain: 0.8 }] },
            nightcore: { name: 'Nightcore', emoji: '🌙', timescale: { speed: 1.3, pitch: 1.3, rate: 1.0 } },
            vaporwave: { name: 'Vaporwave', emoji: '🌊', timescale: { speed: 0.85, pitch: 0.9, rate: 1.0 } },
            pop: { name: 'Pop', emoji: '🎤', equalizer: [{ band: 0, gain: -0.25 }, { band: 1, gain: 0.48 }, { band: 2, gain: 0.59 }] },
            soft: { name: 'Soft', emoji: '🎵', equalizer: [{ band: 0, gain: 0 }, { band: 1, gain: 0 }, { band: 2, gain: -0.25 }] },
            treblebass: { name: 'Treble Bass', emoji: '🎸', equalizer: [{ band: 0, gain: 0.6 }, { band: 1, gain: 0.67 }, { band: 13, gain: 0.6 }] },
            eightd: { name: '8D Audio', emoji: '🎧', rotation: { rotationHz: 0.2 } },
            karaoke: { name: 'Karaoke', emoji: '🎤', karaoke: { level: 1.0, monoLevel: 1.0, filterBand: 220, filterWidth: 100 } },
            vibrato: { name: 'Vibrato', emoji: '〰️', vibrato: { frequency: 4, depth: 0.75 } },
            tremolo: { name: 'Tremolo', emoji: '📳', tremolo: { frequency: 4, depth: 0.75 } },
            clear: { name: 'Clear All', emoji: '🔄', clear: true },
        };

        if (!args[0]) {
            // Show filter menu
            const activeFilters = Object.keys(queue.filters).filter(f => queue.filters[f]);
            
            const embed = new EmbedBuilder()
                .setColor(colors.info)
                .setAuthor({
                    name: 'Audio Filters / オーディオフィルター',
                    iconURL: client.user.displayAvatarURL(),
                })
                .setDescription('Select a filter from the dropdown menu below or use `a!filter <name>`')
                .addFields(
                    {
                        name: 'Available Filters / 利用可能なフィルター',
                        value: Object.entries(filters).map(([key, val]) => `${val.emoji} **${val.name}** - \`a!filter ${key}\``).join('\n'),
                    },
                    {
                        name: 'Active Filters / アクティブ',
                        value: activeFilters.length > 0 ? activeFilters.join(', ') : 'None',
                    }
                )
                .setFooter({ text: `Aori v${client.version}` });

            const row = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('filter_select')
                        .setPlaceholder('Select a filter... / フィルターを選択')
                        .addOptions(
                            Object.entries(filters).map(([key, val]) => ({
                                label: val.name,
                                value: key,
                                emoji: val.emoji,
                                description: `Apply ${val.name} filter`,
                            }))
                        )
                );

            const msg = await message.reply({ embeds: [embed], components: [row] });

            const collector = msg.createMessageComponentCollector({
                filter: i => i.user.id === message.author.id,
                time: 60000,
            });

            collector.on('collect', async (interaction) => {
                const selectedFilter = interaction.values[0];
                await applyFilter(queue, selectedFilter, filters, interaction, client);
            });

            collector.on('end', () => {
                row.components[0].setDisabled(true);
                msg.edit({ components: [row] }).catch(() => {});
            });

        } else {
            const filterName = args[0].toLowerCase();
            
            if (!filters[filterName]) {
                const embed = new EmbedBuilder()
                    .setColor(colors.error)
                    .setDescription(`${emojis.error} Invalid filter! Use \`a!filter\` to see available filters.\n(無効なフィルターです!)`)
                    .setFooter({ text: `Aori v${client.version}` });

                return message.reply({ embeds: [embed] });
            }

            await applyFilter(queue, filterName, filters, message, client);
        }
    }
};

async function applyFilter(queue, filterName, filters, ctx, client) {
    const filter = filters[filterName];
    const isInteraction = ctx.isStringSelectMenu?.();

    try {
        if (filter.clear) {
            await queue.player.clearFilters();
            Object.keys(queue.filters).forEach(f => queue.filters[f] = false);
            
            const embed = new EmbedBuilder()
                .setColor(colors.success)
                .setDescription(`${filter.emoji} All filters cleared!\n(すべてのフィルターをクリアしました!)`)
                .setFooter({ text: `Aori v${client.version}` });

            if (isInteraction) {
                await ctx.update({ embeds: [embed], components: [] });
            } else {
                await ctx.reply({ embeds: [embed] });
            }
            return;
        }

        // Apply the filter
        const filterData = {};
        if (filter.equalizer) filterData.equalizer = filter.equalizer;
        if (filter.timescale) filterData.timescale = filter.timescale;
        if (filter.rotation) filterData.rotation = filter.rotation;
        if (filter.karaoke) filterData.karaoke = filter.karaoke;
        if (filter.vibrato) filterData.vibrato = filter.vibrato;
        if (filter.tremolo) filterData.tremolo = filter.tremolo;

        await queue.player.setFilters(filterData);
        queue.filters[filterName] = true;

        const embed = new EmbedBuilder()
            .setColor(colors.success)
            .setDescription(`${filter.emoji} Applied **${filter.name}** filter!\n(${filter.name}フィルターを適用しました!)`)
            .setFooter({ text: `Aori v${client.version}` });

        if (isInteraction) {
            await ctx.update({ embeds: [embed], components: [] });
        } else {
            await ctx.reply({ embeds: [embed] });
        }

    } catch (error) {
        console.error('[Aori] Filter error:', error);
        
        const embed = new EmbedBuilder()
            .setColor(colors.error)
            .setDescription(`${emojis?.error || '❌'} Failed to apply filter!\n(フィルターの適用に失敗しました!)`)
            .setFooter({ text: error.message });

        if (isInteraction) {
            await ctx.update({ embeds: [embed], components: [] });
        } else {
            await ctx.reply({ embeds: [embed] });
        }
    }
}