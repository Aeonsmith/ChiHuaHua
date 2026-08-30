import * as readline from 'node:readline';
import { GameEngine } from '../engine/engine';
import { TorManager } from '../network/tor-manager';
import { TerminalRenderer, RenderOptions } from './terminal-renderer';
import { WorkerRole } from '../types';

export class TerminalDashboard {
  private engine: GameEngine;
  private torManager: TorManager;
  private renderer: TerminalRenderer;
  private rl: readline.Interface | null = null;
  private isRunning: boolean = false;
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(engine: GameEngine, torManager: TorManager, options?: RenderOptions) {
    this.engine = engine;
    this.torManager = torManager;
    this.renderer = new TerminalRenderer(options);
  }

  public getRenderer(): TerminalRenderer {
    return this.renderer;
  }

  public render(): string {
    const state = this.engine.getState();
    const torStatus = this.torManager.getStatus();
    return this.renderer.renderDashboard(state, torStatus);
  }

  public startInteractiveSession(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // Start engine and background Tor healthcheck
    this.engine.start();
    this.torManager.checkSocksProxy().catch(() => {});

    // Periodic network re-check
    const torInterval = setInterval(() => {
      if (!this.isRunning) {
        clearInterval(torInterval);
        return;
      }
      this.torManager.checkSocksProxy().catch(() => {});
    }, 15000);

    // Terminal render loop
    this.refreshTimer = setInterval(() => {
      if (!this.isRunning) return;
      this.draw();
    }, 500);

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    this.draw();
    this.promptCommand();
  }

  public draw(): void {
    console.clear();
    console.log(this.render());
    this.printActionMenu();
  }

  private printActionMenu(): void {
    console.log('\n[ACTIONS]: [1] Recruit Benjamin ($50/m) | [2] Recruit Elias ($35/m) | [3] Lease Tape ($100) | [4] Scrub Forensics (+50%)');
    console.log('           [5] Resolve Raid ($200)      | [6] Restore Sanity ($100)   | [7] Ping Tor Circuit  | [Q] Exit Terminal');
  }

  private promptCommand(): void {
    if (!this.rl || !this.isRunning) return;

    this.rl.question('\n>> Enter command: ', (cmd) => {
      this.handleCommand(cmd.trim().toUpperCase());
      if (this.isRunning) {
        this.draw();
        this.promptCommand();
      }
    });
  }

  public handleCommand(cmd: string): void {
    const state = this.engine.getState();

    switch (cmd) {
      case '1': {
        const id = `BENJAMIN_${Date.now().toString().slice(-4)}`;
        this.engine.dispatch({
          type: 'RECRUIT_WORKER',
          role: WorkerRole.BENJAMIN,
          codename: id,
          tier: 1
        });
        const newState = this.engine.getState();
        const workerId = Object.keys(newState.workers).pop();
        if (workerId) {
          this.engine.dispatch({
            type: 'ASSIGN_WORKER',
            workerId,
            nodeId: 'node_broadcasting_hub'
          });
        }
        break;
      }

      case '2': {
        const id = `ELIAS_${Date.now().toString().slice(-4)}`;
        this.engine.dispatch({
          type: 'RECRUIT_WORKER',
          role: WorkerRole.ELIAS,
          codename: id,
          tier: 1
        });
        break;
      }

      case '3': {
        this.engine.dispatch({
          type: 'RENT_TAPE',
          tapeId: 'tape_001_vhf_leak',
          currentEpochMs: Date.now()
        });
        break;
      }

      case '4': {
        this.engine.dispatch({
          type: 'SCRUB_TAPE_FORENSICS',
          tapeId: 'tape_001_vhf_leak',
          effortDeltaPercent: 50
        });
        break;
      }

      case '5': {
        this.engine.dispatch({
          type: 'RESOLVE_POLICE_RAID',
          bribesPaidCents: 20000,
          success: true
        });
        break;
      }

      case '6': {
        this.engine.dispatch({
          type: 'RECOVER_SANITY',
          recoveryCents: 10000
        });
        break;
      }

      case '7': {
        this.torManager.checkSocksProxy().catch(() => {});
        break;
      }

      case 'Q': {
        this.stop();
        break;
      }
    }
  }

  public stop(): void {
    this.isRunning = false;
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
    this.engine.stop();
    console.log('\n[TERMINAL] Session detached.');
  }
}
