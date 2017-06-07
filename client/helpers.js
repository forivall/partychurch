
export function toggle(el, on, attr = 'aria-hidden', value = '') {
  if (on) {
    el.setAttribute(attr, value)
  } else {
    el.removeAttribute(attr)
  }
}
