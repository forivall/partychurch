// TODO(forivall): make this room aware. I might need to use namespaces
// instead of rooms for chat rooms...
export default function createUserCounter(io) {
  let active = 0
  io.on('connection', (socket) => {
    active++
    io.emit('active', active)
    socket.on('disconnect', () => {
      active--
      io.emit('active', active)
    })
  })
}
