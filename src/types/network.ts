export interface TorConfig {
  enabled: boolean;
  socksHost: string;
  socksPort: number;
  controlPort?: number;
  controlPassword?: string;
  targetOnionAddress?: string;
  timeoutMs: number;
  fallbackToDirect: boolean;
}

export type TorConnectionStatus =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'CIRCUIT_ESTABLISHED'
  | 'FAILED';

export interface TorCircuitInfo {
  circuitId?: string;
  status: TorConnectionStatus;
  proxyAddress: string;
  targetOnion?: string;
  latencyMs?: number;
  lastCheckedEpochMs: number;
  errorMessage?: string;
}
