import { Client } from 'discord.js';
import pino from 'pino';
import { inject, singleton } from 'tsyringe';
import { CHANNEL_PREFIX, POOL } from '../constants';

@singleton()
export class InitHandler {
  constructor(@inject("logger") private logger: pino.Logger) {}
  public handle(client: Client) {
      return async ():Promise<void> => {
        
            this.logger.info(`Taterubot online. Initializing bot state in guilds...`);
            for (const guild of client.guilds.cache) {
              const tateChannels = guild[1].channels.cache
                .array()
                .filter((x) => x.name.startsWith(CHANNEL_PREFIX) && x.type === 'voice');
              if (tateChannels.length < POOL) {
                for (let i = tateChannels.length; i < POOL; i++) {
                  await guild[1].channels.create(CHANNEL_PREFIX + i, { userLimit: 2, type: 'voice' });
                }
              }
            }
            this.logger.info(`Guilds initialized correctly!`);
          
      }
  }
}
