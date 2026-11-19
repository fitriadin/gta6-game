// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between five screens: title, play, paused,
// game over and controls.
//
// ?seed=N fixes the city. ?shot=start|play (with &seed=N) stages that scene instead
// of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { CAMERA, CITY, DEFAULT_SEED, STEP } from './config.js';
import { generateCity } from './city.js';
import { createCamera } from './camera.js';
import { createPlayer, stepPlayer } from './player.js';
import { ACTION_CLICK, ACTION_CONFIRM, ACTION_INTERACT, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_CONTROLS, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { applySave, hasSave, loadSave, saveGame } from './save.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;
/** How long a toast message stays on screen, in seconds. */
const TOAST_SECONDS = 2.5;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : DEFAULT_SEED;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const city = generateCity(seed);
const cam = createCamera();
const player = createPlayer(city.spawn);
const renderer = createRenderer(canvas);

const state = {
  city,
  player,
  cam,
  money: 0,
  wanted: 0,
  objective: 'Explore Solmar Bay',
  missionsCompleted: [],
  muted: false,
  hasSave: hasSave(),
  menuIndex: 0,
  saveMessage: '',
  toast: '',
  toastUntil: 0,
  time: 0,
};

function showToast(message) {
  state.toast = message;
  state.toastUntil = state.time + TOAST_SECONDS;
}

function runShot(name) {
  const scene = stageShot(name, state);
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  input.setCoordinateMapper((x, y) => renderer.clientToLogical(x, y));
  let screen = SCREEN_TITLE;
  let controlsReturn = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let lastMenuY = 0;
  // The title screen drifts between these viewpoints over the city.
  const titleStops = [
    { x: 1180, y: 2050 },
    { x: 2650, y: 1850 },
    { x: 3200, y: 1200 },
    { x: 1500, y: 900 },
  ];
  let titleStop = 0;
  cam.snap(titleStops[0].x, titleStops[0].y);

  function announce(message) {
    status.textContent = message;
  }

  function newGame() {
    state.money = 0;
    state.wanted = 0;
    state.missionsCompleted = [];
    state.objective = 'Explore Solmar Bay';
    const fresh = createPlayer(city.spawn);
    Object.assign(player, fresh);
    cam.snap(player.x, player.y);
    screen = SCREEN_PLAY;
    announce('Playing. Explore Solmar Bay.');
  }

  function continueGame() {
    const save = loadSave();
    if (!save) {
      newGame();
      return;
    }
    applySave(state, save);
    cam.snap(player.x, player.y);
    screen = SCREEN_PLAY;
    announce('Continuing your game.');
  }

  function pauseGame() {
    screen = SCREEN_PAUSED;
    state.menuIndex = 0;
    state.saveMessage = '';
    saveGame(state);
    announce('Paused. Progress saved.');
  }

  function resumeGame() {
    screen = SCREEN_PLAY;
    announce('Playing.');
  }

  function openControls(from) {
    controlsReturn = from;
    screen = SCREEN_CONTROLS;
    announce('Controls.');
  }

  function closeControls() {
    screen = controlsReturn;
    state.menuIndex = 0;
  }

  function quitToTitle() {
    saveGame(state);
    state.hasSave = true;
    screen = SCREEN_TITLE;
    state.menuIndex = 0;
    titleStop = 0;
    cam.snap(titleStops[0].x, titleStops[0].y);
    announce('Solmar City. Title screen.');
  }

  function activateTitleItem(index) {
    const items = renderer.titleMenuItems(state);
    const item = items[index];
    if (!item) return;
    if (item.id === 'new') newGame();
    else if (item.id === 'continue') continueGame();
    else if (item.id === 'controls') openControls(SCREEN_TITLE);
  }

  function activatePauseItem(index) {
    const items = renderer.pauseMenuItems();
    const item = items[index];
    if (!item) return;
    if (item.id === 'resume') resumeGame();
    else if (item.id === 'save') {
      state.saveMessage = saveGame(state) ? 'Saved.' : 'Could not save in this browser.';
    } else if (item.id === 'controls') openControls(SCREEN_PAUSED);
    else if (item.id === 'restart') newGame();
    else if (item.id === 'title') quitToTitle();
  }

  function handleMenuKeys(moveY, itemCount) {
    if (moveY !== lastMenuY) {
      if (moveY === -1) state.menuIndex = (state.menuIndex + itemCount - 1) % itemCount;
      else if (moveY === 1) state.menuIndex = (state.menuIndex + 1) % itemCount;
    }
    lastMenuY = moveY;
  }

  function handleActions() {
    const actions = input.takeActions();
    const move = input.move();
    if (actions & ACTION_MUTE) {
      state.muted = !state.muted;
      announce(state.muted ? 'Muted.' : 'Sound on.');
    }

    if (screen === SCREEN_TITLE) {
      handleMenuKeys(move.y, renderer.titleMenuItems(state).length);
      if (actions & ACTION_CONFIRM) activateTitleItem(state.menuIndex);
      if (actions & ACTION_CLICK) {
        const mouse = input.mousePosition();
        const hit = renderer.titleMenuHit(state, mouse.x, mouse.y);
        if (hit >= 0) {
          state.menuIndex = hit;
          activateTitleItem(hit);
        }
      }
      return;
    }

    if (screen === SCREEN_CONTROLS) {
      if (actions & (ACTION_CONFIRM | ACTION_PAUSE | ACTION_CLICK)) closeControls();
      return;
    }

    if (screen === SCREEN_PAUSED) {
      handleMenuKeys(move.y, renderer.pauseMenuItems().length);
      if (actions & ACTION_PAUSE) resumeGame();
      else if (actions & ACTION_CONFIRM) activatePauseItem(state.menuIndex);
      else if (actions & ACTION_CLICK) {
        const mouse = input.mousePosition();
        const hit = renderer.pauseMenuHit(mouse.x, mouse.y);
        if (hit >= 0) {
          state.menuIndex = hit;
          activatePauseItem(hit);
        }
      }
      return;
    }

    if (screen === SCREEN_OVER) {
      if (actions & (ACTION_CONFIRM | ACTION_CLICK)) newGame();
      return;
    }

    // SCREEN_PLAY
    if (actions & ACTION_PAUSE) {
      pauseGame();
      return;
    }
    if (actions & ACTION_INTERACT) {
      // Chunk 2 wires stealing; for now the car is locked and says so.
      if (player.nearCar) showToast('Locked — stealing cars comes with the next update.');
    }
  }

  function step() {
    state.time += STEP;
    if (screen === SCREEN_TITLE) {
      // Drift the camera between viewpoints over the living city.
      const target = titleStops[titleStop];
      const dx = target.x - cam.camera.x;
      const dy = target.y - cam.camera.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 60) titleStop = (titleStop + 1) % titleStops.length;
      else {
        const speed = CAMERA.titlePanSpeed;
        cam.camera.x += (dx / distance) * speed * STEP;
        cam.camera.y += (dy / distance) * speed * STEP;
      }
      cam.update(STEP);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    stepPlayer(player, city, input.move(), input.sprinting(), STEP);
    cam.follow(player.x, player.y, STEP);
    cam.update(STEP);
    if (player.health <= 0) {
      screen = SCREEN_OVER;
      announce('Wasted.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
      step();
      accumulator -= STEP;
    }
    if (screen !== SCREEN_TITLE && screen !== SCREEN_PLAY) accumulator = 0;
    renderer.draw(state, screen);
  }

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) pauseGame();
  });

  announce('Solmar City. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
