import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data directory exists
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize SQLite database
const db = new Database(path.join(dataDir, "management.db"));

// Enable WAL mode for better concurrent performance
db.pragma("journal_mode = WAL");

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS unidades (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    ordem_exibicao INTEGER DEFAULT 0,
    ativo INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS categorias (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    ordem INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS indicadores (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    categoria TEXT NOT NULL,
    unidade_medida TEXT NOT NULL,
    digitavel INTEGER DEFAULT 1,
    ordem INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS lancamentos (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    unidade_id TEXT NOT NULL,
    indicador_id TEXT NOT NULL,
    valor REAL DEFAULT 0,
    observacao TEXT,
    usuario_id TEXT,
    created_at TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS metas (
    id TEXT PRIMARY KEY,
    unidade_id TEXT NOT NULL,
    ano INTEGER NOT NULL,
    mes INTEGER NOT NULL,
    indicador_id TEXT NOT NULL,
    valor_meta REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS configuracoes_indicadores (
    unidade_id TEXT NOT NULL,
    indicador_id TEXT NOT NULL,
    nome_personalizado TEXT,
    visivel INTEGER DEFAULT 1,
    PRIMARY KEY (unidade_id, indicador_id)
  );

  CREATE TABLE IF NOT EXISTS dias_uteis (
    unidade_id TEXT NOT NULL,
    ano INTEGER NOT NULL,
    mes INTEGER NOT NULL,
    total_dias_uteis INTEGER DEFAULT 0,
    PRIMARY KEY (unidade_id, ano, mes)
  );
`);

// Seed initial data only if tables are empty
const seedUnidades = db.prepare("SELECT COUNT(*) as count FROM unidades").get() as { count: number };
if (seedUnidades.count === 0) {
  const insertUnidade = db.prepare("INSERT INTO unidades (id, nome, ordem_exibicao, ativo) VALUES (?, ?, ?, ?)");
  const seedUnidadesData = [
    ['u1', 'Unidade São Paulo', 1, 1],
    ['u2', 'Unidade Rio de Janeiro', 2, 1],
    ['u3', 'Unidade Curitiba', 3, 1],
  ];
  for (const u of seedUnidadesData) insertUnidade.run(...u);
}

const seedCategorias = db.prepare("SELECT COUNT(*) as count FROM categorias").get() as { count: number };
if (seedCategorias.count === 0) {
  const insertCategoria = db.prepare("INSERT INTO categorias (id, nome, ordem) VALUES (?, ?, ?)");
  const seedCategoriasData = [
    ['cat1', 'Faturamento', 1],
    ['cat2', 'Carregamento', 2],
    ['cat3', 'Rentabilidade', 3],
    ['cat4', 'Cancelamentos', 4],
    ['cat5', 'Entrada de Pedidos', 5],
    ['cat6', 'Carteira de Pedidos', 6],
    ['cat7', 'Produção', 7],
  ];
  for (const c of seedCategoriasData) insertCategoria.run(...c);
}

const seedIndicadores = db.prepare("SELECT COUNT(*) as count FROM indicadores").get() as { count: number };
if (seedIndicadores.count === 0) {
  const insertIndicador = db.prepare("INSERT INTO indicadores (id, nome, categoria, unidade_medida, digitavel, ordem) VALUES (?, ?, ?, ?, ?, ?)");
  const seedIndicadoresData = [
    ['v1', 'Tons Vendido no Dia', 'Faturamento', 'TON.', 1, 1],
    ['v2', 'Rentabilidade do Dia', 'Rentabilidade', '%', 1, 2],
    ['v3', 'Entrada Geral Pedidos', 'Entrada de Pedidos', 'R$', 1, 3],
    ['v4', 'Cancelamento Bruto Dia', 'Cancelamentos', 'TON.', 1, 4],
    ['v5', 'Carteira Total Ano', 'Carteira de Pedidos', 'R$', 1, 5],
    ['c1', 'Produção do Dia', 'Produção', 'TON.', 1, 6],
    ['f1', 'Faturamento Venda', 'Faturamento', 'R$', 1, 7],
    ['f2', 'Faturamento Consignado', 'Faturamento', 'R$', 1, 8],
    ['f3', 'Remessa Conta e Ordem', 'Faturamento', 'R$', 1, 9],
  ];
  for (const i of seedIndicadoresData) insertIndicador.run(...i);
}

const seedDiasUteis = db.prepare("SELECT COUNT(*) as count FROM dias_uteis").get() as { count: number };
if (seedDiasUteis.count === 0) {
  const insertDiasUteis = db.prepare("INSERT INTO dias_uteis (unidade_id, ano, mes, total_dias_uteis) VALUES (?, ?, ?, ?)");
  const seedDiasUteisData = [
    ['u1', 2026, 2, 21],
    ['u2', 2026, 2, 21],
    ['u3', 2026, 2, 21],
  ];
  for (const d of seedDiasUteisData) insertDiasUteis.run(...d);
}

const seedLancamentos = db.prepare("SELECT COUNT(*) as count FROM lancamentos").get() as { count: number };
if (seedLancamentos.count === 0) {
  const insertLancamento = db.prepare(
    "INSERT INTO lancamentos (id, data, unidade_id, indicador_id, valor) VALUES (?, ?, ?, ?, ?)"
  );
  const today = '2026-02-26';
  const unidadesSeed = [
    { id: 'u1', valor_v1: 450, valor_f1: 150000 },
    { id: 'u2', valor_v1: 380, valor_f1: 120000 },
    { id: 'u3', valor_v1: 290, valor_f1: 95000 },
  ];
  for (const u of unidadesSeed) {
    insertLancamento.run(`l-${u.id}-v1`, today, u.id, 'v1', u.valor_v1);
    insertLancamento.run(`l-${u.id}-v2`, today, u.id, 'v2', 0);
    insertLancamento.run(`l-${u.id}-v3`, today, u.id, 'v3', 0);
    insertLancamento.run(`l-${u.id}-v4`, today, u.id, 'v4', 0);
    insertLancamento.run(`l-${u.id}-v5`, today, u.id, 'v5', 0);
    insertLancamento.run(`l-${u.id}-f1`, today, u.id, 'f1', u.valor_f1);
    insertLancamento.run(`l-${u.id}-f2`, today, u.id, 'f2', 0);
    insertLancamento.run(`l-${u.id}-f3`, today, u.id, 'f3', 0);
  }
}

// Helper to convert SQLite integer booleans to JS booleans for unidades/indicadores
function rowToUnidade(row: any) {
  return { ...row, ativo: row.ativo === 1 || row.ativo === true };
}
function rowToIndicador(row: any) {
  return { ...row, digitavel: row.digitavel === 1 || row.digitavel === true };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/categorias", (req, res) => {
    res.json(db.prepare("SELECT * FROM categorias ORDER BY ordem").all());
  });
  app.post("/api/categorias", (req, res) => {
    const c = req.body;
    db.prepare(
      "INSERT INTO categorias (id, nome, ordem) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET nome=excluded.nome, ordem=excluded.ordem"
    ).run(c.id, c.nome, c.ordem ?? 0);
    res.json(c);
  });
  app.delete("/api/categorias/:id", (req, res) => {
    db.prepare("DELETE FROM categorias WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/unidades", (req, res) => {
    res.json((db.prepare("SELECT * FROM unidades ORDER BY ordem_exibicao").all() as any[]).map(rowToUnidade));
  });
  app.post("/api/unidades", (req, res) => {
    const u = req.body;
    db.prepare(
      "INSERT INTO unidades (id, nome, ordem_exibicao, ativo) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET nome=excluded.nome, ordem_exibicao=excluded.ordem_exibicao, ativo=excluded.ativo"
    ).run(u.id, u.nome, u.ordem_exibicao ?? 0, u.ativo ? 1 : 0);
    res.json(rowToUnidade({ ...u, ativo: u.ativo ? 1 : 0 }));
  });
  app.delete("/api/unidades/:id", (req, res) => {
    db.prepare("DELETE FROM unidades WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/indicadores", (req, res) => {
    res.json((db.prepare("SELECT * FROM indicadores ORDER BY ordem").all() as any[]).map(rowToIndicador));
  });
  app.post("/api/indicadores", (req, res) => {
    const i = req.body;
    db.prepare(
      "INSERT INTO indicadores (id, nome, categoria, unidade_medida, digitavel, ordem) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET nome=excluded.nome, categoria=excluded.categoria, unidade_medida=excluded.unidade_medida, digitavel=excluded.digitavel, ordem=excluded.ordem"
    ).run(i.id, i.nome, i.categoria, i.unidade_medida, i.digitavel ? 1 : 0, i.ordem ?? 0);
    res.json(rowToIndicador({ ...i, digitavel: i.digitavel ? 1 : 0 }));
  });
  app.delete("/api/indicadores/:id", (req, res) => {
    db.prepare("DELETE FROM indicadores WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/lancamentos", (req, res) => {
    const { data, unidade_id } = req.query;
    let sql = "SELECT * FROM lancamentos WHERE 1=1";
    const params: any[] = [];
    if (data) { sql += " AND data = ?"; params.push(data); }
    if (unidade_id) { sql += " AND unidade_id = ?"; params.push(unidade_id); }
    res.json(db.prepare(sql).all(...params));
  });
  app.post("/api/lancamentos", (req, res) => {
    const l = req.body;
    db.prepare(
      "INSERT INTO lancamentos (id, data, unidade_id, indicador_id, valor, observacao, usuario_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data, unidade_id=excluded.unidade_id, indicador_id=excluded.indicador_id, valor=excluded.valor, observacao=excluded.observacao, usuario_id=excluded.usuario_id, updated_at=excluded.updated_at"
    ).run(l.id, l.data, l.unidade_id, l.indicador_id, l.valor ?? 0, l.observacao ?? null, l.usuario_id ?? null, l.created_at ?? null, l.updated_at ?? null);
    res.json(l);
  });
  app.delete("/api/lancamentos/:id", (req, res) => {
    db.prepare("DELETE FROM lancamentos WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/metas", (req, res) => {
    res.json(db.prepare("SELECT * FROM metas").all());
  });
  app.post("/api/metas", (req, res) => {
    const m = req.body;
    db.prepare(
      "INSERT INTO metas (id, unidade_id, ano, mes, indicador_id, valor_meta) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET unidade_id=excluded.unidade_id, ano=excluded.ano, mes=excluded.mes, indicador_id=excluded.indicador_id, valor_meta=excluded.valor_meta"
    ).run(m.id, m.unidade_id, m.ano, m.mes, m.indicador_id, m.valor_meta ?? 0);
    res.json(m);
  });
  app.delete("/api/metas/:id", (req, res) => {
    db.prepare("DELETE FROM metas WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/configuracoes-indicadores", (req, res) => {
    res.json(
      (db.prepare("SELECT * FROM configuracoes_indicadores").all() as any[]).map(r => ({
        ...r,
        visivel: r.visivel === 1 || r.visivel === true,
      }))
    );
  });
  app.post("/api/configuracoes-indicadores", (req, res) => {
    const c = req.body;
    db.prepare(
      "INSERT INTO configuracoes_indicadores (unidade_id, indicador_id, nome_personalizado, visivel) VALUES (?, ?, ?, ?) ON CONFLICT(unidade_id, indicador_id) DO UPDATE SET nome_personalizado=excluded.nome_personalizado, visivel=excluded.visivel"
    ).run(c.unidade_id, c.indicador_id, c.nome_personalizado ?? null, c.visivel ? 1 : 0);
    res.json(c);
  });
  app.delete("/api/configuracoes-indicadores", (req, res) => {
    const { unidade_id, indicador_id } = req.query;
    db.prepare("DELETE FROM configuracoes_indicadores WHERE unidade_id = ? AND indicador_id = ?").run(unidade_id, indicador_id);
    res.json({ success: true });
  });

  app.get("/api/dias-uteis", (req, res) => {
    res.json(db.prepare("SELECT * FROM dias_uteis").all());
  });
  app.post("/api/dias-uteis", (req, res) => {
    const d = req.body;
    db.prepare(
      "INSERT INTO dias_uteis (unidade_id, ano, mes, total_dias_uteis) VALUES (?, ?, ?, ?) ON CONFLICT(unidade_id, ano, mes) DO UPDATE SET total_dias_uteis=excluded.total_dias_uteis"
    ).run(d.unidade_id, d.ano, d.mes, d.total_dias_uteis ?? 0);
    res.json(d);
  });
  app.delete("/api/dias-uteis", (req, res) => {
    const { unidade_id, ano, mes } = req.query;
    db.prepare("DELETE FROM dias_uteis WHERE unidade_id = ? AND ano = ? AND mes = ?").run(unidade_id, Number(ano), Number(mes));
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
