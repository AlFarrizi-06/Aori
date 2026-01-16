const { EmbedBuilder } = require('discord.js');
const { emojis, colors, loadingMessages } = require('./constants');

class PlatformSearcher {
    constructor(client) {
        this.client = client;
        // Urutan: Deezer --> SoundCloud --> BandCamp --> Spotify --> Apple Music
        this.platforms = [
            { prefix: 'dzsearch', name: 'Deezer', emoji: emojis.deezer, color: colors.deezer },
            { prefix: 'scsearch', name: 'SoundCloud', emoji: emojis.soundcloud, color: colors.soundcloud },
            { prefix: 'bcsearch', name: 'Bandcamp', emoji: emojis.bandcamp, color: colors.bandcamp },
            { prefix: 'spsearch', name: 'Spotify', emoji: emojis.spotify, color: colors.spotify },
            { prefix: 'amsearch', name: 'Apple Music', emoji: emojis.applemusic, color: colors.applemusic },
        ];

        // Unknown/Link platform for random URLs
        this.unknownPlatform = {
            prefix: 'link',
            name: 'Source',
            emoji: emojis.link || '🔗',
            color: colors.dark || 0x2F3136,
        };
    }

    async search(query, message) {
        const node = this.client.getNode();
        
        if (!node) {
            throw new Error('No Lavalink nodes available');
        }

        if (this.isURL(query)) {
            if (this.isSpotifyURL(query)) {
                return await this.handleSpotifyURL(node, query, message);
            }
            return await this.searchDirect(node, query, message);
        }

        return await this.cascadeSearch(node, query, message);
    }

    isURL(string) {
        try {
            new URL(string);
            return true;
        } catch {
            return false;
        }
    }

    isSpotifyURL(url) {
        return url.toLowerCase().includes('spotify.com') || url.toLowerCase().includes('open.spotify');
    }

    getSpotifyPlatform() {
        return this.platforms.find(p => p.prefix === 'spsearch') || {
            prefix: 'spsearch',
            name: 'Spotify',
            emoji: emojis.spotify,
            color: colors.spotify
        };
    }

    // Detect platform from URL - returns unknownPlatform for random links
    detectPlatform(url) {
        const urlLower = url.toLowerCase();
        
        if (urlLower.includes('deezer.com')) {
            return this.platforms.find(p => p.prefix === 'dzsearch');
        }
        if (urlLower.includes('soundcloud.com')) {
            return this.platforms.find(p => p.prefix === 'scsearch');
        }
        if (urlLower.includes('bandcamp.com')) {
            return this.platforms.find(p => p.prefix === 'bcsearch');
        }
        if (urlLower.includes('spotify.com') || urlLower.includes('open.spotify')) {
            return this.platforms.find(p => p.prefix === 'spsearch');
        }
        if (urlLower.includes('music.apple.com')) {
            return this.platforms.find(p => p.prefix === 'amsearch');
        }
        
        // Return unknown platform for random/unknown links
        return this.unknownPlatform;
    }

    // Handle Spotify URLs
    async handleSpotifyURL(node, url, message) {
        const spotify = this.client.spotify;
        
        if (!spotify || !spotify.extractSpotifyId) {
            console.log('[Aori] Spotify client not available, using direct resolve...');
            return await this.searchDirect(node, url, message);
        }

        const extracted = spotify.extractSpotifyId(url);
        
        if (!extracted) {
            return await this.searchDirect(node, url, message);
        }

        const { type, id } = extracted;
        const platform = this.getSpotifyPlatform();

        const loadingEmbed = new EmbedBuilder()
            .setColor(platform.color)
            .setDescription(`${emojis.loading} ${platform.emoji} Loading Spotify ${type}... (Spotify ${type}を読み込み中...)`)
            .setFooter({ text: `Aori v${this.client.version}` });

        const loadingMsg = await message.channel.send({ embeds: [loadingEmbed] });

        try {
            const lavalinkResult = await this.tryLavalinkResolve(node, url, platform);
            
            if (lavalinkResult.success) {
                await loadingMsg.delete().catch(() => {});
                return lavalinkResult;
            }

            switch (type) {
                case 'artist':
                    return await this.handleSpotifyArtist(node, id, loadingMsg, platform);
                case 'album':
                    return await this.handleSpotifyAlbum(node, id, loadingMsg, platform);
                case 'playlist':
                    return await this.handleSpotifyPlaylist(node, id, loadingMsg, platform);
                case 'track':
                    return await this.handleSpotifyTrack(node, id, loadingMsg, platform);
                default:
                    await loadingMsg.delete().catch(() => {});
                    return { success: false, error: 'Unknown Spotify URL type' };
            }
        } catch (error) {
            console.error('[Aori] Spotify URL handling error:', error);
            await loadingMsg.delete().catch(() => {});
            return { success: false, error: `Failed to load: ${error.message}` };
        }
    }

    async tryLavalinkResolve(node, url, forcePlatform = null) {
        try {
            const result = await node.rest.resolve(url);
            const tracks = this.extractTracks(result);
            
            if (tracks.length > 0) {
                // Mark tracks with original platform
                const platformName = forcePlatform?.name?.toLowerCase() || 'link';
                tracks.forEach(track => {
                    if (track.info) {
                        track.info.sourceName = platformName;
                    }
                });

                return {
                    success: true,
                    tracks: tracks,
                    playlist: result.loadType === 'playlist' ? result.data : null,
                    platform: forcePlatform || this.detectPlatform(url),
                };
            }
        } catch (e) {
            console.log('[Aori] Lavalink resolve failed, using fallback...');
        }
        
        return { success: false };
    }

    // Handle Spotify Track
    async handleSpotifyTrack(node, trackId, loadingMsg, platform) {
        const spotify = this.client.spotify;

        try {
            const track = await spotify.getTrack(trackId);

            if (!track) {
                await this.showError(loadingMsg, 'Track not found on Spotify! (トラックが見つかりません)');
                return { success: false, error: 'Track not found' };
            }

            const artistName = track.artists?.[0]?.name || '';
            const trackName = track.name || '';
            
            const searchingEmbed = new EmbedBuilder()
                .setColor(platform.color)
                .setDescription(`${emojis.loading} ${platform.emoji} Searching for **${trackName}**... (検索中...)`)
                .setFooter({ text: `Aori v${this.client.version}` });
            
            await loadingMsg.edit({ embeds: [searchingEmbed] }).catch(() => {});

            // Try each platform to find the track
            for (const searchPlatform of this.platforms) {
                const searchQuery = `${searchPlatform.prefix}:${artistName} ${trackName}`;
                
                try {
                    const result = await node.rest.resolve(searchQuery);
                    const tracks = this.extractTracks(result);
                    
                    if (tracks.length > 0) {
                        tracks[0].info.artworkUrl = track.album?.images?.[0]?.url || tracks[0].info.artworkUrl;
                        tracks[0].info.uri = track.external_urls?.spotify || tracks[0].info.uri;
                        tracks[0].info.title = trackName;
                        tracks[0].info.author = artistName;
                        tracks[0].info.sourceName = 'spotify';

                        await this.showSuccess(loadingMsg, `${platform.emoji} Found **${trackName}** by **${artistName}**! (見つかりました!)`, platform.color);

                        return {
                            success: true,
                            tracks: [tracks[0]],
                            playlist: null,
                            platform: platform,
                        };
                    }
                } catch (e) {
                    continue;
                }
            }

            await this.showError(loadingMsg, `Could not find "${trackName}" on any source! (見つかりませんでした)`);
            return { success: false, error: 'Track not found on any source' };

        } catch (error) {
            console.error('[Aori] Spotify track error:', error);
            await this.showError(loadingMsg, 'Failed to load track! (読み込み失敗)');
            return { success: false, error: 'Failed to load track' };
        }
    }

    // Handle Spotify Artist
    async handleSpotifyArtist(node, artistId, loadingMsg, platform) {
        const spotify = this.client.spotify;

        try {
            const artist = await spotify.getArtist(artistId);
            const topTracks = await spotify.getArtistTopTracks(artistId);

            if (!artist || !topTracks || topTracks.length === 0) {
                await this.showError(loadingMsg, 'Artist not found or no tracks available! (アーティストが見つかりません)');
                return { success: false, error: 'Artist not found' };
            }

            const searchingEmbed = new EmbedBuilder()
                .setColor(platform.color)
                .setDescription(`${emojis.loading} ${platform.emoji} Found **${artist.name}**! Loading ${topTracks.length} top tracks... (トップトラックを読み込み中...)`)
                .setFooter({ text: `Aori v${this.client.version}` });

            await loadingMsg.edit({ embeds: [searchingEmbed] }).catch(() => {});

            const resolvedTracks = await this.resolveSpotifyTracks(node, topTracks, artist.images?.[0]?.url);

            if (resolvedTracks.length === 0) {
                await this.showError(loadingMsg, 'Could not load any tracks from this artist! (トラックを読み込めませんでした)');
                return { success: false, error: 'No tracks could be loaded' };
            }

            await this.showSuccess(
                loadingMsg, 
                `${platform.emoji} Loaded **${resolvedTracks.length}** tracks from **${artist.name}**! (${resolvedTracks.length}曲を読み込みました!)`,
                platform.color
            );

            return {
                success: true,
                tracks: resolvedTracks,
                playlist: {
                    info: {
                        name: `${artist.name} - Top Tracks`,
                        url: artist.external_urls?.spotify,
                        artworkUrl: artist.images?.[0]?.url,
                    },
                    tracks: resolvedTracks,
                },
                platform: platform,
            };

        } catch (error) {
            console.error('[Aori] Spotify artist error:', error);
            await this.showError(loadingMsg, 'Failed to load artist! (読み込み失敗)');
            return { success: false, error: 'Failed to load artist' };
        }
    }

    // Handle Spotify Album
    async handleSpotifyAlbum(node, albumId, loadingMsg, platform) {
        const spotify = this.client.spotify;

        try {
            const album = await spotify.getAlbum(albumId);

            if (!album || !album.tracks?.items?.length) {
                await this.showError(loadingMsg, 'Album not found or empty! (アルバムが見つかりません)');
                return { success: false, error: 'Album not found' };
            }

            const albumTracks = album.tracks.items;

            const searchingEmbed = new EmbedBuilder()
                .setColor(platform.color)
                .setDescription(`${emojis.loading} ${platform.emoji} Found **${album.name}** by **${album.artists[0]?.name}**!\nLoading ${albumTracks.length} tracks... (${albumTracks.length}曲を読み込み中...)`)
                .setFooter({ text: `Aori v${this.client.version}` });

            await loadingMsg.edit({ embeds: [searchingEmbed] }).catch(() => {});

            const tracksToResolve = albumTracks.map(track => ({
                name: track.name,
                artists: track.artists,
                album: { images: album.images },
                external_urls: track.external_urls,
                duration_ms: track.duration_ms,
            }));

            const resolvedTracks = await this.resolveSpotifyTracks(node, tracksToResolve, album.images?.[0]?.url);

            if (resolvedTracks.length === 0) {
                await this.showError(loadingMsg, 'Could not load any tracks from this album! (トラックを読み込めませんでした)');
                return { success: false, error: 'No tracks could be loaded' };
            }

            await this.showSuccess(
                loadingMsg,
                `${platform.emoji} Loaded **${resolvedTracks.length}/${albumTracks.length}** tracks from **${album.name}**! (読み込み完了!)`,
                platform.color
            );

            return {
                success: true,
                tracks: resolvedTracks,
                playlist: {
                    info: {
                        name: `${album.name} - ${album.artists[0]?.name}`,
                        url: album.external_urls?.spotify,
                        artworkUrl: album.images?.[0]?.url,
                    },
                    tracks: resolvedTracks,
                },
                platform: platform,
            };

        } catch (error) {
            console.error('[Aori] Spotify album error:', error);
            await this.showError(loadingMsg, 'Failed to load album! (読み込み失敗)');
            return { success: false, error: 'Failed to load album' };
        }
    }

    // Handle Spotify Playlist
    async handleSpotifyPlaylist(node, playlistId, loadingMsg, platform) {
        const spotify = this.client.spotify;

        try {
            const playlist = await spotify.getPlaylist(playlistId);

            if (!playlist || !playlist.tracks?.items?.length) {
                await this.showError(loadingMsg, 'Playlist not found or empty! (プレイリストが見つかりません)');
                return { success: false, error: 'Playlist not found' };
            }

            const playlistTracks = playlist.tracks.items
                .filter(item => item && item.track && !item.track.is_local)
                .map(item => item.track);

            if (playlistTracks.length === 0) {
                await this.showError(loadingMsg, 'No playable tracks in this playlist! (再生可能なトラックがありません)');
                return { success: false, error: 'No playable tracks' };
            }

            const searchingEmbed = new EmbedBuilder()
                .setColor(platform.color)
                .setDescription(`${emojis.loading} ${platform.emoji} Found **${playlist.name}**!\nLoading ${playlistTracks.length} tracks... (${playlistTracks.length}曲を読み込み中...)`)
                .setFooter({ text: `Aori v${this.client.version} • This may take a moment...` });

            await loadingMsg.edit({ embeds: [searchingEmbed] }).catch(() => {});

            const tracksToResolve = playlistTracks.slice(0, 50);
            const resolvedTracks = await this.resolveSpotifyTracks(node, tracksToResolve, playlist.images?.[0]?.url);

            if (resolvedTracks.length === 0) {
                await this.showError(loadingMsg, 'Could not load any tracks from this playlist! (トラックを読み込めませんでした)');
                return { success: false, error: 'No tracks could be loaded' };
            }

            const loadedInfo = playlistTracks.length > 50 
                ? `Loaded **${resolvedTracks.length}** tracks (limited to first 50)`
                : `Loaded **${resolvedTracks.length}/${playlistTracks.length}** tracks`;

            await this.showSuccess(
                loadingMsg,
                `${platform.emoji} ${loadedInfo} from **${playlist.name}**! (読み込み完了!)`,
                platform.color
            );

            return {
                success: true,
                tracks: resolvedTracks,
                playlist: {
                    info: {
                        name: playlist.name,
                        url: playlist.external_urls?.spotify,
                        artworkUrl: playlist.images?.[0]?.url,
                        owner: playlist.owner?.display_name,
                    },
                    tracks: resolvedTracks,
                },
                platform: platform,
            };

        } catch (error) {
            console.error('[Aori] Spotify playlist error:', error);
            await this.showError(loadingMsg, 'Failed to load playlist! (読み込み失敗)');
            return { success: false, error: 'Failed to load playlist' };
        }
    }

    // Resolve Spotify tracks - keep Spotify metadata
    async resolveSpotifyTracks(node, spotifyTracks, defaultArtwork = null) {
        const resolvedTracks = [];
        
        for (const track of spotifyTracks) {
            if (!track) continue;
            
            const artistName = track.artists?.[0]?.name || '';
            const trackName = track.name || '';
            
            if (!trackName) continue;

            let found = false;

            // Try each platform
            for (const platform of this.platforms) {
                if (found) break;
                
                const searchQuery = `${platform.prefix}:${artistName} ${trackName}`;
                
                try {
                    const result = await node.rest.resolve(searchQuery);
                    const tracks = this.extractTracks(result);
                    
                    if (tracks.length > 0) {
                        const resolvedTrack = tracks[0];
                        
                        // Keep Spotify metadata
                        resolvedTrack.info.artworkUrl = track.album?.images?.[0]?.url || defaultArtwork || resolvedTrack.info.artworkUrl;
                        resolvedTrack.info.uri = track.external_urls?.spotify || resolvedTrack.info.uri;
                        resolvedTrack.info.title = trackName;
                        resolvedTrack.info.author = artistName;
                        resolvedTrack.info.sourceName = 'spotify';
                        
                        resolvedTracks.push(resolvedTrack);
                        found = true;
                    }
                } catch (e) {
                    continue;
                }
            }

            await this.sleep(50);
        }

        return resolvedTracks;
    }

    // Show error message
    async showError(loadingMsg, message) {
        const errorEmbed = new EmbedBuilder()
            .setColor(colors.error)
            .setDescription(`${emojis.error} ${message}`)
            .setFooter({ text: `Aori v${this.client.version}` });

        await loadingMsg.edit({ embeds: [errorEmbed] }).catch(() => {});
        setTimeout(() => loadingMsg.delete().catch(() => {}), 5000);
    }

    // Show success message
    async showSuccess(loadingMsg, message, color) {
        const successEmbed = new EmbedBuilder()
            .setColor(color || colors.success)
            .setDescription(`${emojis.success} ${message}`)
            .setFooter({ text: `Aori v${this.client.version}` });

        await loadingMsg.edit({ embeds: [successEmbed] }).catch(() => {});
        setTimeout(() => loadingMsg.delete().catch(() => {}), 2000);
    }

    // Extract tracks from Lavalink result
    extractTracks(result) {
        if (!result || !result.data) return [];

        let tracks = [];

        switch (result.loadType) {
            case 'track':
                if (result.data?.encoded && result.data?.info) {
                    tracks = [result.data];
                }
                break;
            case 'playlist':
                if (result.data?.tracks && Array.isArray(result.data.tracks)) {
                    tracks = result.data.tracks.filter(t => t?.encoded && t?.info);
                }
                break;
            case 'search':
                if (Array.isArray(result.data)) {
                    tracks = result.data.filter(t => t?.encoded && t?.info);
                }
                break;
            default:
                if (Array.isArray(result.data)) {
                    tracks = result.data.filter(t => t?.encoded && t?.info);
                } else if (result.data?.encoded && result.data?.info) {
                    tracks = [result.data];
                }
        }

        return tracks;
    }

    // Direct search for URLs (including random/unknown links)
    async searchDirect(node, url, message) {
        const platform = this.detectPlatform(url);
        
        // Use dark color for unknown links
        const loadingEmbed = new EmbedBuilder()
            .setColor(platform.color)
            .setDescription(`${emojis.loading} ${platform.emoji} ${loadingMessages.loadingTrack}`)
            .setFooter({ text: `Aori v${this.client.version}` });

        const loadingMsg = await message.channel.send({ embeds: [loadingEmbed] });

        try {
            const result = await node.rest.resolve(url);
            const tracks = this.extractTracks(result);

            await loadingMsg.delete().catch(() => {});

            if (tracks.length > 0) {
                // Mark tracks with platform info
                const platformName = platform.name.toLowerCase();
                tracks.forEach(track => {
                    if (track.info) {
                        track.info.sourceName = platformName;
                    }
                });

                return {
                    success: true,
                    tracks: tracks,
                    playlist: result.loadType === 'playlist' ? result.data : null,
                    platform: platform,
                };
            }

            return { success: false, error: 'No results found for this URL' };
        } catch (error) {
            await loadingMsg.delete().catch(() => {});
            return { success: false, error: `Failed to load: ${error.message}` };
        }
    }

    // Cascade search through platforms (no warning between platforms)
    async cascadeSearch(node, query, message) {
        const loadingEmbed = new EmbedBuilder()
            .setColor(colors.info)
            .setDescription(`${emojis.loading} ${emojis.music} Searching for your song... (検索中...)`)
            .setFooter({ text: `Aori v${this.client.version} • ${this.getPlatformOrder()}` });

        const loadingMsg = await message.channel.send({ embeds: [loadingEmbed] });

        const triedPlatforms = [];

        for (let i = 0; i < this.platforms.length; i++) {
            const platform = this.platforms[i];
            triedPlatforms.push(platform.name);
            
            // Show loading for current platform
            const searchingEmbed = new EmbedBuilder()
                .setColor(platform.color)
                .setDescription(`${emojis.loading} ${platform.emoji} Searching on **${platform.name}**... (${platform.name}で検索中...)`)
                .setFooter({ text: `Platform ${i + 1}/${this.platforms.length} • ${this.getPlatformOrder()}` });

            await loadingMsg.edit({ embeds: [searchingEmbed] }).catch(() => {});

            try {
                const searchQuery = `${platform.prefix}:${query}`;
                const result = await node.rest.resolve(searchQuery);
                const tracks = this.extractTracks(result);

                if (tracks.length > 0) {
                    // Found! Mark tracks with platform
                    tracks.forEach(track => {
                        if (track.info) {
                            track.info.sourceName = platform.name.toLowerCase();
                        }
                    });

                    const successEmbed = new EmbedBuilder()
                        .setColor(platform.color)
                        .setDescription(`${emojis.success} ${platform.emoji} Found on **${platform.name}**! (${platform.name}で見つかりました!)`)
                        .setFooter({ text: `Aori v${this.client.version}` });

                    await loadingMsg.edit({ embeds: [successEmbed] });
                    setTimeout(() => loadingMsg.delete().catch(() => {}), 2000);

                    return {
                        success: true,
                        tracks: tracks,
                        playlist: result.loadType === 'playlist' ? result.data : null,
                        platform: platform,
                    };
                }

                // Not found, continue to next platform silently
                if (i < this.platforms.length - 1) {
                    await this.sleep(200);
                }

            } catch (error) {
                console.error(`[Aori] Error searching on ${platform.name}:`, error.message);
            }
        }

        // Only show warning/error after ALL platforms have been tried
        const notFoundEmbed = new EmbedBuilder()
            .setColor(colors.error)
            .setDescription(`${emojis.warning} No results found for "**${query}**"\n\n${emojis.error} Searched on: ${triedPlatforms.join(', ')}\n\n(どのプラットフォームでも見つかりませんでした)`)
            .setFooter({ text: 'Try a different search query • 別のキーワードをお試しください' });

        await loadingMsg.edit({ embeds: [notFoundEmbed] });
        setTimeout(() => loadingMsg.delete().catch(() => {}), 7000);

        return { success: false, error: 'No results found on any platform' };
    }

    getPlatformOrder() {
        return this.platforms.map(p => p.name).join(' → ');
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = PlatformSearcher;
