const { EmbedBuilder } = require('discord.js');
const Queue = require('../../structures/Queue');
const PlatformSearcher = require('../../utils/searchPlatforms');
const { emojis, colors } = require('../../utils/constants');

module.exports = {
    name: 'play',
    aliases: ['p', 'pl'],
    description: 'Play a song from multiple platforms (再生)',
    usage: 'a!play <song name or URL>',
    category: 'music',
    voiceChannel: true,

    async execute(message, args, client) {
        if (!args.length) {
            const embed = new EmbedBuilder()
                .setColor(colors.error)
                .setDescription(`${emojis.error || '❌'} Please provide a song name or URL!\n(曲名またはURLを入力してください!)`)
                .setFooter({ 
                    text: `Aori v${client.version} ♪ あおり`,
                    iconURL: client.user.displayAvatarURL()
                });

            return message.reply({ embeds: [embed] });
        }

        const query = args.join(' ');
        let queue = client.queue.get(message.guild.id);

        // Search for tracks FIRST
        const searcher = new PlatformSearcher(client);
        let result;

        try {
            result = await searcher.search(query, message);

            if (!result.success) {
                const embed = new EmbedBuilder()
                    .setColor(colors.error)
                    .setDescription(`${emojis.error || '❌'} ${result.error}`)
                    .setFooter({ 
                        text: `Aori v${client.version} ♪ あおり`,
                        iconURL: client.user.displayAvatarURL()
                    });

                return message.reply({ embeds: [embed] });
            }
        } catch (error) {
            console.error('[Aori] Search error:', error);
            
            const embed = new EmbedBuilder()
                .setColor(colors.error)
                .setDescription(`${emojis.error || '❌'} An error occurred while searching!\n(検索中にエラーが発生しました!)`)
                .setFooter({ 
                    text: `Aori v${client.version} ♪ あおり`,
                    iconURL: client.user.displayAvatarURL()
                });

            return message.reply({ embeds: [embed] });
        }

        // Create queue if doesn't exist
        if (!queue) {
            try {
                const player = await client.shoukaku.joinVoiceChannel({
                    guildId: message.guild.id,
                    channelId: message.member.voice.channel.id,
                    shardId: 0,
                    deaf: true,
                });

                queue = new Queue(
                    client,
                    message.guild,
                    message.channel,
                    message.member.voice.channel,
                    player
                );

                client.queue.set(message.guild.id, queue);

            } catch (error) {
                console.error('[Aori] Connection error:', error);
                
                const embed = new EmbedBuilder()
                    .setColor(colors.error)
                    .setDescription(`${emojis.error || '❌'} Failed to connect to voice channel!\n(ボイスチャンネルへの接続に失敗しました!)`)
                    .setFooter({ 
                        text: `Aori v${client.version} ♪ あおり`,
                        iconURL: client.user.displayAvatarURL()
                    });

                return message.reply({ embeds: [embed] });
            }
        }

        try {
            // Filter valid tracks and add requester info
            const tracks = result.tracks
                .filter(track => track && track.info)
                .map(track => {
                    if (track.info) {
                        track.info.requester = message.author;
                    }
                    return track;
                });

            if (tracks.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor(colors.error)
                    .setDescription(`${emojis.error || '❌'} No valid tracks found!\n(有効なトラックが見つかりませんでした!)`)
                    .setFooter({ 
                        text: `Aori v${client.version} ♪ あおり`,
                        iconURL: client.user.displayAvatarURL()
                    });

                if (!queue.current && queue.tracks.length === 0) {
                    queue.destroy();
                }

                return message.reply({ embeds: [embed] });
            }

            const platformEmoji = getPlatformEmoji(result.platform?.name || tracks[0]?.info?.sourceName);
            const platformColor = getPlatformColor(result.platform?.name || tracks[0]?.info?.sourceName);
            const platformName = getPlatformName(result.platform?.name || tracks[0]?.info?.sourceName);
            const isAlreadyPlaying = queue.playing && queue.current;

            // Check if it's a playlist/album
            if (result.playlist && tracks.length > 1) {
                queue.tracks.push(...tracks);

                const playlistName = result.playlist.info?.name || result.playlist.name || 'Playlist';
                const totalDuration = tracks.reduce((acc, t) => acc + (t.info?.length || 0), 0);

                const embed = new EmbedBuilder()
                    .setColor(platformColor)
                    .setAuthor({
                        name: '♪ Playlist Added プレイリスト追加',
                        iconURL: message.author.displayAvatarURL(),
                    })
                    .setDescription(`${emojis.link || '🔗'} **[${playlistName}](${result.playlist.info?.url || tracks[0]?.info?.uri || ''})**`)
                    .addFields(
                        { 
                            name: `${emojis.queue || '📜'} Tracks`, 
                            value: `${tracks.length}`, 
                            inline: true 
                        },
                        { 
                            name: `${emojis.clock || '⏰'} Duration`, 
                            value: formatDuration(totalDuration), 
                            inline: true 
                        },
                        { 
                            name: `${platformEmoji} Platform`, 
                            value: platformName, 
                            inline: true 
                        }
                    )
                    .setThumbnail(result.playlist.info?.artworkUrl || tracks[0]?.info?.artworkUrl || client.user.displayAvatarURL())
                    .setFooter({ 
                        text: `Aori v${client.version} ♪ あおり`,
                        iconURL: client.user.displayAvatarURL()
                    })
                    .setTimestamp();

                await message.channel.send({ embeds: [embed] });

            } else {
                // Single track
                const track = tracks[0];
                queue.tracks.push(track);

                // Only show "Added to queue" if something is already playing
                if (isAlreadyPlaying) {
                    const embed = new EmbedBuilder()
                        .setColor(platformColor)
                        .setAuthor({
                            name: '♪ Added to Queue キューに追加',
                            iconURL: message.author.displayAvatarURL(),
                        })
                        .setDescription(`${platformEmoji} **[${track.info.title}](${track.info.uri || ''})**`)
                        .addFields(
                            { 
                                name: `${emojis.user || '👤'} Artist`, 
                                value: track.info.author || 'Unknown', 
                                inline: true 
                            },
                            { 
                                name: `${emojis.clock || '⏱️'} Duration`, 
                                value: formatDuration(track.info.length), 
                                inline: true 
                            },
                            { 
                                name: `${emojis.queue || '📜'} Position`, 
                                value: `#${queue.tracks.length}`, 
                                inline: true 
                            }
                        )
                        .setThumbnail(track.info.artworkUrl || client.user.displayAvatarURL())
                        .setFooter({ 
                            text: `Aori v${client.version} ♪ あおり`,
                            iconURL: client.user.displayAvatarURL()
                        })
                        .setTimestamp();

                    await message.channel.send({ embeds: [embed] });
                }
            }

            // Start playing if not already
            if (!queue.playing) {
                await queue.play();
            }

        } catch (error) {
            console.error('[Aori] Play command error:', error);

            if (queue && !queue.current && queue.tracks.length === 0) {
                queue.destroy();
            }

            const embed = new EmbedBuilder()
                .setColor(colors.error)
                .setDescription(`${emojis.error || '❌'} An error occurred while playing!\n(再生中にエラーが発生しました!)`)
                .setFooter({ 
                    text: `Aori v${client.version} ♪ あおり`,
                    iconURL: client.user.displayAvatarURL()
                });

            return message.reply({ embeds: [embed] });
        }
    }
};

// Helper Functions
function getPlatformEmoji(platform) {
    const name = (platform || '').toLowerCase();
    if (name.includes('spotify')) return emojis.spotify || '🟢';
    if (name.includes('soundcloud')) return emojis.soundcloud || '🟧';
    if (name.includes('deezer')) return emojis.deezer || '🟠';
    if (name.includes('apple')) return emojis.applemusic || '🍎';
    if (name.includes('bandcamp')) return emojis.bandcamp || '🔵';
    return emojis.link || '🔗';
}

function getPlatformColor(platform) {
    const name = (platform || '').toLowerCase();
    if (name.includes('spotify')) return colors.spotify;
    if (name.includes('soundcloud')) return colors.soundcloud;
    if (name.includes('deezer')) return colors.deezer;
    if (name.includes('apple')) return colors.applemusic;
    if (name.includes('bandcamp')) return colors.bandcamp;
    return colors.dark || 0x2F3136;
}

function getPlatformName(platform) {
    const name = (platform || '').toLowerCase();
    if (name.includes('spotify')) return 'Spotify';
    if (name.includes('soundcloud')) return 'SoundCloud';
    if (name.includes('deezer')) return 'Deezer';
    if (name.includes('apple')) return 'Apple Music';
    if (name.includes('bandcamp')) return 'Bandcamp';
    return 'Source';
}

function formatDuration(ms) {
    if (!ms || isNaN(ms)) return '0:00';
    
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
