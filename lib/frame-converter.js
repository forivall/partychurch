import cuid from 'cuid'
import fs from 'fs'
import concat from 'concat-stream'
import rimraf from 'rimraf'
import child from 'child_process'

const TMP_DIR = __dirname + '/../tmp/'

const fileExtensions = {
  'image/jpeg': '.jpg',
  'video/mp4': '.mp4',
}
const videoCodecs = {
  // "filmstrip" jpg view
  jpg: {
    ext: '.jpg',
    command: 'convert -append'
  },
  // For legacy (iOS) clients
  mp4: {
    type: 'ffmpeg',
    ext: '.mp4',
    vcodec: '-vcodec libx264 -pix_fmt yuv420p',
    base64: true,
    mime: 'video/mp4',
  },
}

export default function convertFrame(frames, format, ffmpegRunner, cb) {
  if (!fileExtensions[format]) {
    cb(new Error('Invalid input format'))
    return
  }

  const id = cuid()
  const folder = TMP_DIR + id
  const imgExtension = fileExtensions[format]
  writeTempFiles()

  function writeTempFiles() {
    fs.mkdir(folder, err => {
      if (err) {
        done(err)
        return
      }

      let count = 0
      for (let i = 0; i < frames.length; i++) {
        fs.createWriteStream(folder + '/' + i + imgExtension)
          .on('error', done)
          .end(frames[i], fileDone)
      }

      function fileDone() {
        count++
        if (count === frames.length) {
          convert()
        }
      }
    })
  }

  function convert() {
    const results = {}
    let outstanding = 0
    let firstErr
    Object.keys(videoCodecs).forEach(codec => {
      const info = videoCodecs[codec]
      outstanding++
      const cb = (err, data) => {
        if (err) {
          firstErr = firstErr || err
        } else {
          if (!info.base64) {
            results[codec] = data
          } else {
            results[codec] = 'data:' + info.mime + ';base64,' + data.toString('base64')
          }
        }
        outstanding--
        maybeFinish()
      }
      if (info.type === 'ffmpeg') {
        doFfmpeg(ffmpegRunner, folder, imgExtension, info.vcodec, info.ext, cb)
      } else {
        doOtherCommand(folder, imgExtension, info.command, info.ext, cb)
      }
    })

    function maybeFinish() {
      if (outstanding) return

      if (firstErr) {
        done(firstErr)
      } else {
        done(null, results)
      }
    }
  }

  function done(err, results) {
    cb(err, results)
    deleteFiles()
  }

  function deleteFiles() {
    rimraf(folder, err => {
      if (err) {
        console.error('Error deleting folder: ' + folder + '\n' + err)
      }
    })
  }
}

convertFrame.forMeatspaceProxy = function(video, ffmpegRunner, cb) {
  // take a video, split it into its requisite frames, and then output to a jpeg
  const id = cuid()
  const folder = TMP_DIR + id
  const inputExtension = fileExtensions[video.type]
  writeTempFiles()

  function writeTempFiles() {
    fs.mkdir(folder, err => {
      if (err) {
        done(err)
        return
      }

      fs.createWriteStream(`${folder}/vid${inputExtension}`)
        .on('error', done)
        .end(video, split)
    })
  }

  const splitExtension = '.jpg'
  function split() {
    const command = `-i "${folder}/vid${inputExtension}" ` +
        `-filter:v "setpts=0.4*PTS" -qscale:v 1 "${folder}/frame%02d${splitExtension}"`

    ffmpegRunner(command, { timeout: 3000 }, (err, stdout, stderr) => {
      if (err) {
        done(err)
        return
      }

      const info = videoCodecs.jpg
      doOtherCommand(folder, splitExtension, info.command, info.ext, done)
    })
  }

  function done(err, video) {
    cb(err, video)
    deleteFiles()
  }

  function deleteFiles() {
    rimraf(folder, err => {
      if (err) {
        console.error('Error deleting folder: ' + folder + '\n' + err)
      }
    })
  }
}

function doFfmpeg(ffmpegRunner, folder, imgExtension, vcodecArgs, vidExtension, cb) {
  const command = `-i "${folder}/%d${imgExtension}" -filter:v "setpts=2.5*PTS" ${vcodecArgs} ` +
      `-an "${folder}/vid${vidExtension}"`

  ffmpegRunner(command, { timeout: 3000 }, (err, stdout, stderr) => {
    if (err) {
      cb(err)
      return
    }

    fs.createReadStream(`${folder}/vid${vidExtension}`)
      .pipe(concat(data => cb(null, data)))
      .on('error', err => cb(err))
  })
}

function doOtherCommand(folder, imgExtension, command, outputExtension, cb) {
  const toRun = `${command} "${folder}/*${imgExtension}" "${folder}/output${outputExtension}"`
  child.exec(toRun, (err, stdout, stderr) => {
    if (err) {
      cb(err)
      return
    }

    fs.createReadStream(`${folder}/output${outputExtension}`)
      .pipe(concat(data => cb(null, data)))
      .on('error', err => cb(err))
  })
}
