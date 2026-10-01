const number = (name: string, fallback: number) => Number(process.env[name] ?? fallback);

export const TICK_MS = number('TICK_MS', 200);
export const PICK_TICKS = number('PICK_TICKS', 5);
export const DROP_TICKS = number('DROP_TICKS', 3);
export const PACK_TICKS = number('PACK_TICKS', 10);
export const RESPAWN_TICKS = number('RESPAWN_TICKS', 50);
export const FAILED_VISIBLE_TICKS = number('FAILED_VISIBLE_TICKS', 10);
export const WAIT_REPLAN = number('WAIT_REPLAN', 10);
export const MAX_WAIT_TICKS = number('MAX_WAIT_TICKS', 50);
export const MAX_ROBOTS = number('MAX_ROBOTS', 32);
export const REPLENISH_EVERY_S = number('REPLENISH_EVERY_S', 30);
