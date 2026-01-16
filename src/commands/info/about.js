const { EmbedBuilder } = require('discord.js');
const { emojis, colors } = require('../../utils/constants');

module.exports = {
    name: 'about',
    aliases: ['info', 'aori'],
    description: 'About Aori bot (Aoriについて)',
    usage: 'a!about',
    category: 'info',

    async execute(message, args, client) {
        const embed = new EmbedBuilder()
            .setColor(colors.primary)
            .setAuthor({
                name: `About ${client.config.bot.name} / Aoriについて`,
                iconURL: client.user.displayAvatarURL(),
            })
            .setDescription(`
${emojis.sparkle} **Aori Music Bot v${client.version}** ${emojis.sparkle}

Aori is a professional anime-themed music bot for Discord!
Aoriは、Discord用のプロフェッショナルなアニメテーマの音楽ボットです！

**✨ Features / 機能:**
• Multi-platform support (Deezer, SoundCloud, Spotify, Bandcamp, Apple Music)
• High quality audio streaming
• Audio filters (Nightcore, Vaporwave, Bass Boost, etc.)
• Rich presence & voice channel status
• Queue management
• 24/7 mode

**🎌 Name Origin:**
"Aori" (煽り) is a Japanese word meaning "to stir up" or "to excite" - 
perfect for a music bot that gets the party going!

**💝 Made with Aori Team for the anime community!**
            `)
            .setThumbnail(client.user.displayAvatarURL({ size: 512 }))
            .addFields(
                {
                    name: '📦 Tech Stack',
                    value: '• Discord.js v14\n• Shoukaku v4.2.0\n• Lavalink v4\n• Node.js v21',
                    inline: true
                },
                {
                    name: '🔗 Links',
                    value: '[Support Server](https://discord.gg/Urc3xG9h8f)\n[Invite Bot](https://discord.com/oauth2/authorize?client_id=1459879478330261524&permissions=66583920&integration_type=0&scope=bot+applications.commands)',
                    inline: true
                }
            )
            .setImage('https://cdn.discordapp.com/banners/1459879478330261524/d80c1a51bb2bb92951858d7d838684b7?size=1024') // Add your banner
            .setFooter({ text: `Aori v${client.version} | Anime Edition ♪` })
            .setTimestamp();

        message.reply({ embeds: [embed] });
    }
};