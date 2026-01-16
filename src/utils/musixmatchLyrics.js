const crypto = require('node:crypto');
const https = require('node:https');

const APP_ID = 'web-desktop-app-v1.0';
const TOKEN_TTL = 55000;
const CACHE_TTL = 180000;
const MAX_CACHE_SIZE = 100;

const ENDPOINTS = Object.freeze({
    TOKEN: 'https://apic-desktop.musixmatch.com/ws/1.1/token.get',
    SEARCH: 'https://apic-desktop.musixmatch.com/ws/1.1/track.search',
    LYRICS: 'https://apic-desktop.musixmatch.com/ws/1.1/track.lyrics.get',
    SUBTITLES: 'https://apic-desktop.musixmatch.com/ws/1.1/track.subtitle.get'
});

const CLEAN_PATTERNS = [
    /\s*\([^)]*(?:official|lyrics?|video|audio|mv|visualizer|color\s*coded|hd|4k|prod\.)[^)]*\)/gi,
    /\s*\[[^\]]*(?:official|lyrics?|video|audio|mv|visualizer|color\s*coded|hd|4k|prod\.)[^\]]*\]/gi,
    /\s*-\s*Topic$/i,
    /VEVO$/i
];

const FEAT_PATTERN = /\s*[([]\s*(?:ft\.?|feat\.?|featuring)\s+[^)\]]+[)\]]/gi;
const SEPARATORS = [' - ', ' – ', ' — '];

const generateGuid = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });

const buildUrl = (base, params) => {
    const url = new URL(base);
    Object.entries(params).forEach(
        ([k, v]) => v !== undefined && url.searchParams.set(k, String(v))
    );
    return url.toString();
};

const cleanText = (text, removeFeat = false) => {
    let result = text;
    for (const pattern of CLEAN_PATTERNS) result = result.replace(pattern, '');
    if (removeFeat) result = result.replace(FEAT_PATTERN, '');
    return result.trim();
};

const parseQuery = (query) => {
    const cleaned = cleanText(query, true);
    for (const sep of SEPARATORS) {
        const idx = cleaned.indexOf(sep);
        if (idx > 0 && idx < cleaned.length - sep.length) {
            const artist = cleaned.slice(0, idx).trim();
            const title = cleaned.slice(idx + sep.length).trim();
            if (artist && title) return { artist, title };
        }
    }
    return { artist: null, title: cleanText(query, true) };
};

const makeRequest = (url, options = {}) => {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);

        const reqOptions = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: options.headers || {}
        };

        const req = https.request(reqOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data
                });
            });
        });

        req.on('error', reject);
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        req.end();
    });
};

class MusixmatchLyrics {
    constructor(options = {}) {
        this.signatureSecret = options.signatureSecret || null;
        this.guid = generateGuid();
        this.tokenData = null;
        this.tokenPromise = null;
        this.cookies = new Map();
        this.cache = new Map();
        this.debug = options.debug || false;
    }

    log(level, message) {
        if (this.debug || level === 'error') {
            console.log(`[Musixmatch] [${level.toUpperCase()}] ${message}`);
        }
    }

    _parseCookies(headers) {
        const setCookie = headers?.['set-cookie'];
        if (!setCookie) return;

        const list = Array.isArray(setCookie) ? setCookie : [setCookie];
        list.forEach((h) => {
            const parts = h.split(';')[0].split('=');
            if (parts.length === 2) this.cookies.set(parts[0].trim(), parts[1].trim());
        });
    }

    _getCookies() {
        return this.cookies.size === 0
            ? ''
            : Array.from(this.cookies, ([k, v]) => `${k}=${v}`).join('; ');
    }

    _signUrl(url) {
        if (!this.signatureSecret) throw new Error('signatureSecret not configured');

        const dt = new Date();
        const timestamp = `${dt.getUTCFullYear()}${String(dt.getUTCMonth() + 1).padStart(2, '0')}${String(dt.getUTCDate()).padStart(2, '0')}`;
        const signature = crypto
            .createHmac('sha1', this.signatureSecret)
            .update(url + timestamp)
            .digest('base64');

        return `${url}&signature=${encodeURIComponent(signature)}&signature_protocol=sha1`;
    }

    async _fetchToken() {
        const url = buildUrl(ENDPOINTS.TOKEN, { app_id: APP_ID });

        const { statusCode, headers, body } = await makeRequest(url, {
            method: 'GET',
            headers: {
                'accept': '*/*',
                'accept-language': 'en',
                'cookie': 'AWSELB=unknown; x-mxm-user-id=undefined; x-mxm-token-guid=undefined; mxm-encrypted-token=',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
            }
        });

        this._parseCookies(headers);

        if (statusCode !== 200) throw new Error(`HTTP ${statusCode}`);

        const parsed = JSON.parse(body);
        const token = parsed?.message?.body?.user_token;

        if (!token) {
            const hint = parsed?.message?.header?.hint;
            throw new Error(hint || 'No token in response');
        }

        return token;
    }

    async _getToken(force = false) {
        const now = Date.now();

        if (!force && this.tokenData && now < this.tokenData.expires) {
            return this.tokenData.value;
        }

        if (this.tokenPromise) return this.tokenPromise;

        this.tokenPromise = (async () => {
            try {
                const token = await this._fetchToken();
                this.tokenData = { value: token, expires: now + TOKEN_TTL };
                return token;
            } finally {
                this.tokenPromise = null;
            }
        })();

        return this.tokenPromise;
    }

    async _request(endpoint, params) {
        const useSignature = !!this.signatureSecret;
        const token = useSignature ? null : await this._getToken();

        let url = buildUrl(endpoint, {
            ...params,
            app_id: APP_ID,
            ...(token ? { usertoken: token } : {}),
            guid: this.guid
        });

        if (useSignature) url = this._signUrl(url);

        const { statusCode, headers, body } = await makeRequest(url, {
            method: 'GET',
            headers: {
                'accept': 'application/json',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'cookie': this._getCookies()
            }
        });

        if (!useSignature) this._parseCookies(headers);

        const parsed = JSON.parse(body);
        const apiStatus = parsed?.message?.header?.status_code;

        if (statusCode === 401 || statusCode === 403 || apiStatus === 401 || apiStatus === 403) {
            if (!useSignature) {
                this.tokenData = null;
                this.cookies.clear();
                const newToken = await this._getToken(true);

                const retryUrl = buildUrl(endpoint, {
                    ...params,
                    app_id: APP_ID,
                    usertoken: newToken,
                    guid: this.guid
                });

                const { statusCode: rs, headers: rh, body: rb } = await makeRequest(retryUrl, {
                    method: 'GET',
                    headers: {
                        'accept': 'application/json',
                        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'cookie': this._getCookies()
                    }
                });

                this._parseCookies(rh);
                const retryParsed = JSON.parse(rb);

                if (rs !== 200 || retryParsed?.message?.header?.status_code !== 200) {
                    return null;
                }

                return retryParsed.message.body;
            }
            return null;
        }

        return statusCode === 200 && apiStatus === 200 ? parsed.message.body : null;
    }

    async _search(artist, title) {
        const params = {};
        if (artist) params.q_artist = artist;
        if (title) params.q_track = title;

        const body = await this._request(ENDPOINTS.SEARCH, {
            ...params,
            page_size: '5',
            page: '1',
            s_track_rating: 'desc'
        });

        if (!body?.track_list?.length) return null;

        const tracks = body.track_list.map((item) => {
            const track = item.track;
            const tTitle = track.track_name.toLowerCase();
            const tArtist = track.artist_name.toLowerCase();
            const sTitle = (title || '').toLowerCase();
            const sArtist = (artist || '').toLowerCase();

            let score = track.track_rating / 10;

            if (tTitle === sTitle) score += 100;
            else if (tTitle.includes(sTitle)) score += 50;
            else if (sTitle.includes(tTitle)) score += 30;

            if (artist) {
                if (tArtist === sArtist) score += 100;
                else if (tArtist.includes(sArtist)) score += 50;
                else if (sArtist.includes(tArtist)) score += 30;
            }

            return { track, score };
        });

        tracks.sort((a, b) => b.score - a.score);
        return tracks[0]?.track || null;
    }

    async _getLyrics(trackId) {
        const body = await this._request(ENDPOINTS.LYRICS, { track_id: trackId });
        return body?.lyrics?.lyrics_body || null;
    }

    async _getSubtitles(trackId) {
        const body = await this._request(ENDPOINTS.SUBTITLES, {
            track_id: trackId,
            subtitle_format: 'mxm'
        });

        const subBody = body?.subtitle?.subtitle_body;
        if (!subBody) return null;

        try {
            const parsed = JSON.parse(subBody);
            const arr = Array.isArray(parsed) ? parsed : [];
            if (arr.length === 0) return null;

            return arr.map((item) => ({
                text: String(item?.text ?? ''),
                time: Math.round((item?.time?.total || 0) * 1000),
                duration: Math.round((item?.time?.duration || 0) * 1000)
            }));
        } catch {
            return null;
        }
    }

    _cacheKey(artist, title) {
        return `${(artist || '').toLowerCase().trim()}|${title.toLowerCase().trim()}`;
    }

    _getCache(key) {
        const entry = this.cache.get(key);
        if (!entry) return undefined;
        if (entry.expires > Date.now()) return entry.value;
        this.cache.delete(key);
        return undefined;
    }

    _setCache(key, value) {
        if (this.cache.size >= MAX_CACHE_SIZE) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey) this.cache.delete(firstKey);
        }
        this.cache.set(key, { value, expires: Date.now() + CACHE_TTL });
    }

    async getLyrics(trackInfo) {
        try {
            const { title, author } = trackInfo;

            if (!title) return null;

            const parsed = parseQuery(title);
            const cleanAuthor = cleanText(author || '', false);
            const artist = parsed.artist || cleanAuthor;
            const trackTitle = parsed.artist ? parsed.title : cleanText(title, true);

            const cacheKey = this._cacheKey(artist, trackTitle);
            const cached = this._getCache(cacheKey);
            if (cached !== undefined) {
                this.log('info', 'Cache hit');
                return cached;
            }

            this.log('info', `Searching: "${trackTitle}" by "${artist}"`);

            let track = artist && trackTitle ? await this._search(artist, trackTitle) : null;
            if (!track && trackTitle) track = await this._search(null, trackTitle);

            if (!track) {
                this.log('info', 'No track found');
                this._setCache(cacheKey, null);
                return null;
            }

            this.log('info', `Found: "${track.track_name}" by ${track.artist_name}`);

            const [subtitlesResult, lyricsResult] = await Promise.allSettled([
                this._getSubtitles(track.track_id),
                this._getLyrics(track.track_id)
            ]);

            const subtitles = subtitlesResult.status === 'fulfilled' ? subtitlesResult.value : null;
            const lyrics = lyricsResult.status === 'fulfilled' ? lyricsResult.value : null;

            let result = null;

            if (subtitles?.length > 0) {
                result = {
                    synced: true,
                    lines: subtitles,
                    track: {
                        name: track.track_name,
                        artist: track.artist_name,
                        album: track.album_name
                    }
                };
            } else if (lyrics) {
                const lines = lyrics
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line && !line.startsWith('*'))
                    .map(text => ({ text, time: 0, duration: 0 }));

                if (lines.length > 0) {
                    result = {
                        synced: false,
                        lines,
                        track: {
                            name: track.track_name,
                            artist: track.artist_name,
                            album: track.album_name
                        }
                    };
                }
            }

            if (result) {
                this.log('info', `Success: ${result.lines.length} lines (synced: ${result.synced})`);
            }

            this._setCache(cacheKey, result);
            return result;

        } catch (error) {
            this.log('error', `Failed: ${error.message}`);
            return null;
        }
    }

    clearCache() {
        this.cache.clear();
    }
}

// Singleton instance
let instance = null;

function getMusixmatch(options = {}) {
    if (!instance) {
        instance = new MusixmatchLyrics(options);
    }
    return instance;
}

module.exports = { MusixmatchLyrics, getMusixmatch };