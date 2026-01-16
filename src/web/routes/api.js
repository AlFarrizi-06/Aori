const express = require('express');
const router = express.Router();
const os = require('os');

// Bot Status
router.get('/status', (req, res) => {
    const client = req.client;
    
    res.json({
        status: 'online',
        bot: {
            name: client.user?.username || 'Aori Bot',
            id: client.user?.id,
            avatar: client.user?.displayAvatarURL({ size: 128 })
        },
        ping: client.ws?.ping || 0,
        uptime: client.uptime || 0,
        timestamp: Date.now()
    });
});

// Bot Statistics
router.get('/stats', (req, res) => {
    const client = req.client;
    
    res.json({
        bot: {
            name: client.user?.username,
            discriminator: client.user?.discriminator,
            id: client.user?.id
        },
        stats: {
            guilds: client.guilds?.cache?.size || 0,
            users: client.guilds?.cache?.reduce((a, g) => a + g.memberCount, 0) || 0,
            channels: client.channels?.cache?.size || 0,
            voiceConnections: client.queue?.size || 0
        },
        system: {
            platform: os.platform(),
            arch: os.arch(),
            nodeVersion: process.version,
            memory: {
                used: formatBytes(process.memoryUsage().heapUsed),
                total: formatBytes(os.totalmem())
            },
            uptime: formatUptime(client.uptime)
        },
        ping: client.ws?.ping || 0,
        timestamp: Date.now()
    });
});

// Queue for specific guild
router.get('/queue/:guildId', (req, res) => {
    const { guildId } = req.params;
    const queue = req.client.queue?.get(guildId);
    
    if (!queue) {
        return res.json({ 
            exists: false,
            queue: [], 
            current: null 
        });
    }
    
    res.json({
        exists: true,
        current: queue.current ? {
            title: queue.current.title,
            url: queue.current.url,
            duration: queue.current.duration,
            thumbnail: queue.current.thumbnail,
            requestedBy: queue.current.requestedBy?.tag
        } : null,
        songs: queue.songs?.slice(0, 10).map(song => ({
            title: song.title,
            url: song.url,
            duration: song.duration
        })) || [],
        totalSongs: queue.songs?.length || 0,
        volume: queue.volume,
        loop: queue.loop,
        playing: queue.playing
    });
});

// Guilds list (limited info for privacy)
router.get('/guilds', (req, res) => {
    const client = req.client;
    
    const guilds = client.guilds?.cache?.map(g => ({
        id: g.id,
        name: g.name,
        memberCount: g.memberCount,
        icon: g.iconURL({ size: 64 })
    })) || [];
    
    res.json({
        total: guilds.length,
        guilds: guilds.slice(0, 20) // Limit 20
    });
});

// Helper functions
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatUptime(ms) {
    if (!ms) return '0s';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

module.exports = router;