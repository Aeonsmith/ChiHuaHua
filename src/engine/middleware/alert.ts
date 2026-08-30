import { Middleware, GameAlert } from '../../types';

export interface AlertHandler {
  (alert: GameAlert): void;
}

export function createAlertEngineMiddleware(onAlert?: AlertHandler): Middleware {
  const seenAlertIds = new Set<string>();

  return (getState) => (next) => (action) => {
    next(action);
    const state = getState();

    for (const alert of state.runtime.unresolvedAlerts) {
      if (!seenAlertIds.has(alert.id)) {
        seenAlertIds.add(alert.id);
        if (onAlert) {
          onAlert(alert);
        }
      }
    }
  };
}
