import { getCustomProperty, incrementCustomProperty, setCustomProperty } from "./update.js"

const SPEED = 0.05

export function setupGround(elems) {
  const groundElems = elems || document.querySelectorAll("[data-ground]")
  setCustomProperty(groundElems[0], "--left", 0)
  setCustomProperty(groundElems[1], "--left", 300)
  return groundElems
}

export function updateGround(delta, speedScale, elems) {
  const groundElems = elems || document.querySelectorAll("[data-ground]")
  groundElems.forEach(ground => {
    incrementCustomProperty(ground, "--left", delta * speedScale * SPEED * -1)
    if (getCustomProperty(ground, "--left") <= -300) {
      incrementCustomProperty(ground, "--left", 600)
    }
  })
}
