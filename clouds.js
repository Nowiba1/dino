import { getCustomProperty, incrementCustomProperty, setCustomProperty } from "./update.js"

const SPEED = 0.05

export function setupClouds(elems) {
  const cloudsElems = elems || document.querySelectorAll("[data-clouds]")
  setCustomProperty(cloudsElems[0], "--left", 0)
  setCustomProperty(cloudsElems[1], "--left", 300)
  return cloudsElems
}

export function updateClouds(delta, speedScale, elems) {
  const cloudsElems = elems || document.querySelectorAll("[data-clouds]")
  cloudsElems.forEach(clouds => {
    incrementCustomProperty(clouds, "--left", delta * speedScale * SPEED * -1)
    if (getCustomProperty(clouds, "--left") <= -300) {
      incrementCustomProperty(clouds, "--left", 600)
    }
  })
}
