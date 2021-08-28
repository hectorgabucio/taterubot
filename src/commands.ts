import { TextChannel, VoiceChannel, VoiceState } from 'discord.js';
import fs, { writeFile } from 'fs';
import pEvent from 'p-event';
import { promisify } from 'util';
import { processRecording } from './merge';

const writeF = promisify(writeFile);

const createNewChunk = (SessionID: string) => {
  const pathToFile = __dirname + `/../recordings/${SessionID}/${Date.now()}.pcm`;
  return fs.createWriteStream(pathToFile);
};

interface VoiceSession {
  voiceSid: string;
  activityLog: Record<string, unknown>[];
  guildId: string | number;
  guildName: string;
  recordInitiator: string;
  vcName: string;
  recordStart: number;
}

const mkdir = promisify(fs.mkdir);
const voiceSessionMap: Record<string | number, VoiceSession> = {};

export const enter = async function (
  guildId: string | number,
  authorName: string,
  voiceChannel: VoiceChannel,
): Promise<void> {
  const start = process.hrtime();

  const currentGuildId = guildId;

  const voiceSid = authorName + '-' + new Date().toISOString();

  await mkdir(__dirname + `/../recordings/${voiceSid}/`, { recursive: true });

  try {
    const conn = await voiceChannel.join();

    console.log('inside conn, last', process.hrtime(start));
    const deltaStart = Date.now();
    const dispatcher = conn.play(__dirname + '/../sounds/taterubot-start-recording.mp3');

    await pEvent(dispatcher, 'finish');

    console.log(`Joined ${voiceChannel.name}!\n\nREADY TO RECORD\n`);

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
        /*
                            e: EventType
                                "s": Speak start
                                "e": Speak end
                            s: Username
                            d: Delta from 
                        */
        voiceSessionMap[voiceChannel.id].activityLog.push({
          e: 's',
          s: user.username,
          d: delta,
        });
        console.log(`${user.username} started speaking`);
        const audioStream = receiver.createStream(user, { mode: 'pcm' });
        audioStream.pipe(createNewChunk(voiceSid));

        audioStream.on('end', () => {
          const deltaEnd = Date.now() - deltaStart;
          console.log(`${user.username} stopped speaking`);
          voiceSessionMap[voiceChannel.id].activityLog.push({
            e: 'e',
            s: user.username,
            d: deltaEnd,
          });
        });
      }
    });
  } catch (err) {
    console.log(err);
    console.warn('Failure connecting to guild');
  }
};
export const exit = async function (voice: VoiceState, channel: TextChannel): Promise<void> {
  // Use optional chaining when we upgrade to Node 14.

  const { channel: voiceChannel, connection: conn } = voice;
  if (!voiceChannel || !conn) {
    throw new Error('wtf no voice channel or conn');
  }
  const resolveSessionId = voiceSessionMap[voiceChannel.id].voiceSid;

  const data = JSON.stringify(voiceSessionMap[voiceChannel.id]);
  await writeF(__dirname + `/../recordings/${resolveSessionId}.json`, data, 'utf8');

  await processRecording(resolveSessionId);
  const path = `./recordings/${resolveSessionId}/${resolveSessionId}.mp3`;
  await channel.send({
    files: [path],
  });
  fs.rm(`./recordings/${resolveSessionId}`, { recursive: true, force: true }, () => ({}));

  delete voiceSessionMap[voiceChannel.id];
  voiceChannel.leave();
  console.log(`\nSTOPPED RECORDING\n`);
};
