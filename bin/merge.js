const recId = process.argv[2];
if (typeof process.argv[2] === 'undefined') {
  throw new Error('record ID not specified');
}

var ffmpeg = require('fluent-ffmpeg');

var fs = require('fs'),
  chunks = fs.readdirSync(__dirname + '/../recordings/' + recId + '/'),
  inputStream,
  currentfile,
  outputStream = fs.createWriteStream(__dirname + `/../recordings/${recId}/merged.pcm`);
chunks.sort((a, b) => {
  return a - b;
});
function appendFiles() {
  if (!chunks.length) {
    outputStream.end(() => {
      console.log('Finished.');
      doFfmpegTask();
    });
    return;
  }
  currentfile = `${__dirname}/../recordings/${recId}/` + chunks.shift();
  inputStream = fs.createReadStream(currentfile);
  inputStream.pipe(outputStream, { end: false });
  inputStream.on('end', function () {
    console.log(currentfile + ' appended');
    appendFiles();
  });
}
appendFiles();
function doFfmpegTask() {
  const command = ffmpeg()
    .input(`${__dirname}/../recordings/${recId}/merged.pcm`)
    .inputOptions('-f', 's16le', '-ar', '48000', '-ac', '2')
    .output(`${__dirname}/../recordings/${recId}/${recId}.mp3`)
    .on('end', function () {
      console.log('Finished processing');
    });

  command.run();
}
