const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const path = require("path")

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
  cors: { 
    origin: ["https://nowiba1.github.io", "http://localhost:3000", "http://localhost:5500", "http://127.0.0.1:5500"], 
    methods: ["GET", "POST"] 
  }
})

app.use(express.static(path.join(__dirname, ".")))

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"))
})

// ── Room State ────────────────────────────────────────────────────────────────
const rooms = {}

const PLAYER_COLORS = ["#e74c3c", "#3498db", "#2ecc71", "#f1c40f"]
const PLAYER_NAMES  = ["Red Rex", "Blue Rex", "Green Rex", "Yellow Rex"]
const X_OFFSETS     = [8, 16, 24, 32]

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

function createRoom(hostId) {
  let code
  do { code = generateRoomCode() } while (rooms[code])

  rooms[code] = {
    code,
    hostId,
    state: "lobby",
    speedScale: 1,
    score: 0,
    players: {},
    cactusList: [] // Host will send cactus positions
  }
  return rooms[code]
}

function addPlayer(room, socketId) {
  const idx = Object.keys(room.players).length
  if (idx >= 4) return null

  room.players[socketId] = {
    id: socketId,
    index: idx,
    color: PLAYER_COLORS[idx],
    name: PLAYER_NAMES[idx],
    xOffset: X_OFFSETS[idx],
    lives: 3,
    isAlive: true,
    isInvincible: false,
    bottom: 0,
    state: "run",
    spawnAnim: null,
    score: 0,
  }
  return room.players[socketId]
}

function getRoomOfSocket(socketId) {
  return Object.values(rooms).find(r => r.players[socketId])
}

function roomPlayerList(room) {
  return Object.values(room.players).map(p => ({
    id: p.id,
    index: p.index,
    color: p.color,
    name: p.name,
    xOffset: p.xOffset,
    lives: p.lives,
    isAlive: p.isAlive,
    state: p.state,
    spawnAnim: p.spawnAnim,
    bottom: p.bottom,
    score: p.score,
  }))
}

// ── Socket Events ─────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log("Player connected:", socket.id)

  // ── Create Room ──
  socket.on("createRoom", (cb) => {
    const room = createRoom(socket.id)
    const player = addPlayer(room, socket.id)
    socket.join(room.code)
    cb({ ok: true, code: room.code, player, players: roomPlayerList(room) })
    console.log(`Room ${room.code} created by ${socket.id}`)
  })

  // ── Join Room ──
  socket.on("joinRoom", ({ code }, cb) => {
    const room = rooms[code.toUpperCase()]
    if (!room) return cb({ ok: false, error: "Room not found" })
    if (room.state !== "lobby") return cb({ ok: false, error: "Game already started" })
    if (Object.keys(room.players).length >= 4) return cb({ ok: false, error: "Room is full" })

    const player = addPlayer(room, socket.id)
    socket.join(room.code)
    cb({ ok: true, code: room.code, player, players: roomPlayerList(room) })

    socket.to(room.code).emit("playerJoined", { players: roomPlayerList(room) })
    console.log(`${socket.id} joined room ${room.code}`)
  })

  // ── Host starts the game ──
  socket.on("startGame", () => {
    const room = getRoomOfSocket(socket.id)
    if (!room || room.hostId !== socket.id) return
    if (Object.keys(room.players).length < 1) return

    room.state = "countdown"
    room.score = 0
    room.speedScale = 1
    room.cactusList = []

    // Reset all players
    Object.values(room.players).forEach(p => {
      p.lives = 3
      p.isAlive = true
      p.isInvincible = false
      p.bottom = 0
      p.state = "run"
      p.spawnAnim = null
      p.score = 0
    })

    io.to(room.code).emit("gameCountdown", { players: roomPlayerList(room) })

    // After 3s countdown → start
    setTimeout(() => {
      if (!rooms[room.code]) return
      room.state = "playing"
      io.to(room.code).emit("gameStart", { players: roomPlayerList(room) })
    }, 3000)
  })

  // ── Host syncs cactus positions ──
  socket.on("syncCactus", ({ cactusPositions }) => {
    const room = getRoomOfSocket(socket.id)
    if (!room || room.hostId !== socket.id || room.state !== "playing") return
    room.cactusList = cactusPositions
    // Send to all OTHER players (not back to host)
    socket.to(room.code).emit("cactusUpdate", { cactusPositions })
  })

  // ── Host updates speed and score ──
  socket.on("speedUpdate", ({ speedScale, score }) => {
    const room = getRoomOfSocket(socket.id)
    if (!room || room.hostId !== socket.id) return
    room.speedScale = speedScale
    room.score = score
    // Send to all players INCLUDING host so HUD stays synced
    io.to(room.code).emit("speedSync", { speedScale, score })
  })

  // ── Player position update ──
  socket.on("positionUpdate", ({ bottom, state, xOffset }) => {
    const room = getRoomOfSocket(socket.id)
    if (!room) return
    const p = room.players[socket.id]
    if (!p) return
    p.bottom = bottom
    p.state = state
    // Broadcast to all OTHER players
    socket.to(room.code).emit("playerMoved", { 
      id: socket.id, 
      bottom, 
      state,
      xOffset: p.xOffset 
    })
  })

  // ── Player hit obstacle ──
  socket.on("playerHit", () => {
    const room = getRoomOfSocket(socket.id)
    if (!room) return
    const p = room.players[socket.id]
    if (!p || !p.isAlive || p.isInvincible) return

    p.lives--

    if (p.lives <= 0) {
      p.isAlive = false
      p.state = "spectate"
      io.to(room.code).emit("playerDied", { 
        id: socket.id, 
        players: roomPlayerList(room) 
      })

      // Check if all dead
      const alive = Object.values(room.players).filter(x => x.isAlive)
      if (alive.length === 0) {
        room.state = "ended"
        const sorted = Object.values(room.players).sort((a, b) => b.score - a.score)
        io.to(room.code).emit("gameOver", { 
          players: roomPlayerList(room), 
          winner: sorted[0]?.id || null 
        })
      }
    } else {
      // Pick random respawn animation
      const anims = ["jetpack", "parachute", "pterodactyl"]
      p.spawnAnim = anims[Math.floor(Math.random() * anims.length)]
      p.isInvincible = true
      p.state = "spawning"
      p.bottom = 0 // Reset position on respawn
      
      io.to(room.code).emit("playerRespawn", {
        id: socket.id,
        lives: p.lives,
        spawnAnim: p.spawnAnim,
        players: roomPlayerList(room)
      })

      // Remove invincibility after 5 seconds
      setTimeout(() => {
        if (!rooms[room.code] || !room.players[socket.id]) return
        const player = room.players[socket.id]
        if (player) {
          player.isInvincible = false
          player.spawnAnim = null
          player.state = "run"
          io.to(room.code).emit("invincibilityEnd", { id: socket.id })
        }
      }, 5000)
    }
  })

  // ── Player score update ──
  socket.on("scoreUpdate", ({ score }) => {
    const room = getRoomOfSocket(socket.id)
    if (!room) return
    const p = room.players[socket.id]
    if (p) p.score = score
  })

  // ── Disconnect ──
  socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id)
    const room = getRoomOfSocket(socket.id)
    if (!room) return

    delete room.players[socket.id]
    socket.to(room.code).emit("playerLeft", { 
      id: socket.id, 
      players: roomPlayerList(room) 
    })

    // If host left, assign new host or clean up
    if (room.hostId === socket.id) {
      const remaining = Object.keys(room.players)
      if (remaining.length > 0) {
        room.hostId = remaining[0]
        io.to(room.code).emit("hostChanged", { newHostId: room.hostId })
      } else {
        delete rooms[room.code]
        console.log(`Room ${room.code} deleted`)
      }
    }

    // Clean empty room
    if (Object.keys(room.players).length === 0 && rooms[room.code]) {
      delete rooms[room.code]
    }
  })
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => console.log(`🦖 Dino Party server running on port ${PORT}`))
