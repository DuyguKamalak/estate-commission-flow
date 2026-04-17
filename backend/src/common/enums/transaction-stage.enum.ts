/**
 * Lifecycle stages of a property transaction, in strict forward order.
 *
 * Transitions are validated in the domain layer. Valid transitions are:
 *   AGREEMENT -> EARNEST_MONEY -> TITLE_DEED -> COMPLETED
 *
 * Any backward move, skipped stage, or change after COMPLETED is rejected
 * with `ErrorCode.INVALID_STAGE_TRANSITION`.
 */
export enum TransactionStage {
  AGREEMENT = 'agreement',
  EARNEST_MONEY = 'earnest_money',
  TITLE_DEED = 'title_deed',
  COMPLETED = 'completed',
}

export const TRANSACTION_STAGE_ORDER: readonly TransactionStage[] = [
  TransactionStage.AGREEMENT,
  TransactionStage.EARNEST_MONEY,
  TransactionStage.TITLE_DEED,
  TransactionStage.COMPLETED,
] as const;
