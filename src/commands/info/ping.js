const { EmbedBuilder } = require('discord.js');
const { emojis, colors } = require('../../utils/constants');

module.exports = {
    name: 'ping',
    aliases: ['latency', 'pong'],
    description: 'Check bot latency (レイテンシー)',
    usage: 'a!ping',
    category: 'info',

    async execute(message, args, client) {
        const loadingEmbed = new EmbedBuilder()
            .setColor(colors.info)
            .setDescription(`${emojis.loading} Pinging... (計測中...)`);

        const sent = await message.reply({ embeds: [loadingEmbed] });

        const latency = sent.createdTimestamp - message.createdTimestamp;
        const apiLatency = Math.round(client.ws.ping);

        // Get Lavalink latency
        let lavalinkLatency = 'N/A';
        const node = client.shoukaku.nodes.get('Aori-Node-1');
        if (node) {
            lavalinkLatency = `${node.stats?.cpu?.lavalinkLoad?.toFixed(2) || '0'}%`;
        }

        const getPingColor = (ping) => {
            if (ping < 100) return colors.success;
            if (ping < 200) return colors.warning;
            return colors.error;
        };

        const getPingEmoji = (ping) => {
            if (ping < 100) return '🟢';
            if (ping < 200) return '🟡';
            return '🔴';
        };

        const embed = new EmbedBuilder()
            .setColor(getPingColor(latency))
            .setAuthor({
                name: 'Pong! 🏓',
                iconURL: client.user.displayAvatarURL(),
            })
            .addFields(
                {
                    name: `${getPingEmoji(latency)} Bot Latency`,
                    value: `\`${latency}ms\``,
                    inline: true
                },
                {
                    name: `${getPingEmoji(apiLatency)} API Latency`,
                    value: `\`${apiLatency}ms\``,
                    inline: true
                },
                {
                    name: '🎵 Lavalink',
                    value: `\`${lavalinkLatency}\``,
                    inline: true
                }
            )
            .setFooter({ text: `Aori v${client.version}` })
            .setTimestamp();

        await sent.edit({ embeds: [embed] });
    }
};