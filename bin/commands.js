const fs = require('fs');
const { spawn } = require('child_process');
const { promisify } = require('util');

const createNewChunk = (SessionID) => {
    const pathToFile = __dirname + `/../recordings/${SessionID}/${Date.now()}.pcm`;
    return fs.createWriteStream(pathToFile);
};


const mkdir = promisify(fs.mkdir)
let voiceSessionMap = [];
let activeGuildRecorders = [];
exports.enter = async function(guildId, authorName, voiceChannel) {
    if (typeof(activeGuildRecorders[guildId]) === "undefined") {
        const start = process.hrtime()

        console.log("enabling lock for guild id", guildId, 'last', process.hrtime(start));
        let currentGuildId = guildId
        activeGuildRecorders[currentGuildId] = true;
        let voiceSid = authorName + '-' + (new Date().toISOString());
        
        await mkdir(__dirname + `/../recordings/${voiceSid}/`,{recursive: true})
        
        console.log(`Sliding into ${voiceChannel.name} ..., last`, process.hrtime(start));
        
        voiceChannel.join()
        .then(conn => {
            console.log('inside conn, last', process.hrtime(start))
            let deltaStart = Date.now();
            const dispatcher = conn.play(__dirname + '/../sounds/taterubot-start-recording.mp3');
            console.log('after dispatcher, last', process.hrtime(start))
            dispatcher.on('finish', () => { console.log(`Joined ${voiceChannel.name}!\n\nREADY TO RECORD\n`); });
            voiceSessionMap[voiceChannel.id] = {
                voiceSid: voiceSid,
                activityLog: [],
                guildId: currentGuildId,
                guildName: voiceChannel.guild.name,
                recordInitiator: authorName,
                vcName: voiceChannel.name,
                recordStart: deltaStart
            };
            const receiver = conn.receiver;
            conn.on('speaking', (user, speaking) => {
                if (speaking) {
                    let delta = Date.now() - deltaStart;
                    /*
                        e: EventType
                            "s": Speak start
                            "e": Speak end
                        s: Username
                        d: Delta from 
                    */
                    voiceSessionMap[voiceChannel.id].activityLog.push({
                        e: "s",
                        s: user.username,
                        d: delta
                    })
                    console.log(`${user.username} started speaking`);
                    const audioStream = receiver.createStream(user, { mode: 'pcm' });
                    audioStream.pipe(createNewChunk(voiceSid));
                    audioStream.on('end', () => { 
                        let deltaEnd = Date.now() - deltaStart;
                        console.log(`${user.username} stopped speaking`);
                        voiceSessionMap[voiceChannel.id].activityLog.push({
                            e: "e",
                            s: user.username,
                            d: deltaEnd
                        })
                    });
                }
            });
        })
        .catch(err => {
            console.log(err)
            console.warn("Failure connecting to guild");
        });
    } else {
        console.log("An active recording session exists in the current guild.");
    }
    
}

exports.exit = function (voice, channel) {
    // Use optional chaining when we upgrade to Node 14.

            
            const { channel: voiceChannel, connection: conn } = voice;
            const resolveSessionId = voiceSessionMap[voiceChannel.id].voiceSid;
            const dispatcher = conn.play(__dirname + "/../sounds/badumtss.mp3", { volume: 0.45 });
            dispatcher.on("finish", () => {
                let data = JSON.stringify(voiceSessionMap[voiceChannel.id]);
                fs.writeFile(__dirname + `/../recordings/${resolveSessionId}.json`, data, 'utf8', (err) => {
                    
                    if (err) {
                        return console.log(err);
                    }
                    
                    console.log("written stats json", __dirname + `/../recordings/${resolveSessionId}.json`);
                    const nodeArgs = [
                        __dirname + "/../bin/merge.js",
                        resolveSessionId
                    ]
                    const transcoderChild = spawn('node', nodeArgs);
                    transcoderChild.stdout.setEncoding('utf8');
                    transcoderChild.stdout.on('data', function(data) {
                        //Here is where the output goes
                        
                        console.log('transcoder stdout ' + data);
                        
                        data=data.toString();
                    });
                    transcoderChild.on('exit', function (code, signal) {
                        console.log('Transcoder process exited with ' +
                        `code ${code} and signal ${signal}`);

                        if (code === 0) {
                            const path = `./recordings/${resolveSessionId}/${resolveSessionId}.mp3`
                            channel.send({
                                files: [path]
                            })
                        }
                    });
                }); 
                console.log("Destroying guild lock for", voiceSessionMap[voiceChannel.id].guildId);
                delete activeGuildRecorders[voiceSessionMap[voiceChannel.id].guildId];
                delete voiceSessionMap[voiceChannel.id];
                voiceChannel.leave();
                console.log(`\nSTOPPED RECORDING\n`);
            });
        };
        