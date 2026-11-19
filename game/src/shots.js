// The screenshot scenes behind ?shot=start|play (chunks 2–4 add drive, chase and
// mission). Each one stages the real game at a fixed, scenic state from the given
// seed, so the same seed always gives the same frame. The main loop paints the staged
// scene twice and then sets window.__shotReady for the screenshot.

import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stepPlayer } from './player.js';

/**
 * Set `state` to the named scene and return the screen to draw. Unknown names stage
 * the title, so a typo still yields a usable frame.
 */
export function stageShot(name, state) {
  if (name === 'play') {
    // On foot in Downtown, next to a parked car so the "press E" prompt shows,
    // with the HUD and minimap live.
    state.player.x = 2612;
    state.player.y = 2150;
    state.player.angle = Math.PI;
    state.player.health = 100;
    state.money = 0;
    state.wanted = 0;
    state.objective = 'Explore Solmar Bay';
    state.cam.snap(state.player.x, state.player.y);
    // A few still steps so the near-car prompt is populated.
    for (let i = 0; i < 5; i += 1) stepPlayer(state.player, state.city, { x: 0, y: 0 }, false, 1 / 60);
    return { screen: SCREEN_PLAY };
  }

  // start: the title over the city, framed with the beach and sea on the left and
  // downtown's towers on the right.
  state.player.x = 1300;
  state.player.y = 2100;
  state.player.angle = Math.PI;
  state.money = 0;
  state.wanted = 0;
  state.cam.snap(1180, 2050);
  return { screen: SCREEN_TITLE };
}
