import { GameEngine } from './engine/engine';
import { createDistortionMiddleware } from './engine/middleware/distortion';
import { createAlertEngineMiddleware } from './engine/middleware/alert';
import { createPersistenceMiddleware } from './engine/middleware/persistence';
import { WorkerRole } from './types/worker';

export * from './types';
export * from './engine';

console.log('====================================================');
console.log('   BLOCKBUSTER: UNDERGROUND - Core Game Engine      ');
console.log('====================================================\n');

// 1. Initialize Middlewares
const distortionMiddleware = createDistortionMiddleware((distortionIndex, sanity, heat) => {
  const crtJitter = (distortionIndex * 100).toFixed(1);
  const sanityPct = (sanity * 100).toFixed(1);
  const heatPct = heat.toFixed(1);
  console.log(`[SHADER-PIPELINE] Uniform Update -> Distortion: ${crtJitter}% | Sanity: ${sanityPct}% | Heat: ${heatPct}%`);
});

const alertMiddleware = createAlertEngineMiddleware((alert) => {
  console.log(`[ALERT ENGINE :: ${alert.severity}] [${alert.type}] ${alert.message}`);
});

const persistenceMiddleware = createPersistenceMiddleware((state) => {
  console.log(`[STORAGE-SYNC] State serialized at epoch ${state.runtime.lastTickEpochMs} (Ticks: ${state.runtime.totalTicksElapsed})`);
}, 1500);

// 2. Initialize Game Engine with Middlewares
const engine = new GameEngine({
  middlewares: [distortionMiddleware, alertMiddleware, persistenceMiddleware],
  tickIntervalMs: 350
});

// 3. Subscribe to Engine State
let tickCounter = 0;
const unsubscribe = engine.subscribe((state) => {
  tickCounter++;
  const cash = (state.player.cashCents / 100).toFixed(2);
  const sanity = (state.player.sanity * 100).toFixed(1);
  const heat = state.player.heat.toFixed(1);
  const activeRentalsCount = Object.keys(state.activeRentals).length;
  const activeWorkersCount = Object.keys(state.workers).length;

  if (tickCounter % 3 === 0) {
    console.log(
      `[TICK #${state.runtime.totalTicksElapsed}] Cash: $${cash} | Sanity: ${sanity}% | Heat: ${heat}% | Workers: ${activeWorkersCount} | Active Rentals: ${activeRentalsCount}`
    );
  }
});

// 4. Setup Initial Operations: Recruit Workers & Rent Tapes
console.log('--- Initializing Operatives & Tactical Operations ---');
engine.dispatch({
  type: 'RECRUIT_WORKER',
  role: WorkerRole.BENJAMIN,
  codename: 'Atlas-Prime',
  tier: 2
});

const initialState = engine.getState();
const benjaminId = Object.keys(initialState.workers)[0];
if (benjaminId) {
  engine.dispatch({
    type: 'ASSIGN_WORKER',
    workerId: benjaminId,
    nodeId: 'node_broadcasting_hub'
  });
}

engine.dispatch({
  type: 'RECRUIT_WORKER',
  role: WorkerRole.ELIAS,
  codename: 'Cipher-Mask',
  tier: 1
});

// Rent a surveillance tape
console.log('\n--- Leasing Tape from Analog Vault ---');
engine.dispatch({
  type: 'RENT_TAPE',
  tapeId: 'tape_001_vhf_leak',
  currentEpochMs: Date.now()
});

// 5. Start the Monotonic Simulation Loop
console.log('\n--- Starting Monotonic Game Engine Loop (350ms tick cadence) ---');
engine.start();

// Perform forensics scrubbing at 1.2s
setTimeout(() => {
  console.log('\n>>> Performing Forensics Scrubbing on Tape [tape_001_vhf_leak] (+60% effort)...');
  engine.dispatch({
    type: 'SCRUB_TAPE_FORENSICS',
    tapeId: 'tape_001_vhf_leak',
    effortDeltaPercent: 60
  });
}, 1200);

// Complete forensics decoding at 2.4s
setTimeout(() => {
  console.log('\n>>> Finalizing Forensics Decryption on Tape [tape_001_vhf_leak] (+40% effort)...');
  engine.dispatch({
    type: 'SCRUB_TAPE_FORENSICS',
    tapeId: 'tape_001_vhf_leak',
    effortDeltaPercent: 40
  });
}, 2400);

// Stop engine at 3.8s and print summary
setTimeout(() => {
  engine.stop();
  unsubscribe();
  console.log('\n====================================================');
  console.log('            SIMULATION RUN COMPLETED                ');
  console.log('====================================================');
  const finalState = engine.getState();
  console.log(`Final Player Cash: $${(finalState.player.cashCents / 100).toFixed(2)}`);
  console.log(`Final Player Sanity: ${(finalState.player.sanity * 100).toFixed(1)}%`);
  console.log(`Final Legal Heat: ${finalState.player.heat.toFixed(1)}%`);
  console.log(`Final Distortion Index: ${(finalState.player.distortionIndex * 100).toFixed(1)}%`);
  console.log(`Unlocked Clues: ${JSON.stringify(finalState.unlockedClues, null, 2)}`);
}, 3800);
