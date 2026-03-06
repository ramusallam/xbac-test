import './style.css'
import { initGame, updateGame, resizeGame } from './game.js'

// =========================
// Button name map (index → label)
// =========================
const BUTTON_NAMES = [
  'A', 'B', 'X', 'Y',
  'LB', 'RB', 'LT', 'RT',
  'VIEW', 'MENU',
  'LS', 'RS',
  'UP', 'DOWN', 'LEFT', 'RIGHT',
  'XBOX'
]

// =========================
// State
// =========================
const state = {
  connected: false,
  gpIndex: -1,
  buttons: new Array(17).fill(false),
  prevButtons: new Array(17).fill(false),
  axes: [0, 0, 0, 0],
  anyPressed: false,
  anyJustPressed: false,
  lastButton: ''
}

let activeTab = 'controller'
let keyJump = false
let keyJumpPrev = false

// =========================
// DOM refs
// =========================
const $ = (sel) => document.querySelector(sel)
const statusEl = $('#status')
const statusText = $('.status-text')
const lastValueEl = $('#last-value')
const gameInputDot = $('.game-input-indicator .input-dot')
const overlayEl = $('#game-overlay')
const overlayTextEl = $('#overlay-text')
const scoreEl = $('#game-score')

// All controller buttons keyed by data-btn attribute
const ctrlBtnMap = {}
document.querySelectorAll('.ctrl-btn[data-btn]').forEach(el => {
  const idx = parseInt(el.dataset.btn)
  if (!ctrlBtnMap[idx]) ctrlBtnMap[idx] = []
  ctrlBtnMap[idx].push(el)
})

// Analog stick dots
const dotLeft = $('#dot-left')
const dotRight = $('#dot-right')

// =========================
// Tab Switching
// =========================
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    if (tab.dataset.tab === activeTab) return
    activeTab = tab.dataset.tab

    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
    tab.classList.add('active')

    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'))
    $(`#view-${activeTab}`).classList.add('active')

    if (activeTab === 'game') {
      resizeGame()
    }
  })
})

// =========================
// Gamepad Events
// =========================
window.addEventListener('gamepadconnected', (e) => {
  state.connected = true
  state.gpIndex = e.gamepad.index
  statusEl.classList.add('connected')
  const name = e.gamepad.id.length > 40 ? e.gamepad.id.slice(0, 40) + '...' : e.gamepad.id
  statusText.textContent = name
})

window.addEventListener('gamepaddisconnected', () => {
  state.connected = false
  state.gpIndex = -1
  statusEl.classList.remove('connected')
  statusText.textContent = 'No controller detected \u2014 plug in via USB'
})

// =========================
// Keyboard (fallback for game)
// =========================
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault()
    keyJump = true
  }
})

window.addEventListener('keyup', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    keyJump = false
  }
})

// =========================
// Gamepad Polling
// =========================
function pollGamepad() {
  // Save previous state
  for (let i = 0; i < 17; i++) {
    state.prevButtons[i] = state.buttons[i]
  }

  state.anyPressed = false
  state.anyJustPressed = false

  if (!state.connected) {
    for (let i = 0; i < 17; i++) state.buttons[i] = false
    state.axes = [0, 0, 0, 0]

    // Keyboard fallback
    const keyNow = keyJump
    state.anyPressed = keyNow
    state.anyJustPressed = keyNow && !keyJumpPrev
    keyJumpPrev = keyNow
    return
  }

  const gamepads = navigator.getGamepads()
  const gp = gamepads[state.gpIndex]
  if (!gp) return

  for (let i = 0; i < Math.min(gp.buttons.length, 17); i++) {
    const pressed = gp.buttons[i].pressed || gp.buttons[i].value > 0.5
    state.buttons[i] = pressed
    if (pressed) {
      state.anyPressed = true
      if (!state.prevButtons[i]) {
        state.anyJustPressed = true
        state.lastButton = BUTTON_NAMES[i] || `BTN ${i}`
      }
    }
  }

  // Axes
  for (let i = 0; i < Math.min(gp.axes.length, 4); i++) {
    state.axes[i] = gp.axes[i]
  }

  // Also include keyboard
  const keyNow = keyJump
  if (keyNow) state.anyPressed = true
  if (keyNow && !keyJumpPrev) state.anyJustPressed = true
  keyJumpPrev = keyNow
}

// =========================
// Update Controller Visual
// =========================
function updateControllerVisual() {
  // Buttons
  for (const [idx, els] of Object.entries(ctrlBtnMap)) {
    const pressed = state.buttons[parseInt(idx)]
    els.forEach(el => {
      if (pressed) el.classList.add('active')
      else el.classList.remove('active')
    })
  }

  // Last input
  if (state.lastButton) {
    lastValueEl.textContent = state.lastButton
  }

  // Analog sticks
  const deadzone = 0.15
  const ax0 = Math.abs(state.axes[0]) > deadzone ? state.axes[0] : 0
  const ax1 = Math.abs(state.axes[1]) > deadzone ? state.axes[1] : 0
  const ax2 = Math.abs(state.axes[2]) > deadzone ? state.axes[2] : 0
  const ax3 = Math.abs(state.axes[3]) > deadzone ? state.axes[3] : 0

  const stickRange = 15 // px from center
  dotLeft.style.transform = `translate(${ax0 * stickRange}px, ${ax1 * stickRange}px)`
  dotRight.style.transform = `translate(${ax2 * stickRange}px, ${ax3 * stickRange}px)`

  const leftMoved = Math.abs(ax0) > 0 || Math.abs(ax1) > 0
  const rightMoved = Math.abs(ax2) > 0 || Math.abs(ax3) > 0
  dotLeft.classList.toggle('moved', leftMoved)
  dotRight.classList.toggle('moved', rightMoved)

  // Game input flash
  if (state.anyPressed) {
    gameInputDot.classList.add('flash')
  } else {
    gameInputDot.classList.remove('flash')
  }
}

// =========================
// Main Loop
// =========================
function loop() {
  pollGamepad()
  updateControllerVisual()
  if (activeTab === 'game') {
    updateGame(state, overlayEl, overlayTextEl, scoreEl)
  }
  requestAnimationFrame(loop)
}

// =========================
// Init
// =========================
window.addEventListener('resize', () => {
  if (activeTab === 'game') resizeGame()
})

initGame()
requestAnimationFrame(loop)
