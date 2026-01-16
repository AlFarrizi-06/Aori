const SpotifyWebApi = require('spotify-web-api-node');

class SpotifyManager {
    constructor() {
        this.spotify = new SpotifyWebApi({
            clientId: process.env.SPOTIFY_CLIENT_ID,
            clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
        });
        
        this.tokenExpiry = 0;
        this.isReady = false;
    }

    async initialize() {
        if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
            console.log('[Aori] ⚠️ Spotify API credentials not found. Some features may be limited.');
            return false;
        }

        try {
            await this.refreshToken();
            this.isReady = true;
            console.log('[Aori] ✅ Spotify API connected!');
            return true;
        } catch (error) {
            console.error('[Aori] ❌ Spotify API error:', error.message);
            return false;
        }
    }

    async refreshToken() {
        try {
            const data = await this.spotify.clientCredentialsGrant();
            this.spotify.setAccessToken(data.body.access_token);
            // Token expires in 1 hour, refresh 5 minutes before
            this.tokenExpiry = Date.now() + (data.body.expires_in - 300) * 1000;
            console.log('[Aori] 🔄 Spotify token refreshed!');
        } catch (error) {
            console.error('[Aori] ❌ Failed to refresh Spotify token:', error.message);
            throw error;
        }
    }

    async ensureToken() {
        if (Date.now() >= this.tokenExpiry) {
            await this.refreshToken();
        }
    }

    // Extract Spotify ID from URL
    extractSpotifyId(url) {
        try {
            const urlObj = new URL(url);
            const path = urlObj.pathname;
            
            // Match /track/ID, /album/ID, /playlist/ID, /artist/ID
            const match = path.match(/\/(track|album|playlist|artist)\/([a-zA-Z0-9]+)/);
            if (match) {
                return {
                    type: match[1],
                    id: match[2]
                };
            }
            return null;
        } catch {
            return null;
        }
    }

    // Get Artist Info
    async getArtist(artistId) {
        if (!this.isReady) return null;
        
        try {
            await this.ensureToken();
            const data = await this.spotify.getArtist(artistId);
            return data.body;
        } catch (error) {
            console.error('[Aori] Spotify getArtist error:', error.message);
            return null;
        }
    }

    // Get Artist's Top Tracks
    async getArtistTopTracks(artistId, country = 'US') {
        if (!this.isReady) return [];
        
        try {
            await this.ensureToken();
            const data = await this.spotify.getArtistTopTracks(artistId, country);
            return data.body.tracks || [];
        } catch (error) {
            console.error('[Aori] Spotify getArtistTopTracks error:', error.message);
            return [];
        }
    }

    // Get Album Info
    async getAlbum(albumId) {
        if (!this.isReady) return null;
        
        try {
            await this.ensureToken();
            const data = await this.spotify.getAlbum(albumId);
            return data.body;
        } catch (error) {
            console.error('[Aori] Spotify getAlbum error:', error.message);
            return null;
        }
    }

    // Get Playlist Info
    async getPlaylist(playlistId) {
        if (!this.isReady) return null;
        
        try {
            await this.ensureToken();
            const data = await this.spotify.getPlaylist(playlistId);
            return data.body;
        } catch (error) {
            console.error('[Aori] Spotify getPlaylist error:', error.message);
            return null;
        }
    }

    // Get Track Info
    async getTrack(trackId) {
        if (!this.isReady) return null;
        
        try {
            await this.ensureToken();
            const data = await this.spotify.getTrack(trackId);
            return data.body;
        } catch (error) {
            console.error('[Aori] Spotify getTrack error:', error.message);
            return null;
        }
    }

    // Search tracks
    async searchTracks(query, limit = 10) {
        if (!this.isReady) return [];
        
        try {
            await this.ensureToken();
            const data = await this.spotify.searchTracks(query, { limit });
            return data.body.tracks?.items || [];
        } catch (error) {
            console.error('[Aori] Spotify searchTracks error:', error.message);
            return [];
        }
    }

    // Format duration from ms
    formatDuration(ms) {
        if (!ms) return '0:00';
        const seconds = Math.floor((ms / 1000) % 60);
        const minutes = Math.floor((ms / (1000 * 60)) % 60);
        const hours = Math.floor(ms / (1000 * 60 * 60));

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}

module.exports = SpotifyManager;