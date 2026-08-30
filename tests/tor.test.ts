import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as net from 'node:net';
import { TorManager } from '../src/network/tor-manager';

describe('Tor Onion Network Integration', () => {
  let mockServer: net.Server;
  let mockPort: number;

  before((_, done) => {
    // Spin up a mock SOCKS5 proxy server on an ephemeral port
    mockServer = net.createServer((socket) => {
      let phase = 'GREETING';

      socket.on('data', (data) => {
        if (phase === 'GREETING') {
          // Expecting [0x05, 0x01, 0x00]
          if (data[0] === 0x05) {
            // Reply: [0x05, 0x00] (No auth required)
            socket.write(Buffer.from([0x05, 0x00]));
            phase = 'CONNECT';
          }
        } else if (phase === 'CONNECT') {
          // SOCKS5 CONNECT command: [0x05, 0x01, 0x00, ...]
          // Reply: [0x05, 0x00 (SUCCESS), 0x00 (RSV), 0x01 (IPv4), 127, 0, 0, 1, port_hi, port_lo]
          socket.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 127, 0, 0, 1, 0x1f, 0x90]));
        }
      });
    });

    mockServer.listen(0, '127.0.0.1', () => {
      const addr = mockServer.address() as net.AddressInfo;
      mockPort = addr.port;
      done();
    });
  });

  after((_, done) => {
    mockServer.close(done);
  });

  it('should initialize with default configurations and allow updates', () => {
    const tor = new TorManager();
    const config = tor.getConfig();

    assert.equal(config.enabled, true);
    assert.equal(config.socksHost, '127.0.0.1');
    assert.equal(config.socksPort, 9050);

    tor.setConfig({ socksPort: 9150 });
    assert.equal(tor.getConfig().socksPort, 9150);
  });

  it('should accurately validate Tor v3 .onion addresses', () => {
    const tor = new TorManager();

    // Valid 56-char base32 address
    const validOnion = 'expyuzz5wqqfdgah56trgahqdhlcxbeghie3k4p56trgahqdhlcxbegh.onion';
    assert.equal(tor.isValidV3Onion(validOnion), true);

    // Invalid length
    assert.equal(tor.isValidV3Onion('short.onion'), false);

    // Invalid characters (e.g. '8', '9', '1' are not standard base32)
    assert.equal(tor.isValidV3Onion('1899uzz5wqqfdgah56trgahqdhlcxbeghie3k4p56trgahqdhlcxbegh.onion'), false);

    // Invalid extension
    assert.equal(tor.isValidV3Onion('expyuzz5wqqfdgah56trgahqdhlcxbeghie3k4p56trgahqdhlcxbegh.com'), false);
  });

  it('should report DISCONNECTED status when Tor integration is disabled', async () => {
    const tor = new TorManager({ enabled: false });
    const info = await tor.checkSocksProxy();

    assert.equal(info.status, 'DISCONNECTED');
    assert.ok(info.errorMessage?.includes('disabled'));
  });

  it('should complete SOCKS5 handshake against active Tor proxy', async () => {
    const tor = new TorManager({
      socksHost: '127.0.0.1',
      socksPort: mockPort,
      timeoutMs: 2000
    });

    const info = await tor.checkSocksProxy();
    assert.equal(info.status, 'CONNECTED');
    assert.ok(typeof info.latencyMs === 'number');
  });

  it('should establish a SOCKS5 tunnel through the proxy to a target domain', async () => {
    const tor = new TorManager({
      socksHost: '127.0.0.1',
      socksPort: mockPort,
      timeoutMs: 2000
    });

    const tunnel = await tor.createSocksTunnel('target.onion', 80);
    assert.ok(tunnel);
    assert.equal(tor.getStatus().status, 'CIRCUIT_ESTABLISHED');
    tunnel.destroy();
  });

  it('should gracefully handle connection failure when proxy is offline', async () => {
    const tor = new TorManager({
      socksHost: '127.0.0.1',
      socksPort: 59999, // Unused port
      timeoutMs: 500
    });

    const info = await tor.checkSocksProxy();
    assert.equal(info.status, 'FAILED');
    assert.ok(info.errorMessage);
  });
});
