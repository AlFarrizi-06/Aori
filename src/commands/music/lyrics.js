const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { emojis, colors } = require('../../utils/constants');
const { getMusixmatch } = require('../../utils/musixmatchLyrics');

module.exports = {
    name: 'lyrics',
    aliases: ['ly', 'lyric'],
    description: 'Get lyrics for current or searched song (歌詞)',
    usage: 'a!lyrics [song name]',
    category: 'music',

    async execute(message, args, client) {
        let searchTitle;
        let searchAuthor = '';

        const queue = client.queue.get(message.guild.id);

        if (args.length > 0) {
            searchTitle = args.join(' ');
        } else if (queue?.current) {
            searchTitle = queue.current.info.title;
            searchAuthor = queue.current.info.author || '';
        } else {
            const embed = new EmbedBuilder()
                .setColor(colors.error)
                .setDescription(`${emojis.error} Please provide a song name or play a song first!\n(曲名を入力するか、先に曲を再生してください!)`)
                .setFooter({ text: `Aori v${client.version}` });

            return message.reply({ embeds: [embed] });
        }

        const loadingEmbed = new EmbedBuilder()
            .setColor(colors.info)
            .setDescription(`${emojis.loading} Searching for lyrics... (歌詞を検索中...)`)
            .setFooter({ text: `Aori v${client.version}` });

        const loadingMsg = await message.reply({ embeds: [loadingEmbed] });

        try {
            const musixmatch = getMusixmatch({ debug: false });

            const result = await musixmatch.getLyrics({
                title: searchTitle,
                author: searchAuthor
            });

            if (!result || !result.lines?.length) {
                const notFoundEmbed = new EmbedBuilder()
                    .setColor(colors.error)
                    .setDescription(`${emojis.error} No lyrics found for: **${searchTitle}**\n(歌詞が見つかりませんでした!)`)
                    .setFooter({ text: `Aori v${client.version}` });

                return loadingMsg.edit({ embeds: [notFoundEmbed] });
            }

            // Format lyrics text from lines array
            const lyricsText = result.lines
                .map(line => line.text)
                .join('\n');

            const displayTitle = result.track?.name || searchTitle;
            const displayArtist = result.track?.artist || searchAuthor;

            // Split lyrics if too long
            const lyricsPages = splitLyrics(lyricsText, 2000);

            if (lyricsPages.length === 1) {
                const embed = new EmbedBuilder()
                    .setColor(colors.music)
                    .setAuthor({
                        name: 'Lyrics / 歌詞 ♪',
                        iconURL: client.user.displayAvatarURL(),
                    })
                    .setTitle(`${emojis.music} ${displayTitle}`)
                    .setDescription(lyricsPages[0])
                    .addFields(
                        { name: 'Artist', value: displayArtist || 'Unknown', inline: true },
                        { name: 'Type', value: result.synced ? '⏱️ Synced' : '📝 Unsynced', inline: true }
                    )
                    .setFooter({ text: `Powered by Musixmatch | Aori v${client.version}` })
                    .setTimestamp();

                await loadingMsg.edit({ embeds: [embed] });
            } else {
                // Paginated lyrics
                let currentPage = 0;

                const embed = new EmbedBuilder()
                    .setColor(colors.music)
                    .setAuthor({
                        name: 'Lyrics / 歌詞 ♪',
                        iconURL: client.user.displayAvatarURL(),
                    })
                    .setTitle(`${emojis.music} ${displayTitle}`)
                    .setDescription(lyricsPages[currentPage])
                    .setFooter({ 
                        text: `Page ${currentPage + 1}/${lyricsPages.length} | ${result.synced ? 'Synced' : 'Unsynced'} | Musixmatch | Aori v${client.version}` 
                    });

                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('lyrics_prev')
                            .setEmoji('◀️')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId('lyrics_page')
                            .setLabel(`${currentPage + 1}/${lyricsPages.length}`)
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId('lyrics_next')
                            .setEmoji('▶️')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(lyricsPages.length === 1)
                    );

                await loadingMsg.edit({ embeds: [embed], components: [row] });

                const collector = loadingMsg.createMessageComponentCollector({
                    filter: i => i.user.id === message.author.id,
                    time: 180000,
                });

                collector.on('collect', async (interaction) => {
                    if (interaction.customId === 'lyrics_prev') {
                        currentPage = Math.max(0, currentPage - 1);
                    } else if (interaction.customId === 'lyrics_next') {
                        currentPage = Math.min(lyricsPages.length - 1, currentPage + 1);
                    }

                    embed.setDescription(lyricsPages[currentPage]);
                    embed.setFooter({ 
                        text: `Page ${currentPage + 1}/${lyricsPages.length} | ${result.synced ? 'Synced' : 'Unsynced'} | Musixmatch | Aori v${client.version}` 
                    });

                    row.components[0].setDisabled(currentPage === 0);
                    row.components[1].setLabel(`${currentPage + 1}/${lyricsPages.length}`);
                    row.components[2].setDisabled(currentPage === lyricsPages.length - 1);

                    await interaction.update({ embeds: [embed], components: [row] });
                });

                collector.on('end', () => {
                    row.components.forEach(c => c.setDisabled(true));
                    loadingMsg.edit({ components: [row] }).catch(() => {});
                });
            }

        } catch (error) {
            console.error('[Aori] Lyrics error:', error);

            const errorEmbed = new EmbedBuilder()
                .setColor(colors.error)
                .setDescription(`${emojis.error} Failed to fetch lyrics!\n(歌詞の取得に失敗しました!)`)
                .setFooter({ text: `Aori v${client.version}` });

            loadingMsg.edit({ embeds: [errorEmbed] });
        }
    }
};

function splitLyrics(text, maxLength) {
    const pages = [];
    let currentPage = '';

    const lines = text.split('\n');

    for (const line of lines) {
        if ((currentPage + line + '\n').length > maxLength) {
            if (currentPage.trim()) {
                pages.push(currentPage.trim());
            }
            currentPage = line + '\n';
        } else {
            currentPage += line + '\n';
        }
    }

    if (currentPage.trim()) {
        pages.push(currentPage.trim());
    }

    return pages.length > 0 ? pages : [text.substring(0, maxLength)];
}