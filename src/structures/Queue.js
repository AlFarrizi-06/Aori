const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, REST } = require('discord.js');
const { emojis, colors } = require('../utils/constants');

class Queue {
    constructor(client, guild, textChannel, voiceChannel, player) {
        this.client = client;
        this.guild = guild;
        this.textChannel = textChannel;
        this.voiceChannel = voiceChannel;
        this.player = player;
        
        // Track management
        this.tracks = [];
        this.current = null;
        this.previous = null;
        
        // Player state
        this.volume = client.config.defaultVolume;
        this.loop = 'none'; // none, track, queue
        this.autoplay = false;
        this.paused = false;
        this.playing = false;
        this.is247 = false;
        
        // Retry management
        this.retryCount = 0;
        this.maxRetries = 3;
        
        // Message management
        this.nowPlayingMessage = null;
        this.buttonCollector = null;
        this.emptyChannelWarningMessage = null;
        
        // Timeout management
        this.leaveTimeout = null;
        this.leaveTimeoutDuration = 120000; // 2 minutes in ms
        this.emptyChannelTimeout = null;
        this.pausedByEmpty = false;
        
        // ⭐ Flag untuk voluntary leave
        this.leavingVoluntarily = false;
        
        // Audio filters
        this.filters = {
            bassboost: false,
            nightcore: false,
            vaporwave: false,
            karaoke: false,
            tremolo: false,
            vibrato: false,
            rotation: false,
            distortion: false,
            channelMix: false,
            lowPass: false,
            timescale: null,
            '8d': false,
        };

        this.setupPlayerEvents();
    }

    // ═══════════════════════════════════════════════════════════
    // PLAYER EVENTS
    // ═══════════════════════════════════════════════════════════

    setupPlayerEvents() {
        // Track started playing
        this.player.on('start', () => {
            console.log(`[Aori] ▶️ Track started: ${this.current?.info?.title}`);
            this.playing = true;
            this.paused = false;
            this.pausedByEmpty = false;
            this.retryCount = 0;
            this.leavingVoluntarily = false;
            
            this.clearLeaveTimeout();
            this.clearEmptyChannelTimeout();
            
            this.sendNowPlaying();
            this.updateVoiceStatus();
            this.client.updatePresence(this.current);
        });

        // Track ended
        this.player.on('end', async (data) => {
            const reason = data?.reason || 'unknown';
            console.log(`[Aori] ⏹️ Track ended. Reason: ${reason}`);
            
            // ⭐ Stop collector when track ends
            this.stopButtonCollector('track_ended');
            
            if (['replaced', 'stopped', 'cleanup'].includes(reason)) {
                console.log(`[Aori] Ignoring end event with reason: ${reason}`);
                return;
            }

            this.previous = this.current;

            if (this.loop === 'track' && this.current) {
                console.log('[Aori] 🔂 Loop track - replaying');
                await this.playTrack(this.current);
                return;
            }

            if (this.loop === 'queue' && this.current) {
                console.log('[Aori] 🔁 Loop queue - adding to end');
                this.tracks.push(this.current);
            }

            this.current = this.tracks.shift() || null;

            if (this.current) {
                console.log(`[Aori] ▶️ Playing next: ${this.current.info?.title}`);
                await this.playTrack(this.current);
            } else if (this.autoplay && this.previous) {
                console.log('[Aori] 🎲 Autoplay - finding related track...');
                await this.handleAutoplay();
            } else {
                console.log('[Aori] 📭 Queue is empty');
                this.playing = false;
                this.client.updatePresence(null);
                this.clearVoiceStatus();

                if (!this.is247) {
                    this.sendQueueEndedMessage();
                    this.setLeaveTimeout();
                }
            }
        });

        // Track stuck
        this.player.on('stuck', async (data) => {
            console.warn(`[Aori] ⚠️ Track stuck in guild ${this.guild.id}`);
            this.stopButtonCollector('track_stuck');
            await this.handleTrackError('Track got stuck');
        });

        // Track exception
        this.player.on('exception', async (data) => {
            console.error(`[Aori] ❌ Track exception:`, data?.exception?.message || 'Unknown');
            this.stopButtonCollector('track_exception');
            await this.handleTrackError(data?.exception?.message || 'Unknown error');
        });

        // WebSocket closed
        this.player.on('closed', (data) => {
            console.log(`[Aori] 🔌 Player closed. Code: ${data?.code}`);
            this.stopButtonCollector('player_closed');
            if (data?.code === 4014) {
                this.playing = false;
                this.client.updatePresence(null);
                this.clearVoiceStatus();
            }
        });

        // Player update
        this.player.on('update', (data) => {
            if (data.state) {
                this.position = data.state.position || 0;
            }
        });
    }

    // ═══════════════════════════════════════════════════════════
    // ⭐ BUTTON COLLECTOR MANAGEMENT
    // ═══════════════════════════════════════════════════════════

    stopButtonCollector(reason = 'manual') {
        if (this.buttonCollector) {
            try {
                console.log(`[Aori] 🛑 Stopping button collector. Reason: ${reason}`);
                this.buttonCollector.stop(reason);
            } catch (e) {
                console.log('[Aori] Collector stop error (ignored):', e.message);
            }
            this.buttonCollector = null;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // AUTOPLAY HANDLER
    // ═══════════════════════════════════════════════════════════

    async handleAutoplay() {
        if (!this.previous) {
            this.playing = false;
            if (!this.is247) {
                this.sendQueueEndedMessage();
                this.setLeaveTimeout();
            }
            return;
        }

        try {
            const searchQuery = `${this.previous.info.author} ${this.previous.info.title}`;
            
            const result = await this.client.shoukaku.getNode()?.rest.resolve(
                `ytsearch:${searchQuery} songs like`
            );

            if (result?.data && result.data.length > 0) {
                const tracks = result.data.slice(1, 6);
                if (tracks.length > 0) {
                    const randomTrack = tracks[Math.floor(Math.random() * tracks.length)];
                    randomTrack.info.requester = this.previous.info.requester;
                    randomTrack.info.isAutoplay = true;
                    
                    this.current = randomTrack;
                    await this.playTrack(this.current);
                    return;
                }
            }
        } catch (error) {
            console.error('[Aori] Autoplay error:', error.message);
        }

        this.playing = false;
        if (!this.is247) {
            this.sendQueueEndedMessage();
            this.setLeaveTimeout();
        }
    }

    // ═══════════════════════════════════════════════════════════
    // QUEUE MESSAGES
    // ═══════════════════════════════════════════════════════════

    sendQueueEndedMessage() {
        const embed = new EmbedBuilder()
            .setColor(colors.warning || 0xFFA500)
            .setAuthor({
                name: '📭 Queue Ended | キュー終了',
                iconURL: this.client.user.displayAvatarURL(),
            })
            .setDescription([
                `The queue has ended!`,
                `キューが終了しました！`
            ].join('\n'))
            .addFields(
                {
                    name: `${emojis.info || 'ℹ️'} Status`,
                    value: [
                        `I'll leave in 2 minutes if no more songs are added.`,
                        `2分以内に曲が追加されなければ退出します。`
                    ].join('\n'),
                    inline: false
                },
                {
                    name: `${emojis.music || '🎵'} Want to keep listening?`,
                    value: [
                        `Use \`${this.client.config?.prefix || 'a!'}play <song>\` to add more songs!`,
                        `曲を追加するにはplayコマンドを使用してください！`
                    ].join('\n'),
                    inline: false
                }
            )
            .setFooter({
                text: `Aori v${this.client.version} ♪ Waiting... 待機中...`,
                iconURL: this.client.user.displayAvatarURL(),
            })
            .setTimestamp();

        this.textChannel.send({ embeds: [embed] }).catch(() => {});
    }

    sendLeftChannelMessage() {
        const embed = new EmbedBuilder()
            .setColor(colors.dark || 0x2F3136)
            .setAuthor({
                name: '👋 Left Voice Channel | 退出しました',
                iconURL: this.client.user.displayAvatarURL(),
            })
            .setDescription([
                `No one came back for 2 minutes...`,
                `2分間誰も戻ってきませんでした...`
            ].join('\n'))
            .addFields(
                {
                    name: `${emojis.info || 'ℹ️'} Reason`,
                    value: [
                        `Left due to inactivity. The queue has been cleared.`,
                        `非アクティブのため退出しました。キューはクリアされました。`
                    ].join('\n'),
                    inline: false
                },
                {
                    name: `${emojis.music || '🎵'} Want to listen again?`,
                    value: [
                        `Use \`${this.client.config?.prefix || 'a!'}play <song>\` to start a new session!`,
                        `新しいセッションを開始するにはplayコマンドを使用してください！`
                    ].join('\n'),
                    inline: false
                }
            )
            .setFooter({
                text: `Aori v${this.client.version} ♪ Sayonara~ さようなら~`,
                iconURL: this.client.user.displayAvatarURL(),
            })
            .setTimestamp();

        this.textChannel.send({ embeds: [embed] }).catch(() => {});
    }

    sendDisconnectedMessage() {
        const embed = new EmbedBuilder()
            .setColor(colors.error || 0xFF0000)
            .setAuthor({
                name: '📡 Disconnected | 切断されました',
                iconURL: this.client.user.displayAvatarURL(),
            })
            .setDescription([
                `I was disconnected from the voice channel!`,
                `私はボイスチャンネルから切断されました！`
            ].join('\n'))
            .addFields(
                {
                    name: `${emojis.info || 'ℹ️'} What happened?`,
                    value: [
                        `Someone disconnected me from the voice channel.`,
                        `The queue has been cleared.`,
                        ``,
                        `誰かが私をボイスチャンネルから切断しました。`,
                        `キューはクリアされました。`
                    ].join('\n'),
                    inline: false
                },
                {
                    name: `${emojis.music || '🎵'} Want to listen again?`,
                    value: [
                        `Use \`${this.client.config?.prefix || 'a!'}play <song>\` to start a new session!`,
                        `新しいセッションを開始するにはplayコマンドを使用してください！`
                    ].join('\n'),
                    inline: false
                }
            )
            .setFooter({
                text: `Aori v${this.client.version} ♪ Sayonara~ さようなら`,
                iconURL: this.client.user.displayAvatarURL(),
            })
            .setTimestamp();

        this.textChannel.send({ embeds: [embed] }).catch(() => {});
    }

    sendResumedMessage(requester) {
        const embed = new EmbedBuilder()
            .setColor(colors.success || 0x00FF00)
            .setAuthor({
                name: '▶️ Resumed | 再開しました',
                iconURL: this.client.user.displayAvatarURL(),
            })
            .setDescription([
                `Welcome back! Music has been resumed~`,
                `おかえりなさい！音楽を再開しました~`
            ].join('\n'))
            .addFields(
                {
                    name: `${emojis.music || '🎵'} Now Playing`,
                    value: this.current?.info?.title || 'Unknown',
                    inline: false
                },
                {
                    name: `${emojis.user || '👤'} Welcome back`,
                    value: requester ? `<@${requester.id}>` : 'Unknown',
                    inline: true
                },
                {
                    name: `${emojis.queue || '📋'} Queue`,
                    value: `${this.tracks.length} track(s)`,
                    inline: true
                }
            )
            .setThumbnail(this.current?.info?.artworkUrl || this.client.user.displayAvatarURL())
            .setFooter({
                text: `Aori v${this.client.version} ♪ Enjoy the music! | 音楽を楽しんでください！`,
                iconURL: this.client.user.displayAvatarURL(),
            })
            .setTimestamp();

        this.textChannel.send({ embeds: [embed] }).catch(() => {});
    }

    sendEmbed(title, description, color = colors.primary) {
        const embed = new EmbedBuilder()
            .setColor(color)
            .setAuthor({
                name: title,
                iconURL: this.client.user.displayAvatarURL(),
            })
            .setDescription(description)
            .setFooter({
                text: `Aori v${this.client.version} ♪ あおり`,
                iconURL: this.client.user.displayAvatarURL()
            })
            .setTimestamp();

        return this.textChannel.send({ embeds: [embed] }).catch(() => {});
    }

    sendSimpleEmbed(description, color = colors.primary) {
        const embed = new EmbedBuilder()
            .setColor(color)
            .setDescription(description)
            .setFooter({ 
                text: `Aori v${this.client.version} ♪ あおり`,
                iconURL: this.client.user.displayAvatarURL()
            });

        this.textChannel.send({ embeds: [embed] }).catch(() => {});
    }

    // ═══════════════════════════════════════════════════════════
    // TIMEOUT MANAGEMENT
    // ═══════════════════════════════════════════════════════════

    setLeaveTimeout() {
        this.clearLeaveTimeout();
        
        const leaveMinutes = Math.floor(this.leaveTimeoutDuration / 60000);
        console.log(`[Aori] ⏰ Leave timeout set (${leaveMinutes} minutes)`);
        
        this.leaveTimeout = setTimeout(async () => {
            if (!this.playing && this.tracks.length === 0 && this.client.queue.has(this.guild.id)) {
                console.log('[Aori] ⏰ Leave timeout reached, disconnecting...');
                this.sendLeftChannelMessage();
                this.leavingVoluntarily = true;
                await this.destroy();
            }
        }, this.leaveTimeoutDuration);
    }

    clearLeaveTimeout() {
        if (this.leaveTimeout) {
            clearTimeout(this.leaveTimeout);
            this.leaveTimeout = null;
            console.log('[Aori] ⏰ Leave timeout cleared');
        }
    }

    clearEmptyChannelTimeout() {
        if (this.emptyChannelTimeout) {
            clearTimeout(this.emptyChannelTimeout);
            this.emptyChannelTimeout = null;
            console.log('[Aori] ⏰ Empty channel timeout cleared');
        }

        if (this.emptyChannelWarningMessage) {
            this.emptyChannelWarningMessage.delete().catch(() => {});
            this.emptyChannelWarningMessage = null;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // TRACK MANAGEMENT
    // ═══════════════════════════════════════════════════════════

    async handleTrackError(errorMessage) {
        this.retryCount++;
        console.log(`[Aori] 🔄 Track error (${this.retryCount}/${this.maxRetries}): ${errorMessage}`);

        if (this.retryCount >= this.maxRetries) {
            this.sendSimpleEmbed(
                `${emojis.error || '❌'} Failed to play **${this.current?.info?.title || 'Unknown'}**. Skipping... (スキップします)`,
                colors.error
            );
            this.retryCount = 0;
            
            this.previous = this.current;
            this.current = this.tracks.shift() || null;
            
            if (this.current) {
                await this.playTrack(this.current);
            } else if (this.autoplay && this.previous) {
                await this.handleAutoplay();
            } else {
                this.playing = false;
                this.client.updatePresence(null);
                this.clearVoiceStatus();
                
                if (!this.is247) {
                    this.sendQueueEndedMessage();
                    this.setLeaveTimeout();
                }
            }
        } else {
            await this.sleep(2000);
            if (this.current) {
                await this.playTrack(this.current);
            }
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async playTrack(track) {
        if (!this.player || !track) {
            console.log('[Aori] ⚠️ No player or track to play');
            return;
        }

        try {
            console.log(`[Aori] 🎵 Playing: ${track.info?.title}`);
            await this.player.playTrack({
                track: { encoded: track.encoded }
            });
        } catch (error) {
            console.error('[Aori] ❌ Error playing track:', error.message);
            await this.handleTrackError(error.message);
        }
    }

    async play() {
        if (!this.current && this.tracks.length > 0) {
            this.current = this.tracks.shift();
        }

        if (this.current && this.player) {
            await this.playTrack(this.current);
            try {
                await this.player.setGlobalVolume(this.volume);
            } catch (e) {}
        }
    }

    async skip() {
        console.log('[Aori] ⏭️ Skip requested');
        this.retryCount = 0;
        
        if (!this.player) return;

        // ⭐ Stop collector before skip
        this.stopButtonCollector('skip');

        try {
            await this.player.stopTrack();
            
            this.previous = this.current;
            
            if (this.loop === 'queue' && this.current) {
                this.tracks.push(this.current);
            }
            
            this.current = this.tracks.shift() || null;
            
            if (this.current) {
                await this.playTrack(this.current);
            } else if (this.autoplay && this.previous) {
                await this.handleAutoplay();
            } else {
                this.playing = false;
                this.client.updatePresence(null);
                this.clearVoiceStatus();
                
                if (!this.is247) {
                    this.sendQueueEndedMessage();
                    this.setLeaveTimeout();
                }
            }
        } catch (e) {
            console.error('[Aori] ❌ Skip error:', e.message);
            this.current = this.tracks.shift() || null;
            if (this.current) {
                await this.playTrack(this.current);
            }
        }
    }

    async pause() {
        console.log('[Aori] ⏸️ Pause requested');
        this.paused = true;
        
        if (this.player) {
            try {
                await this.player.setPaused(true);
            } catch (e) {
                console.error('[Aori] Pause error:', e.message);
            }
        }
        
        this.updateNowPlayingButtons();
        this.updateVoiceStatus();
    }

    async resume() {
        console.log('[Aori] ▶️ Resume requested');
        this.paused = false;
        this.pausedByEmpty = false;
        
        if (this.player) {
            try {
                await this.player.setPaused(false);
            } catch (e) {
                console.error('[Aori] Resume error:', e.message);
            }
        }
        
        this.updateNowPlayingButtons();
        this.updateVoiceStatus();
    }

    async stop() {
        console.log('[Aori] ⏹️ Stop requested');
        this.tracks = [];
        this.current = null;
        this.retryCount = 0;
        this.clearLeaveTimeout();
        this.clearEmptyChannelTimeout();
        this.stopButtonCollector('stop');
        
        if (this.player) {
            try {
                await this.player.stopTrack();
            } catch (e) {}
        }
    }

    async setVolume(vol) {
        const volume = Math.min(Math.max(vol, 0), this.client.config.maxVolume || 100);
        this.volume = volume;
        
        if (this.player) {
            try {
                await this.player.setGlobalVolume(volume);
            } catch (e) {}
        }
    }

    async seek(position) {
        if (this.player) {
            try {
                await this.player.seekTo(position);
            } catch (e) {}
        }
    }

    // ═══════════════════════════════════════════════════════════
    // QUEUE MANAGEMENT
    // ═══════════════════════════════════════════════════════════

    addTrack(track) {
        this.tracks.push(track);
    }

    addTracks(tracks) {
        this.tracks.push(...tracks);
    }

    shuffle() {
        for (let i = this.tracks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.tracks[i], this.tracks[j]] = [this.tracks[j], this.tracks[i]];
        }
    }

    remove(index) {
        if (index < 0 || index >= this.tracks.length) return null;
        return this.tracks.splice(index, 1)[0];
    }

    jump(index) {
        if (index < 0 || index >= this.tracks.length) return null;
        const track = this.tracks.splice(index, 1)[0];
        this.tracks.unshift(track);
        return track;
    }

    move(from, to) {
        if (from < 0 || from >= this.tracks.length) return false;
        if (to < 0 || to >= this.tracks.length) return false;
        
        const track = this.tracks.splice(from, 1)[0];
        this.tracks.splice(to, 0, track);
        return true;
    }

    clear() {
        this.tracks = [];
    }

    setLoop(mode) {
        this.loop = mode;
        this.updateNowPlayingButtons();
    }

    toggleAutoplay() {
        this.autoplay = !this.autoplay;
        return this.autoplay;
    }

    toggle247() {
        this.is247 = !this.is247;
        
        if (this.is247) {
            this.clearLeaveTimeout();
            this.clearEmptyChannelTimeout();
        }
        
        return this.is247;
    }

    getLoopEmoji() {
        switch (this.loop) {
            case 'track': return emojis.loop_one || '🔂';
            case 'queue': return emojis.loop || '🔁';
            default: return emojis.loop || '🔁';
        }
    }

    getLoopMode() {
        switch (this.loop) {
            case 'track': return 'Track (曲)';
            case 'queue': return 'Queue (キュー)';
            default: return 'Disabled (無効)';
        }
    }

    // ═══════════════════════════════════════════════════════════
    // AUDIO FILTERS
    // ═══════════════════════════════════════════════════════════

    async setFilter(filter, enabled = true) {
        this.filters[filter] = enabled;
        await this.applyFilters();
    }

    async applyFilters() {
        if (!this.player) return;

        try {
            const filterPayload = {};

            if (this.filters.bassboost) {
                filterPayload.equalizer = [
                    { band: 0, gain: 0.6 },
                    { band: 1, gain: 0.5 },
                    { band: 2, gain: 0.4 },
                    { band: 3, gain: 0.3 },
                    { band: 4, gain: 0.2 },
                    { band: 5, gain: 0.1 },
                    { band: 6, gain: 0 },
                    { band: 7, gain: 0 },
                    { band: 8, gain: 0 },
                    { band: 9, gain: 0 },
                    { band: 10, gain: 0 },
                    { band: 11, gain: 0 },
                    { band: 12, gain: 0 },
                    { band: 13, gain: 0 },
                    { band: 14, gain: 0 },
                ];
            }

            if (this.filters.nightcore) {
                filterPayload.timescale = {
                    speed: 1.2,
                    pitch: 1.2,
                    rate: 1.0,
                };
            }

            if (this.filters.vaporwave) {
                filterPayload.timescale = {
                    speed: 0.85,
                    pitch: 0.85,
                    rate: 1.0,
                };
            }

            if (this.filters['8d']) {
                filterPayload.rotation = {
                    rotationHz: 0.2,
                };
            }

            if (this.filters.karaoke) {
                filterPayload.karaoke = {
                    level: 1.0,
                    monoLevel: 1.0,
                    filterBand: 220.0,
                    filterWidth: 100.0,
                };
            }

            if (this.filters.tremolo) {
                filterPayload.tremolo = {
                    frequency: 4.0,
                    depth: 0.75,
                };
            }

            if (this.filters.vibrato) {
                filterPayload.vibrato = {
                    frequency: 4.0,
                    depth: 0.75,
                };
            }

            if (this.filters.lowPass) {
                filterPayload.lowPass = {
                    smoothing: 20.0,
                };
            }

            if (this.filters.timescale) {
                filterPayload.timescale = this.filters.timescale;
            }

            await this.player.setFilters(filterPayload);
        } catch (error) {
            console.error('[Aori] Filter error:', error.message);
        }
    }

    async clearFilters() {
        this.filters = {
            bassboost: false,
            nightcore: false,
            vaporwave: false,
            karaoke: false,
            tremolo: false,
            vibrato: false,
            rotation: false,
            distortion: false,
            channelMix: false,
            lowPass: false,
            timescale: null,
            '8d': false,
        };

        if (this.player) {
            try {
                await this.player.clearFilters();
            } catch (e) {}
        }
    }

    getActiveFilters() {
        const active = [];
        for (const [key, value] of Object.entries(this.filters)) {
            if (value && key !== 'timescale') {
                active.push(key);
            }
        }
        return active;
    }

    // ═══════════════════════════════════════════════════════════
    // PLATFORM DETECTION
    // ═══════════════════════════════════════════════════════════

    getPlatformEmoji(sourceName) {
        const checkPlatform = (name) => {
            const source = (name || '').toLowerCase();
            if (source.includes('spotify')) return emojis.spotify || '🟢';
            if (source.includes('soundcloud')) return emojis.soundcloud || '🟧';
            if (source.includes('deezer')) return emojis.deezer || '🟠';
            if (source.includes('apple')) return emojis.applemusic || '🍎';
            if (source.includes('bandcamp')) return emojis.bandcamp || '🔵';
            if (source.includes('youtube') || source.includes('yt')) return emojis.youtube || '🔴';
            if (source.includes('twitch')) return emojis.twitch || '🟣';
            if (source.includes('vimeo')) return emojis.vimeo || '🔵';
            return null;
        };

        if (this.current?.info?.originalPlatform) {
            const emoji = checkPlatform(this.current.info.originalPlatform);
            if (emoji) return emoji;
        }
        
        const emoji = checkPlatform(sourceName);
        if (emoji) return emoji;
        
        return emojis.link || '🔗';
    }

    getPlatformColor(sourceName) {
        const checkPlatform = (name) => {
            const source = (name || '').toLowerCase();
            if (source.includes('spotify')) return colors.spotify || 0x1DB954;
            if (source.includes('soundcloud')) return colors.soundcloud || 0xFF5500;
            if (source.includes('deezer')) return colors.deezer || 0xFEAA2D;
            if (source.includes('apple')) return colors.applemusic || 0xFC3C44;
            if (source.includes('bandcamp')) return colors.bandcamp || 0x1DA0C3;
            if (source.includes('youtube') || source.includes('yt')) return colors.youtube || 0xFF0000;
            if (source.includes('twitch')) return colors.twitch || 0x9146FF;
            return null;
        };

        if (this.current?.info?.originalPlatform) {
            const color = checkPlatform(this.current.info.originalPlatform);
            if (color) return color;
        }
        
        const color = checkPlatform(sourceName);
        if (color) return color;
        
        return colors.primary || 0x7289DA;
    }

    getPlatformName(sourceName) {
        const checkPlatform = (name) => {
            const source = (name || '').toLowerCase();
            if (source.includes('spotify')) return 'Spotify';
            if (source.includes('soundcloud')) return 'SoundCloud';
            if (source.includes('deezer')) return 'Deezer';
            if (source.includes('apple')) return 'Apple Music';
            if (source.includes('bandcamp')) return 'Bandcamp';
            if (source.includes('youtube') || source.includes('yt')) return 'YouTube';
            if (source.includes('twitch')) return 'Twitch';
            if (source.includes('vimeo')) return 'Vimeo';
            return null;
        };

        if (this.current?.info?.originalPlatform) {
            const name = checkPlatform(this.current.info.originalPlatform);
            if (name) return name;
        }
        
        const name = checkPlatform(sourceName);
        if (name) return name;
        
        return 'Source';
    }

    // ═══════════════════════════════════════════════════════════
    // NOW PLAYING & BUTTONS
    // ═══════════════════════════════════════════════════════════

    createControlButtons() {
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('music_previous')
                    .setEmoji(emojis.previous || '⏮️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(!this.previous),
                new ButtonBuilder()
                    .setCustomId('music_playpause')
                    .setEmoji(this.paused ? (emojis.play || '▶️') : (emojis.pause || '⏸️'))
                    .setStyle(this.paused ? ButtonStyle.Success : ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('music_stop')
                    .setEmoji(emojis.stop || '⏹️')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('music_skip')
                    .setEmoji(emojis.skip || '⏭️')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('music_loop')
                    .setEmoji(this.getLoopEmoji())
                    .setStyle(this.loop !== 'none' ? ButtonStyle.Success : ButtonStyle.Secondary),
            );

        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('music_shuffle')
                    .setEmoji(emojis.shuffle || '🔀')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(this.tracks.length < 2),
            );

        return [row, row2];
    }

    async updateNowPlayingButtons() {
        if (!this.nowPlayingMessage) return;

        try {
            const buttons = this.createControlButtons();
            await this.nowPlayingMessage.edit({ components: buttons }).catch(() => {});
        } catch (error) {}
    }

    deleteNowPlayingMessage() {
        // ⭐ Stop collector first
        this.stopButtonCollector('delete_message');
        
        if (this.nowPlayingMessage) {
            this.nowPlayingMessage.delete().catch(() => {});
            this.nowPlayingMessage = null;
        }
    }

    async sendNowPlaying() {
    	if (!this.current) return;

    	const track = this.current;
    	const requester = track.info.requester;
    
    	const sourceName = track.info.originalPlatform || track.info.sourceName || 'unknown';
    	const platformEmoji = this.getPlatformEmoji(sourceName);
    	const platformColor = this.getPlatformColor(sourceName);
    	const platformName = this.getPlatformName(sourceName);
    	const trackUrl = track.info.uri || '';

    	const embed = new EmbedBuilder()
        	.setColor(platformColor)
        	.setAuthor({
            	name: '♪ Now Playing | 今再生中',
            	iconURL: requester?.displayAvatarURL?.() || requester?.avatarURL?.() || this.client.user.displayAvatarURL(),
        	})
        	.setDescription(`${platformEmoji} **[${track.info.title}](${trackUrl})**`)
        	.addFields(
            	{
                	name: `${emojis.user || '👤'} Artist`,
                	value: track.info.author || 'Unknown',
                	inline: true
            	},
            	{
                	name: `${emojis.clock || '⏱️'} Duration`,
                	value: track.info.isStream ? '🔴 LIVE' : this.formatDuration(track.info.length),
                	inline: true
            	},
            	{
                	name: `${emojis.headphone || '🎧'} Requested by`,
                	value: requester ? `<@${requester.id}>` : 'Unknown',
                	inline: true
            	}
        	)
        	.setThumbnail(track.info.artworkUrl || this.client.user.displayAvatarURL())
        	.setFooter({
            	text: `Aori v${this.client.version} ♪ あおり • ${platformName}`,
            	iconURL: this.client.user.displayAvatarURL(),
        	})
        	.setTimestamp();

    	const buttons = this.createControlButtons();

    	// ⭐ Clean up old message and collector
    	this.deleteNowPlayingMessage();

    	try {
        	this.nowPlayingMessage = await this.textChannel.send({ 
            	embeds: [embed], 
            	components: buttons 
        	});

        	if (this.nowPlayingMessage) {
            	this.setupButtonCollector();
        	}
    	} catch (error) {
        	console.error('[Aori] Error sending now playing:', error.message);
    	}
	}

    // ═══════════════════════════════════════════════════════════
    // ⭐ BUTTON COLLECTOR (NO TIMEOUT - Ends when track ends)
    // ═══════════════════════════════════════════════════════════

    setupButtonCollector() {
        if (!this.nowPlayingMessage) return;

        console.log(`[Aori] 🎛️ Button collector setup - No timeout, ends when track ends`);

        // ⭐ TIDAK ADA TIMEOUT - Collector aktif sampai di-stop manual
        this.buttonCollector = this.nowPlayingMessage.createMessageComponentCollector();

        this.buttonCollector.on('collect', async (interaction) => {
            const member = interaction.guild.members.cache.get(interaction.user.id);
            
            if (!member?.voice.channel || member.voice.channel.id !== this.voiceChannel.id) {
                return interaction.reply({
                    content: `${emojis.error || '❌'} You must be in the same voice channel! (同じVCにいる必要があります)`,
                    ephemeral: true
                });
            }

            await this.handleButtonInteraction(interaction);
        });

        this.buttonCollector.on('end', (collected, reason) => {
            console.log(`[Aori] 🎛️ Button collector ended - Reason: ${reason}, Collected: ${collected.size}`);
            
            // ⭐ Disable buttons when collector ends (kecuali karena skip manual)
            if (reason !== 'skip' && reason !== 'stop' && reason !== 'delete_message') {
                this.disableButtons();
            }
        });
    }

    async handleButtonInteraction(interaction) {
        try {
            switch (interaction.customId) {
                case 'music_previous':
                    if (this.previous) {
                        this.tracks.unshift(this.current);
                        this.current = this.previous;
                        this.previous = null;
                        await this.playTrack(this.current);
                        await interaction.reply({
                            content: `${emojis.previous || '⏮️'} Playing previous track! (前の曲を再生)`,
                            ephemeral: true
                        });
                    } else {
                        await interaction.reply({
                            content: `${emojis.error || '❌'} No previous track! (前の曲がありません)`,
                            ephemeral: true
                        });
                    }
                    break;

                case 'music_playpause':
                    if (this.paused) {
                        await this.resume();
                        await interaction.reply({
                            content: `${emojis.play || '▶️'} Resumed! (再開しました)`,
                            ephemeral: true
                        });
                    } else {
                        await this.pause();
                        await interaction.reply({
                            content: `${emojis.pause || '⏸️'} Paused! (一時停止しました)`,
                            ephemeral: true
                        });
                    }
                    break;

                case 'music_stop':
                    await interaction.reply({
                        content: `${emojis.stop || '⏹️'} Stopped and disconnected! さようなら~`,
                        ephemeral: true
                    });
                    this.leavingVoluntarily = true;
                    await this.destroy();
                    break;

                case 'music_skip':
                    const skipped = this.current?.info?.title || 'Unknown';
                    await interaction.reply({
                        content: `${emojis.skip || '⏭️'} Skipped **${skipped}**! (スキップしました)`,
                        ephemeral: true
                    });
                    await this.skip();
                    break;

                case 'music_loop':
                    if (this.loop === 'none') {
                        this.setLoop('track');
                        await interaction.reply({
                            content: `${emojis.loop_one || '🔂'} Loop: **Track** (曲ループ)`,
                            ephemeral: true
                        });
                    } else if (this.loop === 'track') {
                        this.setLoop('queue');
                        await interaction.reply({
                            content: `${emojis.loop || '🔁'} Loop: **Queue** (キューループ)`,
                            ephemeral: true
                        });
                    } else {
                        this.setLoop('none');
                        await interaction.reply({
                            content: `${emojis.loop || '🔁'} Loop: **Disabled** (無効)`,
                            ephemeral: true
                        });
                    }
                    break;

                case 'music_shuffle':
                    if (this.tracks.length < 2) {
                        await interaction.reply({
                            content: `${emojis.error || '❌'} Need at least 2 tracks to shuffle! (シャッフルには2曲以上必要)`,
                            ephemeral: true
                        });
                    } else {
                        this.shuffle();
                        await interaction.reply({
                            content: `${emojis.shuffle || '🔀'} Queue shuffled! (シャッフルしました)`,
                            ephemeral: true
                        });
                    }
                    break;
            }
        } catch (error) {
            console.error('[Aori] Button interaction error:', error.message);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: `${emojis.error || '❌'} An error occurred! (エラーが発生しました)`,
                    ephemeral: true
                }).catch(() => {});
            }
        }
    }

    disableButtons() {
        if (!this.nowPlayingMessage) return;

        const disabledRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('music_previous')
                    .setEmoji(emojis.previous || '⏮️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('music_playpause')
                    .setEmoji(emojis.pause || '⏸️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('music_stop')
                    .setEmoji(emojis.stop || '⏹️')
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('music_skip')
                    .setEmoji(emojis.skip || '⏭️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('music_loop')
                    .setEmoji(emojis.loop || '🔁')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
            );

        const disabledRow2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('music_shuffle')
                    .setEmoji(emojis.shuffle || '🔀')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
            );

        this.nowPlayingMessage.edit({ components: [disabledRow, disabledRow2] }).catch(() => {});
    }

    // ═══════════════════════════════════════════════════════════
    // VOICE CHANNEL STATUS
    // ═══════════════════════════════════════════════════════════

    async updateVoiceStatus() {
        if (!this.current || !this.voiceChannel) return;

        const prefix = this.paused ? '⏸️' : '🎵';
        const statusText = `${prefix} ${this.current.info.author} - ${this.current.info.title}`.substring(0, 500);

        try {
            const rest = new REST({ version: '10' }).setToken(this.client.token);
            
            await rest.put(
                `/channels/${this.voiceChannel.id}/voice-status`,
                { body: { status: statusText } }
            );
        } catch (error) {
            try {
                if (typeof this.voiceChannel.setStatus === 'function') {
                    await this.voiceChannel.setStatus(statusText);
                }
            } catch (e) {}
        }
    }

    async clearVoiceStatus() {
        if (!this.voiceChannel) return;

        try {
            const rest = new REST({ version: '10' }).setToken(this.client.token);
            
            await rest.put(
                `/channels/${this.voiceChannel.id}/voice-status`,
                { body: { status: null } }
            );
        } catch (error) {
            try {
                if (typeof this.voiceChannel.setStatus === 'function') {
                    await this.voiceChannel.setStatus(null);
                }
            } catch (e) {}
        }
    }

    // ═══════════════════════════════════════════════════════════
	// UTILITIES
	// ═══════════════════════════════════════════════════════════

	formatDuration(ms) {
    	if (!ms || isNaN(ms)) return '00:00';
    
    	const seconds = Math.floor((ms / 1000) % 60);
    	const minutes = Math.floor((ms / (1000 * 60)) % 60);
    	const hours = Math.floor(ms / (1000 * 60 * 60));

    	if (hours > 0) {
        	return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    	}
    	return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
	}

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    getProgress() {
        if (!this.current || !this.position) return 0;
        return (this.position / this.current.info.length) * 100;
    }

    createProgressBar(current, total, length = 15) {
        const progress = Math.round((current / total) * length);
        const emptyProgress = length - progress;
        
        const progressText = '▓'.repeat(progress);
        const emptyProgressText = '░'.repeat(emptyProgress);
        
        return `[${progressText}${emptyProgressText}]`;
    }

    getTotalDuration() {
        let total = this.current?.info?.length || 0;
        for (const track of this.tracks) {
            total += track.info?.length || 0;
        }
        return total;
    }

    // ═══════════════════════════════════════════════════════════
    // CLEANUP
    // ═══════════════════════════════════════════════════════════

    async destroy() {
        console.log('[Aori] 🗑️ Destroying queue...');
        
        this.tracks = [];
        this.current = null;
        this.previous = null;
        this.playing = false;
        this.paused = false;
        this.retryCount = 0;
        this.pausedByEmpty = false;
        
        this.clearLeaveTimeout();
        this.clearEmptyChannelTimeout();
        
        // ⭐ Stop collector and delete message
        this.deleteNowPlayingMessage();
        
        if (this.emptyChannelWarningMessage) {
            try {
                await this.emptyChannelWarningMessage.delete();
            } catch (e) {}
            this.emptyChannelWarningMessage = null;
        }
        
        await this.clearVoiceStatus();
        
        try {
            await this.client.shoukaku.leaveVoiceChannel(this.guild.id);
        } catch (error) {
            console.error('[Aori] Disconnect error:', error.message);
            try {
                if (this.player?.connection) {
                    this.player.connection.disconnect();
                }
            } catch (e) {}
        }
        
        this.client.queue.delete(this.guild.id);
        this.client.updatePresence(null);
        
        console.log('[Aori] ✅ Queue destroyed');
    }

    // ═══════════════════════════════════════════════════════════
    // HELPER METHOD: Leave dengan flag
    // ═══════════════════════════════════════════════════════════

    async leave() {
        this.leavingVoluntarily = true;
        await this.destroy();
    }
}

module.exports = Queue;