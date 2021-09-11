// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();
import Discord, { TextChannel, VoiceState } from 'discord.js';
import { enter, exit } from './commands';
import logger from './logger';
const client = new Discord.Client();

const POOL = 1;
const CHANNEL_PREFIX = 'TATERU-';

const MAP: Record<string, Discord.GuildChannel[]> = {};

const activeGuildRecorders: Record<string, boolean> = {};

if (!process.env.BOT_TOKEN) {
  throw new Error('have to provide BOT_TOKEN');
}

client.login(process.env.BOT_TOKEN);

client.on('ready', async () => {
  logger.info(`ONLINE`);
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
  await handleVoiceChangeState(oldMember, newMember);
});

async function handleVoiceChangeState(oldMember: VoiceState, newMember: VoiceState) {
  if (oldMember?.member?.user?.bot || newMember?.member?.user?.bot) {
    return;
  }

  const tateruChannelsInvolved =
    (newMember?.channel?.name ?? '').startsWith(CHANNEL_PREFIX) ||
    (oldMember?.channel?.name ?? '').startsWith(CHANNEL_PREFIX);
  if (!tateruChannelsInvolved) {
    return;
  }

  const guildId = oldMember?.guild?.id ?? newMember?.guild?.id ?? null;
  if (!guildId) {
    logger.warn('no guild id detected...');
    return;
  }

  if (activeGuildRecorders[guildId]) {
    //if there was activity while a recording in guild, stop recording
    const guildObj = oldMember?.guild ?? newMember?.guild;
    if (!guildObj || !guildObj.voice) {
      logger.warn('no guild obj or voice found...');
      return;
    }
    const channel = guildObj.channels.cache.find((x) => x.type === 'text');
    await exit(guildObj.voice, channel as TextChannel);
    activeGuildRecorders[guildId] = false;
  } else {
    //if any activity and no recording lock, recording allowed
    const username = newMember?.member?.user?.username;
    if (!username) {
      logger.warn('no username found...');
      return;
    }
    if (!newMember.channel) {
      logger.warn('no channel found to start recording...');
      return;
    }
    activeGuildRecorders[guildId] = true;
    await enter(guildId, username, newMember.channel);
  }
}
