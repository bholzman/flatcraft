// Central tuning knobs. Everything that might get tweaked lives here.

export const TILE = 24;              // pixels per block at zoom 1

export const WORLD_W = 512;          // world size in blocks
export const WORLD_H = 160;

export const SEA_LEVEL = 80;         // y of the average surface (y grows downward)
export const WATER_LEVEL = 84;       // air at or below this fills with water

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

export const PLAYER_W = 0.7;         // player hitbox, in blocks
export const PLAYER_H = 1.8;

export const REACH = 5.5;            // how far the player can mine/place, in blocks

export const ZOOM = 2;               // integer scale factor applied to TILE

export const FIXED_DT = 1 / 120;     // physics step
export const MAX_FRAME_DT = 0.25;    // clamp so a stalled tab doesn't teleport the player
