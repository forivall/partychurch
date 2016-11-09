// TODO(forivall): make this room aware. I might need to use namespaces
// instead of rooms for chat rooms...
export default function createUserCounter(io) {
  let active = 0
  const onDisconnect = () => {
    active--
    io.emit('active', active)
  }
  const onConnect = (socket) => {
    active++
    io.emit('active', active)
    socket.on('disconnect', onDisconnect)
  }
  io.on('connection', onConnect)
  return {
    destroy() {
      io.removeListener('connection', onConnect)
    }
  }
}
