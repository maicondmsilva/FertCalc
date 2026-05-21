# 📋 Plano de Desenvolvimento: Integração de Moedas Dinâmica (BRL/USD)

**Data:** 2026-05-21  
**Versão:** 1.0  
**Status:** 🔵 Planejamento  
**Prioridade:** 🔴 Alta

---

## 📌 Escopo Geral

Implementar suporte completo a cotação de moedas (BRL/USD) na página de **Listas de Preço** com:
- ✅ Seleção de moeda (BRL ou USD) ao criar/editar lista
- ✅ Taxa de câmbio editável pelo usuário (referência de mercado)
- ✅ Conversão automática de valores quando moeda é alterada
- ✅ Campo de local de carregamento obrigatório
- ✅ Exibição de símbolos de moeda em todos os campos de preço
- ✅ Cálculo automático de valores em reais quando lista é USD
- ✅ Persistência da taxa de câmbio na precificação
- ✅ Sincronização com Calculadora (exibir moeda e conversões)
- ✅ Sincronização com Histórico de Precificações

---

## 🏗️ Arquitetura de Mudanças

### 1. **Tipos & Interfaces** (`src/types.ts`)

#### Extensões necessárias:

```typescript
// Interface PriceList (já existe, mas com melhorias)
export interface PriceList {
  id: string;
  name: string;
  branchId?: string;
  local_carregamento_id?: string; // ✨ OBRIGATÓRIO A PARTIR DE AGORA
  date: string;
  currency: 'BRL' | 'USD'; // ✨ AGORA OBRIGATÓRIO (não opcional)
  exchangeRate?: number; // Taxa quando USD → R$ (ex: 1 USD = 5.25 R$)
  dollarRate?: number; // Taxa quando BRL → USD (ex: 1 R$ = 0.19 USD)
  macros: RawMaterial[];
  micros: RawMaterial[];
}

// Nova interface para tracking de câmbio nas precificações
export interface CurrencyInfo {
  currency: 'BRL' | 'USD';
  exchangeRate: number; // Taxa USD→BRL usada no cálculo
  priceListId: string;
  savedAt: string; // ISO timestamp
}

// Extensão de PricingFactors para incluir moeda
export interface PricingFactors {
  // ... campos existentes
  currency: 'BRL' | 'USD'; // ✨ NOVO
  exchangeRate?: number; // ✨ NOVO — taxa do dólar usada no cálculo
  local_carregamento_id?: string; // ✨ NOVO — obrigatório
  // ... resto dos campos
}

// Extensão de RawMaterial para cache de valor convertido
export interface RawMaterial {
  // ... campos existentes
  priceInBRL?: number; // ✨ NOVO — preço convertido em reais (para USD)
  originalCurrency?: 'BRL' | 'USD'; // ✨ NOVO — moeda original do preço
}
```

### 2. **Componente PriceListManager** (`src/components/PriceListManager.tsx`)

#### Alterações principais:

**2.1 — Validação de Campo Obrigatório**
```diff
  const savePriceList = async () => {
    // ... validações existentes
+   if (!selectedLocalId.trim()) {
+     showError('Local de carregamento é obrigatório. Selecione antes de salvar.');
+     return;
+   }
    if (!listName.trim()) {
      showError('Dê um nome para a lista antes de salvar.');
      return;
    }
```

**2.2 — Cálculo de Conversão Automática**
```typescript
// Novo helper para converter preços quando moeda muda
const convertPricesOnCurrencyChange = (
  oldCurrency: 'BRL' | 'USD',
  newCurrency: 'BRL' | 'USD',
  rate: number,
  materials: RawMaterial[]
) => {
  if (oldCurrency === newCurrency) return materials;
  
  return materials.map(m => {
    if (oldCurrency === 'USD' && newCurrency === 'BRL') {
      // USD → R$: multiplica pela taxa
      return {
        ...m,
        price: m.price * rate,
        priceInBRL: m.price * rate,
        originalCurrency: 'USD'
      };
    } else if (oldCurrency === 'BRL' && newCurrency === 'USD') {
      // R$ → USD: divide pela taxa
      return {
        ...m,
        price: m.price / rate,
        originalCurrency: 'BRL'
      };
    }
    return m;
  });
};
```

**2.3 — Handler de Alteração de Moeda**
```typescript
const handleCurrencyChange = (newCurrency: 'BRL' | 'USD') => {
  if (newCurrency === currency) return;
  
  // Se não há taxa definida, solicitar input do usuário
  if (newCurrency === 'USD' && exchangeRate === 0) {
    showError('Digite a taxa de câmbio USD→R$ antes de mudar para dólar.');
    return;
  }
  
  if (newCurrency === 'BRL' && dollarRate === 0) {
    showError('Digite a taxa USD→R$ antes de mudar para reais.');
    return;
  }
  
  // Converter preços
  const rate = newCurrency === 'USD' ? exchangeRate : dollarRate;
  const converted = convertPricesOnCurrencyChange(currency, newCurrency, rate, macros);
  const convertedMicros = convertPricesOnCurrencyChange(currency, newCurrency, rate, micros);
  
  setMacros(converted);
  setMicros(convertedMicros);
  setCurrency(newCurrency);
  
  showSuccess(`Moeda alterada para ${newCurrency}. Preços convertidos automaticamente.`);
};
```

**2.4 — Exibição Dinâmica de Moeda**
```tsx
// Em MacroRow (já existe, mas refatorado):
<th className="px-2 py-2 text-left">
  Preço ({currency === 'BRL' ? 'R$' : 'US$'})
</th>

// Ícone junto ao input
<span className="text-[10px] text-stone-400 flex-shrink-0">
  {currency === 'BRL' ? 'R$' : 'US$'}
</span>
```

**2.5 — Exibição Adicional de Conversão (Novo)**
```tsx
// Mostrar valor convertido quando USD
{currency === 'USD' && exchangeRate > 0 && (
  <div className="text-[10px] text-stone-400 mt-1">
    ≈ R$ {(m.price * exchangeRate).toFixed(2)}/ton
  </div>
)}
```

### 3. **Componente Calculator** (`src/components/Calculator.tsx`)

#### Alterações necessárias:

**3.1 — Adicionar Seletor de Moeda**
```tsx
// Novo card no painel de fatores (após "Lista de Preço")
<div className="bg-stone-50 p-4 rounded-xl border border-stone-200">
  <label className="block text-sm font-medium text-stone-600 mb-2">
    💵 Moeda de Precificação
  </label>
  
  <div className="grid grid-cols-2 gap-2">
    <button
      onClick={() => handleFactorChange('currency', 'BRL')}
      className={`py-2 px-3 rounded-lg font-bold text-sm transition-colors ${
        factors.currency === 'BRL'
          ? 'bg-emerald-600 text-white'
          : 'bg-stone-200 text-stone-600 hover:bg-stone-300'
      }`}
    >
      R$ Real
    </button>
    <button
      onClick={() => handleFactorChange('currency', 'USD')}
      className={`py-2 px-3 rounded-lg font-bold text-sm transition-colors ${
        factors.currency === 'USD'
          ? 'bg-emerald-600 text-white'
          : 'bg-stone-200 text-stone-600 hover:bg-stone-300'
      }`}
    >
      US$ Dólar
    </button>
  </div>
  
  {factors.currency === 'USD' && (
    <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
      <label className="text-xs font-bold text-blue-700 block mb-2">
        Taxa de Câmbio (USD → R$):
      </label>
      <input
        type="number"
        value={factors.exchangeRate || 0}
        onChange={(e) => handleFactorChange('exchangeRate', Number(e.target.value))}
        className="w-full px-2 py-1.5 border border-blue-200 rounded text-sm"
        placeholder="ex: 5.25"
        step="0.01"
      />
      <p className="text-[10px] text-blue-600 mt-1">
        1 USD = R$ {(factors.exchangeRate || 0).toFixed(2)}
      </p>
    </div>
  )}
</div>
```

**3.2 — Sincronização de Moeda da Lista**
```typescript
useEffect(() => {
  if (selectedPriceList) {
    // Quando seleciona lista, carregar sua moeda e taxa
    handleFactorChange('currency', selectedPriceList.currency || 'BRL');
    if (selectedPriceList.currency === 'USD') {
      handleFactorChange('exchangeRate', selectedPriceList.exchangeRate || 0);
    } else if (selectedPriceList.currency === 'BRL') {
      handleFactorChange('exchangeRate', selectedPriceList.dollarRate || 0);
    }
  }
}, [selectedPriceList]);
```

**3.3 — Atualizar Resumo Final com Moeda**
```tsx
// Em "Summary Panel" - atualizar todos os valores exibidos
<div className="space-y-3 border-t border-stone-200 pt-4">
  <div className="flex justify-between items-center">
    <span className="text-stone-600 font-medium">Custo Base:</span>
    <span className="text-lg font-bold">
      {factors.currency === 'BRL' ? 'R$' : 'US$'} 
      {calc.summary?.baseCost.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
    </span>
  </div>
  
  {factors.currency === 'USD' && factors.exchangeRate && (
    <div className="flex justify-between items-center text-sm text-stone-500 bg-stone-50 p-2 rounded">
      <span>Equivalente em R$:</span>
      <span className="font-bold">
        R$ {(calc.summary?.baseCost * factors.exchangeRate).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
      </span>
    </div>
  )}
  
  <div className="flex justify-between items-center">
    <span className="text-emerald-700 font-bold">Preço Final:</span>
    <span className="text-2xl font-black text-emerald-600">
      {factors.currency === 'BRL' ? 'R$' : 'US$'} 
      {calc.summary?.finalPrice.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
    </span>
  </div>
  
  {factors.currency === 'USD' && factors.exchangeRate && (
    <div className="flex justify-between items-center text-sm font-bold text-emerald-700 bg-emerald-50 p-2 rounded">
      <span>Total em R$:</span>
      <span>
        R$ {(calc.summary?.finalPrice * factors.exchangeRate).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
      </span>
    </div>
  )}
</div>
```

**3.4 — Validação de Local Obrigatório**
```typescript
const validateFactors = (): boolean => {
  // ... validações existentes
  if (!factors.local_carregamento_id?.trim()) {
    showError('Local de carregamento é obrigatório. Selecione antes de precificar.');
    return false;
  }
  return true;
};

// Chamar antes de savePricing():
if (!validateFactors()) return;
```

### 4. **Componente PricingDetailModal** (`src/components/PricingDetailModal.tsx`)

#### Alterações para exibir moeda:

**4.1 — Adicionar Badge de Moeda no Header**
```tsx
<div className="flex items-center gap-3">
  <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded">
    {selectedPricing.factors.currency === 'BRL' ? 'R$' : 'US$'} 
    {selectedPricing.factors.currency === 'USD' && selectedPricing.factors.exchangeRate
      ? `• Câmbio: R$ ${selectedPricing.factors.exchangeRate.toFixed(2)}`
      : ''}
  </span>
</div>
```

**4.2 — Exibir Conversão em Reais na Tabela**
```tsx
// Em cada cálculo (TargetFormula)
const materials = getCalculationMaterials(calc);
const currency = selectedPricing.factors.currency;
const exchangeRate = selectedPricing.factors.exchangeRate || 1;

wsData.push(
  [`FÓRMULA ${idx + 1}: ${getCalculationFormulaLabel(calc)}`],
  ['COMPOSIÇÃO'],
  [
    'Produto',
    'Qtd (kg)',
    currency === 'BRL' ? 'Preço (R$/ton)' : 'Preço (US$/ton)',
    currency === 'BRL' ? 'Subtotal (R$)' : 'Subtotal (US$)',
    ...(currency === 'USD' ? ['Equivalente em R$'] : [])
  ]
);

materials.forEach((p) => {
  const subtotal = (p.quantity / 1000) * p.price;
  wsData.push([
    p.name,
    p.quantity,
    p.price,
    subtotal,
    ...(currency === 'USD' ? [(subtotal * exchangeRate).toFixed(2)] : [])
  ]);
});

// Resumo com moeda
wsData.push(
  ['RESUMO FINANCEIRO'],
  ['Custo Base', `${currency === 'BRL' ? 'R$' : 'US$'} ${calcSummary.baseCost.toFixed(2)}`],
  ...(currency === 'USD' 
    ? [['Custo Base (R$)', `R$ ${(calcSummary.baseCost * exchangeRate).toFixed(2)}`]]
    : []
  ),
  ['PREÇO FINAL', `${currency === 'BRL' ? 'R$' : 'US$'} ${calcSummary.finalPrice.toFixed(2)}`],
  ...(currency === 'USD'
    ? [['PREÇO FINAL (R$)', `R$ ${(calcSummary.finalPrice * exchangeRate).toFixed(2)}`]]
    : []
  ),
);
```

### 5. **Banco de Dados & Supabase** (`supabase/migrations/`)

#### Nova migração SQL:

```sql
-- Criar coluna de moeda em price_lists (se não existir)
ALTER TABLE price_lists
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'BRL',
ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(10,4),
ADD COLUMN IF NOT EXISTS dollar_rate DECIMAL(10,4);

-- Criar coluna de moeda em pricing_records
ALTER TABLE pricing_records
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'BRL',
ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(10,4),
ADD COLUMN IF NOT EXISTS local_carregamento_id UUID REFERENCES locais_carregamento(id);

-- Criar índice para queries mais rápidas
CREATE INDEX IF NOT EXISTS idx_pricing_records_currency ON pricing_records(currency);
CREATE INDEX IF NOT EXISTS idx_price_lists_currency ON price_lists(currency);
```

### 6. **Serviços de Banco de Dados** (`src/services/db.ts`)

#### Atualizar CRUDs:

```typescript
// UPDATE: createPriceList
export async function createPriceList(priceList: Omit<PriceList, 'id' | 'date'> & { date: string }) {
  const { data, error } = await supabase
    .from('price_lists')
    .insert([{
      ...priceList,
      currency: priceList.currency || 'BRL',
      exchange_rate: priceList.exchangeRate,
      dollar_rate: priceList.dollarRate,
      // local_carregamento_id já é salvo
    }])
    .select()
    .single();
  
  if (error) throw error;
  return mapPriceList(data);
}

// UPDATE: updatePriceList
export async function updatePriceList(id: string, updates: Partial<PriceList>) {
  const { data, error } = await supabase
    .from('price_lists')
    .update({
      name: updates.name,
      local_carregamento_id: updates.local_carregamento_id,
      currency: updates.currency,
      exchange_rate: updates.exchangeRate,
      dollar_rate: updates.dollarRate,
      macros: updates.macros,
      micros: updates.micros,
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return mapPriceList(data);
}

// UPDATE: savePricing
export async function savePricing(record: Omit<PricingRecord, 'id' | 'date'> & { date: string }) {
  const { data, error } = await supabase
    .from('pricing_records')
    .insert([{
      ...record,
      currency: record.factors.currency || 'BRL',
      exchange_rate: record.factors.exchangeRate,
      local_carregamento_id: record.factors.local_carregamento_id,
    }])
    .select()
    .single();
  
  if (error) throw error;
  return mapPricingRecord(data);
}
```

---

## 📋 Checklist de Implementação

### **Fase 1: Tipos & Tipos (1-2 horas)**
- [ ] Atualizar `src/types.ts` com novos campos
- [ ] Adicionar tipos para `CurrencyInfo`
- [ ] Documentar campos em comentários TSDoc

### **Fase 2: PriceListManager (3-4 horas)**
- [ ] Implementar validação de campo obrigatório (local)
- [ ] Criar `convertPricesOnCurrencyChange()` helper
- [ ] Implementar `handleCurrencyChange()`
- [ ] Adicionar exibição de símbolos de moeda
- [ ] Mostrar conversão automática em reais (USD)
- [ ] Testes unitários: conversão de preços

### **Fase 3: Calculator (4-5 horas)**
- [ ] Adicionar seletor de moeda (BRL/USD buttons)
- [ ] Campo de taxa de câmbio editável
- [ ] Sincronizar moeda com lista selecionada
- [ ] Validação de local obrigatório
- [ ] Atualizar resumo final com símbolos
- [ ] Exibir conversão em reais quando USD
- [ ] Testes: sincronização de moeda + conversão

### **Fase 4: PricingDetailModal (2-3 horas)**
- [ ] Adicionar badge de moeda no header
- [ ] Atualizar tabelas de composição
- [ ] Exibir conversão em R$ nos PDFs
- [ ] Sincronizar com histórico

### **Fase 5: Database & Services (1-2 horas)**
- [ ] Criar migração SQL no Supabase
- [ ] Atualizar `createPriceList()` em db.ts
- [ ] Atualizar `updatePriceList()` em db.ts
- [ ] Atualizar `savePricing()` em db.ts
- [ ] Adicionar mapeamento de campos

### **Fase 6: Testes & QA (3-4 horas)**
- [ ] Teste manual: criar lista em BRL
- [ ] Teste manual: criar lista em USD
- [ ] Teste manual: alterar moeda com conversão
- [ ] Teste manual: precificar com cada moeda
- [ ] Teste manual: visualizar PDF com moeda
- [ ] Teste manual: validações (local obrigatório)
- [ ] Testes automatizados com Vitest

### **Fase 7: Documentação (1 hora)**
- [ ] Atualizar README.md com nova feature
- [ ] Adicionar exemplos de uso
- [ ] Documentar API de conversão

---

## 🔄 Fluxo do Usuário

### **Criar Lista de Preço em USD**
1. Usuário acessa "Gerenciamento de Listas de Preços"
2. Seleciona **Local de Carregamento** (agora obrigatório)
3. Seleciona **Moeda: US$ Dólar**
4. Digita **Taxa de Câmbio: ex. 5.25** (1 USD = R$ 5.25)
5. Adiciona Macros e Micros com preços em dólar
6. Salva lista → **Preços persistem em USD, taxa salva**

### **Usar Lista USD na Calculadora**
1. Seleciona lista USD na Calculadora
2. **Moeda muda automaticamente para USD**
3. **Taxa de câmbio carregada na calculadora**
4. Ao marcar "em Dólar" → exibe valores em USD
5. Ao marcar "em Reais" → exibe conversão automática (USD × taxa)
6. Se usuário altera taxa → **valores em reais recalculam em tempo real**
7. Ao salvar precificação → **taxa fica registrada**

### **Visualizar Precificação**
1. Modal de detalhes exibe badge: "US$ • Câmbio: R$ 5.25"
2. Tabela PDF mostra:
   - Coluna de preço em US$
   - Coluna adicional "Equivalente em R$" (quando USD)
3. Resumo: "Preço Final: US$ 1.500 | Equivalente em R$: R$ 7.875"

---

## 📊 Estrutura de Dados Persistida

```json
{
  "price_list": {
    "id": "uuid-123",
    "name": "Lista Maio 2026 - USD",
    "local_carregamento_id": "local-456",
    "date": "2026-05-21T10:30:00Z",
    "currency": "USD",
    "exchange_rate": 5.25,
    "dollar_rate": null,
    "macros": [
      {
        "id": "macro-1",
        "name": "Ureia",
        "price": 250.00,
        "originalCurrency": "USD"
      }
    ],
    "micros": []
  }
}
```

---

## 🚨 Impactos & Considerações

### **Impacto em Componentes Existentes:**
- ✅ **PriceListManager**: Refatoração moderada (adicionar validações)
- ✅ **Calculator**: Novo painel de moeda, sincronização automática
- ✅ **PricingDetailModal**: Exibição de moeda em tabelas
- ✅ **History**: Exibir moeda de cada precificação
- ⚠️ **Relatórios**: Filtrar por moeda (fase 2 - futuro)

### **Testes Críticos:**
1. Conversão BRL → USD e USD → BRL com múltiplas taxas
2. Precificar com moedas diferentes
3. Alterar taxa e verificar recalculation automático
4. Salvar e recuperar precificações com moedas
5. PDFs com valores convertidos

### **Performance:**
- Conversão de preços: O(n) onde n = número de materiais
- Sem impacto significativo em queries (índices de moeda adicionados)

---

## 📱 Exemplos de Código

### **Uso do Helper de Conversão**
```typescript
const materials = macros;
const converted = convertPricesOnCurrencyChange('USD', 'BRL', 5.25, materials);
// Resultado: [{ price: 250.00 → 1312.50, priceInBRL: 1312.50 }]
```

### **Exibir Moeda em Resume**
```tsx
<span className="font-bold">
  {factors.currency === 'BRL' ? 'R$' : 'US$'} 
  {summary.finalPrice.toLocaleString('pt-BR')}
</span>
```

### **Conversão de Exibição**
```typescript
const displayValue = (price: number, currency: 'BRL' | 'USD', exchangeRate: number) => {
  return currency === 'USD'
    ? `US$ ${price.toFixed(2)} (R$ ${(price * exchangeRate).toFixed(2)})`
    : `R$ ${price.toFixed(2)}`;
};
```

---

## ⏱️ Estimativa Total

| Fase | Tarefa | Tempo | 
|------|--------|-------|
| 1 | Tipos | 1.5h |
| 2 | PriceListManager | 3.5h |
| 3 | Calculator | 4.5h |
| 4 | Modal | 2.5h |
| 5 | Database | 1.5h |
| 6 | Testes | 3.5h |
| 7 | Docs | 1h |
| **TOTAL** | | **~18h** |

---

## 🎯 Próximas Fases (Futuro)

- **Fase 2**: Relatórios de câmbio histórico
- **Fase 3**: Atualização automática de taxas via API de mercado
- **Fase 4**: Alertas quando taxa varia muito
- **Fase 5**: Suporte a mais moedas (EUR, CAD, etc.)

---

## 📞 Referências

- **Componentes:** `PriceListManager.tsx`, `Calculator.tsx`, `PricingDetailModal.tsx`
- **Tipos:** `src/types.ts`
- **Services:** `src/services/db.ts`
- **Banco:** Supabase PostgreSQL
