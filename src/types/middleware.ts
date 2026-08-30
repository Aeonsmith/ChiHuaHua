import { GameState } from './state';
import { GameAction } from './action';

export type Dispatch = (action: GameAction) => void;

export type Middleware = (
  getState: () => GameState,
  dispatch: Dispatch
) => (next: Dispatch) => (action: GameAction) => void;
