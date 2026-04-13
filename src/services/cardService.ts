import { supabase } from './supabase';
import { CreditCard } from '../types/expense.types';

function mapCard(d: Record<string, unknown>): CreditCard {
  return {
    id: d.id as string,
    name: d.name as string,
    lastFour: d.last_four as string | undefined,
    userId: d.user_id as string,
    churchId: d.church_id as string,
    active: (d.active ?? true) as boolean,
    createdAt: d.created_at as string | undefined,
    updatedAt: d.updated_at as string | undefined,
  };
}

export async function getCards(): Promise<CreditCard[]> {
  const { data, error } = await supabase
    .from('credit_cards')
    .select('*')
    .order('name', { ascending: true });
  if (error || !data) return [];
  return data.map(mapCard);
}

export async function getCardsByUser(userId: string): Promise<CreditCard[]> {
  const { data, error } = await supabase
    .from('credit_cards')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true)
    .order('name', { ascending: true });
  if (error || !data) return [];
  return data.map(mapCard);
}

export async function createCard(
  card: Omit<CreditCard, 'id' | 'createdAt' | 'updatedAt'>
): Promise<CreditCard> {
  const { data, error } = await supabase
    .from('credit_cards')
    .insert({
      name: card.name,
      last_four: card.lastFour,
      user_id: card.userId,
      church_id: card.churchId,
      active: card.active ?? true,
    })
    .select()
    .single();
  if (error) throw error;
  return mapCard(data);
}

export async function updateCard(id: string, card: Partial<CreditCard>): Promise<void> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (card.name !== undefined) payload.name = card.name;
  if (card.lastFour !== undefined) payload.last_four = card.lastFour;
  if (card.userId !== undefined) payload.user_id = card.userId;
  if (card.active !== undefined) payload.active = card.active;
  const { error } = await supabase.from('credit_cards').update(payload).eq('id', id);
  if (error) throw error;
}

export async function toggleCardActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase
    .from('credit_cards')
    .update({ active, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
