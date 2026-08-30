import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TerminalRenderer } from '../src/ui/terminal-renderer';
import { GameEngine } from '../src/engine/engine';
import { TorCircuitInfo } from '../src/types';

describe('UI & Terminal Visualization Layer', () => {
  it('should format currency correctly', () => {
    const renderer = new TerminalRenderer();
    assert.equal(renderer.formatCurrency(0), '$0.00');
    assert.equal(renderer.formatCurrency(123456), '$1,234.56');
    assert.equal(renderer.formatCurrency(100000000), '$1,000,000.00');
  });

  it('should generate ASCII progress bars accurately', () => {
    const renderer = new TerminalRenderer();
    const halfBar = renderer.renderProgressBar(0.5, 10);
    assert.ok(halfBar.includes('50%'));

    const fullBar = renderer.renderProgressBar(1.0, 10);
    assert.ok(fullBar.includes('100%'));

    const zeroBar = renderer.renderProgressBar(0.0, 10);
    assert.ok(zeroBar.includes('0%'));
  });

  it('should apply glitch noise when distortion exceeds threshold', () => {
    const renderer = new TerminalRenderer({ enableGlitchEffects: true });
    const cleanText = 'OPERATIONAL_STATUS_CLEAN';

    // Distortion = 0 -> no glitch
    const noGlitch = renderer.applyGlitch(cleanText, 0.0);
    assert.equal(noGlitch, cleanText);

    // Distortion = 0.80 -> glitch characters introduced
    const glitched = renderer.applyGlitch(cleanText, 0.80);
    assert.ok(glitched.length >= cleanText.length);
  });

  it('should render the full terminal dashboard without throwing', () => {
    const engine = new GameEngine();
    const renderer = new TerminalRenderer();

    const mockTorStatus: TorCircuitInfo = {
      status: 'CONNECTED',
      proxyAddress: '127.0.0.1:9050',
      targetOnion: 'sampleoniondomain56charslengthtestsampledomain12345.onion',
      latencyMs: 142,
      lastCheckedEpochMs: Date.now()
    };

    const output = renderer.renderDashboard(engine.getState(), mockTorStatus);

    assert.ok(output.includes('UNDERGROUND'));
    assert.ok(output.includes('CONNECTED'));
    assert.ok(output.includes('142ms'));
    assert.ok(output.includes('CAPITAL / LIQUIDITY:'));
    assert.ok(output.includes('SANITY / CLARITY:'));
    assert.ok(output.includes('LEGAL HEAT:'));
    assert.ok(output.includes('Abandoned VHF Station'));
  });
});
