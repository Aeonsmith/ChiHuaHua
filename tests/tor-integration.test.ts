import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as net from 'node:net';
import { TorManager } from '../src/network/tor-manager';
import { GameEngine } from '../src/engine/engine';
import { Middleware } from '../src/types';

describe('Tor Network Manager - End-to-End Integration', () => {
  let mockProxyServer: net.Server;
  let mockTargetServer: net.Server;
  let proxyPort: number;
  let targetPort: number;

  before((_, done) => {
    // 1. Create a mock target echo server representing an onion backend
    mockTargetServer = net.createServer((socket) => {
      socket.on('data', (data) => {
        socket.write(Buffer.concat([Buffer.from('ECHO::'), data]));
      });
    });

    mockTargetServer.listen(0, '127.0.0.1', () => {
      targetPort = (mockTargetServer.address() as net.AddressInfo).port;

      // 2. Create a mock SOCKS5 proxy server that bridges connections to the target server
      mockProxyServer = net.createServer((clientSocket) => {
        let stage: 'GREETING' | 'REQUEST' | 'STREAM' = 'GREETING';
        let targetSocket: net.Socket | null = null;

        clientSocket.on('data', (data) => {
          if (stage === 'GREETING') {
            if (data[0] === 0x05) {
              clientSocket.write(Buffer.from([0x05, 0x00])); // NO_AUTH
              stage = 'REQUEST';
            }
          } else if (stage === 'REQUEST') {
            // SOCKS5 CONNECT command received
            targetSocket = net.createConnection({ host: '127.0.0.1', port: targetPort }, () => {
              // Send SOCKS5 success reply
              clientSocket.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 127, 0, 0, 1, 0x00, 0x50]));
              stage = 'STREAM';
            });

            targetSocket.on('data', (remoteData) => {
              clientSocket.write(remoteData);
            });

            targetSocket.on('close', () => {
              clientSocket.destroy();
            });

            targetSocket.on('error', () => {
              clientSocket.destroy();
            });
          } else if (stage === 'STREAM' && targetSocket) {
            targetSocket.write(data);
          }
        });

        clientSocket.on('close', () => {
          if (targetSocket) targetSocket.destroy();
        });
      });

      mockProxyServer.listen(0, '127.0.0.1', () => {
        proxyPort = (mockProxyServer.address() as net.AddressInfo).port;
        done();
      });
    });
  });

  after((_, done) => {
    mockProxyServer.close(() => {
      mockTargetServer.close(done);
    });
  });

  it('should establish an end-to-end tunnel and exchange payload through the SOCKS5 proxy', async () => {
    const tor = new TorManager({
      socksHost: '127.0.0.1',
      socksPort: proxyPort,
      targetOnionAddress: 'blockbustertest56charactersoniondomainaddresssample1234.onion'
    });

    const tunnel = await tor.createSocksTunnel('sample.onion', 80);
    assert.ok(tunnel);

    const receivedPayload = await new Promise<string>((resolve) => {
      tunnel.on('data', (data) => {
        resolve(data.toString('utf8'));
      });
      tunnel.write('PING_PAYLOAD_TEST');
    });

    assert.equal(receivedPayload, 'ECHO::PING_PAYLOAD_TEST');
    tunnel.destroy();
  });

  it('should handle concurrent circuit checks efficiently without collision', async () => {
    const tor = new TorManager({
      socksHost: '127.0.0.1',
      socksPort: proxyPort,
      timeoutMs: 3000
    });

    const checks = await Promise.all([
      tor.checkSocksProxy(),
      tor.checkSocksProxy(),
      tor.checkSocksProxy(),
      tor.checkSocksProxy()
    ]);

    for (const check of checks) {
      assert.equal(check.status, 'CONNECTED');
      assert.ok(typeof check.latencyMs === 'number');
    }
  });

  it('should integrate with GameEngine state pipeline and report network status', async () => {
    const tor = new TorManager({
      socksHost: '127.0.0.1',
      socksPort: proxyPort
    });

    let reportedNetworkLatency: number | undefined = undefined;

    // Custom network monitoring middleware
    const networkMiddleware: Middleware = (getState) => (next) => (action) => {
      next(action);
      if (action.type === 'TICK') {
        const torStatus = tor.getStatus();
        reportedNetworkLatency = torStatus.latencyMs;
      }
    };

    const engine = new GameEngine({
      middlewares: [networkMiddleware]
    });

    // Run healthcheck
    await tor.checkSocksProxy();

    // Trigger tick
    engine.dispatch({
      type: 'TICK',
      deltaSeconds: 1,
      currentEpochMs: Date.now()
    });

    assert.ok(reportedNetworkLatency !== undefined);
  });
});
