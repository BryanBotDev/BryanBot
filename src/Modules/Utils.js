import { ChannelType, TextChannel, VoiceChannel, CategoryChannel, DMChannel, Guild, Role, GuildMember } from "discord.js";
import { botVariables, channelVariables, guildVariables, roleVariables, userVariables, createVariable } from "./Variables.js"
import { setupSlashCommand } from "./Utils/setupSlashCommand.js";
import { setupMessage } from "./Utils/setupMessage.js";
import { loadCommands } from "./Utils/loadCommands.js";
import { setupModal } from "./Utils/setupModal.js";
import chalk from "chalk";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const formatColor = function (string) {
    const processNestedColors = (input) => {
        const regex = /(\w+|#[0-9A-Fa-f]{3,6})\{([^{}]*)\}/g;
        let hasNestedMatch = false;
        if (input === null || input === undefined) {
            return "Invalid input: " + input;
        }
        if (typeof input !== "string") {
            if (typeof input === "object") input = JSON.stringify(input, "", 2);
            else return `Invalid input type: expected string, received ${typeof input}`;
        }
        const formattedString = input.replace(regex, (match, color, text) => {
            hasNestedMatch = true;

            switch (color) {
                case 'prefix':
                    return `${chalk.grey('[')}${chalk.greenBright(text)}${chalk.grey(']')}`;
                case 'warn':
                    return chalk.hex("eda634").bold(text);
                default:
                    const baseColor = color.replace('_bold', '');
                    const applyBold = color.endsWith('_bold');
                    if (isHexColor(color)) {
                        return chalk.hex(color)(text);
                    } else if (chalk[baseColor]) {
                        return applyBold ? chalk[baseColor].bold(text) : chalk[baseColor](text);
                    }
                    return text;
            }
        });

        return hasNestedMatch ? processNestedColors(formattedString) : formattedString;
    };
    return processNestedColors(string);
};

function isHexColor(color) {
    return /^#?([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color);
}

export default {
    logger: {
        debug: (...text) => process.argv.includes("--debug") && console.log(chalk.magentaBright.bold("[DEBUG]"), ...text.map(x => formatColor(x))),
        info: (...text) => console.log(chalk.greenBright.bold("[INFO]"), ...text.map(x => formatColor(x))),
        warn: (...text) => console.log(chalk.yellowBright.bold("[WARN]"), ...text.map(x => formatColor(x))),
        error: (...text) => console.log(chalk.redBright.bold("[ERROR]"), ...text.map(x => formatColor(x))),
        addon: (...text) => console.log(chalk.yellowBright.bold("[ADDON]"), ...text.map(x => formatColor(x))),
    },

    // New logging methods
    formatColor: formatColor,
    isHexColor: isHexColor,

    loadCommands: loadCommands,
    setupMessage: setupMessage,
    setupSlashCommand: setupSlashCommand,
    setupModal: setupModal,

    createVariable: createVariable,
    botVariables: botVariables,
    userVariables: userVariables,
    roleVariables: roleVariables,
    guildVariables: guildVariables,
    channelVariables: channelVariables,

    /** @param {String} string */
    capitalizeFirstLetter: (string) => {
        return string.charAt(0).toUpperCase() + string.slice(1);
    },

    /** @param {Array} array */
    getRandom: (array) => array[Math.floor(Math.random() * array.length)],

    /** @param {string} string @param {[{ searchFor: RegExp, replaceWith: any }]} variables*/
    applyVariables(string, variables) {
        return variables.reduce((output, variable) => output.replace(variable.searchFor, variable.replaceWith), string);
    },

    /** @param {Array} array @param {number} itemsperpage @param {number} page */
    paginateArray(array, itemsperpage, page = 1) {
        const maxPages = Math.ceil(array.length / itemsperpage);
        if (page < 1 || page > maxPages) return null;
        return array.slice((page - 1) * itemsperpage, page * itemsperpage)
    },
    /**
     * @param {Guild} guild 
     * @param {String} name 
     * @param {Boolean} notify 
     * @returns {Role | undefined}
     */
    findRole(guild, name, notify = true) {
        const roleName = typeof name === "number" ? name.toString() : name;
        const role = guild.roles.cache.find((r) => {
            return r.name.toLowerCase() === roleName.toLowerCase() || r.id === roleName.toLowerCase();
        });

        if (!role && notify) {
            this.logger.error(`The role with the name or ID "${chalk.bold(name)}" was not found in the "${chalk.bold(guild.name)}" server.`);
        }

        return role;
    },
    /**
     * @param {Guild} guild 
     * @param {String} name 
     * @param {Boolean} notify 
     * @returns {GuildMember | undefined}
     */
    findMember(guild, name, notify = true) {
        const memberName = typeof name === "number" ? name.toString() : name;
        const member = guild.members.cache.find((m) => {
            return m.user.tag.toLowerCase() === memberName.toLowerCase() || m.id.toLowerCase() === memberName.toLowerCase() || m.user.username.toLowerCase() === memberName.toLowerCase();
        });

        if (!member && notify) {
            this.logger.error(`The member with the username or ID "${chalk.bold(name)}" was not found in the "${chalk.bold(guild.name)}" server.`);
        }

        return member;
    },
    /**
     * Finds a channel by type, guild, and name.
     * Redirects to `findTextChannel` or `findVoiceChannel` as needed.
     * @param {string} type - The type of the channel (e.g., "text", "voice", etc.).
     * @param {Guild} guild - The guild where the channel is located.
     * @param {string | number} name - The name or ID of the channel to search for.
     * @param {boolean} [notify=true] - Whether to log an error if the channel is not found.
     * @param {boolean} [ignoreCase=true] - Whether to ignore case when comparing channel names.
     * @returns {TextChannel | VoiceChannel | NewsChannel | ThreadChannel | StageChannel | undefined} - The found channel or `undefined` if not found.
     */
    findChannel(type, guild, name, notify = true, ignoreCase = true) {
        if (typeof name === "number") name = name.toString();
        const channels = guild.channels.cache.filter(channel => channel.type === type);
        const channel = channels.find(ch => ch.name === name || ch.id === name);

        switch (type) {
            case "text":
                return this.findTextChannel(guild, name, notify);
            case "voice":
                return this.findVoiceChannel(guild, name, notify, ignoreCase);
            case ChannelType.GuildText:
                return channel instanceof TextChannel ? channel : undefined;
            case ChannelType.GuildVoice:
                return channel instanceof VoiceChannel ? channel : undefined;
            case ChannelType.DM:
                return channel instanceof DMChannel ? channel : undefined;
            case ChannelType.GuildCategory:
                return channel instanceof CategoryChannel ? channel : undefined;
            case ChannelType.PrivateThread:
                return channel instanceof TextChannel ? channel : undefined;
            default:
                if (notify) this.logger.error(`The ${chalk.bold(ChannelType[type].toString())} channel named "${chalk.bold(name)}" could not be found in the "${chalk.bold(guild.name)}" server. Please check the channel name and its type and try again.`);
        }
    },
    /**
     * Finds a text-based channel in the guild.
     * @param {Guild} guild - The guild to search in.
     * @param {String} name - The name or ID of the channel.
     * @param {Boolean} [notify=true] - Whether to log an error if the channel is not found.
     * @returns {TextChannel | NewsChannel | ThreadChannel | undefined}
     */
    findTextChannel(guild, name, notify = true) {
        if (typeof name === "number") name = name.toString();

        const channel = guild.channels.cache.find(
            ch => (ch.isTextBased() && (ch.name === name.toLowerCase() || ch.id === name))
        );

        if (channel) {
            return channel;
        } else if (notify) {
            this.logger.error(
                `The text-based channel named "bold{${name}}" could not be found in the "bold{${guild.name}}" server.`
            );
        }

        return undefined;
    },
    /**
     * Finds a voice-based channel in the guild.
     * @param {Guild} guild - The guild to search in.
     * @param {String} name - The name or ID of the channel.
     * @param {Boolean} [notify=true] - Whether to log an error if the channel is not found.
     * @param {Boolean} ignoreCase - Specifies whether or not the matching should be case-sensitive. 
     * @returns {VoiceChannel | StageChannel | undefined}
     */
    findVoiceChannel(guild, name, notify = true, ignoreCase = true) {
        if (typeof name === "number") name = name.toString();

        const channel = guild.channels.cache.find(
            ch => (ch.isVoiceBased() && (ignoreCase ? ch.name.toLowerCase() === name.toLowerCase() : ch.name === name || ch.id === name))
        );

        if (channel) {
            return channel;
        } else if (notify) {
            this.logger.error(
                `The voice-based channel named "bold{${name}}" could not be found in the "bold{${guild.name}}" server.`
            );
        }

        return undefined;
    },
    /**
     * @param {[String]} permissions Array of role names or IDs
     * @param {GuildMember} member 
     * @returns {Boolean}
     */
    hasPermission(permissions, member) {
        if (!Array.isArray(permissions)) permissions = [permissions];
        return permissions.some((perm) => {
            const isRolePermission = this.findRole(member.guild, perm, false);
            if (isRolePermission && member.roles.cache.has(isRolePermission.id)) return true

            const isMemberPermission = this.findMember(member.guild, perm, false);
            if (isMemberPermission && member.id == isMemberPermission.id) return true;
        })
    },
    /** @param {GuildMember} member */
    getUserBadges(member) {
        const badges = {
            BugHunterLevel1: "Discord Bug Hunter Level 1",
            BugHunterLevel2: "Discord Bug Hunter Level 2",
            Staff: "Discord Staff",
            PremiumEarlySupporter: "Early Supporter",
            HypeSquadOnlineHouse3: "HypeSquad Balance",
            HypeSquadOnlineHouse1: "HypeSquad Bravery",
            HypeSquadOnlineHouse2: "HypeSquad Brilliance",
            Hypesquad: "HypeSquad Events",
            VerifiedDeveloper: "Early Verified Bot Developer",
            Partner: "Partnered Server Owner",
            CertifiedModerator: "Discord Certified Moderator",
            VerifiedBot: "Verified Bot",
            TeamPseudoUser: "Team User",
            Spammer: "Spammer",
            Quarantined: "Quarantined"
        }

        return Object.entries(badges)
            .filter(([badge, _]) => member.user.flags?.has(badge))
            .map(([_, value]) => value);
    },
    /**
     * Retrieves a user from a message based on the provided arguments.
     * @param {Message} message - The message object to extract user information from.
     * @param {number} [arg=0] - The argument index in the message content to search for the user.
     * @param {boolean} [checkFull=false] - Whether to use the full message content as the search string.
     * @returns {GuildMember|null} The found user as a GuildMember or null if no match is found.
     */
    getUserFromMessage(message, arg = 0, checkFull = false) {
        const args = message.content.split(" "); args.shift();
        const toFind = checkFull ? args.join(" ") : (args[arg] || '');

        return message.mentions.members?.first()
            || message.guild.members.cache.find(member =>
                member.user.tag.toLowerCase() == toFind.toLowerCase()
                || member.displayName.toLowerCase() == toFind.toLowerCase()
                || member.user.username.toLowerCase() == toFind.toLowerCase()
                || member.id == toFind.replace(/([<@!]|[>])/g, "")
            );
    },
    /**
     * Resolves a channel type to a human-readable name.
     * @param {ChannelType} channelType - The type of the channel to resolve.
     * @returns {string} The human-readable name of the channel type.
     */
    resolveChannelTypeName: (channelType) => {
        switch (channelType) {
            case ChannelType.GuildText:
                return "Text Channel";
            case ChannelType.GuildVoice:
                return "Voice Channel";
            case ChannelType.GuildCategory:
                return "Category";
            case ChannelType.GuildAnnouncement:
                return "Announcement Channel";
            case ChannelType.GuildStageVoice:
                return "Stage Channel";
            case ChannelType.GuildForum:
                return "Forum Channel";
            case ChannelType.GuildDirectory:
                return "Directory Channel";
            default:
                return "Unknown Channel Type";
        }
    },
    /**
     * Resolves the directory name of the current module.
     * @param {string} importMetaUrl - The `import.meta.url` of the module.
     * @returns {string} The directory name of the current module.
     */
    getDirname: (importMetaUrl) => {
        return dirname(fileURLToPath(importMetaUrl));
    }
}