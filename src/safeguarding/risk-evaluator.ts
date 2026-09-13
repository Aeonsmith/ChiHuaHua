import { ExtractedFactPayload } from './fact-extraction';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL_IMMEDIATE';
export type TriageDecision = 'DOCUMENT_ONLY' | 'REFER_EXTERNAL' | 'CLOSE_UNSUBSTANTIATED';
export type ReferralPathway = 'STATUTORY_EMERGENCY_SERVICES' | 'COMMUNITY_SAFEGUARDING_LEAD' | 'INTERNAL_SUPPORT_ONLY' | 'NONE';

export interface EvaluationCriteria {
  hasDirectWitness: boolean;
  historyOfSimilarIncidents: boolean;
  vulnerabilityIndicatorsPresent: boolean;
}

export interface RiskEvaluationResult {
  evaluationId: string;
  intakeId: string;
  evaluatedAt: string;
  riskRating: RiskLevel;
  numericRiskScore: number;
  credibilityScore: number;
  immediateDangerFlag: boolean;
  triageDecision: TriageDecision;
  recommendedPathway: ReferralPathway;
  mandatoryDualSignoffRequired: boolean;
  reviewDeadlineIso: string;
  reasoningNotes: string[];
}

export class RiskEvaluator {
  private static readonly CRITICAL_THRESHOLD = 80;
  private static readonly HIGH_THRESHOLD = 55;
  private static readonly MEDIUM_THRESHOLD = 30;

  public evaluate(
    extracted: ExtractedFactPayload,
    criteria: EvaluationCriteria = { hasDirectWitness: false, historyOfSimilarIncidents: false, vulnerabilityIndicatorsPresent: false }
  ): RiskEvaluationResult {
    const reasoningNotes: string[] = [];
    let score = 0;

    const immediateDangerFlag = extracted.containsImmediateRiskKeywords;
    if (immediateDangerFlag) {
      score += 50;
      reasoningNotes.push(`Immediate safety trigger detected: [${extracted.flaggedKeywords.join(', ')}]`);
    }

    const factCount = extracted.factualObservations.length;
    if (factCount >= 4) {
      score += 25;
      reasoningNotes.push(`High density of verifiable observations (${factCount} items).`);
    } else if (factCount >= 2) {
      score += 15;
      reasoningNotes.push(`Moderate density of verifiable observations (${factCount} items).`);
    } else if (factCount === 0) {
      reasoningNotes.push('No verifiable factual statements identified.');
    }

    let credibilityScore = extracted.objectivityRatio;
    if (criteria.hasDirectWitness) {
      credibilityScore = Math.min(1.0, credibilityScore + 0.15);
      score += 10;
      reasoningNotes.push('Direct witness corroboration present.');
    }

    if (criteria.vulnerabilityIndicatorsPresent) {
      score += 15;
      reasoningNotes.push('Vulnerability indicators documented.');
    }
    if (criteria.historyOfSimilarIncidents) {
      score += 10;
      reasoningNotes.push('Prior recurring incidents noted.');
    }

    const finalScore = Math.min(100, Math.max(0, score));
    const riskRating = this.computeRiskLevel(finalScore, immediateDangerFlag);
    const triageDecision = this.computeTriageDecision(riskRating, credibilityScore, factCount);
    const recommendedPathway = this.determineReferralPathway(riskRating, triageDecision);
    const mandatoryDualSignoffRequired = riskRating === 'CRITICAL_IMMEDIATE' || riskRating === 'HIGH' || triageDecision === 'REFER_EXTERNAL';
    const reviewDeadlineIso = this.calculateReviewDeadline(riskRating);

    return {
      evaluationId: `EVAL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      intakeId: extracted.intakeId,
      evaluatedAt: new Date().toISOString(),
      riskRating,
      numericRiskScore: finalScore,
      credibilityScore: Math.round(credibilityScore * 100) / 100,
      immediateDangerFlag,
      triageDecision,
      recommendedPathway,
      mandatoryDualSignoffRequired,
      reviewDeadlineIso,
      reasoningNotes,
    };
  }

  private computeRiskLevel(score: number, immediateDanger: boolean): RiskLevel {
    if (immediateDanger || score >= RiskEvaluator.CRITICAL_THRESHOLD) {
      return 'CRITICAL_IMMEDIATE';
    }
    if (score >= RiskEvaluator.HIGH_THRESHOLD) {
      return 'HIGH';
    }
    if (score >= RiskEvaluator.MEDIUM_THRESHOLD) {
      return 'MEDIUM';
    }
    return 'LOW';
  }

  private computeTriageDecision(risk: RiskLevel, credibility: number, factCount: number): TriageDecision {
    if (factCount === 0 && credibility < 0.2) {
      return 'CLOSE_UNSUBSTANTIATED';
    }
    if (risk === 'CRITICAL_IMMEDIATE' || risk === 'HIGH') {
      return 'REFER_EXTERNAL';
    }
    if (risk === 'MEDIUM') {
      return 'DOCUMENT_ONLY';
    }
    return 'CLOSE_UNSUBSTANTIATED';
  }

  private determineReferralPathway(risk: RiskLevel, decision: TriageDecision): ReferralPathway {
    if (decision !== 'REFER_EXTERNAL') {
      return decision === 'DOCUMENT_ONLY' ? 'INTERNAL_SUPPORT_ONLY' : 'NONE';
    }
    if (risk === 'CRITICAL_IMMEDIATE') {
      return 'STATUTORY_EMERGENCY_SERVICES';
    }
    return 'COMMUNITY_SAFEGUARDING_LEAD';
  }

  private calculateReviewDeadline(risk: RiskLevel): string {
    const now = new Date();
    switch (risk) {
      case 'CRITICAL_IMMEDIATE':
        now.setHours(now.getHours() + 4);
        break;
      case 'HIGH':
        now.setHours(now.getHours() + 24);
        break;
      case 'MEDIUM':
        now.setDate(now.getDate() + 7);
        break;
      case 'LOW':
        now.setDate(now.getDate() + 30);
        break;
    }
    return now.toISOString();
  }
}
