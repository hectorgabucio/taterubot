import { TextChannel, VoiceChannel, VoiceState } from 'discord.js';
import pEvent from 'p-event';
import { inject, singleton } from 'tsyringe';
import { promisify } from 'util';
import fs, { writeFile } from 'fs';
import pino from 'pino';
import { AudioMergeService } from './audioMergeService';

const mkdir = promisify(fs.mkdir);
const writeF = promisify(writeFile);

interface VoiceSession {
  voiceSid: string;
  activityLog: Record<string, unknown>[];
  guildId: string | number;
  guildName: string;
  recordInitiator: string;
  vcName: string;
  recordStart: number;
}

const voiceSessionMap: Record<string | number, VoiceSession> = {};

@singleton()
export class AudioRecordingService {
  constructor(
    @inject('logger') private logger: pino.Logger,
    @inject('soundsPath') private soundsPath: string,
    @inject('recordingsPath') private recordingsPath: string,
    private audioMerge: AudioMergeService
  ) {}

  async enter(guildId: string | number, authorName: string, voiceChannel: VoiceChannel): Promise<void> {
    const currentGuildId = guildId;

    const voiceSid = authorName + '-' + new Date().toISOString();

    await mkdir(`${this.recordingsPath}/${voiceSid}`, { recursive: true });

    try {
      const conn = await voiceChannel.join();

      const deltaStart = Date.now();
      const dispatcher = conn.play(`${this.soundsPath}/taterubot-start-recording.mp3`);

      await pEvent(dispatcher, 'finish');

      this.logger.info(`Joined ${voiceChannel.name}!`);

      voiceSessionMap[voiceChannel.id] = {
        voiceSid: voiceSid,
        activityLog: [],
        guildId: currentGuildId,
        guildName: voiceChannel.guild.name,
        recordInitiator: authorName,
        vcName: voiceChannel.name,
        recordStart: deltaStart,
      };
      const receiver = conn.receiver;

      conn.on('speaking', (user, speaking) => {
        if (speaking) {
          const delta = Date.now() - deltaStart;
          voiceSessionMap[voiceChannel.id].activityLog.push({
            e: 's',
            s: user.username,
            d: delta,
          });
          this.logger.info(`${user.username} started speaking`);
          const audioStream = receiver.createStream(user, { mode: 'pcm' });
          audioStream.pipe(this.createNewChunk(voiceSid));

          audioStream.on('end', () => {
            const deltaEnd = Date.now() - deltaStart;
            this.logger.info(`${user.username} stopped speaking`);
            voiceSessionMap[voiceChannel.id].activityLog.push({
              e: 'e',
              s: user.username,
              d: deltaEnd,
            });
          });
        }
      });
    } catch (err) {
      this.logger.warn('Failure connecting to guild');
      this.logger.error(err);
    }
  }

  async exit(voice: VoiceState, channel: TextChannel): Promise<void> {
    const { channel: voiceChannel, connection: conn } = voice;
    if (!voiceChannel || !conn) {
      throw new Error('wtf no voice channel or conn');
    }
    const resolveSessionId = voiceSessionMap[voiceChannel.id].voiceSid;

    const data = JSON.stringify(voiceSessionMap[voiceChannel.id]);
    const pathFile = `${this.recordingsPath}/${resolveSessionId}.json`;
    await writeF(pathFile, data, 'utf8');

    const isAudioRecorded = await this.audioMerge.processRecording(resolveSessionId);
    if (!isAudioRecorded) {
      await channel.send({ content: 'Sorry, could not record audio, please try again' });
    } else {
      const path = `${this.recordingsPath}/${resolveSessionId}/${resolveSessionId}.mp3`;
      await channel.send({
        files: [path],
      });
      fs.rm(`${this.recordingsPath}/${resolveSessionId}`, { recursive: true, force: true }, () => ({}));
      fs.rm(`${this.recordingsPath}/${resolveSessionId}.json`, { recursive: false, force: true }, () => ({}));
    }

    delete voiceSessionMap[voiceChannel.id];
    voiceChannel.leave();
    this.logger.info(`STOPPED RECORDING`);
  }

  private createNewChunk(SessionID: string) {
    const pathToFile = `${this.recordingsPath}/${SessionID}/${Date.now()}.pcm`;
    return fs.createWriteStream(pathToFile);
  }
}
