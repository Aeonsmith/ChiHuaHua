import * as fs from 'node:fs';
import * as path from 'node:path';
import { GameState } from '../types';

export class SaveManager {
  private saveFilePath: string;

  constructor(customPath?: string) {
    this.saveFilePath = customPath || path.join(process.cwd(), 'save_game.json');
  }

  public saveGame(state: GameState): boolean {
    try {
      const serialized = JSON.stringify(state, null, 2);
      fs.writeFileSync(this.saveFilePath, serialized, 'utf8');
      return true;
    } catch (err) {
      console.error('Failed to save game state:', err);
      return false;
    }
  }

  public loadGame(): GameState | null {
    try {
      if (!fs.existsSync(this.saveFilePath)) {
        return null;
      }
      const raw = fs.readFileSync(this.saveFilePath, 'utf8');
      const parsed: GameState = JSON.parse(raw);
      return parsed;
    } catch (err) {
      console.error('Failed to load game state:', err);
      return null;
    }
  }

  public saveExists(): boolean {
    return fs.existsSync(this.saveFilePath);
  }

  public deleteSave(): boolean {
    try {
      if (fs.existsSync(this.saveFilePath)) {
        fs.unlinkSync(this.saveFilePath);
      }
      return true;
    } catch {
      return false;
    }
  }
}
