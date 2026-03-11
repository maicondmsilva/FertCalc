/**
 * FertCalc Pro - Supabase Database Service
 * Central data access layer for all Supabase operations
 */

import { supabase } from './supabase';
import {
  User,
  AppSettings,
  Branch,
  Client,
  Agent,
  Brand,
  MacroMaterial,
  MicroMaterial,
  FinishedProduct,
  IncompatibilityRule,
  PriceList,
  PricingRecord,
  PricingHistoryEntry,
  Goal,
  Notification,
  FertigranPFormula,
  ComparisonHistory
} from '../types';

// ============================================================
// APP SETTINGS
// ============================================================
export async function getAppSettings(): Promise<AppSettings | null> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('*')
    .limit(1)
    .single();
  if (error || !data) return null;
  return {
    companyName: data.company_name,
    companyLogo: data.company_logo || '',
    companyCnpj: data.company_cnpj,
    pricingTerms: data.pricing_terms,
  };
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  const { data: existing } = await supabase.from('app_settings').select('id').limit(1).single();
  const payload = {
    company_name: settings.companyName,
    company_logo: settings.companyLogo,
    company_cnpj: settings.companyCnpj,
    pricing_terms: settings.pricingTerms,
    updated_at: new Date().toISOString(),
  };
  if (existing?.id) {
    await supabase.from('app_settings').update(payload).eq('id', existing.id);
  } else {
    await supabase.from('app_settings').insert(payload);
  }
}

// ============================================================
// USERS
// ============================================================
export async function getUsers(): Promise<User[]> {
  const { data, error } = await supabase.from('app_users').select('*').order('name');
  if (error || !data) return [];
  return data.map(mapUser);
}

export async function getManagersOfUser(userId: string): Promise<User[]> {
  const { data, error } = await supabase
    .from('app_users')
    .select('*')
    .contains('managed_user_ids', [userId]);
  if (error || !data) return [];
  return data.map(mapUser);
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('app_users')
    .select('*')
    .eq('email', email)
    .single();
  if (error || !data) return null;
  return mapUser(data);
}

export async function createUser(user: Omit<User, 'id'> & { password: string }): Promise<User> {
  const { data, error } = await supabase
    .from('app_users')
    .insert({
      email: user.email,
      name: user.name,
      custom_code: user.customCode,
      password: user.password,
      role: user.role,
      managed_user_ids: user.managedUserIds || [],
      permissions: user.permissions || {},
    })
    .select()
    .single();
  if (error) throw error;
  return mapUser(data);
}

export async function updateUser(id: string, user: Partial<User> & { password?: string }): Promise<void> {
  const payload: any = { updated_at: new Date().toISOString() };
  if (user.email !== undefined) payload.email = user.email;
  if (user.name !== undefined) payload.name = user.name;
  if (user.customCode !== undefined) payload.custom_code = user.customCode;
  if (user.password !== undefined && user.password !== '') payload.password = user.password;
  if (user.role !== undefined) payload.role = user.role;
  if (user.managedUserIds !== undefined) payload.managed_user_ids = user.managedUserIds;
  if (user.permissions !== undefined) payload.permissions = user.permissions;
  const { error } = await supabase.from('app_users').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteUser(id: string): Promise<void> {
  const { error } = await supabase.from('app_users').delete().eq('id', id);
  if (error) throw error;
}

function mapUser(data: any): User {
  return {
    id: data.id,
    email: data.email,
    name: data.name,
    customCode: data.custom_code,
    password: data.password,
    role: data.role,
    managedUserIds: data.managed_user_ids || [],
    permissions: data.permissions || {},
  };
}

// ============================================================
// BRANCHES
// ============================================================
export async function getBranches(): Promise<Branch[]> {
  const { data, error } = await supabase.from('branches').select('*').order('name');
  if (error || !data) return [];
  return data.map(d => ({ id: d.id, name: d.name }));
}

export async function createBranch(branch: Omit<Branch, 'id'>): Promise<Branch> {
  const { data, error } = await supabase
    .from('branches')
    .insert({ name: branch.name })
    .select()
    .single();
  if (error) throw error;
  return { id: data.id, name: data.name };
}

export async function updateBranch(id: string, branch: Partial<Branch>): Promise<void> {
  const { error } = await supabase.from('branches').update({ name: branch.name }).eq('id', id);
  if (error) throw error;
}

export async function deleteBranch(id: string): Promise<void> {
  const { error } = await supabase.from('branches').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// CLIENTS
// ============================================================
export async function getClients(): Promise<Client[]> {
  const { data, error } = await supabase.from('clients').select('*').order('name');
  if (error || !data) return [];
  return data.map(mapClient);
}

export async function getNextClientCode(): Promise<string> {
  const { data } = await supabase.from('clients').select('code');
  if (!data || data.length === 0) return '1';
  const nums = data.map(d => parseInt(d.code || '0', 10)).filter(n => !isNaN(n));
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return String(max + 1);
}

export async function createClient(client: Omit<Client, 'id'>): Promise<Client> {
  const { data, error } = await supabase
    .from('clients')
    .insert(clientToDb(client))
    .select()
    .single();
  if (error) throw error;
  return mapClient(data);
}

export async function createClientsBulk(clients: Omit<Client, 'id'>[]): Promise<void> {
  const dbClients = clients.map(clientToDb);
  // Supabase limits bulk inserts to 1000 rows
  const BATCH_SIZE = 1000;
  for (let i = 0; i < dbClients.length; i += BATCH_SIZE) {
    const batch = dbClients.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('clients').insert(batch);
    if (error) throw error;
  }
}

export async function updateClient(id: string, client: Partial<Client>): Promise<void> {
  const { error } = await supabase
    .from('clients')
    .update({ ...clientToDb(client as any), updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await supabase.from('clients').delete().eq('id', id);
  if (error) throw error;
}

function clientToDb(client: Partial<Client>) {
  const d: any = {};
  if (client.code !== undefined) d.code = client.code;
  if (client.name !== undefined) d.name = client.name;
  if (client.document !== undefined) d.document = client.document;
  if (client.email !== undefined) d.email = client.email;
  if (client.phone !== undefined) d.phone = client.phone;
  if (client.stateRegistration !== undefined) d.state_registration = client.stateRegistration;
  if (client.fazenda !== undefined) d.fazenda = client.fazenda;
  if (client.address !== undefined) d.address = client.address;
  return d;
}

function mapClient(data: any): Client {
  return {
    id: data.id,
    code: data.code,
    name: data.name,
    document: data.document,
    email: data.email,
    phone: data.phone,
    stateRegistration: data.state_registration,
    fazenda: data.fazenda,
    address: data.address,
  };
}

// ============================================================
// AGENTS
// ============================================================
export async function getAgents(): Promise<Agent[]> {
  const { data, error } = await supabase.from('agents').select('*').order('name');
  if (error || !data) return [];
  return data.map(mapAgent);
}

export async function getNextAgentCode(): Promise<string> {
  const { data } = await supabase.from('agents').select('code');
  if (!data || data.length === 0) return '1';
  const nums = data.map(d => parseInt(d.code || '0', 10)).filter(n => !isNaN(n));
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return String(max + 1);
}

export async function createAgent(agent: Omit<Agent, 'id'>): Promise<Agent> {
  const { data, error } = await supabase
    .from('agents')
    .insert(agentToDb(agent))
    .select()
    .single();
  if (error) throw error;
  return mapAgent(data);
}

export async function createAgentsBulk(agents: Omit<Agent, 'id'>[]): Promise<void> {
  const dbAgents = agents.map(agentToDb);
  const BATCH_SIZE = 1000;
  for (let i = 0; i < dbAgents.length; i += BATCH_SIZE) {
    const batch = dbAgents.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('agents').insert(batch);
    if (error) throw error;
  }
}

export async function updateAgent(id: string, agent: Partial<Agent>): Promise<void> {
  const { error } = await supabase
    .from('agents')
    .update({ ...agentToDb(agent as any), updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteAgent(id: string): Promise<void> {
  const { error } = await supabase.from('agents').delete().eq('id', id);
  if (error) throw error;
}

function agentToDb(agent: Partial<Agent>) {
  const d: any = {};
  if (agent.code !== undefined) d.code = agent.code;
  if (agent.name !== undefined) d.name = agent.name;
  if (agent.document !== undefined) d.document = agent.document;
  if (agent.email !== undefined) d.email = agent.email;
  if (agent.phone !== undefined) d.phone = agent.phone;
  if (agent.ie !== undefined) d.ie = agent.ie;
  if (agent.address !== undefined) d.address = agent.address;
  return d;
}

function mapAgent(data: any): Agent {
  return {
    id: data.id,
    code: data.code,
    name: data.name,
    document: data.document,
    email: data.email,
    phone: data.phone,
    ie: data.ie,
    address: data.address,
  };
}

// ============================================================
// BRANDS
// ============================================================
export async function getBrands(): Promise<Brand[]> {
  const { data, error } = await supabase.from('brands').select('*').order('name');
  if (error || !data) return [];
  return data.map(d => ({ id: d.id, code: d.code, name: d.name }));
}

export async function createBrand(brand: Omit<Brand, 'id'>): Promise<Brand> {
  const { data, error } = await supabase
    .from('brands')
    .insert({ code: brand.code, name: brand.name })
    .select()
    .single();
  if (error) throw error;
  return { id: data.id, code: data.code, name: data.name };
}

export async function updateBrand(id: string, brand: Partial<Brand>): Promise<void> {
  const { error } = await supabase.from('brands').update({ code: brand.code, name: brand.name }).eq('id', id);
  if (error) throw error;
}

export async function deleteBrand(id: string): Promise<void> {
  const { error } = await supabase.from('brands').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// MACRO MATERIALS
// ============================================================
export async function getMacroMaterials(): Promise<MacroMaterial[]> {
  const { data, error } = await supabase.from('macro_materials').select('*').order('name');
  if (error || !data) return [];
  return data.map(mapMacro);
}

export async function createMacroMaterial(material: Omit<MacroMaterial, 'id'>): Promise<MacroMaterial> {
  const { data, error } = await supabase
    .from('macro_materials')
    .insert(macroToDb(material))
    .select()
    .single();
  if (error) throw error;
  return mapMacro(data);
}

export async function updateMacroMaterial(id: string, material: Partial<MacroMaterial>): Promise<void> {
  const { error } = await supabase
    .from('macro_materials')
    .update({ ...macroToDb(material as any), updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteMacroMaterial(id: string): Promise<void> {
  const { error } = await supabase.from('macro_materials').delete().eq('id', id);
  if (error) throw error;
}

function macroToDb(m: Partial<MacroMaterial>) {
  const d: any = {};
  if (m.code !== undefined) d.code = m.code;
  if (m.name !== undefined) d.name = m.name;
  if (m.n !== undefined) d.n = m.n;
  if (m.p !== undefined) d.p = m.p;
  if (m.k !== undefined) d.k = m.k;
  if (m.s !== undefined) d.s = m.s;
  if (m.ca !== undefined) d.ca = m.ca;
  if (m.microGuarantees !== undefined) d.micro_guarantees = m.microGuarantees;
  // Send null when brandId is empty string to avoid UUID type error
  if (m.brandId !== undefined) d.brand_id = m.brandId === '' ? null : m.brandId;
  if (m.categories !== undefined) d.categories = m.categories;
  if (m.formulaSuffix !== undefined) d.formula_suffix = m.formulaSuffix;
  if (m.isPremiumLine !== undefined) d.is_premium_line = m.isPremiumLine;
  return d;
}

function mapMacro(data: any): MacroMaterial {
  return {
    id: data.id,
    code: data.code,
    name: data.name,
    n: Number(data.n),
    p: Number(data.p),
    k: Number(data.k),
    s: Number(data.s),
    ca: Number(data.ca),
    microGuarantees: data.micro_guarantees || [],
    brandId: data.brand_id,
    categories: data.categories || [],
    formulaSuffix: data.formula_suffix,
    isPremiumLine: data.is_premium_line || false,
  };
}

// ============================================================
// MICRO MATERIALS
// ============================================================
export async function getMicroMaterials(): Promise<MicroMaterial[]> {
  const { data, error } = await supabase.from('micro_materials').select('*').order('name');
  if (error || !data) return [];
  return data.map(mapMicro);
}

export async function createMicroMaterial(material: Omit<MicroMaterial, 'id'>): Promise<MicroMaterial> {
  const { data, error } = await supabase
    .from('micro_materials')
    .insert(microToDb(material))
    .select()
    .single();
  if (error) throw error;
  return mapMicro(data);
}

export async function updateMicroMaterial(id: string, material: Partial<MicroMaterial>): Promise<void> {
  const { error } = await supabase
    .from('micro_materials')
    .update({ ...microToDb(material as any), updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteMicroMaterial(id: string): Promise<void> {
  const { error } = await supabase.from('micro_materials').delete().eq('id', id);
  if (error) throw error;
}

function microToDb(m: Partial<MicroMaterial>) {
  const d: any = {};
  if (m.code !== undefined) d.code = m.code;
  if (m.name !== undefined) d.name = m.name;
  if (m.microGuarantees !== undefined) d.micro_guarantees = m.microGuarantees;
  if (m.categories !== undefined) d.categories = m.categories;
  if (m.formulaSuffix !== undefined) d.formula_suffix = m.formulaSuffix;
  return d;
}

function mapMicro(data: any): MicroMaterial {
  return {
    id: data.id,
    code: data.code,
    name: data.name,
    microGuarantees: data.micro_guarantees || [],
    categories: data.categories || [],
    formulaSuffix: data.formula_suffix,
  };
}

// ============================================================
// FINISHED PRODUCTS
// ============================================================
export async function getFinishedProducts(): Promise<FinishedProduct[]> {
  const { data, error } = await supabase.from('finished_products').select('*').order('name');
  if (error || !data) return [];
  return data.map(d => ({
    id: d.id,
    code: d.code,
    name: d.name,
    description: d.description,
    price: d.price ? Number(d.price) : undefined,
  }));
}

export async function createFinishedProduct(product: Omit<FinishedProduct, 'id'>): Promise<FinishedProduct> {
  const { data, error } = await supabase
    .from('finished_products')
    .insert({ code: product.code, name: product.name, description: product.description, price: product.price })
    .select()
    .single();
  if (error) throw error;
  return { id: data.id, code: data.code, name: data.name, description: data.description, price: data.price ? Number(data.price) : undefined };
}

export async function updateFinishedProduct(id: string, product: Partial<FinishedProduct>): Promise<void> {
  const { error } = await supabase.from('finished_products').update({
    code: product.code,
    name: product.name,
    description: product.description,
    price: product.price,
    updated_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) throw error;
}

export async function deleteFinishedProduct(id: string): Promise<void> {
  const { error } = await supabase.from('finished_products').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// INCOMPATIBILITY RULES
// ============================================================
export async function getIncompatibilityRules(): Promise<IncompatibilityRule[]> {
  const { data, error } = await supabase.from('incompatibility_rules').select('*').order('created_at');
  if (error || !data) return [];
  return data.map(d => ({
    id: d.id,
    materialAId: d.material_a_id,
    materialBId: d.material_b_id,
    materialAName: d.material_a_name,
    materialBName: d.material_b_name,
  }));
}

export async function createIncompatibilityRule(rule: Omit<IncompatibilityRule, 'id'>): Promise<IncompatibilityRule> {
  const { data, error } = await supabase
    .from('incompatibility_rules')
    .insert({
      material_a_id: rule.materialAId,
      material_b_id: rule.materialBId,
      material_a_name: rule.materialAName,
      material_b_name: rule.materialBName,
    })
    .select()
    .single();
  if (error) throw error;
  return { id: data.id, materialAId: data.material_a_id, materialBId: data.material_b_id, materialAName: data.material_a_name, materialBName: data.material_b_name };
}

export async function deleteIncompatibilityRule(id: string): Promise<void> {
  const { error } = await supabase.from('incompatibility_rules').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// PRICE LISTS
// ============================================================
export async function getPriceLists(): Promise<PriceList[]> {
  const { data, error } = await supabase.from('price_lists').select('*').order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(d => ({
    id: d.id,
    name: d.name,
    branchId: d.branch_id,
    date: d.date,
    currency: d.currency,
    exchangeRate: d.exchange_rate ? Number(d.exchange_rate) : undefined,
    macros: d.macros || [],
    micros: d.micros || [],
  }));
}

export async function createPriceList(pl: Omit<PriceList, 'id'>): Promise<PriceList> {
  const { data, error } = await supabase
    .from('price_lists')
    .insert({
      name: pl.name,
      branch_id: pl.branchId,
      date: pl.date,
      currency: pl.currency,
      exchange_rate: pl.exchangeRate,
      macros: pl.macros,
      micros: pl.micros,
    })
    .select()
    .single();
  if (error) throw error;
  return { id: data.id, name: data.name, branchId: data.branch_id, date: data.date, currency: data.currency, exchangeRate: data.exchange_rate ? Number(data.exchange_rate) : undefined, macros: data.macros || [], micros: data.micros || [] };
}

export async function updatePriceList(id: string, pl: Partial<PriceList>): Promise<void> {
  const payload: any = { updated_at: new Date().toISOString() };
  if (pl.name !== undefined) payload.name = pl.name;
  if (pl.branchId !== undefined) payload.branch_id = pl.branchId;
  if (pl.date !== undefined) payload.date = pl.date;
  if (pl.currency !== undefined) payload.currency = pl.currency;
  if (pl.exchangeRate !== undefined) payload.exchange_rate = pl.exchangeRate;
  if (pl.macros !== undefined) payload.macros = pl.macros;
  if (pl.micros !== undefined) payload.micros = pl.micros;
  const { error } = await supabase.from('price_lists').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deletePriceList(id: string): Promise<void> {
  const { error } = await supabase.from('price_lists').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// PRICING RECORDS
// ============================================================
export async function getPricingRecords(): Promise<PricingRecord[]> {
  const { data, error } = await supabase.from('pricing_records').select('*').order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(mapPricingRecord);
}

export async function createPricingRecord(record: Omit<PricingRecord, 'id'>): Promise<PricingRecord> {
  const { data, error } = await supabase
    .from('pricing_records')
    .insert(pricingRecordToDb(record))
    .select()
    .single();
  if (error) throw error;
  return mapPricingRecord(data);
}

export async function updatePricingRecord(id: string, record: Partial<PricingRecord>): Promise<void> {
  const { error } = await supabase
    .from('pricing_records')
    .update({ ...pricingRecordToDb(record as any), updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deletePricingRecord(id: string): Promise<void> {
  const { error } = await supabase.from('pricing_records').delete().eq('id', id);
  if (error) throw error;
}

function pricingRecordToDb(r: Partial<PricingRecord>) {
  const d: any = {};
  if (r.userId !== undefined) d.user_id = r.userId;
  if (r.userName !== undefined) d.user_name = r.userName;
  if (r.userCode !== undefined) d.user_code = r.userCode;
  if (r.date !== undefined) d.date = r.date;
  if (r.status !== undefined) d.status = r.status;
  if (r.approvalStatus !== undefined) d.approval_status = r.approvalStatus;
  if (r.macros !== undefined) d.macros = r.macros;
  if (r.micros !== undefined) d.micros = r.micros;
  if (r.factors !== undefined) d.factors = r.factors;
  if (r.summary !== undefined) d.summary = r.summary;
  if (r.calculations !== undefined) d.calculations = r.calculations;
  if (r.history !== undefined) d.history = r.history;
  if (r.commercialObservation !== undefined) d.commercial_observation = r.commercialObservation;
  if (r.transferToUserId !== undefined) d.transfer_to_user_id = r.transferToUserId;
  if (r.transferToUserName !== undefined) d.transfer_to_user_name = r.transferToUserName;
  if (r.deletionRequest !== undefined) d.deletion_request = r.deletionRequest;
  return d;
}

/**
 * Formats a numeric COD into a string like 1, 2, 3
 */
export function formatPricingCod(cod?: number): string {
  if (!cod) return '---';
  return String(cod);
}

function mapPricingRecord(d: any): PricingRecord {
  return {
    id: d.id,
    cod: d.cod,
    formattedCod: formatPricingCod(d.cod),
    userId: d.user_id,
    userName: d.user_name,
    userCode: d.user_code,
    date: d.date,
    status: d.status,
    approvalStatus: d.approval_status,
    macros: d.macros || [],
    micros: d.micros || [],
    factors: d.factors || {},
    summary: d.summary || {},
    calculations: d.calculations || [],
    history: d.history || [],
    commercialObservation: d.commercial_observation,
    transferToUserId: d.transfer_to_user_id,
    transferToUserName: d.transfer_to_user_name,
    deletionRequest: d.deletion_request,
  };
}

export async function transferPricingRecord(id: string, targetUserId: string, targetUserName: string, currentUser: User): Promise<void> {
  const historyEntry: PricingHistoryEntry = {
    date: new Date().toISOString(),
    userId: currentUser.id,
    userName: currentUser.name,
    action: `Transferência iniciada para ${targetUserName}`
  };

  const { data: pricing, error: fetchError } = await supabase.from('pricing_records').select('history').eq('id', id).single();
  if (fetchError) throw fetchError;

  const newHistory = [...(pricing.history || []), historyEntry];

  const { error } = await supabase
    .from('pricing_records')
    .update({
      transfer_to_user_id: targetUserId,
      transfer_to_user_name: targetUserName,
      history: newHistory,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) throw error;

  // Create notification for target user
  await createNotification({
    userId: targetUserId,
    title: 'Nova Transferência de Precificação',
    message: `${currentUser.name} enviou uma precificação para você aceitar.`,
    date: new Date().toISOString(),
    read: false,
    type: 'pricing_transfer',
    dataId: id
  });
}

export async function acceptPricingTransfer(id: string, user: User): Promise<void> {
  const historyEntry: PricingHistoryEntry = {
    date: new Date().toISOString(),
    userId: user.id,
    userName: user.name,
    action: `Transferência aceita por ${user.name}`
  };

  const { data: pricing, error: fetchError } = await supabase.from('pricing_records').select('history').eq('id', id).single();
  if (fetchError) throw fetchError;

  const newHistory = [...(pricing.history || []), historyEntry];

  const { error } = await supabase
    .from('pricing_records')
    .update({
      user_id: user.id,
      user_name: user.name,
      user_code: user.customCode,
      transfer_to_user_id: null,
      transfer_to_user_name: null,
      history: newHistory,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) throw error;
}

// ============================================================
// SAVED FORMULAS
// ============================================================

import { SavedFormula } from '../types';

export async function getSavedFormulas(): Promise<SavedFormula[]> {
  const { data, error } = await supabase.from('saved_formulas').select('*').order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(d => ({
    id: d.id,
    userId: d.user_id,
    userName: d.user_name,
    name: d.name,
    date: d.date,
    targetFormula: d.target_formula,
    macros: d.macros || [],
    micros: d.micros || [],
  }));
}

export async function createSavedFormula(formula: Omit<SavedFormula, 'id'>): Promise<SavedFormula> {
  // Validate that userId is a valid UUID (Supabase expects UUID for user_id column)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const validUserId = formula.userId && uuidRegex.test(formula.userId) ? formula.userId : null;

  const { data, error } = await supabase
    .from('saved_formulas')
    .insert({
      user_id: validUserId,
      user_name: formula.userName,
      name: formula.name,
      date: formula.date,
      target_formula: formula.targetFormula,
      macros: formula.macros,
      micros: formula.micros
    })
    .select()
    .single();
  if (error) {
    console.error('[createSavedFormula] Supabase error:', error);
    throw error;
  }
  return {
    id: data.id,
    userId: data.user_id,
    userName: data.user_name,
    name: data.name,
    date: data.date,
    targetFormula: data.target_formula,
    macros: data.macros || [],
    micros: data.micros || [],
  };
}

export async function updateSavedFormula(id: string, formula: Partial<SavedFormula>): Promise<void> {
  const payload: any = { updated_at: new Date().toISOString() };
  if (formula.name !== undefined) payload.name = formula.name;
  if (formula.targetFormula !== undefined) payload.target_formula = formula.targetFormula;
  if (formula.macros !== undefined) payload.macros = formula.macros;
  if (formula.micros !== undefined) payload.micros = formula.micros;

  const { error } = await supabase.from('saved_formulas').update(payload).eq('id', id);
  if (error) {
    console.error('[updateSavedFormula] Supabase error:', error);
    throw error;
  }
}

export async function deleteSavedFormula(id: string): Promise<void> {
  const { error } = await supabase.from('saved_formulas').delete().eq('id', id);
  if (error) throw error;
}



// ============================================================
// GOALS
// ============================================================
export async function getGoals(): Promise<Goal[]> {
  const { data, error } = await supabase.from('goals').select('*').order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(d => ({
    id: d.id,
    userId: d.user_id,
    userName: d.user_name,
    type: d.type,
    targetValue: Number(d.target_value),
    month: d.month,
    year: d.year,
    status: d.status,
  }));
}

export async function createGoal(goal: Omit<Goal, 'id'>): Promise<Goal> {
  const { data, error } = await supabase
    .from('goals')
    .insert({
      user_id: goal.userId,
      user_name: goal.userName,
      type: goal.type,
      target_value: goal.targetValue,
      month: goal.month,
      year: goal.year,
      status: goal.status,
    })
    .select()
    .single();
  if (error) throw error;
  return { id: data.id, userId: data.user_id, userName: data.user_name, type: data.type, targetValue: Number(data.target_value), month: data.month, year: data.year, status: data.status };
}

export async function updateGoal(id: string, goal: Partial<Goal>): Promise<void> {
  const payload: any = { updated_at: new Date().toISOString() };
  if (goal.status !== undefined) payload.status = goal.status;
  if (goal.targetValue !== undefined) payload.target_value = goal.targetValue;
  if (goal.type !== undefined) payload.type = goal.type;
  if (goal.month !== undefined) payload.month = goal.month;
  if (goal.year !== undefined) payload.year = goal.year;
  if (goal.userId !== undefined) payload.user_id = goal.userId;
  if (goal.userName !== undefined) payload.user_name = goal.userName;
  const { error } = await supabase.from('goals').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await supabase.from('goals').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// NOTIFICATIONS
// ============================================================
// ============================================================
// NOTIFICATIONS
// ============================================================
export async function getNotifications(userId?: string): Promise<Notification[]> {
  let query = supabase.from('notifications').select('*').order('created_at', { ascending: false });
  
  if (userId) {
    // Busca notificações do usuário OU globais (onde user_id é null)
    query = query.or(`user_id.eq.${userId},user_id.is.null`);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data.map(d => ({
    id: d.id,
    userId: d.user_id,
    title: d.title,
    message: d.message,
    date: d.date,
    read: d.read,
    type: d.type,
    dataId: d.data_id,
  }));
}

export async function createNotification(notification: Omit<Notification, 'id'>): Promise<Notification> {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const validUserId = notification.userId && uuidRegex.test(notification.userId) ? notification.userId : null;
  const validDataId = notification.dataId && uuidRegex.test(notification.dataId) ? notification.dataId : null;

  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: validUserId,
      title: notification.title,
      message: notification.message,
      date: notification.date,
      read: notification.read,
      type: notification.type,
      data_id: validDataId,
    })
    .select()
    .single();
  if (error) throw error;
  return { id: data.id, userId: data.user_id, title: data.title, message: data.message, date: data.date, read: data.read, type: data.type, dataId: data.data_id };
}

export async function markNotificationsAsRead(notificationIds: string[]): Promise<void> {
  if (!notificationIds || notificationIds.length === 0) return;
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .in('id', notificationIds);
  if (error) throw error;
}

export async function deleteAllNotifications(userId: string): Promise<void> {
  // Deleta apenas as notificações privadas do usuário.
  // Notificações globais (null) permanecem ou poderiam ser marcadas como lidas se necessário.
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('user_id', userId);
  if (error) throw error;
}

// ============================================================
// PASSWORD RECOVERY
// ============================================================

/**
 * Simulates a password reset request. 
 * Since we don't have an email server configured yet, this will just check if user exists.
 */
export async function requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
  const user = await getUserByEmail(email);
  if (!user) {
    return { success: false, message: 'Usuário não encontrado.' };
  }

  // In a real scenario, here we would generate a token and send an email via Supabase Edge Functions
  // For now, we simulate success
  return {
    success: true,
    message: 'Um link de recuperação foi enviado para o seu e-mail (Simulado).'
  };
}

// ============================================================
// FERTIGRAN P COMPARISONS
// ============================================================

export async function getFertigranPFormulas(): Promise<FertigranPFormula[]> {
  const { data, error } = await supabase
    .from('fertigran_p_formulas')
    .select('*')
    .eq('ativo', true);
  if (error) throw error;
  return data || [];
}

export async function saveComparisonHistory(history: Omit<ComparisonHistory, 'id' | 'created_at'>): Promise<ComparisonHistory> {
  const { data, error } = await supabase
    .from('comparison_history')
    .insert([history])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getComparisonHistory(userId: string): Promise<ComparisonHistory[]> {
  const { data, error } = await supabase
    .from('comparison_history')
    .select('*')
    .eq('usuario_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
