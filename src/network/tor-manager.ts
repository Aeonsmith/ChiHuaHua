import * as net from 'node:net';
import { TorConfig, TorCircuitInfo, TorConnectionStatus } from '../types';

export class TorManager {
  private config: TorConfig;
  private currentStatus: TorConnectionStatus = 'DISCONNECTED';
  private lastLatencyMs: number | null = null;
  private lastError: string | null = null;

  constructor(config?: Partial<TorConfig>) {
    this.config = {
      enabled: config?.enabled ?? true,
      socksHost: config?.socksHost || '127.0.0.1',
      socksPort: config?.socksPort || 9050,
      controlPort: config?.controlPort || 9051,
      controlPassword: config?.controlPassword,
      targetOnionAddress: config?.targetOnionAddress,
      timeoutMs: config?.timeoutMs || 5000,
      fallbackToDirect: config?.fallbackToDirect ?? false
    };
  }

  public getConfig(): TorConfig {
    return { ...this.config };
  }

  public setConfig(newConfig: Partial<TorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Validates a Tor v3 .onion address format (56 lowercase base32 characters followed by .onion)
   */
  public isValidV3Onion(address: string): boolean {
    const v3Regex = /^[a-z2-7]{56}\.onion$/i;
    return v3Regex.test(address.trim());
  }

  /**
   * Performs a SOCKS5 handshake check against the configured Tor SOCKS proxy.
   */
  public async checkSocksProxy(): Promise<TorCircuitInfo> {
    const proxyAddress = `${this.config.socksHost}:${this.config.socksPort}`;
    const startTime = Date.now();

    if (!this.config.enabled) {
      this.currentStatus = 'DISCONNECTED';
      return {
        status: 'DISCONNECTED',
        proxyAddress,
        lastCheckedEpochMs: startTime,
        errorMessage: 'Tor integration is disabled in configuration'
      };
    }

    return new Promise((resolve) => {
      this.currentStatus = 'CONNECTING';

      const socket = net.createConnection({
        host: this.config.socksHost,
        port: this.config.socksPort,
        timeout: this.config.timeoutMs
      });

      let resolved = false;

      const finish = (status: TorConnectionStatus, errorMsg?: string) => {
        if (resolved) return;
        resolved = true;
        socket.destroy();

        const latency = Date.now() - startTime;
        this.currentStatus = status;
        this.lastLatencyMs = status === 'CONNECTED' || status === 'CIRCUIT_ESTABLISHED' ? latency : null;
        this.lastError = errorMsg || null;

        resolve({
          status,
          proxyAddress,
          targetOnion: this.config.targetOnionAddress,
          latencyMs: this.lastLatencyMs || undefined,
          lastCheckedEpochMs: Date.now(),
          errorMessage: errorMsg
        });
      };

      socket.on('connect', () => {
        // Send SOCKS5 Greeting: [VER=0x05, NMETHODS=1, METHODS=[0x00 (NO_AUTH)]]
        const greeting = Buffer.from([0x05, 0x01, 0x00]);
        socket.write(greeting);
      });

      socket.on('data', (data) => {
        // Expected SOCKS5 response: [VER=0x05, METHOD=0x00]
        if (data.length >= 2 && data[0] === 0x05 && data[1] === 0x00) {
          finish('CONNECTED');
        } else {
          finish('FAILED', `Unexpected SOCKS5 handshake response: ${data.toString('hex')}`);
        }
      });

      socket.on('timeout', () => {
        finish('FAILED', `Connection to Tor SOCKS proxy at ${proxyAddress} timed out (${this.config.timeoutMs}ms)`);
      });

      socket.on('error', (err) => {
        finish('FAILED', `Socket error connecting to Tor proxy: ${err.message}`);
      });
    });
  }

  /**
   * Establishes a SOCKS5 tunnel through Tor to a remote target (e.g. an onion endpoint).
   */
  public async createSocksTunnel(targetHost: string, targetPort: number): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({
        host: this.config.socksHost,
        port: this.config.socksPort,
        timeout: this.config.timeoutMs
      });

      let state: 'GREETING' | 'CONNECT_REQUEST' | 'CONNECTED' = 'GREETING';

      socket.on('connect', () => {
        // 1. Send SOCKS5 Greeting
        socket.write(Buffer.from([0x05, 0x01, 0x00]));
      });

      socket.on('data', (data) => {
        if (state === 'GREETING') {
          if (data.length < 2 || data[0] !== 0x05 || data[1] !== 0x00) {
            socket.destroy();
            return reject(new Error('SOCKS5 authentication failed'));
          }

          state = 'CONNECT_REQUEST';

          // 2. Send SOCKS5 CONNECT request with Domain Name addressing (ATYP = 0x03)
          const hostBuffer = Buffer.from(targetHost, 'utf8');
          const portBuffer = Buffer.alloc(2);
          portBuffer.writeUInt16BE(targetPort, 0);

          const request = Buffer.concat([
            Buffer.from([0x05, 0x01, 0x00, 0x03, hostBuffer.length]),
            hostBuffer,
            portBuffer
          ]);

          socket.write(request);
        } else if (state === 'CONNECT_REQUEST') {
          // Expected reply: [VER=0x05, REP=0x00 (SUCCESS), RSV=0x00, ATYP=..., BND.ADDR, BND.PORT]
          if (data.length >= 2 && data[0] === 0x05 && data[1] === 0x00) {
            state = 'CONNECTED';
            this.currentStatus = 'CIRCUIT_ESTABLISHED';
            socket.removeAllListeners('data');
            resolve(socket);
          } else {
            socket.destroy();
            const repCode = data.length >= 2 ? data[1] : -1;
            reject(new Error(`SOCKS5 CONNECT failed with reply code: ${repCode}`));
          }
        }
      });

      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error(`SOCKS5 tunnel creation timed out to ${targetHost}:${targetPort}`));
      });

      socket.on('error', (err) => {
        reject(err);
      });
    });
  }

  public getStatus(): TorCircuitInfo {
    return {
      status: this.currentStatus,
      proxyAddress: `${this.config.socksHost}:${this.config.socksPort}`,
      targetOnion: this.config.targetOnionAddress,
      latencyMs: this.lastLatencyMs || undefined,
      lastCheckedEpochMs: Date.now(),
      errorMessage: this.lastError || undefined
    };
  }
}
