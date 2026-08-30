import {
  GameState,
  GameAction,
  Worker,
  WorkerRole,
  WorkerStatus,
  RealEstateNode,
  ActiveTapeRental,
  GameAlert
} from '../types';

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'RECRUIT_WORKER': {
      const tier = Math.min(5, Math.max(1, action.tier || 1));
      const id = `${action.role.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const isBenjamin = action.role === WorkerRole.BENJAMIN;

      const newWorker: Worker = {
        id,
        codename: isBenjamin ? action.codename.toUpperCase() : `ALIAS::${action.codename.toUpperCase()}`,
        role: action.role,
        status: WorkerStatus.ACTIVE,
        tier,
        salaryPerMinuteCents: (isBenjamin ? 5000 : 3500) * tier,
        efficiency: isBenjamin ? 1.5 + tier * 0.5 : 1.0 + tier * 0.25,
        heatGeneratedPerMin: isBenjamin ? 2.5 * tier : 0.0,
        heatDissipationPerMin: isBenjamin ? 0.0 : 4.0 * tier,
        sanityDrainRate: isBenjamin ? -0.005 * tier : 0.01 * tier,
        durability: 1.0,
        assignedNodeId: null
      };

      return {
        ...state,
        workers: { ...state.workers, [id]: newWorker }
      };
    }

    case 'ASSIGN_WORKER': {
      const worker = state.workers[action.workerId];
      if (!worker || worker.status !== WorkerStatus.ACTIVE) return state;

      // Check node capacity if assigning
      if (action.nodeId) {
        const targetNode = state.nodes[action.nodeId];
        if (!targetNode) return state;

        const assignedCount = Object.values(state.workers).filter(
          w => w.assignedNodeId === action.nodeId && w.id !== action.workerId
        ).length;

        if (assignedCount >= targetNode.workerCapacity) {
          return state; // Node at maximum capacity
        }
      }

      return {
        ...state,
        workers: {
          ...state.workers,
          [action.workerId]: { ...worker, assignedNodeId: action.nodeId }
        }
      };
    }

    case 'RETIRE_WORKER': {
      const nextWorkers = { ...state.workers };
      delete nextWorkers[action.workerId];
      return { ...state, workers: nextWorkers };
    }

    case 'UPGRADE_WORKER': {
      const worker = state.workers[action.workerId];
      if (!worker || worker.tier >= 5 || worker.status !== WorkerStatus.ACTIVE) return state;

      const nextTier = worker.tier + 1;
      const isBenjamin = worker.role === WorkerRole.BENJAMIN;

      const upgraded: Worker = {
        ...worker,
        tier: nextTier,
        salaryPerMinuteCents: (isBenjamin ? 5000 : 3500) * nextTier,
        efficiency: isBenjamin ? 1.5 + nextTier * 0.5 : 1.0 + nextTier * 0.25,
        heatGeneratedPerMin: isBenjamin ? 2.5 * nextTier : 0.0,
        heatDissipationPerMin: isBenjamin ? 0.0 : 4.0 * nextTier,
        sanityDrainRate: isBenjamin ? -0.005 * nextTier : 0.01 * nextTier,
        durability: 1.0 // Refurbish durability on promotion
      };

      return {
        ...state,
        workers: { ...state.workers, [action.workerId]: upgraded }
      };
    }

    case 'ADD_NODE': {
      const newNode: RealEstateNode = {
        id: action.id,
        name: action.name,
        tier: action.tier || 1,
        baseYieldPerMinCents: action.baseYieldPerMinCents,
        upgradeCostCents: action.upgradeCostCents || action.baseYieldPerMinCents * 20,
        workerCapacity: action.workerCapacity || 2,
        isCompromised: false,
        sanityRecoveryRatePerMin: action.sanityRecoveryRatePerMin || 0.002
      };
      return {
        ...state,
        nodes: { ...state.nodes, [action.id]: newNode }
      };
    }

    case 'UPGRADE_NODE': {
      const node = state.nodes[action.nodeId];
      if (!node || node.tier >= 5 || state.player.cashCents < node.upgradeCostCents) {
        return state;
      }

      const nextTier = node.tier + 1;
      const upgradedNode: RealEstateNode = {
        ...node,
        tier: nextTier,
        baseYieldPerMinCents: Math.round(node.baseYieldPerMinCents * 2.2),
        upgradeCostCents: Math.round(node.upgradeCostCents * 2.5),
        workerCapacity: node.workerCapacity + 1,
        sanityRecoveryRatePerMin: node.sanityRecoveryRatePerMin * 1.5
      };

      return {
        ...state,
        player: {
          ...state.player,
          cashCents: state.player.cashCents - node.upgradeCostCents
        },
        nodes: {
          ...state.nodes,
          [action.nodeId]: upgradedNode
        }
      };
    }

    case 'REGISTER_TAPE': {
      return {
        ...state,
        tapeCatalog: {
          ...state.tapeCatalog,
          [action.tape.id]: action.tape
        }
      };
    }

    case 'RENT_TAPE': {
      const tape = state.tapeCatalog[action.tapeId];
      if (!tape || state.player.cashCents < tape.rentalCostCents) {
        return state;
      }

      const activeRental: ActiveTapeRental = {
        tapeId: tape.id,
        rentedAtEpochMs: action.currentEpochMs,
        expiresAtEpochMs: action.currentEpochMs + tape.durationSeconds * 1000,
        remainingSeconds: tape.durationSeconds,
        status: 'RENTED',
        progressPercent: 0.0
      };

      return {
        ...state,
        player: {
          ...state.player,
          cashCents: state.player.cashCents - tape.rentalCostCents,
          sanity: Math.max(0.0, state.player.sanity - tape.sanityCost),
          heat: Math.min(100.0, state.player.heat + tape.heatGenerated * 0.2)
        },
        activeRentals: {
          ...state.activeRentals,
          [tape.id]: activeRental
        }
      };
    }

    case 'SCRUB_TAPE_FORENSICS': {
      const rental = state.activeRentals[action.tapeId];
      const tape = state.tapeCatalog[action.tapeId];
      if (!rental || !tape || rental.status !== 'RENTED') return state;

      const newProgress = Math.min(100.0, rental.progressPercent + action.effortDeltaPercent);
      const isDecoded = newProgress >= 100.0;

      const updatedRental: ActiveTapeRental = {
        ...rental,
        progressPercent: newProgress,
        status: isDecoded ? 'DECODED' : 'RENTED'
      };

      let nextCash = state.player.cashCents;
      let nextHeat = state.player.heat;
      const nextClues = [...state.unlockedClues];
      const newAlerts = [...state.runtime.unresolvedAlerts];

      if (isDecoded) {
        nextCash += tape.potentialYieldCents;
        nextHeat = Math.min(100.0, nextHeat + tape.heatGenerated);
        tape.clues.forEach(clue => {
          if (!nextClues.includes(clue)) nextClues.push(clue);
        });

        newAlerts.push({
          id: `alert_decode_${Date.now()}`,
          type: 'DECRYPTION_SUCCESS',
          message: `Decrypted tape [${tape.title}]! Yield: +$${(tape.potentialYieldCents / 100).toFixed(2)}`,
          timestamp: Date.now(),
          severity: 'INFO'
        });
      }

      return {
        ...state,
        player: {
          ...state.player,
          cashCents: nextCash,
          heat: nextHeat,
          sanity: Math.max(0.0, state.player.sanity - 0.02)
        },
        activeRentals: {
          ...state.activeRentals,
          [action.tapeId]: updatedRental
        },
        unlockedClues: nextClues,
        runtime: {
          ...state.runtime,
          unresolvedAlerts: newAlerts
        }
      };
    }

    case 'RECOVER_SANITY': {
      if (state.player.cashCents < action.recoveryCents) return state;
      const sanityBoost = (action.recoveryCents / 10000) * 0.25; // $100 -> +25% sanity

      return {
        ...state,
        player: {
          ...state.player,
          cashCents: state.player.cashCents - action.recoveryCents,
          sanity: Math.min(1.0, state.player.sanity + sanityBoost)
        }
      };
    }

    case 'DISMISS_ALERT': {
      return {
        ...state,
        runtime: {
          ...state.runtime,
          unresolvedAlerts: state.runtime.unresolvedAlerts.filter(a => a.id !== action.alertId)
        }
      };
    }

    case 'RESOLVE_POLICE_RAID': {
      const success = action.success;
      return {
        ...state,
        player: {
          ...state.player,
          cashCents: Math.max(0, state.player.cashCents - action.bribesPaidCents),
          heat: success ? 15.0 : 75.0,
          sanity: success ? state.player.sanity : Math.max(0.0, state.player.sanity - 0.3)
        },
        runtime: {
          ...state.runtime,
          isRaidActive: false
        }
      };
    }

    case 'TICK': {
      const dtMin = action.deltaSeconds / 60.0;
      let cashDelta = 0;
      let heatDelta = 0;
      let sanityDelta = 0;
      let salaryCosts = 0;

      const alerts: GameAlert[] = [...state.runtime.unresolvedAlerts];

      // 1. Safehouse passive sanity restoration from nodes
      for (const nodeId in state.nodes) {
        const node = state.nodes[nodeId];
        if (!node.isCompromised) {
          sanityDelta += node.sanityRecoveryRatePerMin * dtMin;
        }
      }

      // 2. Process Worker Loops
      const updatedWorkers: Record<string, Worker> = {};
      for (const workerId in state.workers) {
        const worker = { ...state.workers[workerId] };

        if (worker.status === WorkerStatus.ACTIVE) {
          salaryCosts += worker.salaryPerMinuteCents * dtMin;

          if (worker.role === WorkerRole.BENJAMIN) {
            if (worker.assignedNodeId && state.nodes[worker.assignedNodeId]) {
              const node = state.nodes[worker.assignedNodeId];
              cashDelta += node.baseYieldPerMinCents * worker.efficiency * dtMin;
            }
            heatDelta += worker.heatGeneratedPerMin * dtMin;
            sanityDelta += worker.sanityDrainRate * dtMin;

            // Burnout decay under extreme surveillance scrutiny
            if (state.player.heat > 65.0) {
              worker.durability = Math.max(0, worker.durability - 0.03 * dtMin);
            }
          } else if (worker.role === WorkerRole.ELIAS) {
            heatDelta -= worker.heatDissipationPerMin * dtMin;
            sanityDelta += worker.sanityDrainRate * dtMin;

            // Durability consumed when actively absorbing high heat spikes
            if (state.player.heat > 50.0) {
              worker.durability = Math.max(0, worker.durability - 0.05 * dtMin);
            }
          }

          if (worker.durability <= 0.0) {
            worker.durability = 0.0;
            worker.status = WorkerStatus.BURNT;
            worker.assignedNodeId = null;

            alerts.push({
              id: `alert_burnout_${worker.id}_${action.currentEpochMs}`,
              type: 'WORKER_BURNOUT',
              message: `Operative [${worker.codename}] burned out due to excessive operational stress!`,
              timestamp: action.currentEpochMs,
              severity: 'WARNING'
            });
          }
        }

        updatedWorkers[workerId] = worker;
      }

      // 3. Process Active Tape Countdown Windows
      const updatedRentals: Record<string, ActiveTapeRental> = {};
      for (const tapeId in state.activeRentals) {
        const rental = { ...state.activeRentals[tapeId] };

        if (rental.status === 'RENTED') {
          const remainingSec = Math.max(0, (rental.expiresAtEpochMs - action.currentEpochMs) / 1000);
          rental.remainingSeconds = remainingSec;

          if (remainingSec <= 0) {
            rental.status = 'EXPIRED';
            alerts.push({
              id: `alert_expired_${tapeId}_${action.currentEpochMs}`,
              type: 'TAPE_EXPIRED',
              message: `Tape rental [${tapeId}] expired before decryption was completed!`,
              timestamp: action.currentEpochMs,
              severity: 'WARNING'
            });
          }
        }

        updatedRentals[tapeId] = rental;
      }

      // 4. Compute Next State Metrics
      const nextCash = Math.max(0, state.player.cashCents + cashDelta - salaryCosts);
      const nextHeat = Math.min(100.0, Math.max(0.0, state.player.heat + heatDelta));
      const nextSanity = Math.min(1.0, Math.max(0.0, state.player.sanity + sanityDelta));

      // Distortion increases as sanity drops and heat spikes
      const computedDistortion = (1.0 - nextSanity) * 0.7 + (nextHeat / 100.0) * 0.3;

      const isRaidNow = nextHeat >= 95.0;
      if (isRaidNow && !state.runtime.isRaidActive) {
        alerts.push({
          id: `alert_raid_${action.currentEpochMs}`,
          type: 'POLICE_RAID',
          message: 'CRITICAL: Surveillance breached! Police raid in progress!',
          timestamp: action.currentEpochMs,
          severity: 'CRITICAL'
        });
      }

      return {
        ...state,
        player: {
          ...state.player,
          cashCents: nextCash,
          heat: nextHeat,
          sanity: nextSanity,
          distortionIndex: Math.min(1.0, Math.max(0.0, computedDistortion))
        },
        workers: updatedWorkers,
        activeRentals: updatedRentals,
        runtime: {
          ...state.runtime,
          lastTickEpochMs: action.currentEpochMs,
          totalTicksElapsed: state.runtime.totalTicksElapsed + 1,
          isRaidActive: isRaidNow,
          unresolvedAlerts: alerts
        }
      };
    }

    default:
      return state;
  }
}
