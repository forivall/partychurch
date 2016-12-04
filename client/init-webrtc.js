let getUserMedia = navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia ||
    navigator.msGetUserMedia
if (getUserMedia) {
  getUserMedia = getUserMedia.bind(navigator)
}

const supportsSourceSelection = !!window.MediaStreamTrack.getSources

function equalsNormalizedFacing(desired, check) {
  let normalized = check
  switch (check) {
    case 'user':
      normalized = 'front'
      break
    case 'environment':
      normalized = 'rear'
      break
  }

  return desired === normalized
}

class StreamResult {
  constructor(stream, hasFrontAndRear, facing) {
    this.stream = stream
    this.url = null
    this.hasFrontAndRear = hasFrontAndRear
    this.facing = facing
    this.stopped = false
  }

  play(video, cb) {
    video.autoplay = true
    if (video.mozSrcObject) {
      video.mozSrcObject = this.stream
    } else {
      if (this.url === null) {
        this.url = window.URL.createObjectURL(this.stream)
      }
      video.src = this.url
    }

    video.addEventListener('loadeddata', dataLoaded)

    function dataLoaded() {
      video.removeEventListener('loadeddata', dataLoaded)
      if (cb) cb()
    }
  }

  stop(video, secondary = false) {
    if (this.stopped) return

    if (this.url && video.src === this.url) {
      video.pause()
      video.removeAttribute('src')
      if (!secondary) {
        window.URL.revokeObjectURL(this.url)
        this.url = null
      }
    } else if (video.mozSrcObject && video.mozSrcObject === this.stream) {
      video.pause()
      video.removeAttribute('src')
    }

    if (!secondary) {
      for (const track of this.stream.getTracks()) {
        track.stop()
      }
    }
    this.stream = null
    this.stopped = true
  }
}


function initWebrtc({width, height, facing}, cb) {
  if (!getUserMedia) {
    cb(new Error('Browser doesn\'t support WebRTC'))
    return
  }

  const constraints = {
    optional: [
      { minAspectRatio: width / height },
    ],
  }
  let hasFrontAndRear = false
  let requestedFacing = false

  if (!facing || !supportsSourceSelection) {
    getMedia()
    return
  }

  // TODO(forivall): this is deprecated. Replace with MediaDevices.enumerateDevices
  window.MediaStreamTrack.getSources(infos => {
    let found = false
    let hasFront = false
    let hasRear = false

    for (const info of infos) {
      if (info.kind !== 'video') continue

      if (equalsNormalizedFacing(facing, info.facing) && !found) {
        found = true
        requestedFacing = true
        constraints.optional.push({ sourceId: info.id })
      }

      if (equalsNormalizedFacing('front', info.facing)) {
        hasFront = true
      } else if (equalsNormalizedFacing('rear', info.facing)) {
        hasRear = true
      }
    }

    hasFrontAndRear = hasFront && hasRear
    getMedia()
  })

  function getMedia() {
    getUserMedia({
      audio: false,
      video: constraints,
    }, success, failure)
  }

  function success(stream) {
    return cb(null,
      new StreamResult(stream, hasFrontAndRear, requestedFacing ? facing : null)
    )
  }

  function failure(err) {
    cb(err)
  }
}

initWebrtc.supportsSourceSelection = supportsSourceSelection
export default initWebrtc
