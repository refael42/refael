/** Fixed simulation rate. */
export const SIM_HZ = 30;
export const DT = 1 / SIM_HZ;
/** Events stay readable for this long so the UI never misses one. */
export const EVENT_TTL = 2;
/** Save format version. Bump when adding fields, keep loaders tolerant. */
export const SAVE_VERSION = 4;
