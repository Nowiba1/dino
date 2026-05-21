import { incrementCustomProperty, setCustomProperty, getCustomProperty } from "./update.js"

const JUMP_SPEED   = 0.45
const GRAVITY      = 0.0015
const FRAME_COUNT  = 2
const FRAME_TIME   = 100

// ── Solo Dino ────────────────────────────────────────────────────────────────
export function createDinoController(dinoElem) {
  let isJumping        = false
  let dinoFrame        = 0
  let currentFrameTime = 0
  let yVelocity        = 0
  let isLose           = false
  let isSetup          = false  // FIX: Track whether listeners are active

  const jumpSound      = new Audio("audio/press_sound.mp3")
  const hitSound       = new Audio("audio/hit_sound.mp3")
  jumpSound.volume     = 0.5
  hitSound.volume      = 0.5

  function onJump(e) {
    if (isJumping || isLose) return
    if (e.type === "keydown" && e.code !== "Space" && e.code !== "ArrowUp") return
    yVelocity = JUMP_SPEED
    isJumping = true
    jumpSound.play().catch(() => {})
  }

  // FIX: Separate function to clean up listeners
  function removeListeners() {
    document.removeEventListener("keydown", onJump)
    document.body.removeEventListener("touchstart", onJump)
    isSetup = false
  }

  // FIX: Separate function to add listeners
  function addListeners() {
    if (!isSetup) {
      document.addEventListener("keydown", onJump)
      document.body.addEventListener("touchstart", onJump, { passive: true })
      isSetup = true
    }
  }

  function setup() {
    isJumping        = false
    dinoFrame        = 0
    currentFrameTime = 0
    yVelocity        = 0
    isLose           = false
    setCustomProperty(dinoElem, "--bottom", 0)
    dinoElem.src     = "images/dino-stationary.png"
    addListeners()
  }

  function update(delta, speedScale) {
    handleRun(delta, speedScale)
    handleJump(delta)
  }

  function handleRun(delta, speedScale) {
    if (isJumping) {
      dinoElem.src = "images/dino-stationary.png"
      return
    }
    if (currentFrameTime >= FRAME_TIME) {
      dinoFrame = (dinoFrame + 1) % FRAME_COUNT
      dinoElem.src = `images/dino-run-${dinoFrame}.png`
      currentFrameTime -= FRAME_TIME
    }
    currentFrameTime += delta * speedScale
  }

  function handleJump(delta) {
    if (!isJumping) return
    incrementCustomProperty(dinoElem, "--bottom", yVelocity * delta)
    if (getCustomProperty(dinoElem, "--bottom") <= 0) {
      setCustomProperty(dinoElem, "--bottom", 0)
      isJumping = false
    }
    yVelocity -= GRAVITY * delta
  }

  function getRect() {
    return dinoElem.getBoundingClientRect()
  }

  function setLose() {
    isLose = true
    dinoElem.src = "images/dino-lose.png"
    hitSound.play().catch(() => {})
    removeListeners()
  }

  // FIX: Export cleanup for external use (e.g., mpStop)
  function destroy() {
    removeListeners()
  }

  return { setup, update, getRect, setLose, destroy, onJump }
}

// ── MP Dino Element ──────────────────────────────────────────────────────────
export function createMpDino(worldElem, player) {
  const el = document.createElement("img")
  el.src              = "images/dino-stationary.png"
  el.classList.add("mp-dino")
  el.dataset.mpDino   = player.id
  el.style.left       = `${player.xOffset}%`
  el.style.filter     = colorFilter(player.color)
  setCustomProperty(el, "--bottom", 0)
  worldElem.appendChild(el)

  let frame     = 0
  let frameTime = 0

  function update(delta, speedScale, state, bottom) {
    setCustomProperty(el, "--bottom", bottom)
    if (state === "jump") {
      el.src = "images/dino-stationary.png"
    } else if (state === "dead" || state === "spectate") {
      el.src = "images/dino-lose.png"
      el.style.opacity = "0.35"
    } else if (state === "spawning") {
      // FIX: Show stationary dino with invincible flash during respawn
      el.src = "images/dino-stationary.png"
      el.style.opacity = "1"
      el.classList.add("invincible")
    } else {
      el.style.opacity = "1"
      el.classList.remove("invincible")
      if (frameTime >= FRAME_TIME) {
        frame = (frame + 1) % FRAME_COUNT
        el.src = `images/dino-run-${frame}.png`
        frameTime -= FRAME_TIME
      }
      frameTime += delta * speedScale
    }
  }

  function setInvincible(val) {
    if (val) el.classList.add("invincible")
    else     el.classList.remove("invincible")
  }

  function remove() { el.remove() }

  return { el, update, setInvincible, remove }
}

// Approximates a CSS color-tint filter for the dino sprite
function colorFilter(hex) {
  const map = {
    "#e74c3c": "sepia(1) saturate(8) hue-rotate(320deg) brightness(0.9)",
    "#3498db": "sepia(1) saturate(8) hue-rotate(175deg) brightness(0.9)",
    "#2ecc71": "sepia(1) saturate(8) hue-rotate(85deg)  brightness(0.85)",
    "#f1c40f": "sepia(1) saturate(8) hue-rotate(10deg)  brightness(1.1)",
  }
  return map[hex] || "none"
}
