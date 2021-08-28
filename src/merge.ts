import ffmpeg from 'fluent-ffmpeg';
import { readdir, readFile, writeFile } from 'fs';
import { promisify } from 'util';

const readF = promisify(readFile);
const readDir = promisify(readdir);
const writeF = promisify(writeFile);

export async function processRecording(recId: string):Promise<void> {
  const inputPCM = __dirname + '/../recordings/' + recId + '/'
  const chunks = await readDir(inputPCM);
  chunks.sort((a, b) => {
    return a.localeCompare(b);
  });
  const buffer = await concatenate(chunks, inputPCM);
  await writeF(__dirname + `/../recordings/${recId}/merged.pcm`, buffer);
  return await doFfmpegTask(recId);
}

async function concatenate(files: string[], basePath: string) {
  const buffers = await Promise.all(files.map((path) => readF(basePath + path)));

  const totalBufferLength = buffers.map((buffer) => buffer.length).reduce((total, length) => total + length);

  return Buffer.concat(buffers, totalBufferLength);
}

function doFfmpegTask(recId: string): Promise<void> {
  return new Promise((resolve, _) => {
    const command = ffmpeg()
      .input(`${__dirname}/../recordings/${recId}/merged.pcm`)
      .inputOptions('-f', 's16le', '-ar', '48000', '-ac', '2')
      .output(`${__dirname}/../recordings/${recId}/${recId}.mp3`)
      .on('end', function () {
        resolve();
      });

    command.run();
  });
}
