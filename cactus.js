import {
  setCustomProperty,
  incrementCustomProperty,
  getCustomProperty,
} from "./update.js"

const SPEED = 0.05
const CACTUS_INTERVAL_MIN = 500
const CACTUS_INTERVAL_MAX = 2000

// Active world context — switched between solo and multiplayer
let activeWorld = null
let nextCactusTime

/**
 * setupCactus(worldElem?)
 * Pass a worldElem to set context (e.g. multiWorld for MP host).
 * Defaults to [data-world] (solo).
 */
export function setupCactus(worldElem) {
  activeWorld    = worldElem || document.querySelector("[data-world]")
  nextCactusTime = CACTUS_INTERVAL_MIN
  // FIX: Only remove cactus elements within the active world, not globally
  if (activeWorld) {
    activeWorld.querySelectorAll("[data-cactus]").forEach(c => c.remove())
  }
}

export function updateCactus(delta, speedScale) {
  // FIX: Only operate on cacti within the active world
  const world = activeWorld || document
  world.querySelectorAll("[data-cactus]").forEach(cactus => {
    incrementCustomProperty(cactus, "--left", delta * speedScale * SPEED * -1)
    if (getCustomProperty(cactus, "--left") <= -100) {
      cactus.remove()
    }
  })

  if (nextCactusTime <= 0) {
    createCactus()
    nextCactusTime =
      randomNumberBetween(CACTUS_INTERVAL_MIN, CACTUS_INTERVAL_MAX) / speedScale
  }
  nextCactusTime -= delta
}

// FIX: Only return cacti from the active world
export function getCactusRects() {
  const world = activeWorld || document
  return [...world.querySelectorAll("[data-cactus]")].map(cactus =>
    cactus.getBoundingClientRect()
  )
}

function createCactus() {
  if (!activeWorld) return
  const cactus = document.createElement("img")
  cactus.dataset.cactus = true
  cactus.src = "images/cactus.png"
  cactus.classList.add("cactus")
  setCustomProperty(cactus, "--left", 100)
  activeWorld.append(cactus)
}

function randomNumberBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min)
}
