const { EmbedBuilder } = require('discord.js');
const { emojis, colors } = require('./constants');

class PlatformSearcher {
    constructor(client) {
        this.client = client;
        this.platforms = [
            { prefix: 'dzsearch', name: 'Deezer', emoji: emojis.deezer, color: colors.deezer },
            { prefix: 'scsearch', name: 'SoundCloud', emoji: emojis.soundcloud, color: colors.soundcloud },
            { prefix: 'bcsearch', name: 'Bandcamp', emoji: emojis.bandcamp, color: colors.bandcamp },
            { prefix: 'spsearch', name: 'Spotify', emoji: emojis.spotify, color: colors.spotify },
            { prefix: 'amsearch', name: 'Apple Music', emoji: emojis.applemusic, color: colors.applemusic },
        ];

        this.unknownPlatform = {
            prefix: 'link',
            name: 'Source',
            emoji: emojis.link,
            color: colors.dark || 0x2F3136,
        };

        this.searchingMessages = [
            'Searching~ 検索中...',
            'Looking for it~ 探してる...',
            'Hunting~ 見つけてあげる...',
        ];

        this.longWaitMessages = [
            '*Chotto matte~* ちょっと待って...',
            '*Mou sukoshi~* もう少し...',
            '*Almost there~* もうすぐ...',
        ];

        this.connectingMessages = [
            'Connecting~ 接続中...',
            'Joining~ 参加するよ...',
            'On my way~ 向かってる...',
        ];

        this.foundMessages = [
            'Mitsuketa~! 見つけた！',
            'Found it~! 発見！',
            'Yatta~! やった！',
        ];
    }

    getRandom(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    // ═══════════════════════════════════════════════════════════
    // MAIN SEARCH
    // ═══════════════════════════════════════════════════════════

    async search(query, message) {
        const node = this.client.getNode();
        if (!node) return { success: false, error: 'No Lavalink nodes!', loadingMessage: null };

        if (this.isURL(query)) {
            if (this.isSpotifyURL(query)) return await this.handleSpotifyURL(node, query, message);
            return await this.searchDirect(node, query, message);
        }
        return await this.cascadeSearch(node, query, message);
    }

    // ═══════════════════════════════════════════════════════════
    // HELPER METHODS FOR PLAY.JS
    // ═══════════════════════════════════════════════════════════

    async updateToConnecting(loadingMessage, platform, voiceChannel) {
        if (!loadingMessage) return;
        const embed = new EmbedBuilder()
            .setColor(platform?.color || colors.primary)
            .setDescription(
                `${emojis.success} ${this.getRandom(this.foundMessages)} **${platform?.name}**!\n` +
                `${emojis.loading} ${this.getRandom(this.connectingMessages)} **${voiceChannel?.name}**`
            );
        await loadingMessage.edit({ embeds: [embed] }).catch(() => {});
    }

    async updateToLongConnecting(loadingMessage, platform, voiceChannel) {
        if (!loadingMessage) return;
        const embed = new EmbedBuilder()
            .setColor(platform?.color || colors.primary)
            .setDescription(
                `${emojis.success} ${this.getRandom(this.foundMessages)} **${platform?.name}**!\n` +
                `${emojis.loading} ${this.getRandom(this.connectingMessages)} **${voiceChannel?.name}**\n` +
                `${emojis.sparkle} ${this.getRandom(this.longWaitMessages)}`
            );
        await loadingMessage.edit({ embeds: [embed] }).catch(() => {});
    }

    async updateToAdding(loadingMessage, platform, count) {
        if (!loadingMessage) return;
        const embed = new EmbedBuilder()
            .setColor(platform?.color || colors.primary)
            .setDescription(`${platform?.emoji || emojis.music} Adding **${count}** tracks~ 追加中...`);
        await loadingMessage.edit({ embeds: [embed] }).catch(() => {});
    }

    async updateToLongAdding(loadingMessage, platform, count) {
        if (!loadingMessage) return;
        const embed = new EmbedBuilder()
            .setColor(platform?.color || colors.primary)
            .setDescription(
                `${platform?.emoji || emojis.music} Adding **${count}** tracks~ 追加中...\n` +
                `${emojis.sparkle} ${this.getRandom(this.longWaitMessages)}`
            );
        await loadingMessage.edit({ embeds: [embed] }).catch(() => {});
    }

    // ═══════════════════════════════════════════════════════════
    // URL HELPERS
    // ═══════════════════════════════════════════════════════════

    isURL(s) { try { new URL(s); return true; } catch { return false; } }
    isSpotifyURL(u) { return u.toLowerCase().includes('spotify.com'); }
    
    getSpotifyPlatform() {
        return this.platforms.find(p => p.prefix === 'spsearch') || 
            { prefix: 'spsearch', name: 'Spotify', emoji: emojis.spotify, color: colors.spotify };
    }

    detectPlatform(url) {
        const u = url.toLowerCase();
        if (u.includes('deezer.com')) return this.platforms.find(p => p.prefix === 'dzsearch');
        if (u.includes('soundcloud.com')) return this.platforms.find(p => p.prefix === 'scsearch');
        if (u.includes('bandcamp.com')) return this.platforms.find(p => p.prefix === 'bcsearch');
        if (u.includes('spotify.com')) return this.platforms.find(p => p.prefix === 'spsearch');
        if (u.includes('music.apple.com')) return this.platforms.find(p => p.prefix === 'amsearch');
        return this.unknownPlatform;
    }

    // ═══════════════════════════════════════════════════════════
    // SPOTIFY HANDLING
    // ═══════════════════════════════════════════════════════════

    async handleSpotifyURL(node, url, message) {
        const platform = this.getSpotifyPlatform();
        
        const embed = new EmbedBuilder()
            .setColor(platform.color)
            .setDescription(`${emojis.loading} ${platform.emoji} ${this.getRandom(this.searchingMessages)}`);
        const loadingMessage = await message.channel.send({ embeds: [embed] });

        const longTimeout = setTimeout(async () => {
            const e = new EmbedBuilder()
                .setColor(platform.color)
                .setDescription(
                    `${emojis.loading} ${platform.emoji} ${this.getRandom(this.searchingMessages)}\n` +
                    `${emojis.sparkle} ${this.getRandom(this.longWaitMessages)}`
                );
            await loadingMessage.edit({ embeds: [e] }).catch(() => {});
        }, 5000);

        try {
            const direct = await this.tryResolve(node, url, platform);
            if (direct.success) { clearTimeout(longTimeout); return { ...direct, loadingMessage }; }

            const spotify = this.client.spotify;
            if (!spotify?.extractSpotifyId) {
                clearTimeout(longTimeout);
                return { success: false, error: 'Spotify not configured!', loadingMessage };
            }

            const extracted = spotify.extractSpotifyId(url);
            if (!extracted) { clearTimeout(longTimeout); return { success: false, error: 'Invalid Spotify URL!', loadingMessage }; }

            let result;
            switch (extracted.type) {
                case 'track': result = await this.spotifyTrack(node, extracted.id, loadingMessage, platform); break;
                case 'artist': result = await this.spotifyArtist(node, extracted.id, loadingMessage, platform); break;
                case 'album': result = await this.spotifyAlbum(node, extracted.id, loadingMessage, platform); break;
                case 'playlist': result = await this.spotifyPlaylist(node, extracted.id, loadingMessage, platform); break;
                default: result = { success: false, error: 'Unknown Spotify type!' };
            }

            clearTimeout(longTimeout);
            return { ...result, loadingMessage };
        } catch (e) {
            clearTimeout(longTimeout);
            return { success: false, error: e.message, loadingMessage };
        }
    }

    async tryResolve(node, url, platform = null) {
        try {
            const result = await node.rest.resolve(url);
            const tracks = this.extractTracks(result);
            if (tracks.length > 0) {
                tracks.forEach(t => { if (t.info) t.info.sourceName = platform?.name?.toLowerCase() || 'link'; });
                return { success: true, tracks, playlist: result.loadType === 'playlist' ? result.data : null, platform: platform || this.detectPlatform(url) };
            }
        } catch {}
        return { success: false };
    }

    async spotifyTrack(node, id, loadingMsg, platform) {
        const track = await this.client.spotify.getTrack(id);
        if (!track) return { success: false, error: 'Track not found!' };

        const artist = track.artists?.[0]?.name || '';
        const title = track.name || '';

        let showLong = false;
        const lt = setTimeout(() => { showLong = true; }, 3000);

        for (const p of this.platforms) {
            const e = new EmbedBuilder()
                .setColor(p.color)
                .setDescription(
                    `${emojis.loading} ${p.emoji} ${this.getRandom(this.searchingMessages)}` +
                    (showLong ? `\n${emojis.sparkle} ${this.getRandom(this.longWaitMessages)}` : '')
                );
            await loadingMsg.edit({ embeds: [e] }).catch(() => {});

            try {
                const result = await node.rest.resolve(`${p.prefix}:${artist} ${title}`);
                const tracks = this.extractTracks(result);
                if (tracks.length > 0) {
                    clearTimeout(lt);
                    tracks[0].info.artworkUrl = track.album?.images?.[0]?.url || tracks[0].info.artworkUrl;
                    tracks[0].info.uri = track.external_urls?.spotify || tracks[0].info.uri;
                    tracks[0].info.title = title;
                    tracks[0].info.author = artist;
                    tracks[0].info.sourceName = 'spotify';
                    return { success: true, tracks: [tracks[0]], playlist: null, platform };
                }
            } catch {}
            await this.sleep(100);
        }

        clearTimeout(lt);
        return { success: false, error: `Could not find "${title}"!` };
    }

    async spotifyArtist(node, id, loadingMsg, platform) {
        const artist = await this.client.spotify.getArtist(id);
        const top = await this.client.spotify.getArtistTopTracks(id);
        if (!artist || !top?.length) return { success: false, error: 'Artist not found!' };

        const e = new EmbedBuilder()
            .setColor(platform.color)
            .setDescription(
                `${emojis.loading} ${platform.emoji} Loading **${artist.name}** (${top.length} tracks)~\n` +
                `${emojis.sparkle} ${this.getRandom(this.longWaitMessages)}`
            );
        await loadingMsg.edit({ embeds: [e] }).catch(() => {});

        const resolved = await this.resolveSpotifyTracks(node, top, artist.images?.[0]?.url);
        if (!resolved.length) return { success: false, error: 'Could not load tracks!' };

        return { success: true, tracks: resolved, playlist: { info: { name: `${artist.name} - Top Tracks`, url: artist.external_urls?.spotify, artworkUrl: artist.images?.[0]?.url } }, platform };
    }

    async spotifyAlbum(node, id, loadingMsg, platform) {
        const album = await this.client.spotify.getAlbum(id);
        if (!album?.tracks?.items?.length) return { success: false, error: 'Album not found!' };

        const e = new EmbedBuilder()
            .setColor(platform.color)
            .setDescription(
                `${emojis.loading} ${platform.emoji} Loading **${album.name}** (${album.tracks.items.length} tracks)~\n` +
                `${emojis.sparkle} ${this.getRandom(this.longWaitMessages)}`
            );
        await loadingMsg.edit({ embeds: [e] }).catch(() => {});

        const toResolve = album.tracks.items.map(t => ({ name: t.name, artists: t.artists, album: { images: album.images }, external_urls: t.external_urls }));
        const resolved = await this.resolveSpotifyTracks(node, toResolve, album.images?.[0]?.url);
        if (!resolved.length) return { success: false, error: 'Could not load tracks!' };

        return { success: true, tracks: resolved, playlist: { info: { name: `${album.name} - ${album.artists[0]?.name}`, url: album.external_urls?.spotify, artworkUrl: album.images?.[0]?.url } }, platform };
    }

    async spotifyPlaylist(node, id, loadingMsg, platform) {
        const playlist = await this.client.spotify.getPlaylist(id);
        if (!playlist?.tracks?.items?.length) return { success: false, error: 'Playlist not found!' };

        const tracks = playlist.tracks.items.filter(i => i?.track && !i.track.is_local).map(i => i.track);
        if (!tracks.length) return { success: false, error: 'No playable tracks!' };

        const toLoad = Math.min(tracks.length, 50);
        const e = new EmbedBuilder()
            .setColor(platform.color)
            .setDescription(
                `${emojis.loading} ${platform.emoji} Loading **${playlist.name}** (${toLoad} tracks)~\n` +
                `${emojis.sparkle} ${this.getRandom(this.longWaitMessages)}`
            );
        await loadingMsg.edit({ embeds: [e] }).catch(() => {});

        const resolved = await this.resolveSpotifyTracks(node, tracks.slice(0, 50), playlist.images?.[0]?.url);
        if (!resolved.length) return { success: false, error: 'Could not load tracks!' };

        return { success: true, tracks: resolved, playlist: { info: { name: playlist.name, url: playlist.external_urls?.spotify, artworkUrl: playlist.images?.[0]?.url } }, platform };
    }

    async resolveSpotifyTracks(node, spotifyTracks, defaultArt = null) {
        const resolved = [];
        for (const track of spotifyTracks) {
            if (!track) continue;
            const artist = track.artists?.[0]?.name || '';
            const title = track.name || '';
            if (!title) continue;

            for (const p of this.platforms) {
                try {
                    const result = await node.rest.resolve(`${p.prefix}:${artist} ${title}`);
                    const tracks = this.extractTracks(result);
                    if (tracks.length > 0) {
                        tracks[0].info.artworkUrl = track.album?.images?.[0]?.url || defaultArt || tracks[0].info.artworkUrl;
                        tracks[0].info.uri = track.external_urls?.spotify || tracks[0].info.uri;
                        tracks[0].info.title = title;
                        tracks[0].info.author = artist;
                        tracks[0].info.sourceName = 'spotify';
                        resolved.push(tracks[0]);
                        break;
                    }
                } catch {}
            }
            await this.sleep(50);
        }
        return resolved;
    }

    // ═══════════════════════════════════════════════════════════
    // DIRECT URL SEARCH
    // ═══════════════════════════════════════════════════════════

    async searchDirect(node, url, message) {
        const platform = this.detectPlatform(url);

        const embed = new EmbedBuilder()
            .setColor(platform.color)
            .setDescription(`${emojis.loading} ${platform.emoji} ${this.getRandom(this.searchingMessages)}`);
        const loadingMessage = await message.channel.send({ embeds: [embed] });

        const lt = setTimeout(async () => {
            const e = new EmbedBuilder()
                .setColor(platform.color)
                .setDescription(
                    `${emojis.loading} ${platform.emoji} ${this.getRandom(this.searchingMessages)}\n` +
                    `${emojis.sparkle} ${this.getRandom(this.longWaitMessages)}`
                );
            await loadingMessage.edit({ embeds: [e] }).catch(() => {});
        }, 5000);

        try {
            const result = await node.rest.resolve(url);
            const tracks = this.extractTracks(result);
            clearTimeout(lt);

            if (tracks.length > 0) {
                tracks.forEach(t => { if (t.info) t.info.sourceName = platform.name.toLowerCase(); });
                return { success: true, tracks, playlist: result.loadType === 'playlist' ? result.data : null, platform, loadingMessage };
            }
            return { success: false, error: 'No results found!', loadingMessage };
        } catch (e) {
            clearTimeout(lt);
            return { success: false, error: e.message, loadingMessage };
        }
    }

    // ═══════════════════════════════════════════════════════════
    // CASCADE SEARCH
    // ═══════════════════════════════════════════════════════════

    async cascadeSearch(node, query, message) {
        const embed = new EmbedBuilder()
            .setColor(colors.info)
            .setDescription(`${emojis.loading} ${emojis.music} ${this.getRandom(this.searchingMessages)}`);
        const loadingMessage = await message.channel.send({ embeds: [embed] });

        let showLong = false;
        const lt = setTimeout(() => { showLong = true; }, 4000);

        for (const platform of this.platforms) {
            const e = new EmbedBuilder()
                .setColor(platform.color)
                .setDescription(
                    `${emojis.loading} ${platform.emoji} ${this.getRandom(this.searchingMessages)}` +
                    (showLong ? `\n${emojis.sparkle} ${this.getRandom(this.longWaitMessages)}` : '')
                );
            await loadingMessage.edit({ embeds: [e] }).catch(() => {});

            try {
                const result = await node.rest.resolve(`${platform.prefix}:${query}`);
                const tracks = this.extractTracks(result);

                if (tracks.length > 0) {
                    clearTimeout(lt);
                    tracks.forEach(t => { if (t.info) t.info.sourceName = platform.name.toLowerCase(); });

                    const found = new EmbedBuilder()
                        .setColor(platform.color)
                        .setDescription(`${emojis.success} ${platform.emoji} ${this.getRandom(this.foundMessages)}`);
                    await loadingMessage.edit({ embeds: [found] }).catch(() => {});

                    return { success: true, tracks, playlist: result.loadType === 'playlist' ? result.data : null, platform, loadingMessage };
                }
            } catch (e) {
                console.error(`[Aori] ${platform.name}:`, e.message);
            }
            await this.sleep(300);
        }

        clearTimeout(lt);
        return { success: false, error: `Could not find "${query}"!`, loadingMessage };
    }

    // ═══════════════════════════════════════════════════════════
    // UTILITIES
    // ═══════════════════════════════════════════════════════════

    extractTracks(result) {
        if (!result?.data) return [];
        switch (result.loadType) {
            case 'track': return result.data?.encoded ? [result.data] : [];
            case 'playlist': return result.data?.tracks?.filter(t => t?.encoded) || [];
            case 'search': return Array.isArray(result.data) ? result.data.filter(t => t?.encoded) : [];
            default: return Array.isArray(result.data) ? result.data.filter(t => t?.encoded) : (result.data?.encoded ? [result.data] : []);
        }
    }

    sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}

module.exports = PlatformSearcher;