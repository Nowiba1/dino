// ============================================================
//  DINO PARTY — Main Script
//  Handles: Menu navigation, Solo mode, Multiplayer mode
// ============================================================

import { setupGround,  updateGround  } from "./ground.js"
import { setupClouds,  updateClouds  } from "./clouds.js"
import { setupCactus,  updateCactus,  getCactusRects } from "./cactus.js"
import { createDinoController, createMpDino } from "./dino.js"
import { setCustomProperty, getCustomProperty } from "./update.js"

// ── Constants ────────────────────────────────────────────────
const WORLD_WIDTH        = 100
const WORLD_HEIGHT       = 30
const SPEED_SCALE_INC    = 0.00001

// ── Screen elements ──────────────────────────────────────────
const screens = {
  menu     : document.getElementById("main-menu"),
  join     : document.getElementById("join-screen"),
  lobby    : document.getElementById("lobby-screen"),
  solo     : document.getElementById("solo-screen"),
  multi    : document.getElementById("multi-screen"),
  gameover : document.getElementById("gameover-screen"),
}

// ── UI refs ──────────────────────────────────────────────────
const btnSolo        = document.getElementById("btn-solo")
const btnCreate      = document.getElementById("btn-create")
const btnJoinOpen    = document.getElementById("btn-join-open")
const btnJoinBack    = document.getElementById("btn-join-back")
const btnJoinConfirm = document.getElementById("btn-join-confirm")
const roomCodeInput  = document.getElementById("room-code-input")
const joinError      = document.getElementById("join-error")
const btnSoloBack    = document.getElementById("btn-solo-back")
const btnMultiBack   = document.getElementById("btn-multi-back")
const btnLobbyBack   = document.getElementById("btn-lobby-back")
const btnStart       = document.getElementById("btn-start")
const lobbyCode      = document.getElementById("lobby-code")
const lobbyWaiting   = document.getElementById("lobby-waiting")
const playerSlots    = document.getElementById("player-slots")
const countdownOvl   = document.getElementById("countdown-overlay")
const countdownNum   = document.getElementById("countdown-number")
const btnPlayAgain   = document.getElementById("btn-play-again")
const btnGoMenu      = document.getElementById("btn-go-menu")
const winnerDisplay  = document.getElementById("winner-display")
const finalScores    = document.getElementById("final-scores")

// ── Solo world refs ──────────────────────────────────────────
const soloWorld      = document.getElementById("solo-world")
const soloScore      = document.getElementById("solo-score")
const hiVal          = document.getElementById("hi-val")
const soloStart      = document.getElementById("solo-start-screen")
const soloEnd        = document.getElementById("solo-end-screen")
const soloDinoElem   = document.getElementById("solo-dino")

// ── Multi world refs ─────────────────────────────────────────
const multiWorld     = document.getElementById("multi-world")
const mpHud          = document.getElementById("mp-hud")
const mpMessage      = document.getElementById("mp-message")

// ── Screen helper ─────────────────────────────────────────────
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove("active"))
  screens[name].classList.add("active")
}

// ── World scaling ─────────────────────────────────────────────
function scaleWorld(worldElem) {
  let scale
  if (window.innerWidth / window.innerHeight < WORLD_WIDTH / WORLD_HEIGHT) {
    scale = window.innerWidth / WORLD_WIDTH
  } else {
    scale = window.innerHeight / WORLD_HEIGHT
  }
  worldElem.style.width  = `${WORLD_WIDTH  * scale}px`
  worldElem.style.height = `${WORLD_HEIGHT * scale}px`
}

window.addEventListener("resize", () => {
  scaleWorld(soloWorld)
  scaleWorld(multiWorld)
})
scaleWorld(soloWorld)
scaleWorld(multiWorld)

// ════════════════════════════════════════════════════════════
//  SOLO MODE
// ════════════════════════════════════════════════════════════
let soloRunning   = false
let soloLastTime  = null
let soloSpeed     = 1
let soloScoreVal  = 0
let soloHi        = parseInt(localStorage.getItem("dinoHi") || "0")
let soloAnimFrame = null
let soloStarted   = false

const dinoCtrl = createDinoController(soloDinoElem)

// Ground/cloud element refs for solo
const soloGroundElems = soloWorld.querySelectorAll("[data-ground]")
const soloCloudsElems = soloWorld.querySelectorAll("[data-clouds]")

function soloInit() {
  scaleWorld(soloWorld)
  hiVal.textContent = String(soloHi).padStart(5, "0")
  soloScore.textContent = "00000"
  soloStart.textContent = "Press Space / Tap to Start"
  soloStart.style.display = "block"
  soloEnd.classList.add("hidden")
  soloRunning  = false
  soloStarted  = false
  soloLastTime = null

  setupGround(soloGroundElems)
  setupClouds(soloCloudsElems)
  setupCactus()
  dinoCtrl.setup()

  // Listen for first start input
  document.addEventListener("keydown", soloHandleFirstStart, { once: true })
  document.body.addEventListener("touchstart", soloHandleFirstStart, { once: true, passive: true })
}

function soloHandleFirstStart(e) {
  if (e.type === "keydown" && e.code !== "Space" && e.code !== "ArrowUp") {
    // re-attach if wrong key
    document.addEventListener("keydown", soloHandleFirstStart, { once: true })
    return
  }
  soloBegin()
}

function soloBegin() {
  soloLastTime  = null
  soloSpeed     = 1
  soloScoreVal  = 0
  soloStarted   = true
  soloRunning   = true

  setupGround(soloGroundElems)
  setupClouds(soloCloudsElems)
  setupCactus()
  dinoCtrl.setup()

  soloStart.style.display = "none"
  soloEnd.classList.add("hidden")

  if (soloAnimFrame) cancelAnimationFrame(soloAnimFrame)
  soloAnimFrame = requestAnimationFrame(soloLoop)
}

function soloLoop(time) {
  if (!soloRunning) return
  if (soloLastTime == null) {
    soloLastTime = time
    soloAnimFrame = requestAnimationFrame(soloLoop)
    return
  }

  const delta = time - soloLastTime
  soloLastTime = time

  updateGround(delta, soloSpeed, soloGroundElems)
  updateClouds(delta, soloSpeed, soloCloudsElems)
  dinoCtrl.update(delta, soloSpeed)
  updateCactus(delta, soloSpeed)
  soloSpeed += delta * SPEED_SCALE_INC
  soloScoreVal += delta * 0.01

  const display = Math.floor(soloScoreVal)
  soloScore.textContent = String(display).padStart(5, "0")

  if (display > soloHi) {
    soloHi = display
    hiVal.textContent = String(soloHi).padStart(5, "0")
    localStorage.setItem("dinoHi", soloHi)
  }

  // Collision
  const dinoRect = dinoCtrl.getRect()
  const hit = getCactusRects().some(r => isCollision(r, dinoRect))
  if (hit) {
    soloRunning = false
    dinoCtrl.setLose()
    setTimeout(() => {
      soloEnd.classList.remove("hidden")
      document.addEventListener("keydown", soloRestartListener)
      document.body.addEventListener("touchstart", soloRestartTouch, { passive: true })
    }, 600)
    return
  }

  soloAnimFrame = requestAnimationFrame(soloLoop)
}

function soloRestartListener(e) {
  if (e.code !== "Space" && e.code !== "ArrowUp") return
  document.removeEventListener("keydown", soloRestartListener)
  document.body.removeEventListener("touchstart", soloRestartTouch)
  soloBegin()
}
function soloRestartTouch() {
  document.removeEventListener("keydown", soloRestartListener)
  document.body.removeEventListener("touchstart", soloRestartTouch)
  soloBegin()
}

function soloStop() {
  soloRunning = false
  if (soloAnimFrame) cancelAnimationFrame(soloAnimFrame)
  document.removeEventListener("keydown", soloHandleFirstStart)
  document.body.removeEventListener("touchstart", soloHandleFirstStart)
  document.removeEventListener("keydown", soloRestartListener)
  document.body.removeEventListener("touchstart", soloRestartTouch)
  // Clean up cactus elements
  soloWorld.querySelectorAll("[data-cactus]").forEach(c => c.remove())
}

// ════════════════════════════════════════════════════════════
//  MULTIPLAYER MODE
// ════════════════════════════════════════════════════════════
let socket        = null
let myPlayer      = null
let myRoomCode    = null
let isHost        = false
let mpRunning     = false
let mpLastTime    = null
let mpSpeed       = 1
let mpScoreVal    = 0
let mpAnimFrame   = null
let mpPlayers     = {}   // id → { data, dinoController }
let mpGroundElems = null
let mpCloudsElems = null
let myDinoCtrl    = null
let myDinoElem    = null

function ensureSocket() {
  if (socket && socket.connected) return

  socket = io()

  socket.on("playerJoined",     onPlayerJoined)
  socket.on("playerLeft",       onPlayerLeft)
  socket.on("hostChanged",      onHostChanged)
  socket.on("gameCountdown",    onGameCountdown)
  socket.on("gameStart",        onGameStart)
  socket.on("obstacleSpawned",  onObstacleSpawned)
  socket.on("speedSync",        onSpeedSync)
  socket.on("playerMoved",      onPlayerMoved)
  socket.on("playerHit",        onPlayerHitEvent)
  socket.on("playerDied",       onPlayerDied)
  socket.on("playerRespawn",    onPlayerRespawn)
  socket.on("invincibilityEnd", onInvincibilityEnd)
  socket.on("gameOver",         onGameOver)
}

// ── Lobby helpers ────────────────────────────────────────────
function renderLobby(players) {
  playerSlots.innerHTML = ""
  const MAX = 4
  const list = Object.values(players)

  for (let i = 0; i < MAX; i++) {
    const slot = document.createElement("div")
    slot.className = "player-slot" + (i >= list.length ? " empty" : "")

    if (i < list.length) {
      const p = list[i]
      slot.innerHTML = `
        <div class="slot-color" style="background:${p.color}"></div>
        <div class="slot-name">${p.name}${p.id === socket.id ? " (You)" : ""}</div>
      `
    } else {
      slot.innerHTML = `<div class="slot-name" style="font-size:0.4rem;color:#bbb">Waiting…</div>`
    }
    playerSlots.appendChild(slot)
  }
}

function updateStartButton(players) {
  const count = Object.keys(players).length
  if (isHost) {
    btnStart.style.display  = count >= 1 ? "block" : "none"
    lobbyWaiting.style.display = "none"
  } else {
    btnStart.style.display  = "none"
    lobbyWaiting.style.display = "block"
  }
}

// ── MP World setup ────────────────────────────────────────────
function setupMpWorld(players) {
  // Clear old mp dinos
  multiWorld.querySelectorAll("[data-mp-dino]").forEach(e => e.remove())
  multiWorld.querySelectorAll("[data-cactus]").forEach(e => e.remove())
  mpPlayers = {}

  mpGroundElems = multiWorld.querySelectorAll("[data-mp-ground]")
  mpCloudsElems = multiWorld.querySelectorAll("[data-clouds]")

  setupGround(mpGroundElems)
  setupClouds(mpCloudsElems)
  setupCactus()

  // Create dino for each player
  Object.values(players).forEach(p => {
    if (p.id === socket.id) {
      // My dino — use a real controller
      myDinoElem = document.createElement("img")
      myDinoElem.src = "images/dino-stationary.png"
      myDinoElem.classList.add("dino")
      myDinoElem.style.left   = `${p.xOffset}%`
      myDinoElem.style.filter = colorFilter(p.color)
      setCustomProperty(myDinoElem, "--bottom", 0)
      multiWorld.appendChild(myDinoElem)

      myDinoCtrl = createDinoController(myDinoElem)
      myDinoCtrl.setup()
      mpPlayers[p.id] = { data: p, ctrl: myDinoCtrl, isMine: true }
    } else {
      // Remote dino — visual only
      const mpDino = createMpDino(multiWorld, p)
      mpPlayers[p.id] = { data: p, mpDino, isMine: false }
    }
  })

  // Build HUD
  renderMpHud(players)
}

function renderMpHud(players) {
  mpHud.innerHTML = `
    <div class="mp-score-global" id="mp-score-display">Score: 0</div>
  `
  Object.values(players).forEach(p => {
    const row = document.createElement("div")
    row.className = "hud-player"
    row.id = `hud-${p.id}`
    row.innerHTML = `
      <span class="hud-dot" style="background:${p.color}"></span>
      <span class="hud-name">${p.name}</span>
      <span class="hud-hearts" id="hearts-${p.id}">${"❤️".repeat(p.lives)}</span>
    `
    mpHud.appendChild(row)
  })
}

function updateHudHearts(id, lives) {
  const el = document.getElementById(`hearts-${id}`)
  if (el) el.textContent = "❤️".repeat(Math.max(0, lives))
}

// ── MP Game Loop ──────────────────────────────────────────────
function mpLoop(time) {
  if (!mpRunning) return
  if (mpLastTime == null) {
    mpLastTime = time
    mpAnimFrame = requestAnimationFrame(mpLoop)
    return
  }

  const delta = time - mpLastTime
  mpLastTime  = time

  updateGround(delta, mpSpeed, mpGroundElems)
  updateClouds(delta, mpSpeed, mpCloudsElems)

  // Update my dino
  const me = mpPlayers[socket.id]
  if (me && me.isMine && me.ctrl) {
    me.ctrl.update(delta, mpSpeed)
    const bottom = getCustomProperty(myDinoElem, "--bottom")
    const isJumping = bottom > 0
    const state = isJumping ? "jump" : (me.data.state === "dead" || me.data.state === "spectate" ? me.data.state : "run")
    socket.emit("positionUpdate", { bottom, state })

    // Collision detection — only if alive and not invincible
    if (me.data.isAlive && !me.data.isInvincible) {
      const dinoRect = me.ctrl.getRect()
      const hit = getCactusRects().some(r => isCollision(r, dinoRect))
      if (hit) {
        socket.emit("playerHit")
      }
    }
  }

  // Update remote dinos
  Object.values(mpPlayers).forEach(entry => {
    if (!entry.isMine && entry.mpDino) {
      entry.mpDino.update(delta, mpSpeed, entry.data.state, entry.data.bottom)
    }
  })

  // Host: update obstacles & broadcast speed
  if (isHost) {
    updateCactus(delta, mpSpeed)
    mpSpeed    += delta * SPEED_SCALE_INC
    mpScoreVal += delta * 0.01

    const scoreEl = document.getElementById("mp-score-display")
    if (scoreEl) scoreEl.textContent = `Score: ${Math.floor(mpScoreVal)}`

    socket.emit("speedUpdate", { speedScale: mpSpeed, score: Math.floor(mpScoreVal) })
    socket.emit("scoreUpdate", { score: Math.floor(mpScoreVal) })
  }

  mpAnimFrame = requestAnimationFrame(mpLoop)
}

function mpStop() {
  mpRunning = false
  if (mpAnimFrame) cancelAnimationFrame(mpAnimFrame)
  multiWorld.querySelectorAll("[data-mp-dino], [data-cactus]").forEach(e => e.remove())
  if (myDinoElem) { myDinoElem.remove(); myDinoElem = null }
  myDinoCtrl = null
  mpPlayers  = {}
}

// ── Socket event handlers ─────────────────────────────────────
function onPlayerJoined({ players }) {
  renderLobby(players)
  updateStartButton(players)
}

function onPlayerLeft({ id, players }) {
  renderLobby(players)
  updateStartButton(players)
  // Remove their dino if in game
  if (mpPlayers[id] && mpPlayers[id].mpDino) {
    mpPlayers[id].mpDino.remove()
  }
  delete mpPlayers[id]
  const hudRow = document.getElementById(`hud-${id}`)
  if (hudRow) hudRow.remove()
}

function onHostChanged({ newHostId }) {
  if (newHostId === socket.id) {
    isHost = true
    // If still in lobby
    btnStart.style.display     = "block"
    lobbyWaiting.style.display = "none"
  }
}

function onGameCountdown({ players }) {
  showScreen("multi")
  scaleWorld(multiWorld)
  setupMpWorld(players)
  mpRunning = false

  // Show countdown overlay
  countdownOvl.classList.remove("hidden")
  let n = 3
  countdownNum.textContent = n

  const tick = setInterval(() => {
    n--
    if (n <= 0) {
      clearInterval(tick)
      countdownOvl.classList.add("hidden")
    } else {
      countdownNum.textContent = n
      // Re-trigger animation
      countdownNum.style.animation = "none"
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          countdownNum.style.animation = ""
        })
      })
    }
  }, 1000)
}

function onGameStart({ players }) {
  mpRunning   = true
  mpLastTime  = null
  mpSpeed     = 1
  mpScoreVal  = 0

  // Activate my dino controller listening
  if (myDinoCtrl) myDinoCtrl.setup()

  // Mark all alive
  Object.values(players).forEach(p => {
    if (mpPlayers[p.id]) mpPlayers[p.id].data = p
  })

  mpAnimFrame = requestAnimationFrame(mpLoop)
}

function onObstacleSpawned({ obstacle }) {
  if (!isHost) {
    // Non-hosts receive obstacle data and spawn visually
    // The cactus.js createCactus is called by host's updateCactus.
    // For non-hosts we replicate the cactus element directly.
    spawnRemoteCactus(obstacle)
  }
}

function spawnRemoteCactus(obstacle) {
  // Create the visual cactus at the position the host says
  const cactus = document.createElement("img")
  cactus.dataset.cactus = true
  cactus.src = "images/cactus.png"
  cactus.classList.add("cactus")
  import("./update.js").then(({ setCustomProperty }) => {
    setCustomProperty(cactus, "--left", obstacle.left)
    multiWorld.append(cactus)
  })
}

function onSpeedSync({ speedScale, score }) {
  mpSpeed    = speedScale
  mpScoreVal = score
  const scoreEl = document.getElementById("mp-score-display")
  if (scoreEl) scoreEl.textContent = `Score: ${score}`
}

function onPlayerMoved({ id, bottom, state }) {
  if (mpPlayers[id]) {
    mpPlayers[id].data.bottom = bottom
    mpPlayers[id].data.state  = state
  }
}

function onPlayerHitEvent({ id, lives }) {
  // Only comes if someone else is hit — server handles, we get playerRespawn or playerDied
}

function onPlayerDied({ id, players }) {
  if (mpPlayers[id]) {
    mpPlayers[id].data.state   = "spectate"
    mpPlayers[id].data.isAlive = false
    if (mpPlayers[id].isMine) {
      myDinoCtrl.setLose()
      showMpMessage("You're out! Spectating…")
    } else if (mpPlayers[id].mpDino) {
      mpPlayers[id].mpDino.update(0, 1, "spectate", mpPlayers[id].data.bottom)
    }
    updateHudHearts(id, 0)
  }
}

function onPlayerRespawn({ id, lives, spawnAnim, players }) {
  Object.values(players).forEach(p => {
    if (mpPlayers[p.id]) mpPlayers[p.id].data = p
  })

  updateHudHearts(id, lives)

  if (id === socket.id) {
    // Re-setup my dino
    if (myDinoCtrl) myDinoCtrl.setup()
    showMpMessage(`Respawning… (${spawnAnim})`)
    setTimeout(() => hideMpMessage(), 2000)
  }
}

function onInvincibilityEnd({ id }) {
  if (mpPlayers[id]) {
    mpPlayers[id].data.isInvincible = false
    if (mpPlayers[id].isMine) {
      hideMpMessage()
    }
    if (mpPlayers[id].mpDino) {
      mpPlayers[id].mpDino.setInvincible(false)
    }
  }
}

function onGameOver({ players, winner }) {
  mpStop()
  showScreen("gameover")

  const winnerPlayer = players.find(p => p.id === winner)
  if (winnerPlayer) {
    winnerDisplay.innerHTML = `🏆 Winner: <span style="color:${winnerPlayer.color}">${winnerPlayer.name}</span>`
  } else {
    winnerDisplay.textContent = "No winner — everyone crashed!"
  }

  const sorted = [...players].sort((a, b) => b.score - a.score)
  finalScores.innerHTML = sorted.map((p, i) => `
    <div class="final-row">
      <span class="final-dot" style="background:${p.color}"></span>
      <span class="final-name">${i + 1}. ${p.name}${p.id === socket.id ? " (You)" : ""}</span>
      <span class="final-score">${p.score}</span>
    </div>
  `).join("")
}

function showMpMessage(msg) {
  mpMessage.textContent = msg
  mpMessage.classList.remove("hidden")
}
function hideMpMessage() {
  mpMessage.classList.add("hidden")
}

// ── Collision helper ──────────────────────────────────────────
function isCollision(r1, r2) {
  return (
    r1.left   < r2.right  &&
    r1.top    < r2.bottom &&
    r1.right  > r2.left   &&
    r1.bottom > r2.top
  )
}

// ── Color filter helper (mirrors dino.js) ────────────────────
function colorFilter(hex) {
  const map = {
    "#e74c3c": "sepia(1) saturate(8) hue-rotate(320deg) brightness(0.9)",
    "#3498db": "sepia(1) saturate(8) hue-rotate(175deg) brightness(0.9)",
    "#2ecc71": "sepia(1) saturate(8) hue-rotate(85deg)  brightness(0.85)",
    "#f1c40f": "sepia(1) saturate(8) hue-rotate(10deg)  brightness(1.1)",
  }
  return map[hex] || "none"
}

// ════════════════════════════════════════════════════════════
//  MENU NAVIGATION
// ════════════════════════════════════════════════════════════

// Solo
btnSolo.addEventListener("click", () => {
  showScreen("solo")
  soloInit()
})
btnSoloBack.addEventListener("click", () => {
  soloStop()
  showScreen("menu")
})

// Create Room
btnCreate.addEventListener("click", () => {
  ensureSocket()
  socket.emit("createRoom", (res) => {
    if (!res.ok) return alert("Could not create room.")
    myPlayer   = res.player
    myRoomCode = res.code
    isHost     = true
    lobbyCode.textContent = res.code
    renderLobby(Object.fromEntries(res.players.map(p => [p.id, p])))
    updateStartButton(Object.fromEntries(res.players.map(p => [p.id, p])))
    showScreen("lobby")
  })
})

// Join Room flow
btnJoinOpen.addEventListener("click", () => {
  joinError.textContent = ""
  roomCodeInput.value   = ""
  showScreen("join")
})
btnJoinBack.addEventListener("click", () => showScreen("menu"))

btnJoinConfirm.addEventListener("click", () => {
  const code = roomCodeInput.value.trim().toUpperCase()
  if (code.length < 4) { joinError.textContent = "Enter a 4-character code."; return }
  joinError.textContent = "Connecting…"
  ensureSocket()
  socket.emit("joinRoom", { code }, (res) => {
    if (!res.ok) { joinError.textContent = res.error || "Could not join."; return }
    myPlayer   = res.player
    myRoomCode = res.code
    isHost     = false
    lobbyCode.textContent = res.code
    renderLobby(Object.fromEntries(res.players.map(p => [p.id, p])))
    updateStartButton(Object.fromEntries(res.players.map(p => [p.id, p])))
    showScreen("lobby")
  })
})
roomCodeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") btnJoinConfirm.click()
})

// Lobby
btnStart.addEventListener("click", () => {
  if (!isHost) return
  socket.emit("startGame")
})

btnLobbyBack.addEventListener("click", () => {
  if (socket) socket.disconnect()
  socket     = null
  myPlayer   = null
  myRoomCode = null
  isHost     = false
  showScreen("menu")
})

// Multi Back
btnMultiBack.addEventListener("click", () => {
  mpStop()
  if (socket) { socket.disconnect(); socket = null }
  myPlayer   = null
  myRoomCode = null
  isHost     = false
  showScreen("menu")
})

// Game Over
btnPlayAgain.addEventListener("click", () => {
  if (!socket || !socket.connected) {
    showScreen("menu")
    return
  }
  // Go back to lobby as host and start again
  lobbyCode.textContent = myRoomCode || "----"
  // Re-fetch players would require server state; simplest is to return to menu
  showScreen("menu")
})
btnGoMenu.addEventListener("click", () => {
  if (socket) { socket.disconnect(); socket = null }
  myPlayer   = null
  myRoomCode = null
  isHost     = false
  showScreen("menu")
})

// ── Initial screen ────────────────────────────────────────────
showScreen("menu")
