require('dotenv').config()
import Discord, { TextChannel } from 'discord.js';
const client = new Discord.Client();


import { enter, exit } from './commands';

const POOL = 2;
const CHANNEL_PREFIX = 'TATERU-';

const MAP: Record<string, Discord.GuildChannel[]> = {};

const USER_RECORDING: Record<string, string | undefined> = {};

if (!process.env.BOT_TOKEN) {
  throw new Error('have to provide BOT_TOKEN')
}

client.login(process.env.BOT_TOKEN);

client.on('ready', async () => {
  console.log(`\nONLINE\n`);
  for (const guild of client.guilds.cache) {
    const tateChannels = guild[1].channels.cache
      .array()
      .filter((x) => x.name.startsWith(CHANNEL_PREFIX) && x.type === 'voice');
    const newChannels = [];
    if (tateChannels.length < POOL) {
      for (let i = tateChannels.length; i < POOL; i++) {
        const chan = await guild[1].channels.create(CHANNEL_PREFIX + i, { userLimit: 2, type: 'voice' });
        newChannels.push(chan);
      }
    }
    const finalChannels = tateChannels.concat(newChannels);
    MAP[guild[0]] = finalChannels;
  }
});

client.on('voiceStateUpdate', async (oldMember, newMember) => {
  if (oldMember?.member?.user?.bot || newMember?.member?.user?.bot) {
    return;
  }

  const guildNew = newMember.guild.id;
  const guildObj = newMember.guild;

  console.log(oldMember.channelID, newMember.channelID)

  if (newMember.channel === null) {
    if (oldMember?.channel?.name.startsWith(CHANNEL_PREFIX)) {
      if (USER_RECORDING[guildNew] === oldMember?.member?.id) {
        const channel = guildObj.channels.cache.find((x) => x.type === 'text');
        guildObj.voice && channel && await exit(guildObj.voice, channel as TextChannel);

        USER_RECORDING[guildNew] = undefined;
      }
    }
    return;
  }

  if (newMember.channel.name.startsWith(CHANNEL_PREFIX)) {
    USER_RECORDING[guildNew] = newMember?.member?.user.id;
    await enter(guildNew, newMember?.member?.user?.username ?? 'pepoclown', newMember.channel);
  }
});
