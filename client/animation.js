
// let firstAnim = null;

export function play(elem, options) {
  const anim = elem.animate({
    transform: ['translateY(0%)', 'translateY(-100%)']
  }, {
    direction: 'normal',
    duration: options.duration,
    iterations: Infinity,
    easing: `steps(${options.frames}, end)`
  })
  // if (firstAnim) {
  //   anim.currentTime = firstAnim.currentTime;
  // } else {
  //   firstAnim = anim;
  // }
  return anim
}
