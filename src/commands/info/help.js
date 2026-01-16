const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { emojis, colors } = require('../../utils/constants');

module.exports = {
    name: 'help',
    aliases: ['h', 'commands', 'cmd'],
    description: 'Show all commands (ヘルプ)',
    usage: 'a!help [command]',
    category: 'info',

    async execute(message, args, client) {
        if (args[0]) {
            // Specific command help
            const commandName = args[0].toLowerCase();
            const command = client.commands.get(commandName) || 
                           client.commands.get(client.aliases.get(commandName));

            if (!command) {
                const embed = new EmbedBuilder()
                    .setColor(colors.error)
                    .setDescription(`${emojis.error} Command not found: \`${commandName}\``)
                    .setFooter({ text: `Aori v${client.version}` });

                return message.reply({ embeds: [embed] });
            }

            const embed = new EmbedBuilder()
                .setColor(colors.info)
                .setAuthor({
                    name: `Command: ${command.name}`,
                    iconURL: client.user.displayAvatarURL(),
                })
                .setDescription(command.description || 'No description available.')
                .addFields(
                    { name: 'Usage / 使い方', value: `\`${command.usage || `a!${command.name}`}\``, inline: true },
                    { name: 'Category / カテゴリ', value: command.category || 'General', inline: true },
                    { name: 'Aliases / エイリアス', value: command.aliases?.length > 0 ? command.aliases.map(a => `\`${a}\``).join(', ') : 'None', inline: true }
                )
                .setFooter({ text: `Aori v${client.version}` })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }

        // Main help menu
        const categories = {
            music: {
                name: '🎵 Music / 音楽',
                emoji: '🎵',
                description: 'Music playback commands',
            },
            info: {
                name: 'ℹ️ Info / 情報',
                emoji: 'ℹ️',
                description: 'Information commands',
            },
            utility: {
                name: '⚙️ Utility / ユーティリティ',
                emoji: '⚙️',
                description: 'Utility commands',
            },
        };

        const embed = new EmbedBuilder()
            .setColor(colors.primary)
            .setAuthor({
                name: `${client.config.bot.name} Help Menu / ヘルプ`,
                iconURL: client.user.displayAvatarURL(),
            })
            .setDescription(`
${emojis.sparkle} **Welcome to Aori Music Bot!** ${emojis.sparkle}
ようこそ！

Select a category from the dropdown below to view commands.
下のドロップダウンからカテゴリを選択してください。

**Prefix:** \`${client.prefix}\` (case-insensitive)
**Total Commands:** ${client.commands.size}
            `)
            .addFields(
                {
                    name: '🎵 Music Commands',
                    value: 'Play, Queue, Filters, and more!',
                    inline: true
                },
                {
                    name: 'ℹ️ Info Commands',
                    value: 'Help, Ping, Stats, etc.',
                    inline: true
                },
                {
                    name: '🌐 Platforms',
                    value: `${emojis.deezer} Deezer\n${emojis.soundcloud} SoundCloud\n${emojis.spotify} Spotify\n${emojis.bandcamp} Bandcamp\n${emojis.applemusic} Apple Music\nand more...`,
                    inline: true
                }
            )
            .setThumbnail(client.user.displayAvatarURL({ size: 512 }))
            .setFooter({ text: `Aori v${client.version} | Made with ♥` })
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('help_category')
                    .setPlaceholder('Select a category... / カテゴリを選択')
                    .addOptions([
                        {
                            label: 'Music / 音楽',
                            value: 'music',
                            emoji: '🎵',
                            description: 'Music playback commands',
                        },
                        {
                            label: 'Info / 情報',
                            value: 'info',
                            emoji: 'ℹ️',
                            description: 'Information commands',
                        },
                        {
                            label: 'Utility / ユーティリティ',
                            value: 'utility',
                            emoji: '⚙️',
                            description: 'Utility commands',
                        },
                        {
                            label: 'All Commands',
                            value: 'all',
                            emoji: '📜',
                            description: 'View all commands',
                        },
                    ])
            );

        const msg = await message.reply({ embeds: [embed], components: [row] });

        const collector = msg.createMessageComponentCollector({
            filter: i => i.user.id === message.author.id,
            time: 120000,
        });

        collector.on('collect', async (interaction) => {
            const category = interaction.values[0];

            let categoryCommands;
            let categoryTitle;

            if (category === 'all') {
                categoryCommands = [...client.commands.values()];
                categoryTitle = '📜 All Commands / 全コマンド';
            } else {
                categoryCommands = [...client.commands.values()].filter(c => c.category === category);
                categoryTitle = categories[category]?.name || category;
            }

            const commandList = categoryCommands.map(cmd => {
                return `\`${cmd.name}\` - ${cmd.description || 'No description'}`;
            }).join('\n');

            const categoryEmbed = new EmbedBuilder()
                .setColor(colors.primary)
                .setAuthor({
                    name: categoryTitle,
                    iconURL: client.user.displayAvatarURL(),
                })
                .setDescription(commandList || 'No commands in this category.')
                .setFooter({ text: `Use a!help <command> for more info | Aori v${client.version}` })
                .setTimestamp();

            await interaction.update({ embeds: [categoryEmbed], components: [row] });
        });

        collector.on('end', () => {
            row.components[0].setDisabled(true);
            msg.edit({ components: [row] }).catch(() => {});
        });
    }
};