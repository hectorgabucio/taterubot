
import { readdir, readFile, writeFile } from 'fs';
import { inject, singleton } from "tsyringe";
import { promisify } from 'util';

import ffmpeg from 'fluent-ffmpeg';
const readF = promisify(readFile);
const readDir = promisify(readdir);
const writeF = promisify(writeFile);

@singleton()
export class AudioMergeService {
    constructor(    @inject('recordingsPath') private recordingsPath: string,) {}
  async processRecording(recId: string): Promise<boolean> {
    const inputPCM = this.recordingsPath + '/' + recId + '/';
    const chunks = await readDir(inputPCM);
    if (chunks.length === 0) {
      return false;
    }
    chunks.sort((a, b) => {
      return a.localeCompare(b);
    });
    const buffer = await this.concatenate(chunks, inputPCM);
    await writeF(`${this.recordingsPath}/${recId}/merged.pcm`, buffer);
    await this.doFfmpegTask(recId);
    return true;
  }

  private async concatenate(files: string[], basePath: string) {
    const buffers = await Promise.all(files.map((path) => readF(basePath + path)));

    const totalBufferLength = buffers.map((buffer) => buffer.length).reduce((total, length) => total + length);

    return Buffer.concat(buffers, totalBufferLength);
  }

  private doFfmpegTask(recId: string): Promise<void> {
    return new Promise((resolve) => {
      const command = ffmpeg()
        .input(`${this.recordingsPath}/${recId}/merged.pcm`)
        .inputOptions('-f', 's16le', '-ar', '48000', '-ac', '2')
        .output(`${this.recordingsPath}/${recId}/${recId}.mp3`)
        .on('end', function () {
          resolve();
        });

      command.run();
    });
  }
}
