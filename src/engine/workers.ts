import { Worker, WorkerRole, WorkerStatus, SimulationState } from '../types';

export class WorkerManager {
  private workers: Map<string, Worker> = new Map();

  /**
   * Factory constructor for a 'Benjamin' (Financial operative)
   */
  public recruitBenjamin(codename: string, tier: number = 1): Worker {
    const id = `benjamin_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const worker: Worker = {
      id,
      codename: codename.toUpperCase(),
      role: WorkerRole.BENJAMIN,
      status: WorkerStatus.ACTIVE,
      tier,
      salaryPerMinuteCents: 5000 * tier, // $50.00/min * tier
      efficiency: 1.5 + tier * 0.5,      // Multiplies node income
      heatGeneratedPerMin: 2.5 * tier,   // Attracts financial heat
      heatDissipationPerMin: 0.0,
      sanityDrainRate: 0.005 * tier,     // High stress to manage
      durability: 1.0,
      assignedNodeId: null
    };
    this.workers.set(id, worker);
    return worker;
  }

  /**
   * Factory constructor for an 'Elias' (Identity mask operative)
   */
  public recruitElias(codename: string, tier: number = 1): Worker {
    const id = `elias_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const worker: Worker = {
      id,
      codename: `ALIAS::${codename.toUpperCase()}`,
      role: WorkerRole.ELIAS,
      status: WorkerStatus.ACTIVE,
      tier,
      salaryPerMinuteCents: 3500 * tier, // $35.00/min * tier
      efficiency: 1.0 + tier * 0.25,
      heatGeneratedPerMin: 0.0,
      heatDissipationPerMin: 4.0 * tier, // Actively scrubs heat
      sanityDrainRate: -0.01 * tier,     // Restores mental stability
      durability: 1.0,
      assignedNodeId: null
    };
    this.workers.set(id, worker);
    return worker;
  }

  /**
   * Assigns worker to a specific real-estate hub / surveillance tape node
   */
  public assignWorker(workerId: string, nodeId: string): boolean {
    const worker = this.workers.get(workerId);
    if (!worker || worker.status !== WorkerStatus.ACTIVE) {
      return false;
    }
    worker.assignedNodeId = nodeId;
    return true;
  }

  /**
   * Process a simulation tick for the worker manager instance
   * @param deltaSeconds Elapsed time since last tick
   * @param state Current simulation state
   */
  public processTick(deltaSeconds: number, state: SimulationState): SimulationState {
    const deltaMinutes = deltaSeconds / 60.0;

    let totalYieldDelta = 0;
    let totalHeatDelta = 0;
    let totalSanityDelta = 0;
    let totalSalaryCost = 0;

    for (const [, worker] of this.workers.entries()) {
      if (worker.status !== WorkerStatus.ACTIVE) continue;

      // 1. Calculate upkeep costs
      totalSalaryCost += worker.salaryPerMinuteCents * deltaMinutes;

      // 2. Role-specific execution logic
      if (worker.role === WorkerRole.BENJAMIN) {
        if (worker.assignedNodeId && state.assignedNodes.has(worker.assignedNodeId)) {
          const node = state.assignedNodes.get(worker.assignedNodeId)!;
          const revenue = node.baseYieldCents * worker.efficiency * deltaMinutes;
          totalYieldDelta += revenue;
        }
        totalHeatDelta += worker.heatGeneratedPerMin * deltaMinutes;
        totalSanityDelta -= worker.sanityDrainRate * deltaMinutes;

        // Burnout decay under high heat
        if (state.totalHeat > 60.0) {
          worker.durability -= 0.02 * deltaMinutes;
        }
      } else if (worker.role === WorkerRole.ELIAS) {
        totalHeatDelta -= worker.heatDissipationPerMin * deltaMinutes;
        totalSanityDelta -= worker.sanityDrainRate * deltaMinutes; // Negative drain = recovery

        // Durability burns down when actively absorbing high heat spikes
        if (state.totalHeat > 50.0) {
          worker.durability -= 0.05 * deltaMinutes;
        }
      }

      // 3. Check for identity burnout / exhaustion
      if (worker.durability <= 0.0) {
        worker.durability = 0.0;
        worker.status = WorkerStatus.BURNT;
        worker.assignedNodeId = null;
      }
    }

    // Update state mutations
    state.cashCents = Math.max(0, state.cashCents + totalYieldDelta - totalSalaryCost);
    state.totalHeat = Math.min(100.0, Math.max(0.0, state.totalHeat + totalHeatDelta));
    state.sanityLevel = Math.min(1.0, Math.max(0.0, state.sanityLevel + totalSanityDelta));

    return state;
  }

  public getWorker(workerId: string): Worker | undefined {
    return this.workers.get(workerId);
  }

  public getAllWorkers(): Worker[] {
    return Array.from(this.workers.values());
  }
}
