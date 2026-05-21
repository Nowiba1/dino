
import { setupGround,  updateGround  } from "./ground.js"
import { setupClouds,  updateClouds  } from "./clouds.js"
import { setupCactus,  updateCactus,  getCactusRects } from "./cactus.js"
import { createDinoController, createMpDino } from "./dino.js"
import { setCustomProperty, getCustomProperty } from "./update.js"

// ── Constants ────────────────────────────────────────────────
const WORLD_WIDTH     = 100
const WORLD_HEIGHT    = 30
const SPEED_SCALE_INC = 0.00001

// ── Screen elements ──────────────────────────────────────────
const screens = {
  menu     : document.getElementById("main-menu"),
  join     : document.getElementById("join-screen"),
  lobby    : document.getElementById("lobby-screen"),
  solo     : document.getElementById("solo-screen"),
  multi    : document.getElementById("multi-screen"),
  gameover : document.getElementById("gameover-screen"),
}

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove("active"))
  screens[name].classList.add("active")
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

// ── Game world elements ──────────────────────────────────────
const soloWorld      = document.getElementById("solo-world")
const soloScore      = document.getElementById("solo-score")
const hiVal          = document.getElementById("hi-val")
const soloStartMsg   = document.getElementById("solo-start-screen")
const soloEndMsg     = document.getElementById("solo-end-screen")
const soloDinoElem   = document.getElementById("solo-dino")
const multiWorld     = document.getElementById("multi-world")
const mpHud          = document.getElementById("mp-hud")
const mpMessage      = document.getElementById("mp-message")

// ── World scaling ─────────────────────────────────────────────
function scaleWorld(el) {
  const scale = window.innerWidth / window.innerHeight < WORLD_WIDTH / WORLD_HEIGHT
    ? window.innerWidth  / WORLD_WIDTH
    : window.innerHeight / WORLD_HEIGHT
  el.style.width  = `${WORLD_WIDTH  * scale}px`
  el.style.height = `${WORLD_HEIGHT * scale}px`
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
let soloRunning  = false
let soloLastTime = null
let soloSpeed    = 1
let soloScoreVal = 0
let soloHi       = parseInt(localStorage.getItem("dinoHi") || "0")
let soloRafId    = null
let soloWaiting  = false

const dinoCtrl       = createDinoController(soloDinoElem)
const soloGroundElems = soloWorld.querySelectorAll("[data-ground]")
const soloCloudsElems = soloWorld.querySelectorAll("[data-clouds]")

function soloInit() {
  scaleWorld(soloWorld)
  hiVal.textContent         = String(soloHi).padStart(5, "0")
  soloScore.textContent     = "00000"
  soloStartMsg.style.display = "block"
  soloEndMsg.classList.add("hidden")
  soloRunning  = false
  soloWaiting  = true
  soloLastTime = null

  setupGround(soloGroundElems)
  setupClouds(soloCloudsElems)
  setupCactus(soloWorld)
  dinoCtrl.setup()

  document.addEventListener("keydown",    soloFirstInput)
  document.body.addEventListener("touchstart", soloFirstInput, { passive: true })
}

function soloFirstInput(e) {
  if (!soloWaiting) return
  if (e.type === "keydown" && e.code !== "Space" && e.code !== "ArrowUp") return
  soloWaiting = false
  document.removeEventListener("keydown",    soloFirstInput)
  document.body.removeEventListener("touchstart", soloFirstInput)
  soloBegin()
}

function soloBegin() {
  soloLastTime  = null
  soloSpeed     = 1
  soloScoreVal  = 0
  soloRunning   = true

  setupGround(soloGroundElems)
  setupClouds(soloCloudsElems)
  setupCactus(soloWorld)
  dinoCtrl.setup()

  soloStartMsg.style.display = "none"
  soloEndMsg.classList.add("hidden")

  if (soloRafId) cancelAnimationFrame(soloRafId)
  soloRafId = requestAnimationFrame(soloLoop)
}

function soloLoop(time) {
  if (!soloRunning) return
  if (soloLastTime == null) {
    soloLastTime = time
    soloRafId = requestAnimationFrame(soloLoop)
    return
  }

  const delta  = time - soloLastTime
  soloLastTime = time

  updateGround(delta, soloSpeed, soloGroundElems)
  updateClouds(delta, soloSpeed, soloCloudsElems)
  dinoCtrl.update(delta, soloSpeed)
  updateCactus(delta, soloSpeed)
  soloSpeed    += delta * SPEED_SCALE_INC
  soloScoreVal += delta * 0.01

  const display = Math.floor(soloScoreVal)
  soloScore.textContent = String(display).padStart(5, "0")
  if (display > soloHi) {
    soloHi = display
    hiVal.textContent = String(soloHi).padStart(5, "0")
    localStorage.setItem("dinoHi", soloHi)
  }

  const dinoRect = dinoCtrl.getRect()
  const hit = getCactusRects().some(r => isCollision(r, dinoRect))
  if (hit) {
    soloRunning = false
    dinoCtrl.setLose()
    setTimeout(() => {
      soloEndMsg.classList.remove("hidden")
      document.addEventListener("keydown",    soloRestartKey)
      document.body.addEventListener("touchstart", soloRestartTouch, { passive: true })
    }, 600)
    return
  }

  soloRafId = requestAnimationFrame(soloLoop)
}

function soloRestartKey(e) {
  if (e.code !== "Space" && e.code !== "ArrowUp") return
  document.removeEventListener("keydown",    soloRestartKey)
  document.body.removeEventListener("touchstart", soloRestartTouch)
  soloBegin()
}
function soloRestartTouch() {
  document.removeEventListener("keydown",    soloRestartKey)
  document.body.removeEventListener("touchstart", soloRestartTouch)
  soloBegin()
}

function soloStop() {
  soloRunning = false
  soloWaiting = false
  if (soloRafId) cancelAnimationFrame(soloRafId)
  document.removeEventListener("keydown",    soloFirstInput)
  document.body.removeEventListener("touchstart", soloFirstInput)
  document.removeEventListener("keydown",    soloRestartKey)
  document.body.removeEventListener("touchstart", soloRestartTouch)
  soloWorld.querySelectorAll("[data-cactus]").forEach(c => c.remove())
}

// ════════════════════════════════════════════════════════════
//  MULTIPLAYER MODE
// ════════════════════════════════════════════════════════════
let socket      = null
let myPlayer    = null
let myRoomCode  = null
let isHost      = false
let mpRunning   = false
let mpLastTime  = null
let mpSpeed     = 1
let mpScoreVal  = 0
let mpRafId     = null
let mpPlayers   = {}      // id → { data, ctrl?, mpDino?, isMine }
let mpGround    = null
let mpCloudsEl  = null
let myDinoElem  = null
let myDinoCtrl  = null

// Prevent repeated obstacle broadcast per tick
let mpObstaclePrevCount = 0

function ensureSocket() {
  if (socket && socket.connected) return

  socket = io()

  socket.on("playerJoined",     data => { renderLobby(data.players); updateStartBtn(data.players) })
  socket.on("playerLeft",       onPlayerLeft)
  socket.on("hostChanged",      onHostChanged)
  socket.on("gameCountdown",    onGameCountdown)
  socket.on("gameStart",        onGameStart)
  socket.on("speedSync",        ({ speedScale, score }) => { mpSpeed = speedScale; mpScoreVal = score; updateMpScoreDisplay(score) })
  socket.on("playerMoved",      ({ id, bottom, state }) => { if (mpPlayers[id]) { mpPlayers[id].data.bottom = bottom; mpPlayers[id].data.state = state } })
  socket.on("playerDied",       onPlayerDied)
  socket.on("playerRespawn",    onPlayerRespawn)
  socket.on("invincibilityEnd", ({ id }) => { if (mpPlayers[id]) { mpPlayers[id].data.isInvincible = false; if (mpPlayers[id].mpDino) mpPlayers[id].mpDino.setInvincible(false); if (id === socket.id) hideMpMessage() } })
  socket.on("gameOver",         onGameOver)
}

// ── Lobby ─────────────────────────────────────────────────────
function renderLobby(players) {
  const list = Array.isArray(players) ? players : Object.values(players)
  playerSlots.innerHTML = ""
  for (let i = 0; i < 4; i++) {
    const slot = document.createElement("div")
    const p = list[i]
    if (p) {
      slot.className = "player-slot"
      slot.innerHTML = `
        <div class="slot-color" style="background:${p.color}"></div>
        <div class="slot-name">${p.name}${socket && p.id === socket.id ? " (You)" : ""}</div>
      `
    } else {
      slot.className = "player-slot empty"
      slot.innerHTML = `<div class="slot-name" style="font-size:0.4rem;color:#bbb">Waiting…</div>`
    }
    playerSlots.appendChild(slot)
  }
}

function updateStartBtn(players) {
  const list  = Array.isArray(players) ? players : Object.values(players)
  const count = list.length
  if (isHost) {
    btnStart.style.display     = count >= 1 ? "block" : "none"
    lobbyWaiting.style.display = "none"
  } else {
    btnStart.style.display     = "none"
    lobbyWaiting.style.display = "block"
  }
}

// ── MP world setup ────────────────────────────────────────────
function setupMpWorld(players) {
  const list = Array.isArray(players) ? players : Object.values(players)

  // Clear leftovers
  multiWorld.querySelectorAll(".mp-dino, [data-mp-dino], [data-cactus]").forEach(e => e.remove())
  if (myDinoElem) { myDinoElem.remove(); myDinoElem = null }
  myDinoCtrl = null
  mpPlayers  = {}

  mpGround   = multiWorld.querySelectorAll("[data-mp-ground]")
  mpCloudsEl = multiWorld.querySelectorAll("[data-clouds]")

  setupGround(mpGround)
  setupClouds(mpCloudsEl)
  setupCactus(multiWorld)   // <-- pass multiWorld so cactuses go in the right world

  list.forEach(p => {
    if (socket && p.id === socket.id) {
      // My own dino
      myDinoElem = document.createElement("img")
      myDinoElem.src = "images/dino-stationary.png"
      myDinoElem.classList.add("dino")
      myDinoElem.style.left   = `${p.xOffset}%`
      myDinoElem.style.filter = colorFilter(p.color)
      setCustomProperty(myDinoElem, "--bottom", 0)
      multiWorld.appendChild(myDinoElem)
      myDinoCtrl = createDinoController(myDinoElem)
      mpPlayers[p.id] = { data: { ...p }, ctrl: myDinoCtrl, isMine: true }
    } else {
      const mpDino = createMpDino(multiWorld, p)
      mpPlayers[p.id] = { data: { ...p }, mpDino, isMine: false }
    }
  })

  buildMpHud(list)
}

function buildMpHud(players) {
  mpHud.innerHTML = `<div class="mp-score-global" id="mp-score-display">Score: 0</div>`
  players.forEach(p => {
    const row = document.createElement("div")
    row.className = "hud-player"
    row.id        = `hud-${p.id}`
    row.innerHTML = `
      <span class="hud-dot" style="background:${p.color}"></span>
      <span>${p.name}</span>
      <span class="hud-hearts" id="hearts-${p.id}">${"❤️".repeat(p.lives)}</span>
    `
    mpHud.appendChild(row)
  })
}

function updateMpScoreDisplay(score) {
  const el = document.getElementById("mp-score-display")
  if (el) el.textContent = `Score: ${Math.floor(score)}`
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
    mpRafId    = requestAnimationFrame(mpLoop)
    return
  }

  const delta = time - mpLastTime
  mpLastTime  = time

  updateGround(delta, mpSpeed, mpGround)
  updateClouds(delta, mpSpeed, mpCloudsEl)

  // My dino
  const me = mpPlayers[socket?.id]
  if (me && me.isMine && me.ctrl) {
    me.ctrl.update(delta, mpSpeed)
    const bottom    = getCustomProperty(myDinoElem, "--bottom")
    const isJumping = bottom > 0.5
    const state     = isJumping ? "jump" : (me.data.isAlive ? "run" : me.data.state)
    socket.emit("positionUpdate", { bottom, state })

    // Collision — only if alive and not invincible
    if (me.data.isAlive && !me.data.isInvincible) {
      const rect = me.ctrl.getRect()
      const hit  = getCactusRects().some(r => isCollision(r, rect))
      if (hit) {
        me.data.isInvincible = true   // local flag prevents double-emit
        socket.emit("playerHit")
      }
    }
  }

  // Remote dinos
  Object.values(mpPlayers).forEach(entry => {
    if (!entry.isMine && entry.mpDino) {
      entry.mpDino.update(delta, mpSpeed, entry.data.state, entry.data.bottom)
    }
  })

  // Host: drive obstacles & broadcast speed/score
  if (isHost) {
    updateCactus(delta, mpSpeed)
    mpSpeed    += delta * SPEED_SCALE_INC
    mpScoreVal += delta * 0.01
    const score = Math.floor(mpScoreVal)
    updateMpScoreDisplay(score)
    socket.emit("speedUpdate",  { speedScale: mpSpeed, score })
    socket.emit("scoreUpdate",  { score })
  }

  mpRafId = requestAnimationFrame(mpLoop)
}

function mpStop() {
  mpRunning = false
  if (mpRafId) cancelAnimationFrame(mpRafId)
  Object.values(mpPlayers).forEach(entry => {
    if (entry.mpDino) entry.mpDino.remove()
  })
  if (myDinoElem) { myDinoElem.remove(); myDinoElem = null }
  myDinoCtrl = null
  mpPlayers  = {}
  multiWorld.querySelectorAll("[data-cactus]").forEach(c => c.remove())
}

// ── Socket handlers ───────────────────────────────────────────
function onPlayerLeft({ id, players }) {
  if (mpPlayers[id]) {
    if (mpPlayers[id].mpDino) mpPlayers[id].mpDino.remove()
    delete mpPlayers[id]
  }
  const hudRow = document.getElementById(`hud-${id}`)
  if (hudRow) hudRow.remove()

  const list = Array.isArray(players) ? players : Object.values(players)
  renderLobby(list)
  updateStartBtn(list)
}

function onHostChanged({ newHostId }) {
  if (socket && newHostId === socket.id) {
    isHost                     = true
    btnStart.style.display     = "block"
    lobbyWaiting.style.display = "none"
  }
}

function onGameCountdown({ players }) {
  showScreen("multi")
  scaleWorld(multiWorld)

  const list = Array.isArray(players) ? players : Object.values(players)
  setupMpWorld(list)
  mpRunning = false

  // Countdown visual
  countdownOvl.classList.remove("hidden")
  let n = 3
  countdownNum.textContent = String(n)

  const tick = setInterval(() => {
    n--
    if (n <= 0) {
      clearInterval(tick)
      countdownOvl.classList.add("hidden")
    } else {
      countdownNum.textContent = String(n)
      // Re-trigger CSS animation by forcing reflow
      countdownNum.style.animation = "none"
      void countdownNum.offsetWidth
      countdownNum.style.animation = ""
    }
  }, 1000)
}

function onGameStart({ players }) {
  const list = Array.isArray(players) ? players : Object.values(players)
  list.forEach(p => { if (mpPlayers[p.id]) mpPlayers[p.id].data = { ...p } })

  mpRunning   = true
  mpLastTime  = null
  mpSpeed     = 1
  mpScoreVal  = 0

  if (myDinoCtrl) myDinoCtrl.setup()

  if (mpRafId) cancelAnimationFrame(mpRafId)
  mpRafId = requestAnimationFrame(mpLoop)
}

function onPlayerDied({ id, players }) {
  if (mpPlayers[id]) {
    mpPlayers[id].data.isAlive = false
    mpPlayers[id].data.state   = "spectate"
    if (mpPlayers[id].isMine) {
      if (myDinoCtrl) myDinoCtrl.setLose()
      showMpMessage("💀 You're out! Spectating…")
    } else if (mpPlayers[id].mpDino) {
      mpPlayers[id].mpDino.update(0, 1, "spectate", mpPlayers[id].data.bottom)
    }
    updateHudHearts(id, 0)
  }
}

function onPlayerRespawn({ id, lives, spawnAnim, players }) {
  const list = Array.isArray(players) ? players : Object.values(players)
  list.forEach(p => { if (mpPlayers[p.id]) mpPlayers[p.id].data = { ...p } })

  updateHudHearts(id, lives)

  if (socket && id === socket.id) {
    if (myDinoCtrl) myDinoCtrl.setup()
    const icons = { jetpack: "🚀", parachute: "🪂", pterodactyl: "🦕" }
    showMpMessage(`${icons[spawnAnim] || "✨"} Respawning via ${spawnAnim}! Invincible for 5s`)
    setTimeout(() => hideMpMessage(), 4500)
  }
}

function onGameOver({ players, winner }) {
  mpStop()
  showScreen("gameover")

  const list   = Array.isArray(players) ? players : Object.values(players)
  const win    = list.find(p => p.id === winner)
  const isMe   = socket && winner === socket.id

  if (win) {
    winnerDisplay.innerHTML = `
      🏆 ${isMe ? "You Win!" : "Winner"}: <span style="color:${win.color}">${win.name}</span>
    `
  } else {
    winnerDisplay.textContent = "Everyone crashed! No winner."
  }

  const sorted = [...list].sort((a, b) => b.score - a.score)
  finalScores.innerHTML = sorted.map((p, i) => `
    <div class="final-row">
      <span class="final-dot" style="background:${p.color}"></span>
      <span class="final-name">${i + 1}. ${p.name}${socket && p.id === socket.id ? " (You)" : ""}</span>
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

// ── Collision ─────────────────────────────────────────────────
function isCollision(r1, r2) {
  return r1.left < r2.right && r1.top < r2.bottom && r1.right > r2.left && r1.bottom > r2.top
}

// ── Color filter ──────────────────────────────────────────────
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
//  BUTTON WIRING
// ════════════════════════════════════════════════════════════

// Solo
btnSolo.addEventListener("click", () => { showScreen("solo"); soloInit() })
btnSoloBack.addEventListener("click", () => { soloStop(); showScreen("menu") })

// Create Room
btnCreate.addEventListener("click", () => {
  ensureSocket()
  socket.emit("createRoom", (res) => {
    if (!res.ok) return alert("Could not create room: " + (res.error || "unknown error"))
    myPlayer   = res.player
    myRoomCode = res.code
    isHost     = true
    lobbyCode.textContent = res.code
    const list = Array.isArray(res.players) ? res.players : Object.values(res.players)
    renderLobby(list)
    updateStartBtn(list)
    showScreen("lobby")
  })
})

// Join Room
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
    const list = Array.isArray(res.players) ? res.players : Object.values(res.players)
    renderLobby(list)
    updateStartBtn(list)
    showScreen("lobby")
  })
})
roomCodeInput.addEventListener("keydown", e => { if (e.key === "Enter") btnJoinConfirm.click() })

// Lobby actions
btnStart.addEventListener("click", () => { if (isHost) socket.emit("startGame") })

btnLobbyBack.addEventListener("click", () => {
  if (socket) { socket.disconnect(); socket = null }
  isHost = false; myPlayer = null; myRoomCode = null
  showScreen("menu")
})

// Multi back
btnMultiBack.addEventListener("click", () => {
  mpStop()
  if (socket) { socket.disconnect(); socket = null }
  isHost = false; myPlayer = null; myRoomCode = null
  showScreen("menu")
})

// Game over
btnPlayAgain.addEventListener("click", () => {
  if (socket) { socket.disconnect(); socket = null }
  isHost = false; myPlayer = null; myRoomCode = null
  showScreen("menu")
})
btnGoMenu.addEventListener("click", () => {
  if (socket) { socket.disconnect(); socket = null }
  isHost = false; myPlayer = null; myRoomCode = null
  showScreen("menu")
})

// ── Boot ──────────────────────────────────────────────────────
showScreen("menu")
