require('dotenv').config();
import Discord, { TextChannel } from 'discord.js';
import { enter, exit } from './commands';
const client = new Discord.Client();

const POOL = 2;
const CHANNEL_PREFIX = 'TATERU-';

const MAP: Record<string, Discord.GuildChannel[]> = {};

if (!process.env.BOT_TOKEN) {
  throw new Error('have to provide BOT_TOKEN');
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

  const tateruChannelsInvolved =
    (newMember?.channel?.name ?? '').startsWith(CHANNEL_PREFIX) ||
    (oldMember?.channel?.name ?? '').startsWith(CHANNEL_PREFIX);
  if (!tateruChannelsInvolved) {
    return;
  }

  const guildNew = newMember.guild.id;
  const guildObj = newMember.guild;

  console.log(oldMember.channelID, newMember.channelID);

  const newUserChannel = newMember.channelID;
  const oldUserChannel = oldMember.channelID;

  if (!oldUserChannel && newUserChannel) {
    // User Joins a voice channel
    if (newMember?.channel?.name.startsWith(CHANNEL_PREFIX)) {
      await enter(guildNew, newMember?.member?.user?.username ?? 'pepoclown', newMember.channel);
    }
  } else if (!newUserChannel) {
    // User leaves a voice channel
    if (oldMember?.channel?.name.startsWith(CHANNEL_PREFIX)) {
      const channel = guildObj.channels.cache.find((x) => x.type === 'text');
      guildObj.voice && channel && (await exit(guildObj.voice, channel as TextChannel));
    }
  } else {
    // user switches to/from tateru channel
  }
});
