const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { emojis, colors } = require('../../utils/constants');

module.exports = {
    name: 'queue',
    aliases: ['q', 'list'],
    description: 'View the music queue (キュー)',
    usage: 'a!queue [page]',
    category: 'music',
    requireQueue: true,

    async execute(message, args, client) {
        const queue = client.queue.get(message.guild.id);
        
        // Check if queue exists
        if (!queue || (!queue.current && queue.tracks.length === 0)) {
            const emptyEmbed = new EmbedBuilder()
                .setColor(colors.warning)
                .setDescription(`${emojis.warning} The queue is empty! Use \`a!play\` to add songs.\n(キューは空です!)`);
            return message.reply({ embeds: [emptyEmbed] });
        }

        const tracksPerPage = 10;
        const totalTracks = queue.tracks.length;
        const totalPages = Math.ceil(totalTracks / tracksPerPage) || 1;
        
        // Parse and validate page number
        let page = parseInt(args[0]) || 1;
        if (page > totalPages) page = totalPages;
        if (page < 1) page = 1;

        // Helper function to get platform emoji
        const getPlatformEmoji = (url) => {
            if (!url) return emojis.music;
            if (url.includes('spotify.com')) return emojis.spotify || '🟢';
            if (url.includes('soundcloud.com')) return emojis.soundcloud || '🟠';
            if (url.includes('deezer.com')) return emojis.deezer || '💜';
            if (url.includes('music.apple.com')) return emojis.applemusic || '🍎';
            if (url.includes('bandcamp.com')) return emojis.bandcamp || '🎵';
            return emojis.link || '🎵';
        };

        // Helper function to get loop display
        const getLoopDisplay = (loopMode) => {
            switch (loopMode) {
                case 'track':
                    return `\`Track\` ${emojis.loop_one || '🔂'}`;
                case 'queue':
                    return `\`Queue\` ${emojis.loop || '🔁'}`;
                default:
                    return `\`Disabled\``;
            }
        };

        // Helper function to truncate text
        const truncate = (text, length) => {
            if (!text) return 'Unknown';
            return text.length > length ? text.substring(0, length - 3) + '...' : text;
        };

        // Generate embed function
        const generateQueueEmbed = (currentPage) => {
            const start = (currentPage - 1) * tracksPerPage;
            const end = start + tracksPerPage;
            const tracks = queue.tracks.slice(start, end);

            let description = '';

            // Now Playing Section
            if (queue.current) {
                const current = queue.current;
                const platformEmoji = getPlatformEmoji(current.info.uri);
                
                description += `**${emojis.disc} Now Playing:**\n`;
                description += `${platformEmoji} [${truncate(current.info.title, 50)}](${current.info.uri}) - \`${formatDuration(current.info.length)}\`\n`;
                description += `${emojis.arrow_right} Requested by: <@${current.info.requester?.id || 'Unknown'}>\n\n`;
            }

            // Queue Section
            if (tracks.length > 0) {
                description += `**${emojis.queue} Queue:**\n`;
                tracks.forEach((track, index) => {
                    const position = start + index + 1;
                    const platformEmoji = getPlatformEmoji(track.info.uri);
                    description += `\`${position}.\` ${platformEmoji} [${truncate(track.info.title, 45)}](${track.info.uri}) - \`${formatDuration(track.info.length)}\`\n`;
                });
            } else if (currentPage === 1 && !queue.current) {
                description += `${emojis.info} No tracks in queue.\n`;
            }

            // Calculate total duration
            const totalDuration = queue.tracks.reduce((acc, track) => acc + (track.info.length || 0), 0) + 
                                 (queue.current?.info.length || 0);

            // Build embed
            const embed = new EmbedBuilder()
                .setColor(colors.queue)
                .setAuthor({
                    name: `Queue for ${message.guild.name}'s server`,
                    iconURL: message.guild.iconURL({ dynamic: true }),
                })
                .setDescription(description)
                .addFields(
                    { 
                        name: `${emojis.music} Total Tracks`, 
                        value: `\`${totalTracks + (queue.current ? 1 : 0)}\``, 
                        inline: true 
                    },
                    { 
                        name: `${emojis.clock} Total Duration`, 
                        value: `\`${formatDuration(totalDuration)}\``, 
                        inline: true 
                    },
                    { 
                        name: `${emojis.loop} Loop Mode`, 
                        value: getLoopDisplay(queue.loop), 
                        inline: true 
                    }
                )
                .setFooter({ 
                    text: `Page ${currentPage}/${totalPages} • Aori v${client.version}`,
                    iconURL: client.user.displayAvatarURL()
                })
                .setTimestamp();

            // Add thumbnail if current track has one
            if (queue.current?.info.artworkUrl || queue.current?.info.thumbnail) {
                embed.setThumbnail(queue.current.info.artworkUrl || queue.current.info.thumbnail);
            }

            return embed;
        };

        // Generate buttons function
        const generateButtons = (currentPage, maxPages) => {
            return new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('queue_first')
                        .setEmoji('⏮️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage === 1),
                    new ButtonBuilder()
                        .setCustomId('queue_prev')
                        .setEmoji('◀️')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(currentPage === 1),
                    new ButtonBuilder()
                        .setCustomId('queue_page')
                        .setLabel(`${currentPage}/${maxPages}`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('queue_next')
                        .setEmoji('▶️')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(currentPage === maxPages),
                    new ButtonBuilder()
                        .setCustomId('queue_last')
                        .setEmoji('⏭️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage === maxPages)
                );
        };

        // Send initial message
        const msg = await message.reply({ 
            embeds: [generateQueueEmbed(page)], 
            components: totalPages > 1 ? [generateButtons(page, totalPages)] : [] 
        });

        // If only one page, no need for collector
        if (totalPages <= 1) return;

        // Create button collector
        const collector = msg.createMessageComponentCollector({
            filter: (i) => i.user.id === message.author.id,
            time: 120000, // 2 minutes
        });

        collector.on('collect', async (interaction) => {
            // Update page based on button clicked
            switch (interaction.customId) {
                case 'queue_first':
                    page = 1;
                    break;
                case 'queue_prev':
                    page = Math.max(1, page - 1);
                    break;
                case 'queue_next':
                    page = Math.min(totalPages, page + 1);
                    break;
                case 'queue_last':
                    page = totalPages;
                    break;
            }

            await interaction.update({
                embeds: [generateQueueEmbed(page)],
                components: [generateButtons(page, totalPages)]
            });
        });

        collector.on('end', async () => {
            // Disable all buttons when collector ends
            const disabledRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('queue_first')
                        .setEmoji('⏮️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('queue_prev')
                        .setEmoji('◀️')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('queue_page')
                        .setLabel(`${page}/${totalPages}`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('queue_next')
                        .setEmoji('▶️')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('queue_last')
                        .setEmoji('⏭️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                );

            await msg.edit({ components: [disabledRow] }).catch(() => {});
        });
    }
};

// Format duration helper function - UPDATED
function formatDuration(ms) {
    if (!ms || isNaN(ms)) return '00:00';
    
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));

    if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}