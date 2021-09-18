import 'reflect-metadata';

// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();
import { container, singleton } from 'tsyringe';
import { myLogger } from './logger';

//custom injects
container.register('logger', { useValue: myLogger });
container.register('recordingsPath', { useValue: __dirname + '/../recordings' });
container.register('soundsPath', { useValue: __dirname + '/../sounds' });

import Discord, { Client } from 'discord.js';
import disbut from 'discord-buttons';
import { InitHandler } from './handlers/initHandler';
import { VoiceUpdateHandler } from './handlers/voiceUpdateHandler';

if (!process.env.BOT_TOKEN) {
  throw new Error('have to provide BOT_TOKEN');
}

@singleton()
class EntryPoint {
  private client: Client;
  constructor(private initHandler: InitHandler, private voiceUpdateHandler: VoiceUpdateHandler) {
    this.client = new Discord.Client();
    disbut(this.client);
  }

  public async start() {
    this.client.login(process.env.BOT_TOKEN);
    this.client.on('ready', this.initHandler.handle(this.client));
    this.client.on('voiceStateUpdate', this.voiceUpdateHandler.handle());
  }
}

const entrypoint = container.resolve(EntryPoint);
entrypoint.start();
