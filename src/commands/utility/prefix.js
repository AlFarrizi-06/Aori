const { EmbedBuilder } = require('discord.js');
const { emojis, colors } = require('../../utils/constants');

module.exports = {
    name: 'prefix',
    aliases: ['setprefix'],
    description: 'View or change bot prefix (プレフィックス)',
    usage: 'a!prefix [new prefix]',
    category: 'utility',

    async execute(message, args, client) {
        // For now, just display the current prefix
        // You can add database integration for per-server prefixes

        const embed = new EmbedBuilder()
            .setColor(colors.info)
            .setAuthor({
                name: 'Bot Prefix / プレフィックス',
                iconURL: client.user.displayAvatarURL(),
            })
            .setDescription(`
**Current Prefix:** \`${client.prefix}\`

The prefix is **case-insensitive**, so both \`a!\` and \`A!\` work!
プレフィックスは大文字小文字を区別しません。

**Examples / 例:**
• \`a!play\`
• \`A!play\`
• \`a!help\`
            `)
            .setFooter({ text: `Aori v${client.version}` })
            .setTimestamp();

        message.reply({ embeds: [embed] });
    }
};