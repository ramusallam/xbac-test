// ================================
// Endless Runner Game
// ================================

// --- Constants ---
const GRAVITY = 0.75
const JUMP_FORCE = -13
const PLAYER_W = 24
const PLAYER_H = 24
const GROUND_RATIO = 0.80 // ground at 80% of canvas height
const BASE_SPEED = 5.5
const SPEED_INCREMENT = 0.18
const MAX_SPEED = 15
const MIN_GAP = 40
const START_GAP = 90

// --- Colors ---
const COLOR_BG = '#0a0e14'
const COLOR_GROUND = '#1e2430'
const COLOR_GROUND_LINE = '#2d3a4a'
const COLOR_PLAYER = '#0fec32'
const COLOR_PLAYER_SHADOW = 'rgba(15, 236, 50, 0.15)'
const COLOR_OBSTACLE = '#f85149'
const COLOR_OBSTACLE_SHADOW = 'rgba(248, 81, 73, 0.12)'
const COLOR_TEXT = '#e6edf3'
const COLOR_DIM = '#6e7681'
const COLOR_STAR = '#2d333b'

// --- Audio ---
let audioCtx = null

function getAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  return audioCtx
}

function playJumpSound() {
  try {
    const ctx = getAudio()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(440, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08)
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.12)
  } catch (e) { /* audio not available */ }
}

function playScoreSound() {
  try {
    const ctx = getAudio()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(660, ctx.currentTime)
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.06)
    gain.gain.setValueAtTime(0.1, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.15)
  } catch (e) { /* audio not available */ }
}

function playGameOverSound() {
  try {
    const ctx = getAudio()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(300, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.6)
    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.6)
  } catch (e) { /* audio not available */ }
}

// --- Game State ---
let canvas, ctx
let gameState = 'idle' // idle | playing | over
let player = {}
let obstacles = []
let score = 0
let speed = BASE_SPEED
let frameCount = 0
let nextSpawn = START_GAP
let groundY = 0
let stars = []
let particles = []
let shakeTimer = 0
let cooldownTimer = 0

// --- Init ---
export function initGame() {
  canvas = document.getElementById('game-canvas')
  ctx = canvas.getContext('2d')
  resizeGame()
  generateStars()
  resetPlayer()
}

export function resizeGame() {
  if (!canvas) return
  const container = canvas.parentElement
  canvas.width = container.clientWidth
  canvas.height = container.clientHeight
  groundY = canvas.height * GROUND_RATIO
  generateStars()
  if (gameState === 'idle') resetPlayer()
}

function generateStars() {
  stars = []
  const count = Math.floor((canvas.width * canvas.height) / 3000)
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * groundY,
      size: Math.random() * 1.5 + 0.5,
      speed: Math.random() * 0.3 + 0.1
    })
  }
}

function resetPlayer() {
  player = {
    x: canvas.width * 0.13,
    y: groundY - PLAYER_H,
    w: PLAYER_W,
    h: PLAYER_H,
    vy: 0,
    grounded: true
  }
}

function resetGame() {
  resetPlayer()
  obstacles = []
  particles = []
  score = 0
  speed = BASE_SPEED
  frameCount = 0
  nextSpawn = START_GAP
  shakeTimer = 0
}

// --- Main Update (called from main.js) ---
export function updateGame(input, overlayEl, overlayTextEl, scoreEl) {
  const justPressed = input.anyJustPressed

  switch (gameState) {
    case 'idle':
      renderIdle()
      if (justPressed) {
        gameState = 'playing'
        resetGame()
        overlayEl.classList.add('hidden')
        scoreEl.textContent = '0'
      }
      break

    case 'playing':
      updatePlaying(justPressed)
      renderPlaying()
      scoreEl.textContent = score
      break

    case 'over':
      renderPlaying() // still render the frozen scene
      cooldownTimer--
      if (cooldownTimer <= 0 && justPressed) {
        gameState = 'idle'
        overlayTextEl.innerHTML = 'PRESS ANY BUTTON'
        overlayEl.classList.remove('hidden')
      }
      break
  }
}

// --- Playing Logic ---
function updatePlaying(jump) {
  frameCount++

  // Jump
  if (jump && player.grounded) {
    player.vy = JUMP_FORCE
    player.grounded = false
    playJumpSound()
    spawnJumpParticles()
  }

  // Physics
  player.vy += GRAVITY
  player.y += player.vy

  if (player.y >= groundY - player.h) {
    player.y = groundY - player.h
    player.vy = 0
    player.grounded = true
  }

  // Speed scaling
  speed = BASE_SPEED + score * SPEED_INCREMENT
  if (speed > MAX_SPEED) speed = MAX_SPEED

  // Spawn obstacles
  nextSpawn--
  if (nextSpawn <= 0) {
    spawnObstacle()
    const gap = Math.max(MIN_GAP, START_GAP - score * 3.5)
    nextSpawn = gap + Math.random() * 40
  }

  // Move obstacles + check
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i]
    o.x -= speed

    // Score
    if (!o.scored && o.x + o.w < player.x) {
      o.scored = true
      score++
      playScoreSound()
    }

    // Remove off-screen
    if (o.x + o.w < -20) {
      obstacles.splice(i, 1)
      continue
    }

    // Collision
    if (collides(player, o)) {
      triggerGameOver()
      return
    }
  }

  // Update particles
  updateParticles()

  // Screen shake decay
  if (shakeTimer > 0) shakeTimer--
}

function spawnObstacle() {
  const minH = 26
  const maxH = Math.min(34 + score * 1.8, 75)
  const h = minH + Math.random() * (maxH - minH)
  const w = 22 + Math.random() * 14
  obstacles.push({
    x: canvas.width + 10,
    y: groundY - h,
    w,
    h,
    scored: false
  })
}

function collides(a, b) {
  const pad = 2 // forgiveness pixels
  return (
    a.x + pad < b.x + b.w &&
    a.x + a.w - pad > b.x &&
    a.y + pad < b.y + b.h &&
    a.y + a.h - pad > b.y
  )
}

function triggerGameOver() {
  gameState = 'over'
  cooldownTimer = 40 // ~0.67s at 60fps
  shakeTimer = 12
  playGameOverSound()
  spawnHitParticles()

  // Update overlay
  const overlayEl = document.getElementById('game-overlay')
  const overlayTextEl = document.getElementById('overlay-text')
  overlayTextEl.innerHTML = `GAME OVER<span class="score-line">${score}</span><span class="sub">PRESS ANY BUTTON TO RETRY</span>`
  overlayEl.classList.remove('hidden')
}

// --- Particles ---
function spawnJumpParticles() {
  for (let i = 0; i < 6; i++) {
    particles.push({
      x: player.x + player.w / 2,
      y: groundY,
      vx: (Math.random() - 0.5) * 3,
      vy: -Math.random() * 2 - 1,
      life: 20 + Math.random() * 10,
      maxLife: 30,
      color: COLOR_PLAYER,
      size: 2 + Math.random() * 2
    })
  }
}

function spawnHitParticles() {
  for (let i = 0; i < 12; i++) {
    particles.push({
      x: player.x + player.w / 2,
      y: player.y + player.h / 2,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.5) * 6,
      life: 25 + Math.random() * 15,
      maxLife: 40,
      color: i % 2 === 0 ? COLOR_PLAYER : COLOR_OBSTACLE,
      size: 2 + Math.random() * 3
    })
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.x += p.vx
    p.y += p.vy
    p.vy += 0.1
    p.life--
    if (p.life <= 0) {
      particles.splice(i, 1)
    }
  }
}

// --- Rendering ---
function renderIdle() {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  drawBackground()
  drawGround()
  drawPlayer(1)
}

function renderPlaying() {
  // Screen shake
  let sx = 0, sy = 0
  if (shakeTimer > 0) {
    sx = (Math.random() - 0.5) * shakeTimer * 0.8
    sy = (Math.random() - 0.5) * shakeTimer * 0.8
  }

  ctx.save()
  ctx.translate(sx, sy)
  ctx.clearRect(-10, -10, canvas.width + 20, canvas.height + 20)

  drawBackground()
  drawGround()
  drawObstacles()
  drawPlayer(gameState === 'over' ? 0.5 : 1)
  drawParticles()

  ctx.restore()
}

function drawBackground() {
  // Fill
  ctx.fillStyle = COLOR_BG
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Stars
  ctx.fillStyle = COLOR_STAR
  for (const s of stars) {
    // Parallax scroll
    if (gameState === 'playing') {
      s.x -= s.speed * (speed / BASE_SPEED)
      if (s.x < 0) s.x = canvas.width
    }
    ctx.beginPath()
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawGround() {
  // Ground fill
  ctx.fillStyle = COLOR_GROUND
  ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY)

  // Ground line
  ctx.strokeStyle = COLOR_GROUND_LINE
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(0, groundY)
  ctx.lineTo(canvas.width, groundY)
  ctx.stroke()

  // Speed lines on ground
  if (gameState === 'playing') {
    ctx.strokeStyle = 'rgba(45, 58, 74, 0.5)'
    ctx.lineWidth = 1
    const lineSpacing = 40
    const offset = (frameCount * speed) % lineSpacing
    for (let x = -offset; x < canvas.width; x += lineSpacing) {
      ctx.beginPath()
      ctx.moveTo(x, groundY + 8)
      ctx.lineTo(x + 12, groundY + 8)
      ctx.stroke()
    }
  }
}

function drawPlayer(alpha) {
  ctx.save()
  ctx.globalAlpha = alpha

  // Shadow
  ctx.fillStyle = COLOR_PLAYER_SHADOW
  const shadowSize = player.w * 0.8
  const shadowY = groundY + 2
  ctx.beginPath()
  ctx.ellipse(
    player.x + player.w / 2,
    shadowY,
    shadowSize / 2,
    3,
    0, 0, Math.PI * 2
  )
  ctx.fill()

  // Body
  ctx.fillStyle = COLOR_PLAYER
  roundRect(player.x, player.y, player.w, player.h, 5)
  ctx.fill()

  // Highlight
  ctx.fillStyle = 'rgba(255,255,255,0.2)'
  roundRect(player.x + 3, player.y + 3, player.w - 6, player.h * 0.35, 3)
  ctx.fill()

  ctx.restore()
}

function drawObstacles() {
  for (const o of obstacles) {
    // Shadow
    ctx.fillStyle = COLOR_OBSTACLE_SHADOW
    ctx.beginPath()
    ctx.ellipse(
      o.x + o.w / 2,
      groundY + 2,
      o.w / 2 + 2,
      3,
      0, 0, Math.PI * 2
    )
    ctx.fill()

    // Body
    ctx.fillStyle = COLOR_OBSTACLE
    roundRect(o.x, o.y, o.w, o.h, 4)
    ctx.fill()

    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    roundRect(o.x + 2, o.y + 2, o.w - 4, o.h * 0.3, 3)
    ctx.fill()
  }
}

function drawParticles() {
  for (const p of particles) {
    const alpha = p.life / p.maxLife
    ctx.globalAlpha = alpha
    ctx.fillStyle = p.color
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

// --- Utility ---
function roundRect(x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
