import { GameEngine } from './engine/engine';
import { TorManager } from './network/tor-manager';
import { TerminalDashboard } from './ui/dashboard';

console.log('Booting Blockbuster: Underground Terminal Interface...\n');

const engine = new GameEngine();
const torManager = new TorManager();
const dashboard = new TerminalDashboard(engine, torManager);

dashboard.startInteractiveSession();
