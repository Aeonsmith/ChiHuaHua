import { Middleware } from '../../types';

export interface DistortionListener {
  (distortionIndex: number, sanity: number, heat: number): void;
}

export function createDistortionMiddleware(listener?: DistortionListener): Middleware {
  let lastDistortion = -1;

  return (getState) => (next) => (action) => {
    next(action);
    const state = getState();
    const currentDistortion = state.player.distortionIndex;

    if (Math.abs(currentDistortion - lastDistortion) > 0.005) {
      lastDistortion = currentDistortion;
      if (listener) {
        listener(currentDistortion, state.player.sanity, state.player.heat);
      }
    }
  };
}
