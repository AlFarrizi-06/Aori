const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { emojis, colors } = require('../../utils/constants');

module.exports = {
    name: 'invite',
    aliases: ['inv', 'addbot'],
    description: 'Get bot invite link (招待リンク)',
    usage: 'a!invite',
    category: 'info',

    async execute(message, args, client) {
        const inviteLink = `https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=66583920&scope=bot%20applications.commands`;
        
        const embed = new EmbedBuilder()
            .setColor(colors.primary)
            .setAuthor({
                name: 'Invite Aori / 招待する ♪',
                iconURL: client.user.displayAvatarURL(),
            })
            .setDescription(`
${emojis.sparkle} **Thank you for your interest in Aori!** ${emojis.sparkle}
Aoriに興味を持っていただきありがとうございます！

Click the button below to invite me to your server!
下のボタンをクリックして、サーバーに招待してください！
            `)
            .setThumbnail(client.user.displayAvatarURL({ size: 512 }))
            .addFields({
                name: '🎵 Features / 機能',
                value: '• Multi-platform music streaming\n• High quality audio\n• Audio filters & effects\n• Queue management\n• 24/7 mode'
            })
            .setFooter({ text: `Aori v${client.version}` })
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('Invite Aori / 招待する')
                    .setEmoji('🎵')
                    .setURL(inviteLink)
                    .setStyle(ButtonStyle.Link),
                new ButtonBuilder()
                    .setLabel('Support Server')
                    .setEmoji('💬')
                    .setURL('https://discord.gg/Urc3xG9h8f')
                    .setStyle(ButtonStyle.Link)
            );

        message.reply({ embeds: [embed], components: [row] });
    }
};