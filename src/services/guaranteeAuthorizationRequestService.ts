import type { PricingRecord } from '../types';
import type { GuaranteeDivergence } from '../utils/guaranteeAuthorization';
import { supabase } from './supabase';

export type GuaranteeAuthorizationRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'consumed';

export interface GuaranteeAuthorizationRequest {
  id: string;
  organizationId: string;
  requesterId: string;
  requesterName: string;
  clientId?: string;
  clientName?: string;
  compositionHash: string;
  pricingSnapshot: Partial<PricingRecord>;
  divergences: GuaranteeDivergence[];
  requestReason: string;
  status: GuaranteeAuthorizationRequestStatus;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  reviewReason?: string;
  createdAt: string;
  updatedAt: string;
  consumedAt?: string;
  consumedByPricingId?: string;
}

const mapRequest = (row: Record<string, unknown>): GuaranteeAuthorizationRequest => ({
  id: String(row.id),
  organizationId: String(row.organization_id),
  requesterId: String(row.requester_id),
  requesterName: String(row.requester_name),
  clientId: row.client_id ? String(row.client_id) : undefined,
  clientName: row.client_name ? String(row.client_name) : undefined,
  compositionHash: String(row.composition_hash),
  pricingSnapshot: (row.pricing_snapshot || {}) as Partial<PricingRecord>,
  divergences: (row.divergences || []) as GuaranteeDivergence[],
  requestReason: String(row.request_reason),
  status: row.status as GuaranteeAuthorizationRequestStatus,
  reviewedBy: row.reviewed_by ? String(row.reviewed_by) : undefined,
  reviewedByName: row.reviewed_by_name ? String(row.reviewed_by_name) : undefined,
  reviewedAt: row.reviewed_at ? String(row.reviewed_at) : undefined,
  reviewReason: row.review_reason ? String(row.review_reason) : undefined,
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at),
  consumedAt: row.consumed_at ? String(row.consumed_at) : undefined,
  consumedByPricingId: row.consumed_by_pricing_id
    ? String(row.consumed_by_pricing_id)
    : undefined,
});

export async function createGuaranteeAuthorizationRequest(input: {
  organizationId: string;
  requesterId: string;
  requesterName: string;
  clientId?: string;
  clientName?: string;
  compositionHash: string;
  pricingSnapshot: Partial<PricingRecord>;
  divergences: GuaranteeDivergence[];
  requestReason: string;
}): Promise<GuaranteeAuthorizationRequest> {
  const payload = {
    organization_id: input.organizationId,
    requester_id: input.requesterId,
    requester_name: input.requesterName,
    client_id: input.clientId || null,
    client_name: input.clientName || null,
    composition_hash: input.compositionHash,
    pricing_snapshot: input.pricingSnapshot,
    divergences: input.divergences,
    request_reason: input.requestReason.trim(),
  };
  const { data, error } = await supabase
    .from('guarantee_authorization_requests')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return mapRequest(data as Record<string, unknown>);
}

export async function getGuaranteeAuthorizationRequests(
  status?: GuaranteeAuthorizationRequestStatus
): Promise<GuaranteeAuthorizationRequest[]> {
  let query = supabase
    .from('guarantee_authorization_requests')
    .select('*')
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row) => mapRequest(row as Record<string, unknown>));
}

export async function getMyGuaranteeAuthorizationRequests(
  requesterId: string
): Promise<GuaranteeAuthorizationRequest[]> {
  const { data, error } = await supabase
    .from('guarantee_authorization_requests')
    .select('*')
    .eq('requester_id', requesterId)
    .in('status', ['pending', 'approved', 'rejected'])
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => mapRequest(row as Record<string, unknown>));
}

export function subscribeToMyGuaranteeAuthorizationRequests(
  requesterId: string,
  onChange: () => void
): () => void {
  const channel = supabase
    .channel(`guarantee-authorization-requests-${requesterId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'guarantee_authorization_requests',
        filter: `requester_id=eq.${requesterId}`,
      },
      onChange
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function decideGuaranteeAuthorizationRequest(
  requestId: string,
  decision: 'approved' | 'rejected',
  reason: string
): Promise<GuaranteeAuthorizationRequest> {
  const { data, error } = await supabase.rpc('decide_guarantee_authorization_request', {
    p_request_id: requestId,
    p_decision: decision,
    p_reason: reason.trim(),
  });
  if (error) throw error;
  return mapRequest(data as Record<string, unknown>);
}

export async function findApprovedGuaranteeAuthorizationRequest(
  compositionHash: string
): Promise<GuaranteeAuthorizationRequest | null> {
  const { data, error } = await supabase
    .from('guarantee_authorization_requests')
    .select('*')
    .eq('composition_hash', compositionHash)
    .eq('status', 'approved')
    .order('reviewed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRequest(data as Record<string, unknown>) : null;
}

export async function consumeGuaranteeAuthorizationRequest(
  requestId: string,
  compositionHash: string,
  pricingId: string
): Promise<GuaranteeAuthorizationRequest> {
  const { data, error } = await supabase.rpc('consume_guarantee_authorization_request', {
    p_request_id: requestId,
    p_composition_hash: compositionHash,
    p_pricing_id: pricingId,
  });
  if (error) throw error;
  return mapRequest(data as Record<string, unknown>);
}
