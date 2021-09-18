import { TextChannel, VoiceState } from 'discord.js';
import { pino } from 'pino';
import { inject, singleton } from 'tsyringe';
import { CHANNEL_PREFIX } from '../constants';
import { AudioRecordingService } from '../services/audioRecordingService';

const activeGuildRecorders: Record<string, boolean> = {};

@singleton()
export class VoiceUpdateHandler {
  constructor(@inject('logger') private logger: pino.Logger, private audioRecordingService: AudioRecordingService) {}
  public handle() {
    return async (oldMember: VoiceState, newMember: VoiceState): Promise<void> => {
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
        this.logger.warn('no guild id detected...');
        return;
      }

      if (activeGuildRecorders[guildId]) {
        //if there was activity while a recording in guild, stop recording
        const guildObj = oldMember?.guild ?? newMember?.guild;
        if (!guildObj || !guildObj.voice) {
          this.logger.warn('no guild obj or voice found...');
          return;
        }
        const channel = guildObj.channels.cache.find((x) => x.type === 'text');
        await this.audioRecordingService.exit(guildObj.voice, channel as TextChannel);
        activeGuildRecorders[guildId] = false;
      } else {
        //if any activity and no recording lock, recording allowed
        const username = newMember?.member?.user?.username;
        if (!username) {
          this.logger.warn('no username found...');
          return;
        }
        if (!newMember.channel) {
          this.logger.warn('no channel found to start recording...');
          return;
        }
        activeGuildRecorders[guildId] = true;
        await this.audioRecordingService.enter(guildId, username, newMember.channel);
      }
    };
  }
}
