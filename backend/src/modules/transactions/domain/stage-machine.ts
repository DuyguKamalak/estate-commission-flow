import { ErrorCode } from '../../../common/enums/error-code.enum';
import { DomainException } from '../../../common/exceptions/domain.exception';
import {
  TRANSACTION_STAGE_ORDER,
  TransactionStage,
} from '../../../common/enums/transaction-stage.enum';

/**
 * Pure state-machine for the transaction lifecycle.
 *
 * The business rule from the brief is deliberately strict:
 *
 *     agreement  ->  earnest_money  ->  title_deed  ->  completed
 *
 * - Forward-only, one step at a time (no skipping stages).
 * - No-op transitions (same -> same) are rejected: every transition must
 *   cause a visible change recorded in TransactionStageHistory.
 * - `completed` is terminal. Once a transaction is completed, no further
 *   stage changes are permitted.
 *
 * Violations surface as `DomainException(INVALID_STAGE_TRANSITION)` so the
 * global filter returns a consistent HTTP 400 shape; callers never need to
 * branch on internal machinery.
 */

/** Describes the single valid next step from a given stage, if any. */
export function nextStage(current: TransactionStage): TransactionStage | null {
  const idx = TRANSACTION_STAGE_ORDER.indexOf(current);
  if (idx === -1) {
    return null;
  }
  return TRANSACTION_STAGE_ORDER[idx + 1] ?? null;
}

/**
 * Validates the proposed transition and throws a DomainException with a
 * descriptive message on failure. Returns `void` on success so callers can
 * use it as a guard.
 */
export function assertValidStageTransition(
  from: TransactionStage,
  to: TransactionStage,
): void {
  if (!TRANSACTION_STAGE_ORDER.includes(from)) {
    throw new DomainException(
      ErrorCode.INVALID_STAGE_TRANSITION,
      `Unknown current stage: ${String(from)}`,
    );
  }
  if (!TRANSACTION_STAGE_ORDER.includes(to)) {
    throw new DomainException(
      ErrorCode.INVALID_STAGE_TRANSITION,
      `Unknown target stage: ${String(to)}`,
    );
  }

  if (from === TransactionStage.COMPLETED) {
    throw new DomainException(
      ErrorCode.INVALID_STAGE_TRANSITION,
      'Transaction is already completed; no further stage changes are allowed.',
    );
  }

  if (from === to) {
    throw new DomainException(
      ErrorCode.INVALID_STAGE_TRANSITION,
      `Transaction is already in stage "${from}"; transition is a no-op.`,
    );
  }

  const expected = nextStage(from);
  if (expected === null || expected !== to) {
    throw new DomainException(
      ErrorCode.INVALID_STAGE_TRANSITION,
      `Invalid stage transition: "${from}" can only advance to "${expected ?? '(none)'}", not "${to}".`,
    );
  }
}

/** Convenience boolean form — useful when building UI option lists. */
export function canTransition(
  from: TransactionStage,
  to: TransactionStage,
): boolean {
  try {
    assertValidStageTransition(from, to);
    return true;
  } catch {
    return false;
  }
}

/** True once the transaction has reached the terminal `completed` stage. */
export function isTerminalStage(stage: TransactionStage): boolean {
  return stage === TransactionStage.COMPLETED;
}
