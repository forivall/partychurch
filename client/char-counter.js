class CharCounter {
  constructor(input, counter, limit = 250) {
    this.updateCounter = this.updateCounter.bind(this)

    this.input = input
    this.counter = counter
    this.limit = limit

    this.updateCounter()

    ;['keyup', 'change', 'input', 'paste'].forEach(event =>
      input.addEventListener(event, this.updateCounter)
    )
  }

  destroy() {
    ;['keyup', 'change', 'input', 'paste'].forEach(event =>
      this.input.removeEventListener(event, this.updateCounter)
    )
  }

  updateCounter() {
    const len = this.input.value.length
    this.counter.innerHTML = `${len} / ${this.limit}`
    const isFull = len >= this.limit
    this.counter.classList.toggle('full', isFull)
    this.input.classList.toggle('full', isFull)
  }
}

export default function(input, counter, limit) {
  return new CharCounter(input, counter, limit)
}
