require('dotenv').config();

module.exports = {
    bot: {
        token: process.env.DISCORD_TOKEN,
        clientId: process.env.CLIENT_ID,
        prefix: process.env.DEFAULT_PREFIX || 'a!',
        ownerId: process.env.OWNER_ID,
        version: '5.23.1',
        name: 'Aori',
        color: '#FF69B4',
        embedColor: 0xFF69B4,
    },

    lavalink: {
        nodes: [
            {
                name: 'Aori-Node-1',
                url: `${process.env.LAVALINK_HOST}:${process.env.LAVALINK_PORT}`,
                auth: process.env.LAVALINK_PASSWORD,
                secure: process.env.LAVALINK_SECURE === 'true',
            }
        ],
        // ✅ SHOUKAKU OPTIONS
        options: {
            moveOnDisconnect: false,
            resume: true,
            resumeTimeout: 60,
            resumeByLibrary: true,
            reconnectTries: -1,          // Unlimited
            reconnectInterval: 10000,    // 10 detik
            restTimeout: 60000,
        }
    },

    searchPlatforms: [
        'dzsearch',
        'scsearch',
        'bcsearch',
        'spsearch',
        'amsearch',
    ],

    cooldown: 10000,
    maxVolume: 100,
    defaultVolume: 50,
};