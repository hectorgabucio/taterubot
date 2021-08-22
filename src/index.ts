import Discord, { TextChannel } from 'discord.js';
const client = new Discord.Client();

const config = require('../config.json');
import { enter, exit } from './commands';


const POOL = 2
const CHANNEL_PREFIX = 'TATERU-'



const MAP:Record<string, any> = {}

const USER_RECORDING:Record<string, string|undefined> = {}

client.login(config.BOT_TOKEN);

client.on('ready', async () => {
    console.log(`\nONLINE\n`);
    for (const guild of client.guilds.cache) {
        const tateChannels = guild[1].channels.cache.array().filter(x => x.name.startsWith(CHANNEL_PREFIX) && x.type === 'voice')
        const newChannels = []
        if (tateChannels.length < POOL) {
            for (let i = tateChannels.length; i < POOL; i++) {
                const chan = await guild[1].channels.create(CHANNEL_PREFIX + i, {userLimit: 2, type: 'voice'})
                newChannels.push(chan)
            }

        }
        const finalChannels = tateChannels.concat(newChannels)
        MAP[guild[0]] = finalChannels

    }
});

client.on('voiceStateUpdate', (oldMember, newMember) => {

    if (oldMember?.member?.user?.bot || newMember?.member?.user?.bot) {
        console.log('fucking bot...')
        return
    }

    const guildNew = newMember.guild.id
    const guildObj = newMember.guild
    const channNew = newMember.channelID


    if (newMember.channel === null) {
        if (oldMember?.channel?.name.startsWith(CHANNEL_PREFIX)) {
            if (USER_RECORDING[guildNew] === oldMember?.member?.id) {
                console.log('stop recording biatch')
                const channel =  guildObj.channels.cache.find(x => x.type === 'text')
                guildObj.voice && channel && exit(guildObj.voice,(channel as TextChannel))


                USER_RECORDING[guildNew] = undefined
            }
            console.log(USER_RECORDING[guildNew],oldMember?.member?.user.id)
        }
        console.log('leaving wtf')
        return
    }

    if (newMember.channel.name.startsWith(CHANNEL_PREFIX)) {
        USER_RECORDING[guildNew] = newMember?.member?.user.id
        enter(guildNew, newMember?.member?.user?.username ?? 'pepoclown',newMember.channel)
    }

 });