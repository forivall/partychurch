import cuid from 'cuid'

const KEY = 'fingerprint'
const VERSION = 1

let value

export default function getFingerprint() {
  if (value) return value
  value = _getFingerprint()
  return value
}

function _getFingerprint() {
  const saved = window.localStorage.getItem(KEY)
  if (!saved) {
    return generateAndSave()
  }

  let parsed
  try {
    parsed = JSON.parse(saved)
  } catch (err) {
    return generateAndSave()
  }

  if (parsed.version !== VERSION) {
    return generateAndSave()
  } else {
    return parsed.value
  }
}

function generateAndSave() {
  const fingerprint = cuid()
  const toSave = { version: VERSION, value: fingerprint }
  window.localStorage.setItem(KEY, JSON.stringify(toSave))
  return fingerprint
}
