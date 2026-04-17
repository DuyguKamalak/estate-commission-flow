/**
 * Frontend preview of the commission split.
 *
 * Mirrors the backend's `calculateCommission` domain function so the
 * create-transaction form can show an honest breakdown before the
 * record is persisted. The authoritative calculation (with
 * `ruleVersion`) still happens on the backend at COMPLETED time —
 * this preview intentionally does NOT stamp a rule version.
 *
 * Rules (v1):
 *   - agency = floor(total / 2)
 *   - agentPool = total - agency  (the odd penny, if any, falls to
 *     the pool, matching the backend implementation)
 *   - same agent:    listing + selling = agentPool
 *   - different:     listing = ceil(agentPool / 2), selling = floor(agentPool / 2)
 *                    (odd penny routed to the listing agent)
 */

export interface CommissionPreview {
  totalServiceFee: number;
  agencyShare: number;
  agentPool: number;
  listingAgentShare: number;
  sellingAgentShare: number;
  isSameAgent: boolean;
}

export function computeCommissionPreview(params: {
  totalServiceFee: number;
  listingAgentId: string;
  sellingAgentId: string;
}): CommissionPreview | null {
  const { totalServiceFee, listingAgentId, sellingAgentId } = params;
  if (!Number.isFinite(totalServiceFee) || totalServiceFee <= 0) return null;
  if (!Number.isInteger(totalServiceFee)) return null;
  if (!listingAgentId || !sellingAgentId) return null;

  const agencyShare = Math.floor(totalServiceFee / 2);
  const agentPool = totalServiceFee - agencyShare;
  const isSameAgent = listingAgentId === sellingAgentId;

  let listingAgentShare = 0;
  let sellingAgentShare = 0;
  if (isSameAgent) {
    listingAgentShare = agentPool;
    sellingAgentShare = 0;
  } else {
    listingAgentShare = Math.ceil(agentPool / 2);
    sellingAgentShare = agentPool - listingAgentShare;
  }

  return {
    totalServiceFee,
    agencyShare,
    agentPool,
    listingAgentShare,
    sellingAgentShare,
    isSameAgent,
  };
}
