import type { PriceListPublication } from '../types';
import { supabase } from './supabase';

type PublicationInput = Omit<
  PriceListPublication,
  'id' | 'idNumeric' | 'organizationId' | 'createdAt' | 'updatedAt'
>;

function mapPublication(data: Record<string, unknown>): PriceListPublication {
  return {
    id: data.id as string,
    idNumeric: Number(data.id_numeric),
    organizationId: data.organization_id as string | undefined,
    name: data.name as string,
    competence: data.competence as string,
    revision: Number(data.revision),
    currency: data.currency as PriceListPublication['currency'],
    exchangeRate: data.exchange_rate != null ? Number(data.exchange_rate) : undefined,
    validFrom: data.valid_from as string | undefined,
    validUntil: data.valid_until as string | undefined,
    notes: data.notes as string | undefined,
    status: data.status as PriceListPublication['status'],
    createdAt: data.created_at as string | undefined,
    updatedAt: data.updated_at as string | undefined,
  };
}

function toPayload(publication: PublicationInput): Record<string, unknown> {
  return {
    name: publication.name.trim(),
    competence: publication.competence,
    revision: publication.revision,
    currency: publication.currency,
    exchange_rate: publication.exchangeRate ?? null,
    valid_from: publication.validFrom ?? null,
    valid_until: publication.validUntil ?? null,
    notes: publication.notes?.trim() || null,
    status: publication.status,
  };
}

function normalizePublicationChanges(
  publication: Partial<PublicationInput>
): Record<string, unknown> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (publication.name !== undefined) payload.name = publication.name.trim();
  if (publication.competence !== undefined) payload.competence = publication.competence;
  if (publication.revision !== undefined) payload.revision = publication.revision;
  if (publication.currency !== undefined) payload.currency = publication.currency;
  if ('exchangeRate' in publication) payload.exchange_rate = publication.exchangeRate ?? null;
  if ('validFrom' in publication) payload.valid_from = publication.validFrom ?? null;
  if ('validUntil' in publication) payload.valid_until = publication.validUntil ?? null;
  if ('notes' in publication) payload.notes = publication.notes?.trim() || null;
  if (publication.status !== undefined) payload.status = publication.status;
  return payload;
}

export async function getPriceListPublications(): Promise<PriceListPublication[]> {
  const { data, error } = await supabase
    .from('price_list_publications')
    .select('*')
    .order('competence', { ascending: false })
    .order('revision', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((item) => mapPublication(item as Record<string, unknown>));
}

export async function createPriceListPublication(
  publication: PublicationInput
): Promise<PriceListPublication> {
  const { data, error } = await supabase
    .from('price_list_publications')
    .insert(toPayload(publication))
    .select()
    .single();
  if (error) throw error;
  return mapPublication(data as Record<string, unknown>);
}

export async function updatePriceListPublication(
  id: string,
  publication: Partial<PublicationInput>
): Promise<void> {
  const { error } = await supabase
    .from('price_list_publications')
    .update(normalizePublicationChanges(publication))
    .eq('id', id);
  if (error) throw error;
}

export async function deletePriceListPublication(id: string): Promise<void> {
  const { error } = await supabase.from('price_list_publications').delete().eq('id', id);
  if (error) throw error;
}
