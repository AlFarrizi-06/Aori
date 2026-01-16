const { ActivityType } = require('discord.js');

module.exports = {
    name: 'ready',
    once: true,
    
    async execute(client) {
        console.log('');
        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║                                                            ║');
        console.log('║     ▄▀█ █▀█ █▀█ █   █ █   █▀▄▀█ █ █ █▀ █ █▀▀              ║');
        console.log('║     █▀█ █▄█ █▀▄ █   █ █   █ ▀ █ █▄█ ▄█ █ █▄▄              ║');
        console.log('║                                                            ║');
        console.log('║                    v5.23.1 - Anime Edition                 ║');
        console.log('║                                                            ║');
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log(`║  Bot: ${client.user.tag.padEnd(50)}║`);
        console.log(`║  Guilds: ${client.guilds.cache.size.toString().padEnd(47)}║`);
        console.log(`║  Users: ${client.users.cache.size.toString().padEnd(48)}║`);
        console.log(`║  Commands: ${client.commands.size.toString().padEnd(45)}║`);
        console.log(`║  Prefix: ${client.prefix.padEnd(47)}║`);
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log('║  Supported Platforms:                                      ║');
        console.log('║    • Deezer                                                ║');
        console.log('║    • SoundCloud                                            ║');
        console.log('║    • Spotify                                               ║');
        console.log('║    • Bandcamp                                              ║');
        console.log('║    • Apple Music                                           ║');
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log('║  Status: Online! ✨ (オンライン!)                           ║');
        console.log('╚════════════════════════════════════════════════════════════╝');
        console.log('');

        // Set initial presence
        client.user.setPresence({
            activities: [{
                name: `a!help | v${client.version}`,
                type: ActivityType.Listening,
            }],
            status: 'online',
        });

        // Rotating status
        const statuses = [
            { name: `a!help | v${client.version}`, type: ActivityType.Listening },
            { name: `${client.guilds.cache.size} servers ♪`, type: ActivityType.Watching },
            { name: 'Anime Music 🎵', type: ActivityType.Listening },
            { name: 'Deezer • SoundCloud • Spotify', type: ActivityType.Playing },
            { name: 'BandCamp • Apple Music • and more...', type: ActivityType.Playing },
            { name: '音楽を聴く (Listening to music)', type: ActivityType.Playing },
        ];

        let statusIndex = 0;
        setInterval(() => {
            if (!client.currentTrack) {
                client.user.setPresence({
                    activities: [statuses[statusIndex]],
                    status: 'online',
                });
                statusIndex = (statusIndex + 1) % statuses.length;
            }
        }, 30000);
    }
};