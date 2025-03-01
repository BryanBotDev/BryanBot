import { Command } from "../../Modules/Structures/Handlers/Commands.js";
import Utils from "../../Modules/Utils.js";
import { manager } from "../../index.js";
import Discord from "discord.js";
import ms from "ms";

/** @param {Discord.ApplicationCommand} command */
const getOptions = (command) => {
  const options = command.options;

  const subCommandGroups = command.options.filter(
    (o) => o.type == Discord.ApplicationCommandOptionType.SubcommandGroup
  );
  const scg = subCommandGroups
    .map((scg) => {
      const subCommands = scg.options.filter(
        (o) => o.type == Discord.ApplicationCommandOptionType.Subcommand
      );
      return subCommands
        .map((sc) => `</${command.name} ${scg.name} ${sc.name}:${command.id}>`)
        .join(", ");
    })
    .filter((x) => x)
    .join(", ");

  const subCommands = command.options.filter(
    (o) => o.type == Discord.ApplicationCommandOptionType.Subcommand
  );
  const sc = subCommands
    ? subCommands
        .map((sc) => `</${command.name} ${sc.name}:${command.id}>`)
        .join(", ")
    : "";

  return options[0]
    ? [scg ? scg : false, sc ? sc : false].filter((x) => x).join(", ")
    : `</${command.name}:${command.id}>`;
};

export default new Command({
  commandData: manager.configs.commands.General.Help,
  commandConfig: {
    dmOnly: false,
    guildOnly: true,
    requiredPermissions: { user: [], bot: [] },
  },
  LegacyRun: async (manager, message, args, prefixUsed, commandData) => {
    const subCommand = args[0];
    const lang = manager.configs.lang,
      commandsConfig = manager.configs.commands;
    const slashCommands = manager.slashCommands,
      legacyCommands = manager.commands;

    switch (subCommand) {
      case "category": {
        const type = args[1] || "general";
        const slashCommandsList = [
            ...(await manager.application.commands.fetch()).toJSON(),
            ...(await message.guild.commands.fetch()).toJSON(),
          ],
          sortedCommands = legacyCommands
            .filter(
              (cmd) => cmd.commandData.Type?.toLowerCase() == type.toLowerCase()
            )
            ?.toJSON();

        const format = Object.entries(
          lang.General.Help.AutoCompleteCategory
        ).find(([key]) => key.toLowerCase() == type.toLowerCase());
        const valueToUse = format && format[0] ? format[1] : type;

        if (!sortedCommands.length)
          return message.reply(
            Utils.setupMessage({
              configPath: lang.General.Help.NoCommandsInCategory,
              variables: [
                ...Utils.userVariables(message.member, "user"),
                { searchFor: /{type}/g, replaceWith: type },
              ],
            })
          );

        const messages = [],
          maxPages = Math.ceil(sortedCommands.length / 10),
          pageIndex = 0;
        if (maxPages == 1) {
          message.reply(
            Utils.setupMessage({
              configPath: lang.General.Help.CommandList,
              variables: [
                ...Utils.userVariables(message.member, "user"),
                { searchFor: /{max-page}/g, replaceWith: maxPages },
                { searchFor: /{current-page}/g, replaceWith: 1 },
                { searchFor: /{category}/g, replaceWith: valueToUse },
                {
                  searchFor: /{data}/g,
                  replaceWith: sortedCommands
                    .map((cmd, i) => {
                      const slashCmd = slashCommandsList.find(
                        (x) => x.name == cmd.commandData.Name
                      );
                      return [
                        `\`${i + 1}]\` **${Utils.capitalizeFirstLetter(
                          cmd.commandData.Name
                        )}** - ${cmd.commandData.Description}`,
                        getOptions(slashCmd),
                      ]
                        .filter((x) => x)
                        .join("\n");
                    })
                    .join("\n\n"),
                },
              ],
            })
          );
        } else {
          for (let i = 0; i < maxPages; i++) {
            const cmds = Utils.paginateArray(sortedCommands, 10, i + 1);
            messages.push(
              Utils.setupMessage({
                configPath: lang.General.Help.CommandList,
                variables: [
                  ...Utils.userVariables(message.member, "user"),
                  { searchFor: /{max-page}/g, replaceWith: maxPages },
                  { searchFor: /{current-page}/g, replaceWith: i + 1 },
                  { searchFor: /{category}/g, replaceWith: valueToUse },
                  {
                    searchFor: /{data}/g,
                    replaceWith: cmds
                      .map((cmd, i) => {
                        const slashCmd = slashCommandsList.find(
                          (x) => x.name == cmd.commandData.Name
                        );
                        return [
                          `\`${i + 1}]\` **${Utils.capitalizeFirstLetter(
                            cmd.commandData.Name
                          )}** - ${cmd.commandData.Description}`,
                          getOptions(slashCmd),
                        ]
                          .filter((x) => x)
                          .join("\n");
                      })
                      .join("\n\n"),
                  },
                ],
              })
            );
          }

          const getRow = (disabled) =>
            new Discord.ActionRowBuilder().addComponents([
              new Discord.ButtonBuilder({
                customId: "bryanbot_help_next",
                style: 1,
                emoji: "⏮",
              }).setDisabled(disabled ? disabled : pageIndex == 0),
              new Discord.ButtonBuilder({
                customId: "bryanbot_help_last",
                style: 1,
                emoji: "⏭",
              }).setDisabled(
                disabled ? disabled : pageIndex == messages.length - 1
              ),
            ]);
          let queueMSG = { ...messages[pageIndex], components: [getRow()] };

          message.reply(queueMSG).then(async (msg) => {
            const collector = await msg.createMessageComponentCollector({
              filter: (i) => i.user.id == message.author.id,
              time: 2 * 60 * 1000,
              componentType: "BUTTON",
            });
            collector.on("collect", async (interaction) => {
              if (
                !["bryanbot_help_next", "bryanbot_help_last"].includes(
                  interaction.customId
                )
              )
                return;

              if (
                interaction.customId == "bryanbot_help_last" &&
                pageIndex > 0
              ) {
                --pageIndex;
              } else if (
                interaction.customId == "bryanbot_help_next" &&
                pageIndex < maxPages - 1
              ) {
                ++pageIndex;
              }

              interaction.update({
                ...messages[pageIndex],
                components: [getRow()],
              });
            });

            collector.on("end", async () =>
              msg.edit({ ...messages[pageIndex], components: [getRow(true)] })
            );
          });
        }

        break;
      }
      case "command": {
        const command = args[1] || "help";

        const legacyCommand = legacyCommands.get(command),
          slashCommandsList = [
            ...(await manager.application.commands.fetch()).toJSON(),
            ...(await message.guild.commands.fetch()).toJSON(),
          ];

        const slashCommandApplication = slashCommandsList.find(
          (cmd) => cmd.name === command
        );

        if (!legacyCommand)
          return message.reply(
            Utils.setupMessage({
              configPath: lang.General.Help.CommandNotFound,
              variables: Utils.userVariables(message.member, "user"),
            })
          );

        const commandData = legacyCommand.commandData;
        if (!Array.isArray(commandData.Permission))
          commandData.Permission = [commandData.Permission];
        const commandVariables = [
          { searchFor: /{prefixUsed}/g, replaceWith: "/" },
          { searchFor: /{cmd-name}/g, replaceWith: commandData.Name },
          { searchFor: /{cmd-type}/g, replaceWith: commandData.Type },
          { searchFor: /{cmd-usage}/g, replaceWith: commandData.Usage },
          {
            searchFor: /{cmd-cooldown}/g,
            replaceWith: commandData.Cooldown ? ms(commandData.Cooldown) : "❎",
          },
          {
            searchFor: /{cmd-description}/g,
            replaceWith: commandData.Description,
          },
          {
            searchFor: /{cmd-dmOnly}/g,
            replaceWith: legacyCommand.commandConfig.dmOnly ? "✅" : "❎",
          },
          {
            searchFor: /{cmd-guildOnly}/g,
            replaceWith: legacyCommand.commandConfig.guildOnly ? "✅" : "❎",
          },
          {
            searchFor: /{cmd-isSlashCommand}/g,
            replaceWith: Array.isArray(commandData.Arguments) ? "✅" : "❎",
          },
          {
            searchFor: /{cmd-slashMentions}/g,
            replaceWith: slashCommandApplication
              ? getOptions(slashCommandApplication)
              : "❎",
          },
          {
            searchFor: /{cmd-permission}/g,
            replaceWith: commandData.Permission.map((role) => {
              if (role === "@everyone") return `@everyone`;

              const guildRole = Utils.findRole(message.guild, role, true);
              if (guildRole) return guildRole.toString();
            }).join(", "),
          },
        ];

        message.reply(
          Utils.setupMessage({
            configPath: lang.General.Help.CommandInfo,
            variables: [
              ...Utils.userVariables(message.member, "user"),
              ...commandVariables,
            ],
          })
        );
        break;
      }
      default: {
        message.reply(
          Utils.setupMessage({
            configPath: lang.General.Help.InvalidUsage,
            variables: [
              ...Utils.botVariables(manager),
              ...Utils.guildVariables(message.guild),
              ...Utils.userVariables(message.member),
              ...Utils.channelVariables(message.channel),
              { searchFor: /{prefixUsed}/, replaceWith: prefixUsed },
            ],
          })
        );
      }
    }
  },
  InteractionRun: async (manager, interaction, commandData) => {
    const subCommand = interaction.options.getSubcommand();
    const lang = manager.configs.lang,
      commandsConfig = manager.configs.commands;
    const slashCommands = manager.slashCommands,
      legacyCommands = manager.commands;

    switch (subCommand) {
      case "category": {
        const type = interaction.options.getString("type");
        const slashCommandsList = [
            ...(await manager.application.commands.fetch()).toJSON(),
            ...(await interaction.guild.commands.fetch()).toJSON(),
          ],
          sortedCommands = legacyCommands
            .filter(
              (cmd) => cmd.commandData.Type.toLowerCase() == type.toLowerCase()
            )
            ?.toJSON();

        const format = Object.entries(
          lang.General.Help.AutoCompleteCategory
        ).find(([key]) => key.toLowerCase() == type.toLowerCase());
        const valueToUse = format && format[0] ? format[1] : type;

        if (!sortedCommands.length)
          return interaction.reply(
            Utils.setupMessage({
              configPath: lang.General.Help.NoCommandsInCategory,
              variables: [
                ...Utils.userVariables(interaction.member, "user"),
                { searchFor: /{type}/g, replaceWith: type },
              ],
            })
          );

        const messages = [],
          maxPages = Math.ceil(sortedCommands.length / 10),
          pageIndex = 0;
        if (maxPages == 1) {
          interaction.reply(
            Utils.setupMessage({
              configPath: lang.General.Help.CommandList,
              variables: [
                ...Utils.userVariables(interaction.member, "user"),
                { searchFor: /{max-page}/g, replaceWith: maxPages },
                { searchFor: /{current-page}/g, replaceWith: 1 },
                { searchFor: /{category}/g, replaceWith: valueToUse },
                {
                  searchFor: /{data}/g,
                  replaceWith: sortedCommands
                    .map((cmd, i) => {
                      const slashCmd = slashCommandsList.find(
                        (x) => x.name == cmd.commandData.Name
                      );
                      return [
                        `\`${i + 1}]\` **${Utils.capitalizeFirstLetter(
                          cmd.commandData.Name
                        )}** - ${cmd.commandData.Description}`,
                        getOptions(slashCmd),
                      ]
                        .filter((x) => x)
                        .join("\n");
                    })
                    .join("\n\n"),
                },
              ],
            })
          );
        } else {
          for (let i = 0; i < maxPages; i++) {
            const cmds = Utils.paginateArray(sortedCommands, 10, i + 1);
            messages.push(
              Utils.setupMessage({
                configPath: lang.General.Help.CommandList,
                variables: [
                  ...Utils.userVariables(interaction.member, "user"),
                  { searchFor: /{max-page}/g, replaceWith: maxPages },
                  { searchFor: /{current-page}/g, replaceWith: i + 1 },
                  { searchFor: /{category}/g, replaceWith: valueToUse },
                  {
                    searchFor: /{data}/g,
                    replaceWith: cmds
                      .map((cmd, i) => {
                        const slashCmd = slashCommandsList.find(
                          (x) => x.name == cmd.commandData.Name
                        );
                        return [
                          `\`${i + 1}]\` **${Utils.capitalizeFirstLetter(
                            cmd.commandData.Name
                          )}** - ${cmd.commandData.Description}`,
                          getOptions(slashCmd),
                        ]
                          .filter((x) => x)
                          .join("\n");
                      })
                      .join("\n\n"),
                  },
                ],
              })
            );
          }

          const getRow = (disabled) =>
            new Discord.ActionRowBuilder().addComponents([
              new Discord.ButtonBuilder({
                customId: "bryanbot_help_next",
                style: 1,
                emoji: "⏮",
              }).setDisabled(disabled ? disabled : pageIndex == 0),
              new Discord.ButtonBuilder({
                customId: "bryanbot_help_last",
                style: 1,
                emoji: "⏭",
              }).setDisabled(
                disabled ? disabled : pageIndex == messages.length - 1
              ),
            ]);
          let queueMSG = { ...messages[pageIndex], components: [getRow()] };

          interaction
            .reply({ fetchReply: true, ...queueMSG })
            .then(async (msg) => {
              const collector = await msg.createMessageComponentCollector({
                filter: (i) => i.user.id == message.author.id,
                time: 2 * 60 * 1000,
                componentType: "BUTTON",
              });
              collector.on("collect", async (interaction) => {
                if (
                  !["bryanbot_help_next", "bryanbot_help_last"].includes(
                    interaction.customId
                  )
                )
                  return;

                if (
                  interaction.customId == "bryanbot_help_last" &&
                  pageIndex > 0
                ) {
                  --pageIndex;
                } else if (
                  interaction.customId == "bryanbot_help_next" &&
                  pageIndex < maxPages - 1
                ) {
                  ++pageIndex;
                }

                interaction.update({
                  ...messages[pageIndex],
                  components: [getRow()],
                });
              });

              collector.on("end", async () =>
                msg.edit({ ...messages[pageIndex], components: [getRow(true)] })
              );
            });
        }

        break;
      }
      case "command": {
        const command = interaction.options.getString("command");

        const legacyCommand = legacyCommands.get(command),
          slashCommandsList = [
            ...(await manager.application.commands.fetch()).toJSON(),
            ...(await interaction.guild.commands.fetch()).toJSON(),
          ];

        const slashCommandApplication = slashCommandsList.find(
          (cmd) => cmd.name === command
        );

        if (!legacyCommand)
          return interaction.reply(
            Utils.setupMessage({
              configPath: lang.General.Help.CommandNotFound,
              variables: Utils.userVariables(interaction.member, "user"),
            })
          );

        const commandData = legacyCommand.commandData;
        if (!Array.isArray(commandData.Permission))
          commandData.Permission = [commandData.Permission];
        const commandVariables = [
          { searchFor: /{prefixUsed}/g, replaceWith: "/" },
          { searchFor: /{cmd-name}/g, replaceWith: commandData.Name },
          { searchFor: /{cmd-type}/g, replaceWith: commandData.Type },
          { searchFor: /{cmd-usage}/g, replaceWith: commandData.Usage },
          {
            searchFor: /{cmd-cooldown}/g,
            replaceWith: commandData.Cooldown ? ms(commandData.Cooldown) : "❎",
          },
          {
            searchFor: /{cmd-description}/g,
            replaceWith: commandData.Description,
          },
          {
            searchFor: /{cmd-dmOnly}/g,
            replaceWith: legacyCommand.commandConfig.dmOnly ? "✅" : "❎",
          },
          {
            searchFor: /{cmd-guildOnly}/g,
            replaceWith: legacyCommand.commandConfig.guildOnly ? "✅" : "❎",
          },
          {
            searchFor: /{cmd-isSlashCommand}/g,
            replaceWith: Array.isArray(commandData.Arguments) ? "✅" : "❎",
          },
          {
            searchFor: /{cmd-slashMentions}/g,
            replaceWith: slashCommandApplication
              ? getOptions(slashCommandApplication)
              : "❎",
          },
          {
            searchFor: /{cmd-permission}/g,
            replaceWith: commandData.Permission.map((role) => {
              if (role === "@everyone") return `@everyone`;

              const guildRole = Utils.findRole(interaction.guild, role, true);
              if (guildRole) return guildRole.toString();
            }).join(", "),
          },
        ];

        interaction.reply(
          Utils.setupMessage({
            configPath: lang.General.Help.CommandInfo,
            variables: [
              ...Utils.userVariables(interaction.member, "user"),
              ...commandVariables,
            ],
          })
        );
        break;
      }
    }
  },
  AutoComplete: async (manager, interaction) => {
    const lang = manager.configs.lang;
    const subCommand = interaction.options.getSubcommand();
    const slashCommands = manager.slashCommands,
      legacyCommands = manager.commands;
    switch (subCommand) {
      case "category": {
        const focusedValue = interaction.options.getFocused();
        const rawChoices = legacyCommands
          .map((x) => {
            const format = Object.entries(
              lang.General.Help.AutoCompleteCategory
            ).find(
              ([key]) => key.toLowerCase() == x.commandData.Type.toLowerCase()
            );
            const valueToUse =
              format && format[0] ? format[1] : x.commandData.Type;
            return {
              name: valueToUse,
              value: x.commandData.Type.toLowerCase(),
            };
          })
          .filter((x) => x);
        const choices = [
          ...new Map(rawChoices.map((c) => [c.value, c])).values(),
        ];
        const filtered = choices.filter((choice) =>
          choice.name.toLowerCase().startsWith(focusedValue.toLowerCase())
        );
        return await interaction.respond(
          filtered.map((choice) => ({ name: choice.name, value: choice.value }))
        );
      }
      case "command": {
        const focusedValue = interaction.options.getFocused();
        const choices = legacyCommands
          .map((x) => ({
            name: x.commandData.Name,
            value: x.commandData.Name.toLowerCase(),
          }))
          .filter((x) => x);
        const filtered = choices.filter((choice) =>
          choice.name.toLowerCase().startsWith(focusedValue.toLowerCase())
        );
        return await interaction.respond([
          ...new Set(
            filtered.map((choice) => ({
              name: choice.name,
              value: choice.value,
            }))
          ),
        ]);
      }
    }
  },
});
