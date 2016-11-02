
const possibleEvents = {
  transition: 'transitionend',
  OTransition: 'oTransitionEnd',
  MozTransition: 'transitionend',
  WebkitTransition: 'webkitTransitionEnd',
}

let transitionEvent_
for (const t in possibleEvents) {
  if (document.body.style[t] !== undefined) {
    transitionEvent_ = possibleEvents[t]
    break
  }
}

const transitionEvent = transitionEvent_

export default transitionEvent
