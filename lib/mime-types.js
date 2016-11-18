const mimeTypes = {
  jpg: 'image/jpeg',
  mp4: 'video/mp4',
}
export const mimeToRoom = {}
Object.keys(mimeTypes).forEach(function(type) {
  mimeToRoom[mimeTypes[type]] = type
})
export default mimeTypes
