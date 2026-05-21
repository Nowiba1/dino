const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const path = require("path")

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
  cors: { 
    origin: [
      "https://nowiba1.github.io", 
      "http://localhost:3000", 
      "http://localhost:5500", 
      "http://127.0.0.1:5500",
      "http://127.0.0.1:3000"
    ], 
    methods: ["GET", "POST"] 
  },
  pingTimeout: 60000,
  pingInterval: 25000
})

app.use(express.static(path.join(__dirname, ".")))
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"))
})

// ── Room State ─────────────────────────────────────────────────
const rooms = {}
const playerKeyMap = {}       // playerKey → { roomCode, socketId }
const disconnectTimers = {}   // playerKey → timeout

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
    players: {},        // playerKey → playerData
    cactusList: [],
    cactusSeed: Math.floor(Math.random() * 1000000)
  }
  return rooms[code]
}

function addPlayer(room, playerKey, socketId) {
  const idx = Object.keys(room.players).length
  if (idx >= 4) return null

  room.players[playerKey] = {
    playerKey,
    socketId,            // current socket ID
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
  playerKeyMap[playerKey] = { roomCode: room.code, socketId }
  return room.players[playerKey]
}

function getRoomOfSocket(socketId) {
  // Search all rooms for a player with this socketId
  for (const code in rooms) {
    const room = rooms[code]
    for (const key in room.players) {
      if (room.players[key].socketId === socketId) {
        return room
      }
    }
  }
  return null
}

function getPlayerInRoom(socketId) {
  const room = getRoomOfSocket(socketId)
  if (!room) return null
  for (const key in room.players) {
    if (room.players[key].socketId === socketId) {
      return { room, player: room.players[key], playerKey: key }
    }
  }
  return null
}

function roomPlayerList(room) {
  return Object.values(room.players).map(p => ({
    id: p.playerKey,          // use playerKey as public ID
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

// ── Socket Events ─────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id)

  // ── Registration / Reconnection ──
  socket.on("register", ({ playerKey, roomCode }, callback) => {
    // If reconnecting to an existing room
    if (roomCode && rooms[roomCode]) {
      const room = rooms[roomCode]
      // Cancel any pending disconnect timer for this playerKey
      if (disconnectTimers[playerKey]) {
        clearTimeout(disconnectTimers[playerKey])
        delete disconnectTimers[playerKey]
      }
      
      const player = room.players[playerKey]
      if (player) {
        // Reconnect: update socketId
        player.socketId = socket.id
        playerKeyMap[playerKey] = { roomCode, socketId: socket.id }
        socket.join(roomCode)
        
        // Notify others that the player is back
        socket.to(roomCode).emit("playerReconnected", { 
          playerKey, 
          players: roomPlayerList(room) 
        })
        
        callback({ 
          success: true, 
          player, 
          players: roomPlayerList(room),
          roomState: {
            state: room.state,
            speedScale: room.speedScale,
            score: room.score,
            cactusSeed: room.cactusSeed
          }
        })
        console.log(`Player ${playerKey} reconnected via socket ${socket.id}`)
        return
      }
    }
    // New registration: just acknowledge
    callback({ success: true, newPlayer: true })
  })

  // ── Create Room ──
  socket.on("createRoom", ({ playerKey }, cb) => {
    const room = createRoom(socket.id)
    const player = addPlayer(room, playerKey, socket.id)
    if (!player) return cb({ ok: false, error: "Room full" })
    socket.join(room.code)
    cb({ ok: true, code: room.code, player, players: roomPlayerList(room) })
    console.log(`Room ${room.code} created by ${socket.id} (playerKey: ${playerKey})`)
  })

  // ── Join Room ──
  socket.on("joinRoom", ({ code, playerKey }, cb) => {
    const room = rooms[code.toUpperCase()]
    if (!room) return cb({ ok: false, error: "Room not found" })
    if (room.state !== "lobby") return cb({ ok: false, error: "Game already started" })
    if (Object.keys(room.players).length >= 4) return cb({ ok: false, error: "Room is full" })

    const player = addPlayer(room, playerKey, socket.id)
    if (!player) return cb({ ok: false, error: "Could not join" })
    socket.join(room.code)
    cb({ ok: true, code: room.code, player, players: roomPlayerList(room) })

    socket.to(room.code).emit("playerJoined", { players: roomPlayerList(room) })
    console.log(`${socket.id} (playerKey: ${playerKey}) joined room ${room.code}`)
  })

  // ── Host starts the game ──
  socket.on("startGame", () => {
    const data = getPlayerInRoom(socket.id)
    if (!data) return
    const room = data.room
    if (room.hostId !== socket.id) return
    if (Object.keys(room.players).length < 1) return

    room.state = "countdown"
    room.score = 0
    room.speedScale = 1
    room.cactusList = []
    room.cactusSeed = Math.floor(Math.random() * 1000000)

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

    setTimeout(() => {
      if (!rooms[room.code]) return
      room.state = "playing"
      io.to(room.code).emit("gameStart", { 
        players: roomPlayerList(room),
        cactusSeed: room.cactusSeed
      })
    }, 3000)
  })

  // ── Host syncs cactus positions ──
  socket.on("syncCactus", ({ cactusPositions }) => {
    const data = getPlayerInRoom(socket.id)
    if (!data) return
    const room = data.room
    if (room.hostId !== socket.id || room.state !== "playing") return
    room.cactusList = cactusPositions
    socket.to(room.code).emit("cactusUpdate", { cactusPositions })
  })

  // ── Host broadcasts game state ──
  socket.on("gameStateBroadcast", ({ speedScale, score, cactusSeed }) => {
    const data = getPlayerInRoom(socket.id)
    if (!data) return
    const room = data.room
    if (room.hostId !== socket.id) return
    room.speedScale = speedScale
    room.score = score
    room.cactusSeed = cactusSeed
    socket.to(room.code).emit("gameStateSync", { speedScale, score, cactusSeed })
  })

  // ── Host speed update ──
  socket.on("speedUpdate", ({ speedScale, score }) => {
    const data = getPlayerInRoom(socket.id)
    if (!data) return
    const room = data.room
    if (room.hostId !== socket.id) return
    room.speedScale = speedScale
    room.score = score
    io.to(room.code).emit("speedSync", { speedScale, score })
  })

  // ── Player position ──
  socket.on("positionUpdate", ({ bottom, state, xOffset }) => {
    const data = getPlayerInRoom(socket.id)
    if (!data) return
    const p = data.player
    p.bottom = bottom
    p.state = state
    socket.to(data.room.code).emit("playerMoved", { 
      id: data.playerKey, 
      bottom, 
      state,
      xOffset: p.xOffset 
    })
  })

  // ── Player hit ──
  socket.on("playerHit", () => {
    const data = getPlayerInRoom(socket.id)
    if (!data) return
    const p = data.player
    if (!p.isAlive || p.isInvincible) return

    p.lives--

    if (p.lives <= 0) {
      p.isAlive = false
      p.state = "spectate"
      io.to(data.room.code).emit("playerDied", { 
        id: data.playerKey, 
        players: roomPlayerList(data.room) 
      })

      const alive = Object.values(data.room.players).filter(x => x.isAlive)
      if (alive.length === 0) {
        data.room.state = "ended"
        const sorted = Object.values(data.room.players).sort((a, b) => b.score - a.score)
        io.to(data.room.code).emit("gameOver", { 
          players: roomPlayerList(data.room), 
          winner: sorted[0]?.playerKey || null 
        })
      }
    } else {
      const anims = ["jetpack", "parachute", "pterodactyl"]
      p.spawnAnim = anims[Math.floor(Math.random() * anims.length)]
      p.isInvincible = true
      p.state = "spawning"
      p.bottom = 0
      
      io.to(data.room.code).emit("playerRespawn", {
        id: data.playerKey,
        lives: p.lives,
        spawnAnim: p.spawnAnim,
        players: roomPlayerList(data.room)
      })

      setTimeout(() => {
        if (!rooms[data.room.code] || !data.room.players[data.playerKey]) return
        const player = data.room.players[data.playerKey]
        player.isInvincible = false
        player.spawnAnim = null
        player.state = "run"
        io.to(data.room.code).emit("invincibilityEnd", { id: data.playerKey })
      }, 5000)
    }
  })

  // ── Score update ──
  socket.on("scoreUpdate", ({ score }) => {
    const data = getPlayerInRoom(socket.id)
    if (!data) return
    data.player.score = score
  })

  // ── Disconnect ──
  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id)
    // Find player by socketId
    let found = null
    for (const code in rooms) {
      const room = rooms[code]
      for (const key in room.players) {
        if (room.players[key].socketId === socket.id) {
          found = { room, playerKey: key }
          break
        }
      }
      if (found) break
    }
    if (!found) return

    const { room, playerKey } = found
    // Don't remove the player immediately; set a 15-second timer
    disconnectTimers[playerKey] = setTimeout(() => {
      // After timeout, remove player if still disconnected
      if (room.players[playerKey] && room.players[playerKey].socketId === socket.id) {
        delete room.players[playerKey]
        delete playerKeyMap[playerKey]
        io.to(room.code).emit("playerLeft", { 
          id: playerKey, 
          players: roomPlayerList(room) 
        })

        // If host left, assign new host or clean up
        if (room.hostId === socket.id) {
          const remaining = Object.keys(room.players)
          if (remaining.length > 0) {
            room.hostId = room.players[remaining[0]].socketId
            io.to(room.code).emit("hostChanged", { newHostId: room.hostId })
          } else {
            delete rooms[room.code]
            console.log(`Room ${room.code} deleted`)
          }
        }

        if (Object.keys(room.players).length === 0 && rooms[room.code]) {
          delete rooms[room.code]
        }
      }
      delete disconnectTimers[playerKey]
    }, 15000)
  })
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => console.log(`🦖 Dino Party server running on port ${PORT}`))
