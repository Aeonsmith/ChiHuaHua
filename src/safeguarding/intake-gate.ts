import { createHash, randomUUID } from 'crypto';

export type SourceType = 'INTERNAL_OBSERVATION' | 'USER_REPORT' | 'EXTERNAL_REFERRAL';
export type IntakeStatus = 'ACCEPTED' | 'REJECTED';

export interface RawIntakePayload {
  sourceType: SourceType;
  timestamp: string;
  sourceIdentifier: string;
  rawContent: string;
  observedBehaviors: string[];
}

export interface ValidatedIntakeRecord {
  intakeId: string;
  sourceType: SourceType;
  ingestedAt: string;
  eventTimestamp: string;
  sanitizedBehaviors: string[];
  sanitizedNotes: string;
  contentHash: string;
}

export interface AuditRecordPayload {
  action: 'INTAKE_INGESTED' | 'ASSESSMENT_CREATED' | 'DUAL_SIGNOFF_APPLIED' | 'CASE_CLOSED' | 'CASE_REFERRED';
  caseOrIntakeId: string;
  operatorId: string;
  details: Record<string, unknown>;
  secondarySignature?: string;
}

export interface AuditLedgerEntry {
  sequenceNumber: number;
  timestamp: string;
  payload: AuditRecordPayload;
  previousHash: string;
  entryHash: string;
}

export class IntakeGate {
  private static readonly MAX_NOTE_LENGTH = 10000;

  public processIntake(payload: RawIntakePayload): { status: IntakeStatus; record?: ValidatedIntakeRecord; error?: string } {
    const parsedDate = Date.parse(payload.timestamp);
    if (isNaN(parsedDate)) {
      return { status: 'REJECTED', error: 'Invalid ISO-8601 timestamp format.' };
    }
    if (parsedDate > Date.now() + 5000) {
      return { status: 'REJECTED', error: 'Timestamp cannot be in the future.' };
    }

    if (!payload.sourceIdentifier || payload.sourceIdentifier.trim().length === 0) {
      return { status: 'REJECTED', error: 'Source identifier must not be empty.' };
    }

    if (!Array.isArray(payload.observedBehaviors) || payload.observedBehaviors.length === 0) {
      return { status: 'REJECTED', error: 'At least one observed behavior entry is required.' };
    }

    if (payload.rawContent.length > IntakeGate.MAX_NOTE_LENGTH) {
      return { status: 'REJECTED', error: `Content exceeds maximum allowed limit of ${IntakeGate.MAX_NOTE_LENGTH} characters.` };
    }

    const sanitizedNotes = this.sanitizeText(payload.rawContent);
    const sanitizedBehaviors = payload.observedBehaviors.map((b) => this.sanitizeText(b)).filter((b) => b.length > 0);

    const intakeId = `INTAKE-${randomUUID()}`;
    const ingestedAt = new Date().toISOString();

    const contentHash = createHash('sha256')
      .update(`${intakeId}:${payload.sourceType}:${payload.timestamp}:${sanitizedNotes}`)
      .digest('hex');

    const record: ValidatedIntakeRecord = {
      intakeId,
      sourceType: payload.sourceType,
      ingestedAt,
      eventTimestamp: new Date(parsedDate).toISOString(),
      sanitizedBehaviors,
      sanitizedNotes,
      contentHash,
    };

    return { status: 'ACCEPTED', record };
  }

  private sanitizeText(input: string): string {
    return input.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '').trim();
  }
}

export class AuditLedger {
  private ledger: AuditLedgerEntry[] = [];
  private static readonly GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

  constructor() {
    const genesisEntry: AuditLedgerEntry = {
      sequenceNumber: 0,
      timestamp: new Date().toISOString(),
      payload: {
        action: 'INTAKE_INGESTED',
        caseOrIntakeId: 'GENESIS',
        operatorId: 'SYSTEM',
        details: { description: 'Audit Ledger Initialized' },
      },
      previousHash: AuditLedger.GENESIS_HASH,
      entryHash: '',
    };
    genesisEntry.entryHash = this.computeHash(
      genesisEntry.sequenceNumber,
      genesisEntry.timestamp,
      genesisEntry.payload,
      genesisEntry.previousHash
    );
    this.ledger.push(genesisEntry);
  }

  public append(payload: AuditRecordPayload): AuditLedgerEntry {
    const previousEntry = this.ledger[this.ledger.length - 1];
    const sequenceNumber = previousEntry.sequenceNumber + 1;
    const timestamp = new Date().toISOString();

    const entryHash = this.computeHash(sequenceNumber, timestamp, payload, previousEntry.entryHash);

    const entry: AuditLedgerEntry = {
      sequenceNumber,
      timestamp,
      payload,
      previousHash: previousEntry.entryHash,
      entryHash,
    };

    this.ledger.push(entry);
    return entry;
  }

  public verifyIntegrity(): { isValid: boolean; brokenSequence?: number } {
    for (let i = 1; i < this.ledger.length; i++) {
      const current = this.ledger[i];
      const previous = this.ledger[i - 1];

      if (current.previousHash !== previous.entryHash) {
        return { isValid: false, brokenSequence: current.sequenceNumber };
      }

      const expectedHash = this.computeHash(
        current.sequenceNumber,
        current.timestamp,
        current.payload,
        current.previousHash
      );

      if (current.entryHash !== expectedHash) {
        return { isValid: false, brokenSequence: current.sequenceNumber };
      }
    }

    return { isValid: true };
  }

  public getEntries(): ReadonlyArray<AuditLedgerEntry> {
    return Object.freeze([...this.ledger]);
  }

  private computeHash(seq: number, timestamp: string, payload: AuditRecordPayload, prevHash: string): string {
    const serialized = JSON.stringify({ seq, timestamp, payload, prevHash });
    return createHash('sha256').update(serialized).digest('hex');
  }
}
