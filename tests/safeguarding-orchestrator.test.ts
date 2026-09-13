import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  IntakeGate,
  AuditLedger,
  FactExtractionEngine,
  RiskEvaluator,
  ModuleEasyOrchestrator,
} from '../src/safeguarding';

describe('Intake Gate & Audit Ledger', () => {
  it('should accept valid report payloads and compute content hash', () => {
    const gate = new IntakeGate();
    const result = gate.processIntake({
      sourceType: 'USER_REPORT',
      timestamp: new Date().toISOString(),
      sourceIdentifier: 'ANON_USER_123',
      rawContent: 'Observed absence during scheduled check-in.',
      observedBehaviors: ['Missed check-in'],
    });

    assert.equal(result.status, 'ACCEPTED');
    assert.ok(result.record);
    assert.ok(result.record.intakeId.startsWith('INTAKE-'));
    assert.equal(typeof result.record.contentHash, 'string');
    assert.equal(result.record.contentHash.length, 64);
  });

  it('should reject invalid or future timestamps', () => {
    const gate = new IntakeGate();
    const futureDate = new Date(Date.now() + 100000).toISOString();
    const result = gate.processIntake({
      sourceType: 'USER_REPORT',
      timestamp: futureDate,
      sourceIdentifier: 'USER_1',
      rawContent: 'Test content',
      observedBehaviors: ['Behavior 1'],
    });

    assert.equal(result.status, 'REJECTED');
    assert.match(result.error || '', /future/i);
  });

  it('should maintain a verifiable SHA-256 hash chain in Audit Ledger', () => {
    const ledger = new AuditLedger();
    assert.equal(ledger.verifyIntegrity().isValid, true);

    ledger.append({
      action: 'INTAKE_INGESTED',
      caseOrIntakeId: 'INTAKE_001',
      operatorId: 'OP_1',
      details: { sample: 'data1' },
    });

    ledger.append({
      action: 'ASSESSMENT_CREATED',
      caseOrIntakeId: 'CASE_001',
      operatorId: 'OP_2',
      details: { sample: 'data2' },
    });

    const verification = ledger.verifyIntegrity();
    assert.equal(verification.isValid, true);
    assert.equal(ledger.getEntries().length, 3); // Genesis + 2 entries
  });
});

describe('Fact Extraction & Statement Separation', () => {
  it('should segregate objective observations from subjective interpretations', () => {
    const extractor = new FactExtractionEngine();
    const extracted = extractor.process({
      intakeId: 'INTAKE_MOCK_1',
      sourceType: 'INTERNAL_OBSERVATION',
      ingestedAt: new Date().toISOString(),
      eventTimestamp: new Date().toISOString(),
      sanitizedBehaviors: ['Unexcused absence recorded at 14:00'],
      sanitizedNotes: 'I think the subject was avoiding staff. Physical safety gear was left behind.',
      contentHash: 'mockhash',
    });

    assert.equal(extracted.factualObservations.length, 2);
    assert.ok(extracted.factualObservations.includes('Physical safety gear was left behind.'));
    assert.equal(extracted.subjectiveContext.length, 1);
    assert.ok(extracted.subjectiveContext[0].includes('I think the subject was avoiding staff'));
    assert.ok(extracted.objectivityRatio > 0);
  });

  it('should flag immediate risk keywords in extraction', () => {
    const extractor = new FactExtractionEngine();
    const extracted = extractor.process({
      intakeId: 'INTAKE_MOCK_2',
      sourceType: 'USER_REPORT',
      ingestedAt: new Date().toISOString(),
      eventTimestamp: new Date().toISOString(),
      sanitizedBehaviors: ['Visible physical injury reported'],
      sanitizedNotes: 'Subject had burn marks and was unresponsive.',
      contentHash: 'mockhash',
    });

    assert.equal(extracted.containsImmediateRiskKeywords, true);
    assert.ok(extracted.flaggedKeywords.includes('injury') || extracted.flaggedKeywords.includes('unresponsive'));
  });
});

describe('Risk Evaluator', () => {
  it('should evaluate low risk cases and recommend documentation/close', () => {
    const evaluator = new RiskEvaluator();
    const result = evaluator.evaluate({
      intakeId: 'INTAKE_LOW',
      extractedAt: new Date().toISOString(),
      factualObservations: ['Subject arrived 5 minutes late.'],
      subjectiveContext: [],
      discardedStatements: [],
      objectivityRatio: 1.0,
      containsImmediateRiskKeywords: false,
      flaggedKeywords: [],
    });

    assert.equal(result.riskRating, 'LOW');
    assert.equal(result.triageDecision, 'CLOSE_UNSUBSTANTIATED');
    assert.equal(result.mandatoryDualSignoffRequired, false);
  });

  it('should escalate critical danger with mandatory dual sign-off', () => {
    const evaluator = new RiskEvaluator();
    const result = evaluator.evaluate({
      intakeId: 'INTAKE_CRIT',
      extractedAt: new Date().toISOString(),
      factualObservations: [
        'Unresponsive individual found in restricted area.',
        'Visible physical trauma documented.',
        'Direct threat communicated.',
      ],
      subjectiveContext: [],
      discardedStatements: [],
      objectivityRatio: 1.0,
      containsImmediateRiskKeywords: true,
      flaggedKeywords: ['threat', 'unresponsive'],
    }, {
      hasDirectWitness: true,
      historyOfSimilarIncidents: false,
      vulnerabilityIndicatorsPresent: true,
    });

    assert.equal(result.riskRating, 'CRITICAL_IMMEDIATE');
    assert.equal(result.triageDecision, 'REFER_EXTERNAL');
    assert.equal(result.recommendedPathway, 'STATUTORY_EMERGENCY_SERVICES');
    assert.equal(result.mandatoryDualSignoffRequired, true);
  });
});

describe('ModuleEasyOrchestrator End-to-End Workflow', () => {
  it('should process intake through risk assessment and enforce two-person integrity on referral', () => {
    const orchestrator = new ModuleEasyOrchestrator();

    // 1. Process Report
    const res = orchestrator.processReport(
      {
        sourceType: 'INTERNAL_OBSERVATION',
        timestamp: new Date().toISOString(),
        sourceIdentifier: 'OBSERVER_42',
        rawContent: 'Physical injury observed on subject. Missing mandatory check-in.',
        observedBehaviors: ['Physical trauma', 'Missed appointment'],
      },
      'ASSESSOR_ALICE',
      { hasDirectWitness: true, historyOfSimilarIncidents: false, vulnerabilityIndicatorsPresent: true }
    );

    assert.equal(res.success, true);
    assert.ok(res.caseRecord);
    const caseId = res.caseRecord.caseId;

    // 2. Prevent self-authorization (Two-person integrity violation)
    const selfAuth = orchestrator.authorizeReferral(caseId, 'ASSESSOR_ALICE');
    assert.equal(selfAuth.success, false);
    assert.match(selfAuth.error || '', /Two-Person.*violation|Governance Violation/i);

    // 3. Authorize with distinct secondary approver
    const validAuth = orchestrator.authorizeReferral(caseId, 'SUPERVISOR_BOB', 'Confirmed escalation pathway.');
    assert.equal(validAuth.success, true);
    assert.ok(validAuth.handoff);
    assert.equal(validAuth.handoff.dualSignoffVerified, true);
    assert.equal(validAuth.handoff.decision, 'REFER_EXTERNAL');

    // 4. Verify ledger chain
    const ledgerIntegrity = orchestrator.getAuditLedger().verifyIntegrity();
    assert.equal(ledgerIntegrity.isValid, true);
  });

  it('should allow closing non-critical cases', () => {
    const orchestrator = new ModuleEasyOrchestrator();

    const res = orchestrator.processReport(
      {
        sourceType: 'USER_REPORT',
        timestamp: new Date().toISOString(),
        sourceIdentifier: 'OBSERVER_10',
        rawContent: 'Just a routine inquiry with no incidents.',
        observedBehaviors: ['Routine inquiry'],
      },
      'ASSESSOR_CLAIRE'
    );

    assert.equal(res.success, true);
    assert.ok(res.caseRecord);

    const closed = orchestrator.closeCase(res.caseRecord.caseId, 'ASSESSOR_CLAIRE', 'Non-actionable routine inquiry.');
    assert.equal(closed, true);

    const updatedCase = orchestrator.getCase(res.caseRecord.caseId);
    assert.equal(updatedCase?.status, 'CLOSED');
  });
});
