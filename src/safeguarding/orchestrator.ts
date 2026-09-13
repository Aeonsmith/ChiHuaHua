import { randomUUID } from 'crypto';
import { IntakeGate, RawIntakePayload, ValidatedIntakeRecord, AuditLedger } from './intake-gate';
import { FactExtractionEngine, ExtractedFactPayload } from './fact-extraction';
import { RiskEvaluator, RiskEvaluationResult, EvaluationCriteria, RiskLevel, TriageDecision } from './risk-evaluator';

export type CaseStatus = 'INTAKE_ACCEPTED' | 'EVALUATED_PENDING_REVIEW' | 'CLOSED' | 'REFERRED_AUTHORIZED';

export interface FinalCaseRecord {
  caseId: string;
  intakeRecord: ValidatedIntakeRecord;
  extractedFacts: ExtractedFactPayload;
  riskEvaluation: RiskEvaluationResult;
  status: CaseStatus;
  primaryAssessorId: string;
  secondaryApproverId?: string;
  assessorSignature: string;
  approverSignature?: string;
  createdAt: string;
  finalizedAt?: string;
}

export interface HandoffPackage {
  caseId: string;
  timestamp: string;
  decision: TriageDecision;
  riskRating: RiskLevel;
  pathway: string;
  factualSummary: string[];
  reviewDeadlineIso: string;
  dualSignoffVerified: boolean;
}

export class ModuleEasyOrchestrator {
  private intakeGate: IntakeGate;
  private factExtractor: FactExtractionEngine;
  private riskEvaluator: RiskEvaluator;
  private auditLedger: AuditLedger;
  private cases: Map<string, FinalCaseRecord> = new Map();

  constructor(
    intakeGate?: IntakeGate,
    factExtractor?: FactExtractionEngine,
    riskEvaluator?: RiskEvaluator,
    auditLedger?: AuditLedger
  ) {
    this.intakeGate = intakeGate ?? new IntakeGate();
    this.factExtractor = factExtractor ?? new FactExtractionEngine();
    this.riskEvaluator = riskEvaluator ?? new RiskEvaluator();
    this.auditLedger = auditLedger ?? new AuditLedger();
  }

  public processReport(
    rawPayload: RawIntakePayload,
    assessorId: string,
    contextCriteria?: EvaluationCriteria
  ): { success: boolean; caseRecord?: FinalCaseRecord; error?: string } {
    const intakeResult = this.intakeGate.processIntake(rawPayload);
    if (intakeResult.status !== 'ACCEPTED' || !intakeResult.record) {
      return { success: false, error: intakeResult.error || 'Intake rejected by gateway.' };
    }
    const intakeRecord = intakeResult.record;

    this.auditLedger.append({
      action: 'INTAKE_INGESTED',
      caseOrIntakeId: intakeRecord.intakeId,
      operatorId: assessorId,
      details: {
        sourceType: intakeRecord.sourceType,
        contentHash: intakeRecord.contentHash,
      },
    });

    const extractedFacts = this.factExtractor.process(intakeRecord);
    const riskEvaluation = this.riskEvaluator.evaluate(extractedFacts, contextCriteria);

    const caseId = `CASE-${randomUUID()}`;
    const initialStatus: CaseStatus = riskEvaluation.mandatoryDualSignoffRequired
      ? 'EVALUATED_PENDING_REVIEW'
      : riskEvaluation.triageDecision === 'CLOSE_UNSUBSTANTIATED'
      ? 'CLOSED'
      : 'EVALUATED_PENDING_REVIEW';

    const caseRecord: FinalCaseRecord = {
      caseId,
      intakeRecord,
      extractedFacts,
      riskEvaluation,
      status: initialStatus,
      primaryAssessorId: assessorId,
      assessorSignature: `SIG_${assessorId}_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    this.cases.set(caseId, caseRecord);

    this.auditLedger.append({
      action: 'ASSESSMENT_CREATED',
      caseOrIntakeId: caseId,
      operatorId: assessorId,
      details: {
        riskRating: riskEvaluation.riskRating,
        triageDecision: riskEvaluation.triageDecision,
        dualSignoffRequired: riskEvaluation.mandatoryDualSignoffRequired,
      },
    });

    return { success: true, caseRecord };
  }

  public authorizeReferral(
    caseId: string,
    approverId: string,
    notes?: string
  ): { success: boolean; handoff?: HandoffPackage; error?: string } {
    const existingCase = this.cases.get(caseId);
    if (!existingCase) {
      return { success: false, error: 'Case ID not found.' };
    }

    if (existingCase.primaryAssessorId === approverId) {
      return {
        success: false,
        error: 'Governance Violation: Approver ID must be distinct from primary Assessor ID.',
      };
    }

    if (existingCase.status === 'CLOSED') {
      return { success: false, error: 'Cannot authorize a closed case.' };
    }

    existingCase.secondaryApproverId = approverId;
    existingCase.approverSignature = `SIG_APPROV_${approverId}_${Date.now()}`;
    existingCase.status = 'REFERRED_AUTHORIZED';
    existingCase.finalizedAt = new Date().toISOString();

    this.auditLedger.append({
      action: 'DUAL_SIGNOFF_APPLIED',
      caseOrIntakeId: caseId,
      operatorId: approverId,
      secondarySignature: existingCase.approverSignature,
      details: {
        assessorId: existingCase.primaryAssessorId,
        approverNotes: notes || 'Authorized for formal escalation.',
      },
    });

    const handoff: HandoffPackage = {
      caseId: existingCase.caseId,
      timestamp: existingCase.finalizedAt,
      decision: existingCase.riskEvaluation.triageDecision,
      riskRating: existingCase.riskEvaluation.riskRating,
      pathway: existingCase.riskEvaluation.recommendedPathway,
      factualSummary: existingCase.extractedFacts.factualObservations,
      reviewDeadlineIso: existingCase.riskEvaluation.reviewDeadlineIso,
      dualSignoffVerified: true,
    };

    return { success: true, handoff };
  }

  public closeCase(caseId: string, operatorId: string, rationale: string): boolean {
    const existingCase = this.cases.get(caseId);
    if (!existingCase) return false;

    existingCase.status = 'CLOSED';
    existingCase.finalizedAt = new Date().toISOString();

    this.auditLedger.append({
      action: 'CASE_CLOSED',
      caseOrIntakeId: caseId,
      operatorId,
      details: { rationale },
    });

    return true;
  }

  public getCase(caseId: string): FinalCaseRecord | undefined {
    return this.cases.get(caseId);
  }

  public getAuditLedger(): AuditLedger {
    return this.auditLedger;
  }
}
