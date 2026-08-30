import { GameState, TorCircuitInfo } from '../types';

export interface RenderOptions {
  theme?: 'GREEN_PHOSPHOR' | 'AMBER_PHOSPHOR';
  enableGlitchEffects?: boolean;
}

export class TerminalRenderer {
  private theme: 'GREEN_PHOSPHOR' | 'AMBER_PHOSPHOR';
  private enableGlitchEffects: boolean;

  // ANSI escape codes
  private readonly RESET = '\x1b[0m';
  private readonly BOLD = '\x1b[1m';
  private readonly DIM = '\x1b[2m';
  private readonly RED = '\x1b[31m';
  private readonly GREEN = '\x1b[32m';
  private readonly YELLOW = '\x1b[33m';
  private readonly CYAN = '\x1b[36m';
  private readonly AMBER = '\x1b[38;5;214m';
  private readonly BG_DARK = '\x1b[48;5;233m';

  constructor(options?: RenderOptions) {
    this.theme = options?.theme || 'GREEN_PHOSPHOR';
    this.enableGlitchEffects = options?.enableGlitchEffects ?? true;
  }

  private getPrimaryColor(): string {
    return this.theme === 'AMBER_PHOSPHOR' ? this.AMBER : this.GREEN;
  }

  /**
   * Applies subtle CRT text glitch noise when distortion index is elevated.
   */
  public applyGlitch(text: string, distortionIndex: number): string {
    if (!this.enableGlitchEffects || distortionIndex < 0.15) {
      return text;
    }

    const glitchChars = ['#', '%', '&', '§', '░', '▒', '▓', '?', '!', '/'];
    const glitchProbability = Math.min(0.35, distortionIndex * 0.4);

    return text
      .split('')
      .map((char) => {
        if (char === ' ' || char === '\n' || char === '\t' || char === '\x1b') return char;
        if (Math.random() < glitchProbability) {
          const randomChar = glitchChars[Math.floor(Math.random() * glitchChars.length)];
          return `${this.RED}${randomChar}${this.getPrimaryColor()}`;
        }
        return char;
      })
      .join('');
  }

  /**
   * Generates an ASCII progress bar (e.g. [████████░░░░░░░░░░] 50%).
   */
  public renderProgressBar(
    ratio: number,
    width: number = 20,
    filledColor: string = this.getPrimaryColor(),
    emptyColor: string = this.DIM
  ): string {
    const clampedRatio = Math.max(0, Math.min(1, ratio));
    const filledChars = Math.round(clampedRatio * width);
    const emptyChars = width - filledChars;

    const bar = `${filledColor}${'█'.repeat(filledChars)}${emptyColor}${'░'.repeat(emptyChars)}${this.RESET}`;
    const percentage = `${(clampedRatio * 100).toFixed(0).padStart(3)}%`;
    return `${bar} ${percentage}`;
  }

  /**
   * Formats numbers into currency format ($1,234.56)
   */
  public formatCurrency(cents: number): string {
    const dollars = cents / 100;
    return `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  /**
   * Renders the complete dashboard view.
   */
  public renderDashboard(state: GameState, torStatus?: TorCircuitInfo): string {
    const primary = this.getPrimaryColor();
    const distortion = state.player.distortionIndex;
    const lines: string[] = [];

    // Header Banner
    lines.push(`${primary}${this.BOLD}================================================================================${this.RESET}`);
    lines.push(
      this.applyGlitch(
        `${primary}${this.BOLD}   █▀▀█ █   █▀▀█ █▀▀ █ █ █▀▀▄ █  █ █▀▀ ▀▀█▀▀ █▀▀ █▀▀█  :: UNDERGROUND v0.1.0${this.RESET}`,
        distortion
      )
    );
    lines.push(
      this.applyGlitch(
        `${primary}${this.BOLD}   █▀▀▄ █   █  █ █   █▀▄ █▀▀▄ █  █ ▀▀█   █   █▀▀ █▀▀▄  :: ANALOG TERMINAL${this.RESET}`,
        distortion
      )
    );
    lines.push(`${primary}${this.BOLD}================================================================================${this.RESET}`);

    // System Status & Tor Onion Network Circuit Bar
    const networkStatusColor =
      torStatus?.status === 'CONNECTED' || torStatus?.status === 'CIRCUIT_ESTABLISHED'
        ? this.GREEN
        : torStatus?.status === 'CONNECTING'
        ? this.YELLOW
        : this.RED;

    const netStatusText = torStatus ? torStatus.status : 'OFFLINE';
    const netLatency = torStatus?.latencyMs ? `${torStatus.latencyMs}ms` : '--';
    const netTarget = torStatus?.targetOnion
      ? `${torStatus.targetOnion.substring(0, 16)}...onion`
      : 'direct_relay';

    lines.push(
      `${this.BOLD}[SYS]${this.RESET} Operator: ${this.CYAN}${state.player.alias}${this.RESET} | ` +
      `Tor Onion: ${networkStatusColor}${netStatusText}${this.RESET} (${netLatency}) | ` +
      `Relay: ${this.DIM}${netTarget}${this.RESET} | ` +
      `Tick: #${state.runtime.totalTicksElapsed}`
    );

    lines.push(`${primary}--------------------------------------------------------------------------------${this.RESET}`);

    // Financial & Mental Clarity Ledger
    const sanityColor = state.player.sanity > 0.5 ? this.GREEN : state.player.sanity > 0.25 ? this.YELLOW : this.RED;
    const heatColor = state.player.heat < 50 ? this.GREEN : state.player.heat < 80 ? this.YELLOW : this.RED;

    lines.push(
      `${this.BOLD}CAPITAL / LIQUIDITY:${this.RESET} ${this.YELLOW}${this.formatCurrency(state.player.cashCents).padEnd(16)}${this.RESET} ` +
      `${this.BOLD}DISTORTION INDEX:${this.RESET} ${((distortion * 100).toFixed(1) + '%').padEnd(10)}`
    );

    lines.push(
      `${this.BOLD}SANITY / CLARITY:   ${this.RESET} ${this.renderProgressBar(state.player.sanity, 16, sanityColor)}   ` +
      `${this.BOLD}LEGAL HEAT:      ${this.RESET} ${this.renderProgressBar(state.player.heat / 100, 16, heatColor)}`
    );

    lines.push(`${primary}--------------------------------------------------------------------------------${this.RESET}`);

    // Operatives Roster (Benjamins & Eliases)
    lines.push(`${primary}${this.BOLD}>> ACTIVE OPERATIVES (BENJAMINS & ELIASES)${this.RESET}`);
    const workers = Object.values(state.workers);
    if (workers.length === 0) {
      lines.push(`${this.DIM}   No active operatives recruited. Recruit Benjamins for income or Eliases to scrub heat.${this.RESET}`);
    } else {
      workers.forEach((w) => {
        const roleBadge =
          w.role === 'BENJAMIN'
            ? `${this.YELLOW}[BENJAMIN: +${(w.efficiency * 100).toFixed(0)}% YIELD]${this.RESET}`
            : `${this.CYAN}[ELIAS: -${w.heatDissipationPerMin.toFixed(1)} HEAT/MIN]${this.RESET}`;

        const statusColor = w.status === 'ACTIVE' ? this.GREEN : this.RED;
        const durabilityBar = this.renderProgressBar(w.durability, 8, statusColor);

        lines.push(
          `   • ${this.BOLD}${w.codename.padEnd(20)}${this.RESET} ${roleBadge} ` +
          `Tier ${w.tier} | Upkeep: ${this.formatCurrency(w.salaryPerMinuteCents)}/m | ` +
          `Cond: ${durabilityBar} | ` +
          `Hub: ${w.assignedNodeId || 'UNASSIGNED'}`
        );
      });
    }

    lines.push(`${primary}--------------------------------------------------------------------------------${this.RESET}`);

    // Real Estate Nodes / Safehouse Territory
    lines.push(`${primary}${this.BOLD}>> CONTROLLED REAL ESTATE & SURVEILLANCE HUBS${this.RESET}`);
    const nodes = Object.values(state.nodes);
    nodes.forEach((n) => {
      const assignedWorkers = workers.filter((w) => w.assignedNodeId === n.id).length;
      lines.push(
        `   • [${n.id}] ${this.BOLD}${n.name}${this.RESET} (Tier ${n.tier}) - ` +
        `Base: ${this.formatCurrency(n.baseYieldPerMinCents)}/m | ` +
        `Capacity: ${assignedWorkers}/${n.workerCapacity} | ` +
        `Recovery: +${(n.sanityRecoveryRatePerMin * 100).toFixed(2)}%/m`
      );
    });

    lines.push(`${primary}--------------------------------------------------------------------------------${this.RESET}`);

    // Analog Tape Vault & Active Rentals
    lines.push(`${primary}${this.BOLD}>> ANALOG TAPE VAULT & ACTIVE FORENSICS COUNTDOWNS${this.RESET}`);
    const activeRentals = Object.values(state.activeRentals);
    if (activeRentals.length === 0) {
      lines.push(`${this.DIM}   No tapes currently leased. Rent VHS cassettes from the archive to decode intelligence.${this.RESET}`);
    } else {
      activeRentals.forEach((r) => {
        const tape = state.tapeCatalog[r.tapeId];
        const statusBadge =
          r.status === 'DECODED'
            ? `${this.GREEN}[DECODED]${this.RESET}`
            : r.status === 'EXPIRED'
            ? `${this.RED}[EXPIRED]${this.RESET}`
            : `${this.YELLOW}[RENTED - ${Math.ceil(r.remainingSeconds)}s REMAINING]${this.RESET}`;

        const scrubBar = this.renderProgressBar(r.progressPercent / 100, 10, this.CYAN);

        lines.push(
          `   • [${r.tapeId}] ${this.BOLD}${tape ? tape.title : r.tapeId}${this.RESET} ` +
          `${statusBadge} | Decryption Progress: ${scrubBar}`
        );
      });
    }

    // Unlocked Clues
    if (state.unlockedClues.length > 0) {
      lines.push(`${this.DIM}   Unlocked Intel: ${state.unlockedClues.join(' | ')}${this.RESET}`);
    }

    lines.push(`${primary}================================================================================${this.RESET}`);

    // Active Alerts / Raids
    if (state.runtime.isRaidActive) {
      lines.push(`${this.RED}${this.BOLD}>>> [CRITICAL WARNING] SURVEILLANCE BREACH: POLICE RAID ACTIVE! PAY BRIBES (ACTION 5) <<<${this.RESET}`);
    }

    return lines.join('\n');
  }
}
