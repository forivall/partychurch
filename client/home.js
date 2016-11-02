export function enter(ctx, next) {
  console.log('home')
  next()
}

export function exit(ctx, next) {
  console.log('exit home')
  next()
}
