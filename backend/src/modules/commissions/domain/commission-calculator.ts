import { ErrorCode } from '../../../common/enums/error-code.enum';
import { DomainException } from '../../../common/exceptions/domain.exception';
import {
  MinorUnits,
  splitEqual,
  splitHalfInteger,
} from '../../../common/utils/money.util';

/**
 * Semantic label for a party on a commission breakdown row.
 *
 * - `listing`: the agent who originated / listed the property (different-agent case).
 * - `selling`: the agent who closed the sale (different-agent case).
 * - `listing_and_selling`: the SAME agent acted in both roles (same-agent case),
 *   in which case only ONE party row is emitted, with the full agent pool.
 */
export type CommissionPartyRole = 'listing' | 'selling' | 'listing_and_selling';

export interface CommissionPartyShare {
  agentId: string;
  role: CommissionPartyRole;
  share: MinorUnits;
  /** Human-readable rationale shown in the frontend breakdown table. */
  reason: string;
}

export interface CommissionCalculationInput {
  /** Total service fee, in minor units (e.g. pence for GBP). Must be a non-negative integer. */
  totalServiceFee: MinorUnits;
  /** ISO 4217 three-letter currency code. */
  currency: string;
  /** String identifier of the listing agent (ObjectId hex or business id). */
  listingAgentId: string;
  /** String identifier of the selling agent. Equal to listing when same agent closed both roles. */
  sellingAgentId: string;
}

export interface CommissionCalculationResult {
  totalServiceFee: MinorUnits;
  currency: string;
  /** Agency portion — exactly 50% of the total, floored on odd pennies. */
  agencyShare: MinorUnits;
  /** Agent pool — exactly 50% of the total, absorbs the odd penny. */
  agentPool: MinorUnits;
  /** True when listing and selling agents are the same person. */
  isSameAgent: boolean;
  /**
   * One row per payable party. Length is 1 for same-agent case, 2 for different-agent case.
   * Frontend iterates over this to render the breakdown table without branching on rules.
   */
  parties: CommissionPartyShare[];
  /** Versioned so historic breakdowns can be re-interpreted if rules change later. */
  ruleVersion: string;
  calculatedAt: Date;
}

/**
 * Version tag burned into every breakdown we persist.
 *
 * If the commission rules ever change (e.g. agency vs. agent percentages, or a
 * tiered scheme) we bump this and keep the old calculator around. Old rows
 * continue to reflect the rules that were in force when they were calculated.
 */
export const COMMISSION_RULE_VERSION = 'v1';

/**
 * Pure commission calculator for the Estate Commission Flow rules.
 *
 * Rules (from the brief):
 *   1. Agency always keeps 50% of the total service fee.
 *   2. The remaining 50% (the "agent pool") is distributed as follows:
 *      a. If listing agent and selling agent are the same person,
 *         they receive 100% of the agent pool.
 *      b. If they are different people, the pool is split 50/50 between them.
 *
 * Implementation notes:
 *   - All math runs in integer minor units — no floating-point drift.
 *   - Odd pennies: the agent pool absorbs the odd penny at the first split
 *     (favouring the agents over the agency), and the listing agent absorbs
 *     the odd penny at the second split (deterministic tie-break, documented
 *     in ADR-003). Totals always reconcile exactly.
 *   - Errors surface as `DomainException` with
 *     `ErrorCode.COMMISSION_CALCULATION_ERROR` so the global filter returns
 *     a consistent HTTP 400 shape.
 */
export function calculateCommission(
  input: CommissionCalculationInput,
): CommissionCalculationResult {
  const {
    totalServiceFee,
    currency,
    listingAgentId,
    sellingAgentId,
  } = input;

  if (!Number.isInteger(totalServiceFee) || totalServiceFee < 0) {
    throw new DomainException(
      ErrorCode.COMMISSION_CALCULATION_ERROR,
      `totalServiceFee must be a non-negative integer in minor units, got: ${String(totalServiceFee)}`,
    );
  }
  if (typeof currency !== 'string' || currency.trim().length !== 3) {
    throw new DomainException(
      ErrorCode.COMMISSION_CALCULATION_ERROR,
      `currency must be a 3-letter ISO 4217 code, got: ${String(currency)}`,
    );
  }
  if (!listingAgentId || !sellingAgentId) {
    throw new DomainException(
      ErrorCode.COMMISSION_CALCULATION_ERROR,
      'listingAgentId and sellingAgentId are both required',
    );
  }

  const [agencyShare, agentPool] = splitHalfInteger(totalServiceFee);
  const isSameAgent = listingAgentId === sellingAgentId;

  const parties: CommissionPartyShare[] = isSameAgent
    ? [
        {
          agentId: listingAgentId,
          role: 'listing_and_selling',
          share: agentPool,
          reason:
            'Acted as both listing and selling agent; receives 100% of the agent pool (50% of total).',
        },
      ]
    : buildDifferentAgentParties(agentPool, listingAgentId, sellingAgentId);

  return {
    totalServiceFee,
    currency: currency.toUpperCase(),
    agencyShare,
    agentPool,
    isSameAgent,
    parties,
    ruleVersion: COMMISSION_RULE_VERSION,
    calculatedAt: new Date(),
  };
}

function buildDifferentAgentParties(
  agentPool: MinorUnits,
  listingAgentId: string,
  sellingAgentId: string,
): CommissionPartyShare[] {
  const [listingShare, sellingShare] = splitEqual(agentPool, 2);
  return [
    {
      agentId: listingAgentId,
      role: 'listing',
      share: listingShare,
      reason:
        'Listed the property; receives 50% of the agent pool (25% of total service fee).',
    },
    {
      agentId: sellingAgentId,
      role: 'selling',
      share: sellingShare,
      reason:
        'Sold the property; receives 50% of the agent pool (25% of total service fee).',
    },
  ];
}
