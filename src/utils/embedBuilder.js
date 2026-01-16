const { EmbedBuilder } = require('discord.js');
const { emojis, colors } = require('./constants');

class AoriEmbed {
    static success(title, description, client) {
        return new EmbedBuilder()
            .setColor(colors.success)
            .setDescription(`${emojis.success} ${description}`)
            .setFooter({ text: `Aori v${client.version}` })
            .setTimestamp();
    }

    static error(title, description, client) {
        return new EmbedBuilder()
            .setColor(colors.error)
            .setDescription(`${emojis.error} ${description}`)
            .setFooter({ text: `Aori v${client.version}` })
            .setTimestamp();
    }

    static warning(title, description, client) {
        return new EmbedBuilder()
            .setColor(colors.warning)
            .setDescription(`${emojis.warning} ${description}`)
            .setFooter({ text: `Aori v${client.version}` })
            .setTimestamp();
    }

    static info(title, description, client) {
        return new EmbedBuilder()
            .setColor(colors.info)
            .setDescription(`${emojis.info} ${description}`)
            .setFooter({ text: `Aori v${client.version}` })
            .setTimestamp();
    }

    static loading(description, client) {
        return new EmbedBuilder()
            .setColor(colors.info)
            .setDescription(`${emojis.loading} ${description}`)
            .setFooter({ text: `Aori v${client.version}` });
    }

    static music(title, description, client) {
        return new EmbedBuilder()
            .setColor(colors.music)
            .setAuthor({
                name: title,
                iconURL: client.user.displayAvatarURL(),
            })
            .setDescription(description)
            .setFooter({ text: `Aori v${client.version}` })
            .setTimestamp();
    }
}

module.exports = AoriEmbed;