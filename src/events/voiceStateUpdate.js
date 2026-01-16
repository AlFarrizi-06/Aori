const { EmbedBuilder } = require('discord.js');
const { colors } = require('../utils/constants');

module.exports = {
    name: 'voiceStateUpdate',
    once: false,

    async execute(oldState, newState, client) {
        const guildId = oldState.guild.id || newState.guild.id;
        const queue = client.queue.get(guildId);
        
        if (!queue) return;

        const botId = client.user.id;
        const botVoiceChannel = oldState.guild.members.me?.voice?.channel;

        // ═══════════════════════════════════════════════════════════
        // 🔴 Case 1: Bot was forcefully disconnected/kicked from VC
        // ═══════════════════════════════════════════════════════════
        if (oldState.member?.id === botId && oldState.channelId && !newState.channelId) {
            console.log('[Aori] 🔌 Bot was disconnected from voice channel');
            
            // Check if bot left voluntarily (timeout/command) or was kicked
            const leftVoluntarily = queue.leavingVoluntarily || false;
            
            if (queue.leaveTimeout) {
                clearTimeout(queue.leaveTimeout);
                queue.leaveTimeout = null;
            }

            if (queue.emptyChannelTimeout) {
                clearTimeout(queue.emptyChannelTimeout);
                queue.emptyChannelTimeout = null;
            }

            const textChannel = queue.textChannel;

            // Only show disconnect message if bot was kicked/disconnected forcefully
            if (textChannel && !leftVoluntarily) {
                const disconnectEmbed = new EmbedBuilder()
                    .setColor(colors.error || '#FF6B6B')
                    .setAuthor({
                        name: '📡 Disconnected | 切断されました',
                        iconURL: client.user.displayAvatarURL(),
                    })
                    .setDescription([
                        `I was disconnected or kicked from the voice channel!`,
                        `ボイスチャンネルから切断またはキックされました！`
                    ].join('\n'))
                    .setFooter({
                        text: `Aori v${client.version} ♪ Sayonara~`,
                        iconURL: client.user.displayAvatarURL(),
                    })
                    .setTimestamp();

                try {
                    await textChannel.send({ embeds: [disconnectEmbed] });
                } catch (error) {
                    console.error('[Aori] Failed to send disconnect message:', error.message);
                }
            }

            queue.tracks = [];
            queue.current = null;
            queue.playing = false;
            queue.deleteNowPlayingMessage();
            await queue.clearVoiceStatus();
            client.queue.delete(guildId);
            client.updatePresence(null);
            
            return;
        }

        // ═══════════════════════════════════════════════════════════
        // 🔇 Case 2: Bot is alone in voice channel
        // ═══════════════════════════════════════════════════════════
        if (!botVoiceChannel) return;

        const membersInChannel = botVoiceChannel.members.filter(member => !member.user.bot);

        if (membersInChannel.size === 0) {
            if (queue.is247) {
                console.log('[Aori] 🌙 24/7 mode enabled, staying in channel');
                return;
            }

            console.log('[Aori] 😢 Bot is alone in voice channel');

            const wasPlaying = queue.playing && !queue.paused;
            if (wasPlaying && queue.player) {
                try {
                    await queue.player.setPaused(true);
                    queue.paused = true;
                    queue.pausedByEmpty = true;
                    console.log('[Aori] ⏸️ Music paused (channel empty)');
                } catch (error) {
                    console.error('[Aori] Failed to pause:', error.message);
                }
            }

            const textChannel = queue.textChannel;

            if (textChannel) {
                const pausedEmbed = new EmbedBuilder()
                    .setColor(colors.warning || '#FFA500')
                    .setAuthor({
                        name: '⏸️ Music Paused | 一時停止',
                        iconURL: client.user.displayAvatarURL(),
                    })
                    .setDescription([
                        `Everyone left the voice channel...`,
                        `全員がボイスチャンネルから退出しました...`,
                        ``,
                        `> *I'll leave in 2 minutes if no one comes back.*`,
                        `> *2分以内に誰も戻らなければ退出します。*`
                    ].join('\n'))
                    .setFooter({
                        text: `Aori v${client.version} ♪ Waiting...`,
                        iconURL: client.user.displayAvatarURL(),
                    })
                    .setTimestamp();

                try {
                    const warningMessage = await textChannel.send({ embeds: [pausedEmbed] });
                    queue.emptyChannelWarningMessage = warningMessage;
                } catch (error) {
                    console.error('[Aori] Failed to send paused message:', error.message);
                }
            }

            await queue.updateVoiceStatus();

            // Set 2 minute timeout to leave
            queue.emptyChannelTimeout = setTimeout(async () => {
                const currentQueue = client.queue.get(guildId);
                if (!currentQueue) return;

                const currentChannel = oldState.guild.members.me?.voice?.channel;
                if (!currentChannel) return;

                const currentMembers = currentChannel.members.filter(m => !m.user.bot);

                if (currentMembers.size === 0 && !currentQueue.is247) {
                    console.log('[Aori] ⏰ 2 minutes passed, leaving voice channel...');
                    
                    const textCh = currentQueue.textChannel;

                    if (currentQueue.emptyChannelWarningMessage) {
                        try {
                            await currentQueue.emptyChannelWarningMessage.delete();
                        } catch (e) {}
                        currentQueue.emptyChannelWarningMessage = null;
                    }

                    if (textCh) {
                        const leaveEmbed = new EmbedBuilder()
                            .setColor(colors.error || '#FF0000')
                            .setAuthor({
                                name: '👋 Left Voice Channel | ボイスチャンネル退出',
                                iconURL: client.user.displayAvatarURL(),
                            })
                            .setDescription([
                                `I left because no one came back for 2 minutes.`,
                                `2分間誰も戻ってこなかったので退出しました。`
                            ].join('\n'))
                            .setFooter({
                                text: `Aori v${client.version} ♪ Sayonara~`,
                                iconURL: client.user.displayAvatarURL(),
                            })
                            .setTimestamp();

                        try {
                            await textCh.send({ embeds: [leaveEmbed] });
                        } catch (error) {
                            console.error('[Aori] Failed to send leave message:', error.message);
                        }
                    }

                    // Set flag before destroying to prevent disconnect message
                    currentQueue.leavingVoluntarily = true;
                    await currentQueue.destroy();
                }
            }, 2 * 60 * 1000);

            return;
        }

        // ═══════════════════════════════════════════════════════════
        // 🟢 Case 3: Someone joined - resume music
        // ═══════════════════════════════════════════════════════════
        if (newState.channelId === botVoiceChannel.id && !newState.member.user.bot) {
            console.log(`[Aori] 👤 ${newState.member.user.tag} joined the voice channel`);

            if (queue.emptyChannelTimeout) {
                clearTimeout(queue.emptyChannelTimeout);
                queue.emptyChannelTimeout = null;
            }

            if (queue.emptyChannelWarningMessage) {
                try {
                    await queue.emptyChannelWarningMessage.delete();
                } catch (e) {}
                queue.emptyChannelWarningMessage = null;
            }

            if (queue.pausedByEmpty && queue.player && queue.current) {
                try {
                    await queue.player.setPaused(false);
                    queue.paused = false;
                    queue.pausedByEmpty = false;
                    console.log('[Aori] ▶️ Music resumed (user joined)');

                    const textChannel = queue.textChannel;
                    if (textChannel) {
                        const resumeEmbed = new EmbedBuilder()
                            .setColor(colors.success || '#00FF7F')
                            .setAuthor({
                                name: '▶️ Resumed | 再開しました',
                                iconURL: client.user.displayAvatarURL(),
                            })
                            .setDescription([
                                `Welcome back! Music has been resumed~`,
                                `おかえりなさい！音楽を再開しました~`
                            ].join('\n'))
                            .setFooter({
                                text: `Aori v${client.version} ♪ Enjoy!`,
                                iconURL: client.user.displayAvatarURL(),
                            })
                            .setTimestamp();

                        try {
                            const resumeMessage = await textChannel.send({ embeds: [resumeEmbed] });
                            
                            // Auto-delete after 10 seconds
                            setTimeout(async () => {
                                try {
                                    await resumeMessage.delete();
                                } catch (e) {
                                    // Message might already be deleted
                                }
                            }, 10 * 1000);
                            
                        } catch (error) {
                            console.error('[Aori] Failed to send resume message:', error.message);
                        }
                    }

                    await queue.updateVoiceStatus();

                } catch (error) {
                    console.error('[Aori] Failed to resume:', error.message);
                }
            }
        }
    }
};