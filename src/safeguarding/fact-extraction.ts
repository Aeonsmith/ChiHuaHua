import { ValidatedIntakeRecord } from './intake-gate';

export type StatementClassification = 'OBJECTIVE_OBSERVATION' | 'SUBJECTIVE_INTERPRETATION' | 'UNVERIFIABLE_SPECULATION';

export interface AnalyzedStatement {
  originalText: string;
  cleanedText: string;
  classification: StatementClassification;
  confidenceScore: number;
  conjectureMarkers: string[];
}

export interface ExtractedFactPayload {
  intakeId: string;
  extractedAt: string;
  factualObservations: string[];
  subjectiveContext: string[];
  discardedStatements: string[];
  objectivityRatio: number;
  containsImmediateRiskKeywords: boolean;
  flaggedKeywords: string[];
}

export class FactExtractionEngine {
  private static readonly SUBJECTIVE_MARKERS = [
    'i think', 'i feel', 'seems like', 'probably', 'maybe',
    'i believe', 'suspect', 'assumed', 'might be', 'could be',
    'appeared angry', 'looks suspicious', 'rumor', 'heard that'
  ];

  private static readonly IMMEDIATE_RISK_KEYWORDS = [
    'immediate danger', 'physical harm', 'threat', 'emergency',
    'unresponsive', 'abandoned', 'injury', 'violence', 'abuse'
  ];

  private static readonly INFLAMMATORY_PATTERNS = [
    /\b(obviously guilty|monster|criminal|evil|liar)\b/gi
  ];

  public process(intake: ValidatedIntakeRecord): ExtractedFactPayload {
    const rawStatements = this.splitIntoStatements(intake.sanitizedNotes);
    const combinedInput = [...intake.sanitizedBehaviors, ...rawStatements];

    const factualObservations: string[] = [];
    const subjectiveContext: string[] = [];
    const discardedStatements: string[] = [];
    const flaggedKeywords: Set<string> = new Set();

    for (const statement of combinedInput) {
      const sanitized = this.cleanInflammatoryText(statement);
      if (sanitized.length < 3) {
        discardedStatements.push(statement);
        continue;
      }

      this.scanRiskKeywords(sanitized, flaggedKeywords);

      const analyzed = this.analyzeStatement(sanitized);

      if (analyzed.classification === 'OBJECTIVE_OBSERVATION') {
        factualObservations.push(analyzed.cleanedText);
      } else if (analyzed.classification === 'SUBJECTIVE_INTERPRETATION') {
        subjectiveContext.push(analyzed.cleanedText);
      } else {
        discardedStatements.push(statement);
      }
    }

    const totalValid = factualObservations.length + subjectiveContext.length;
    const objectivityRatio = totalValid > 0 ? factualObservations.length / totalValid : 0;

    return {
      intakeId: intake.intakeId,
      extractedAt: new Date().toISOString(),
      factualObservations,
      subjectiveContext,
      discardedStatements,
      objectivityRatio: Math.round(objectivityRatio * 100) / 100,
      containsImmediateRiskKeywords: flaggedKeywords.size > 0,
      flaggedKeywords: Array.from(flaggedKeywords),
    };
  }

  private analyzeStatement(text: string): AnalyzedStatement {
    const lower = text.toLowerCase();
    const matchedMarkers: string[] = [];

    for (const marker of FactExtractionEngine.SUBJECTIVE_MARKERS) {
      if (lower.includes(marker)) {
        matchedMarkers.push(marker);
      }
    }

    let classification: StatementClassification = 'OBJECTIVE_OBSERVATION';
    let confidence = 0.9;

    if (matchedMarkers.length > 0) {
      classification = 'SUBJECTIVE_INTERPRETATION';
      confidence = Math.max(0.6, 1.0 - matchedMarkers.length * 0.15);
    }

    return {
      originalText: text,
      cleanedText: text,
      classification,
      confidenceScore: confidence,
      conjectureMarkers: matchedMarkers,
    };
  }

  private cleanInflammatoryText(text: string): string {
    let sanitized = text;
    for (const pattern of FactExtractionEngine.INFLAMMATORY_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[REDACTED_SUBJECTIVE]');
    }
    return sanitized.trim();
  }

  private splitIntoStatements(text: string): string[] {
    return text
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  private scanRiskKeywords(text: string, accumulator: Set<string>): void {
    const lower = text.toLowerCase();
    for (const keyword of FactExtractionEngine.IMMEDIATE_RISK_KEYWORDS) {
      if (lower.includes(keyword)) {
        accumulator.add(keyword);
      }
    }
  }
}
