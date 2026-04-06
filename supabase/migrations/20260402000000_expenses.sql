-- ============================================================
-- MÓDULO: GASTOS CARTÃO (Credit Card Expenses)
-- ============================================================

-- Tabela: categorias de gastos
CREATE TABLE IF NOT EXISTS expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  budget_limit NUMERIC,
  color TEXT,
  icon TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: gastos do cartão de crédito
CREATE TABLE IF NOT EXISTS credit_card_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  date DATE NOT NULL,
  category_id UUID REFERENCES expense_categories(id),
  status TEXT NOT NULL DEFAULT 'pendente',
  card_name TEXT,
  installments INTEGER DEFAULT 1,
  current_installment INTEGER,
  receipt TEXT,
  observation TEXT,
  user_id TEXT NOT NULL,
  user_name TEXT,
  period_month INTEGER NOT NULL,
  period_year INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: auditoria de gastos
CREATE TABLE IF NOT EXISTS expense_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES credit_card_expenses(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT,
  observation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_expenses_period ON credit_card_expenses(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_expenses_user ON credit_card_expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON credit_card_expenses(status);
CREATE INDEX IF NOT EXISTS idx_expense_audit_expense ON expense_audit(expense_id);

-- ============================================================
-- RLS POLICIES
-- ============================================================

ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_expense_categories" ON expense_categories;
CREATE POLICY "allow_all_expense_categories" ON expense_categories FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE credit_card_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_credit_card_expenses" ON credit_card_expenses;
CREATE POLICY "allow_all_credit_card_expenses" ON credit_card_expenses FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE expense_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_expense_audit" ON expense_audit;
CREATE POLICY "allow_all_expense_audit" ON expense_audit FOR ALL USING (true) WITH CHECK (true);
