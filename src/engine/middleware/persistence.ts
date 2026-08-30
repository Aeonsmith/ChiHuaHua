import { Middleware, GameState } from '../../types';

export interface SaveHandler {
  (state: GameState): Promise<void> | void;
}

export function createPersistenceMiddleware(
  saveHandler: SaveHandler,
  throttleIntervalMs: number = 5000
): Middleware {
  let lastSaveEpochMs = Date.now();
  let pendingSave: NodeJS.Timeout | null = null;

  return (getState) => (next) => (action) => {
    next(action);
    const now = Date.now();

    if (now - lastSaveEpochMs >= throttleIntervalMs) {
      lastSaveEpochMs = now;
      saveHandler(getState());
    } else if (!pendingSave) {
      pendingSave = setTimeout(() => {
        lastSaveEpochMs = Date.now();
        pendingSave = null;
        saveHandler(getState());
      }, throttleIntervalMs - (now - lastSaveEpochMs));
    }
  };
}
