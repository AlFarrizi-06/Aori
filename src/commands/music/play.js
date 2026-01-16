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
                .setDescription(`${emojis.error} Please provide a song name or URL!\n(曲名またはURLを入力してください!)`)
                .setFooter({ 
                    text: `Aori v${client.version} ♪ あおり`,
                    iconURL: client.user.displayAvatarURL()
                });

            return message.reply({ embeds: [embed] });
        }

        const query = args.join(' ');
        let queue = client.queue.get(message.guild.id);
        const searcher = new PlatformSearcher(client);

        // ═══════════════════════════════════════════════════════════
        // ⭐ PHASE 1: SEARCHING (handled by PlatformSearcher)
        // ═══════════════════════════════════════════════════════════
        
        let result;

        try {
            result = await searcher.search(query, message);
            const loadingMessage = result.loadingMessage;

            if (!result.success) {
                const errorEmbed = new EmbedBuilder()
                    .setColor(colors.error)
                    .setAuthor({
                        name: '♪ Search Failed | 検索失敗',
                        iconURL: client.user.displayAvatarURL(),
                    })
                    .setDescription([
                        `${emojis.error} **Gomen ne~** ごめんね`,
                        ``,
                        `${result.error}`,
                        ``,
                        `${emojis.info} *Try a different search term~*`,
                        `別の検索ワードを試してください！`
                    ].join('\n'))
                    .setFooter({ 
                        text: `Aori v${client.version} ♪ あおり`,
                        iconURL: client.user.displayAvatarURL()
                    })
                    .setTimestamp();

                if (loadingMessage) {
                    return loadingMessage.edit({ embeds: [errorEmbed] });
                }
                return message.reply({ embeds: [errorEmbed] });
            }

            // ═══════════════════════════════════════════════════════════
            // ⭐ PHASE 2: CONNECTING TO VOICE CHANNEL
            // ═══════════════════════════════════════════════════════════

            const platform = result.platform;
            const voiceChannel = message.member.voice.channel;

            // Update loading message to show connecting
            await searcher.updateToConnecting(loadingMessage, platform, voiceChannel);

            // Set long connecting timeout
            let longConnectTimeout = setTimeout(async () => {
                await searcher.updateToLongConnecting(loadingMessage, platform, voiceChannel);
            }, 5000);

            // Create queue if doesn't exist
            if (!queue) {
                try {
                    const existingPlayer = client.shoukaku.players.get(message.guild.id);
                    if (existingPlayer) {
                        console.log('[Aori] Found orphaned player, cleaning up...');
                        try {
                            await client.shoukaku.leaveVoiceChannel(message.guild.id);
                        } catch (e) {
                            console.log('[Aori] Cleanup error (ignored):', e.message);
                        }
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }

                    const player = await client.shoukaku.joinVoiceChannel({
                        guildId: message.guild.id,
                        channelId: voiceChannel.id,
                        shardId: 0,
                        deaf: true,
                    });

                    queue = new Queue(
                        client,
                        message.guild,
                        message.channel,
                        voiceChannel,
                        player
                    );

                    client.queue.set(message.guild.id, queue);
                    clearTimeout(longConnectTimeout);
                    console.log('[Aori] New queue created');

                } catch (error) {
                    clearTimeout(longConnectTimeout);
                    console.error('[Aori] Connection error:', error);
                    
                    if (error.message?.includes('existing connection')) {
                        try {
                            console.log('[Aori] Retrying after cleanup...');
                            
                            const existingPlayer = client.shoukaku.players.get(message.guild.id);
                            if (existingPlayer) {
                                try {
                                    existingPlayer.connection?.disconnect();
                                } catch (e) {}
                            }
                            
                            await client.shoukaku.leaveVoiceChannel(message.guild.id);
                            client.queue.delete(message.guild.id);
                            
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            
                            const player = await client.shoukaku.joinVoiceChannel({
                                guildId: message.guild.id,
                                channelId: voiceChannel.id,
                                shardId: 0,
                                deaf: true,
                            });

                            queue = new Queue(
                                client,
                                message.guild,
                                message.channel,
                                voiceChannel,
                                player
                            );

                            client.queue.set(message.guild.id, queue);
                            console.log('[Aori] Reconnection successful');
                            
                        } catch (retryError) {
                            console.error('[Aori] Retry failed:', retryError);
                            
                            const errorEmbed = new EmbedBuilder()
                                .setColor(colors.error)
                                .setAuthor({
                                    name: '♪ Connection Failed | 接続失敗',
                                    iconURL: client.user.displayAvatarURL(),
                                })
                                .setDescription([
                                    `${emojis.error} **Gomen nasai~** ごめんなさい`,
                                    ``,
                                    `Connection error! Please try again in a few seconds~`,
                                    `接続エラー！数秒後に再試行してください！`,
                                    ``,
                                    `${emojis.info} *The voice channel might be busy~*`
                                ].join('\n'))
                                .setFooter({ 
                                    text: `Aori v${client.version} ♪ あおり`,
                                    iconURL: client.user.displayAvatarURL()
                                })
                                .setTimestamp();

                            if (loadingMessage) {
                                return loadingMessage.edit({ embeds: [errorEmbed] });
                            }
                            return message.reply({ embeds: [errorEmbed] });
                        }
                    } else {
                        const errorEmbed = new EmbedBuilder()
                            .setColor(colors.error)
                            .setAuthor({
                                name: '♪ Connection Failed | 接続失敗',
                                iconURL: client.user.displayAvatarURL(),
                            })
                            .setDescription([
                                `${emojis.error} **Dame desu~** ダメです`,
                                ``,
                                `Could not join **${voiceChannel.name}**!`,
                                `ボイスチャンネルへの接続に失敗しました！`,
                                ``,
                                `${emojis.info} *Make sure I have permission, senpai~*`
                            ].join('\n'))
                            .setFooter({ 
                                text: `Aori v${client.version} ♪ あおり`,
                                iconURL: client.user.displayAvatarURL()
                            })
                            .setTimestamp();

                        if (loadingMessage) {
                            return loadingMessage.edit({ embeds: [errorEmbed] });
                        }
                        return message.reply({ embeds: [errorEmbed] });
                    }
                }
            } else {
                clearTimeout(longConnectTimeout);
                
                // Existing queue - check voice channel
                if (queue.voiceChannel.id !== voiceChannel.id) {
                    const errorEmbed = new EmbedBuilder()
                        .setColor(colors.error)
                        .setAuthor({
                            name: '♪ Wrong Channel | チャンネル違い',
                            iconURL: client.user.displayAvatarURL(),
                        })
                        .setDescription([
                            `${emojis.error} **Kocchi da yo~!** こっちだよ！`,
                            ``,
                            `I'm already playing in **${queue.voiceChannel.name}**!`,
                            `すでに別のチャンネルで再生中です！`,
                            ``,
                            `${emojis.info} *Join my channel to add songs~*`
                        ].join('\n'))
                        .setFooter({ 
                            text: `Aori v${client.version} ♪ あおり`,
                            iconURL: client.user.displayAvatarURL()
                        })
                        .setTimestamp();

                    if (loadingMessage) {
                        return loadingMessage.edit({ embeds: [errorEmbed] });
                    }
                    return message.reply({ embeds: [errorEmbed] });
                }
                
                if (queue.textChannel.id !== message.channel.id) {
                    queue.textChannel = message.channel;
                }
                
                console.log('[Aori] Using existing queue');
            }

            // ═══════════════════════════════════════════════════════════
            // ⭐ PHASE 3: ADDING TO QUEUE
            // ═══════════════════════════════════════════════════════════

            const tracks = result.tracks
                .filter(track => track && track.info)
                .map(track => {
                    if (track.info) {
                        track.info.requester = message.author;
                    }
                    return track;
                });

            if (tracks.length === 0) {
                const errorEmbed = new EmbedBuilder()
                    .setColor(colors.error)
                    .setAuthor({
                        name: '♪ No Tracks | トラックなし',
                        iconURL: client.user.displayAvatarURL(),
                    })
                    .setDescription([
                        `${emojis.error} **Nani mo nai~** 何もない`,
                        ``,
                        `The search returned no playable tracks!`,
                        `有効なトラックが見つかりませんでした！`
                    ].join('\n'))
                    .setFooter({ 
                        text: `Aori v${client.version} ♪ あおり`,
                        iconURL: client.user.displayAvatarURL()
                    })
                    .setTimestamp();

                if (!queue.current && queue.tracks.length === 0) {
                    queue.leavingVoluntarily = true;
                    queue.destroy();
                }

                if (loadingMessage) {
                    return loadingMessage.edit({ embeds: [errorEmbed] });
                }
                return message.reply({ embeds: [errorEmbed] });
            }

            const platformColor = platform?.color || colors.primary;
            const platformEmoji = platform?.emoji || emojis.music;
            const platformName = platform?.name || 'Source';
            const isAlreadyPlaying = queue.playing && queue.current;

            // Check if it's a playlist/album
            if (result.playlist && tracks.length > 1) {
                // Update for playlist adding
                await searcher.updateToAdding(loadingMessage, platform, tracks.length);

                // Set timeout for long playlist adding
                const longAddTimeout = setTimeout(async () => {
                    await searcher.updateToLongAdding(loadingMessage, platform, tracks.length);
                }, 3000);

                queue.tracks.push(...tracks);
                clearTimeout(longAddTimeout);

                const playlistName = result.playlist.info?.name || result.playlist.name || 'Playlist';
                const totalDuration = tracks.reduce((acc, t) => acc + (t.info?.length || 0), 0);

                const successEmbed = new EmbedBuilder()
                    .setColor(platformColor)
                    .setAuthor({
                        name: '♪ Playlist Added! | プレイリスト追加！',
                        iconURL: message.author.displayAvatarURL(),
                    })
                    .setDescription([
                        `${emojis.success} **Yatta~!** やった！ ${emojis.sparkle}`,
                        ``,
                        `${emojis.link} **[${playlistName}](${result.playlist.info?.url || tracks[0]?.info?.uri || ''})**`
                    ].join('\n'))
                    .addFields(
                        { 
                            name: `${emojis.queue} Tracks`, 
                            value: `\`${tracks.length}\``, 
                            inline: true 
                        },
                        { 
                            name: `${emojis.clock} Duration`, 
                            value: `\`${formatDuration(totalDuration)}\``, 
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
                        text: `Aori v${client.version} ♪ Tanoshinde ne~ 楽しんでね！`,
                        iconURL: client.user.displayAvatarURL()
                    })
                    .setTimestamp();

                if (loadingMessage) {
                    await loadingMessage.edit({ embeds: [successEmbed] });
                }

            } else {
                // Single track
                const track = tracks[0];
                queue.tracks.push(track);

                if (isAlreadyPlaying) {
                    const queuedEmbed = new EmbedBuilder()
                        .setColor(platformColor)
                        .setAuthor({
                            name: '♪ Added to Queue! | キューに追加！',
                            iconURL: message.author.displayAvatarURL(),
                        })
                        .setDescription([
                            `${emojis.success} **Ryoukai~!** 了解！ ${emojis.sparkle}`,
                            ``,
                            `${platformEmoji} **[${track.info.title}](${track.info.uri || ''})**`
                        ].join('\n'))
                        .addFields(
                            { 
                                name: `${emojis.user} Artist`, 
                                value: track.info.author || 'Unknown', 
                                inline: true 
                            },
                            { 
                                name: `${emojis.clock} Duration`, 
                                value: `\`${formatDuration(track.info.length)}\``, 
                                inline: true 
                            },
                            { 
                                name: `${emojis.queue} Position`, 
                                value: `#${queue.tracks.length}`, 
                                inline: true 
                            }
                        )
                        .setThumbnail(track.info.artworkUrl || client.user.displayAvatarURL())
                        .setFooter({ 
                            text: `Aori v${client.version} ♪ ${platformName}`,
                            iconURL: client.user.displayAvatarURL()
                        })
                        .setTimestamp();

                    if (loadingMessage) {
                        await loadingMessage.edit({ embeds: [queuedEmbed] });
                    }
                } else {
                    // First song - show starting then delete
                    const startingEmbed = new EmbedBuilder()
                        .setColor(platformColor)
                        .setDescription(
                            `${emojis.success} Yosh~! ${platformEmoji} **${platformName}** ` +
                            `${emojis.arrow_right} ${emojis.loading} Hajimeru yo~! 始めるよ...`
                        );

                    if (loadingMessage) {
                        await loadingMessage.edit({ embeds: [startingEmbed] });
                        
                        // Delete after short delay (Now Playing will appear from Queue.js)
                        setTimeout(() => {
                            loadingMessage.delete().catch(() => {});
                        }, 1500);
                    }
                }
            }

            // Start playing if not already
            if (!queue.playing) {
                await queue.play();
            }

        } catch (error) {
            console.error('[Aori] Play command error:', error);

            if (queue && !queue.current && queue.tracks.length === 0) {
                queue.leavingVoluntarily = true;
                queue.destroy();
            }

            const errorEmbed = new EmbedBuilder()
                .setColor(colors.error)
                .setAuthor({
                    name: '♪ Playback Error | 再生エラー',
                    iconURL: client.user.displayAvatarURL(),
                })
                .setDescription([
                    `${emojis.error} **Yabai~!** やばい！`,
                    ``,
                    `An error occurred while playing!`,
                    `再生中にエラーが発生しました！`,
                    ``,
                    `${emojis.info} *Please try again~* もう一度お試しください`
                ].join('\n'))
                .setFooter({ 
                    text: `Aori v${client.version} ♪ あおり`,
                    iconURL: client.user.displayAvatarURL()
                })
                .setTimestamp();

            return message.reply({ embeds: [errorEmbed] });
        }
    }
};

// ═══════════════════════════════════════════════════════════
// HELPER FUNCTION
// ═══════════════════════════════════════════════════════════

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