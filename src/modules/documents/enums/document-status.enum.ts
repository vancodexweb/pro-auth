export enum DocumentStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  POSTED = 'POSTED',
  CANCELLED = 'CANCELLED',
  REVERSED = 'REVERSED',
}

/**
 * DRAFT/REJECTED are the only editable states. Once SUBMITTED a document is
 * locked pending a decision; once POSTED it is immutable forever - the only
 * way to change its financial effect is `reverse()`, which produces a new
 * document, never an edit of this row.
 */
export const ALLOWED_DOCUMENT_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  [DocumentStatus.DRAFT]: [DocumentStatus.SUBMITTED, DocumentStatus.CANCELLED],
  [DocumentStatus.SUBMITTED]: [DocumentStatus.APPROVED, DocumentStatus.REJECTED],
  [DocumentStatus.APPROVED]: [DocumentStatus.POSTED, DocumentStatus.CANCELLED],
  [DocumentStatus.REJECTED]: [DocumentStatus.DRAFT],
  [DocumentStatus.POSTED]: [DocumentStatus.REVERSED],
  [DocumentStatus.CANCELLED]: [],
  [DocumentStatus.REVERSED]: [],
};

export const EDITABLE_STATUSES: DocumentStatus[] = [DocumentStatus.DRAFT, DocumentStatus.REJECTED];
