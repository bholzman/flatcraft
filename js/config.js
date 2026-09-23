// Central tuning knobs. Everything that might get tweaked lives here.

export const TILE = 24;              // pixels per block at zoom 1
export const ZOOM = 2;               // integer scale factor applied to TILE

// Each realm is its own world, with its own size and waterline.
export const REALMS = {
  overworld: { w: 4096, h: 320, liquidLevel: 118, surfaceLevel: 110, liquid: 'water' },
  nether:    { w: 2048, h: 192, liquidLevel: 58, surfaceLevel: 42, liquid: 'lava', ceiling: 6 },
  end:       { w: 1536, h: 160, liquidLevel: -1, surfaceLevel: 70,  liquid: null },
};

export const START_REALM = 'overworld';

// ---- day / night ----
// One full cycle in seconds. Phase runs 0 = sunrise, 0.25 = noon,
// 0.5 = sunset, 0.75 = midnight.
export const DAY_LENGTH = 600;
export const START_PHASE = 0.12;     // start mid-morning

/** Surface light from the sky, 0 at night to 1 in full day. */
export function dayLightAt(phase) {
  const t = ((phase % 1) + 1) % 1;
  if (t < 0.06) return t / 0.06;                     // sunrise
  if (t < 0.44) return 1;                            // day
  if (t < 0.52) return 1 - (t - 0.44) / 0.08;        // sunset
  if (t < 0.96) return 0;                            // night
  return (t - 0.96) / 0.04;                          // pre-dawn
}

/**
 * Phase as a 24-hour clock. Phase 0 is sunrise, which is 06:00 -- multiplying
 * the phase by 24 directly would put noon at 06:00.
 */
export function clockAt(phase) {
  const h = (((phase % 1) + 1) % 1) * 24 + 6;
  return h % 24;
}

/** Name of the current phase, for the readouts. */
export function phaseName(phase) {
  const t = ((phase % 1) + 1) % 1;
  if (t < 0.06) return 'Sunrise';
  if (t < 0.22) return 'Morning';
  if (t < 0.3) return 'Noon';
  if (t < 0.44) return 'Afternoon';
  if (t < 0.52) return 'Sunset';
  if (t < 0.72) return 'Night';
  if (t < 0.9) return 'Midnight';
  return 'Late night';
}

// Overworld underground bands, as a fraction of world height.
export const CAVE_TOP_OFFSET = 8;    // blocks below the surface where caves start
export const LUSH_CAVES_AT = 0.55;   // fraction of height where lush caves begin
export const DEEP_DARK_AT = 0.74;    // fraction of height where the deep dark begins
export const DEEPSLATE_AT = 0.66;    // fraction of height where stone becomes deepslate

// Physics, in blocks and seconds.
export const GRAVITY = 58;
export const MOVE_ACCEL = 110;
export const MOVE_SPEED = 8.5;
export const AIR_ACCEL_SCALE = 0.45;
export const GROUND_FRICTION = 14;
export const AIR_FRICTION = 1.2;
export const JUMP_SPEED = 16.5;
export const MAX_FALL_SPEED = 42;
export const COYOTE_TIME = 0.1;      // grace period for jumping after leaving ground
export const JUMP_BUFFER = 0.12;     // grace period for jumping before landing

// Swimming / lava, applied while the player's head is in a liquid.
export const LIQUID_DRAG = 0.62;
export const LIQUID_SINK = 0.35;
export const SWIM_SPEED = 7.5;

export const PLAYER_W = 0.7;         // player hitbox, in blocks
export const PLAYER_H = 1.8;

export const REACH = 5.5;            // how far the player can mine/place, in blocks
export const CREATIVE_REACH = 9;     // longer arms in creative mode

// Creative flight.
export const FLY_ACCEL = 190;
export const FLY_SPEED = 20;
export const FLY_DAMP = 0.0008;      // remaining fraction of velocity after 1s

export const FIXED_DT = 1 / 120;     // physics step
export const MAX_FRAME_DT = 0.25;    // clamp so a stalled tab doesn't teleport the player

// Camera. The player stays pinned to the middle of the screen in both axes, so
// digging down or climbing up is what changes how much sky vs. underground is
// on screen -- the camera never clamps at a world edge to break that.
export const CAMERA_SMOOTH = 0.0015; // remaining fraction of the gap after 1s
export const PORTAL_DWELL = 0.9;     // seconds standing in a portal before travel
export const PORTAL_LINK_RANGE = 240; // how far a destination portal may be before one is built
