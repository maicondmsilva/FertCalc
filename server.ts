import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Mock Data
  let unidades = [
    { id: 'u1', nome: 'Unidade São Paulo', ordem_exibicao: 1, ativo: true },
    { id: 'u2', nome: 'Unidade Rio de Janeiro', ordem_exibicao: 2, ativo: true },
    { id: 'u3', nome: 'Unidade Curitiba', ordem_exibicao: 3, ativo: true },
  ];

  let categorias = [
    { id: 'cat1', nome: 'Faturamento', ordem: 1 },
    { id: 'cat2', nome: 'Carregamento', ordem: 2 },
    { id: 'cat3', nome: 'Rentabilidade', ordem: 3 },
    { id: 'cat4', nome: 'Cancelamentos', ordem: 4 },
    { id: 'cat5', nome: 'Entrada de Pedidos', ordem: 5 },
    { id: 'cat6', nome: 'Carteira de Pedidos', ordem: 6 },
    { id: 'cat7', nome: 'Produção', ordem: 7 },
  ];

  let indicadores = [
    { id: 'v1', nome: 'Tons Vendido no Dia', categoria: 'Faturamento', unidade_medida: 'TON.', digitavel: true, ordem: 1 },
    { id: 'v2', nome: 'Rentabilidade do Dia', categoria: 'Rentabilidade', unidade_medida: '%', digitavel: true, ordem: 2 },
    { id: 'v3', nome: 'Entrada Geral Pedidos', categoria: 'Entrada de Pedidos', unidade_medida: 'R$', digitavel: true, ordem: 3 },
    { id: 'v4', nome: 'Cancelamento Bruto Dia', categoria: 'Cancelamentos', unidade_medida: 'TON.', digitavel: true, ordem: 4 },
    { id: 'v5', nome: 'Carteira Total Ano', categoria: 'Carteira de Pedidos', unidade_medida: 'R$', digitavel: true, ordem: 5 },
    { id: 'c1', nome: 'Produção do Dia', categoria: 'Produção', unidade_medida: 'TON.', digitavel: true, ordem: 6 },
    { id: 'f1', nome: 'Faturamento Venda', categoria: 'Faturamento', unidade_medida: 'R$', digitavel: true, ordem: 7 },
    { id: 'f2', nome: 'Faturamento Consignado', categoria: 'Faturamento', unidade_medida: 'R$', digitavel: true, ordem: 8 },
    { id: 'f3', nome: 'Remessa Conta e Ordem', categoria: 'Faturamento', unidade_medida: 'R$', digitavel: true, ordem: 9 },
  ];

  let lancamentos: any[] = [];
  let metas: any[] = [];
  let configs: any[] = [];
  let diasUteis: any[] = [
    { unidade_id: 'u1', ano: 2026, mes: 2, total_dias_uteis: 21 },
    { unidade_id: 'u2', ano: 2026, mes: 2, total_dias_uteis: 21 },
    { unidade_id: 'u3', ano: 2026, mes: 2, total_dias_uteis: 21 },
  ];

  // Initial data to match image
  const today = '2026-02-26';
  unidades.forEach(u => {
    // Vendas
    lancamentos.push({ id: `l-${u.id}-v1`, data: today, unidade_id: u.id, indicador_id: 'v1', valor: u.id === 'u1' ? 450 : u.id === 'u2' ? 380 : 290 });
    lancamentos.push({ id: `l-${u.id}-v2`, data: today, unidade_id: u.id, indicador_id: 'v2', valor: 0 });
    lancamentos.push({ id: `l-${u.id}-v3`, data: today, unidade_id: u.id, indicador_id: 'v3', valor: 0 });
    lancamentos.push({ id: `l-${u.id}-v4`, data: today, unidade_id: u.id, indicador_id: 'v4', valor: 0 });
    lancamentos.push({ id: `l-${u.id}-v5`, data: today, unidade_id: u.id, indicador_id: 'v5', valor: 0 });
    // Faturamento
    lancamentos.push({ id: `l-${u.id}-f1`, data: today, unidade_id: u.id, indicador_id: 'f1', valor: u.id === 'u1' ? 150000 : u.id === 'u2' ? 120000 : 95000 });
    lancamentos.push({ id: `l-${u.id}-f2`, data: today, unidade_id: u.id, indicador_id: 'f2', valor: 0 });
    lancamentos.push({ id: `l-${u.id}-f3`, data: today, unidade_id: u.id, indicador_id: 'f3', valor: 0 });
  });

  // API Routes
  app.get("/api/categorias", (req, res) => res.json(categorias));
  app.post("/api/categorias", (req, res) => {
    const c = req.body;
    const idx = categorias.findIndex(x => x.id === c.id);
    if (idx >= 0) categorias[idx] = c;
    else categorias.push(c);
    res.json(c);
  });
  app.delete("/api/categorias/:id", (req, res) => {
    categorias = categorias.filter(c => c.id !== req.params.id);
    res.json({ success: true });
  });
  app.get("/api/unidades", (req, res) => res.json(unidades));
  app.post("/api/unidades", (req, res) => {
    const u = req.body;
    const idx = unidades.findIndex(x => x.id === u.id);
    if (idx >= 0) unidades[idx] = u;
    else unidades.push(u);
    res.json(u);
  });
  app.delete("/api/unidades/:id", (req, res) => {
    unidades = unidades.filter(u => u.id !== req.params.id);
    res.json({ success: true });
  });

  app.get("/api/indicadores", (req, res) => res.json(indicadores));
  app.post("/api/indicadores", (req, res) => {
    const i = req.body;
    const idx = indicadores.findIndex(x => x.id === i.id);
    if (idx >= 0) indicadores[idx] = i;
    else indicadores.push(i);
    res.json(i);
  });
  app.delete("/api/indicadores/:id", (req, res) => {
    indicadores = indicadores.filter(i => i.id !== req.params.id);
    res.json({ success: true });
  });

  app.get("/api/lancamentos", (req, res) => {
    const { data, unidade_id } = req.query;
    let filtered = lancamentos;
    if (data) filtered = filtered.filter(l => l.data === data);
    if (unidade_id) filtered = filtered.filter(l => l.unidade_id === unidade_id);
    res.json(filtered);
  });
  app.post("/api/lancamentos", (req, res) => {
    const l = req.body;
    const idx = lancamentos.findIndex(x => x.id === l.id);
    if (idx >= 0) lancamentos[idx] = l;
    else lancamentos.push(l);
    res.json(l);
  });
  app.delete("/api/lancamentos/:id", (req, res) => {
    lancamentos = lancamentos.filter(l => l.id !== req.params.id);
    res.json({ success: true });
  });

  app.get("/api/metas", (req, res) => res.json(metas));
  app.post("/api/metas", (req, res) => {
    const m = req.body;
    const idx = metas.findIndex(x => x.id === m.id);
    if (idx >= 0) metas[idx] = m;
    else metas.push(m);
    res.json(m);
  });
  app.delete("/api/metas/:id", (req, res) => {
    metas = metas.filter(m => m.id !== req.params.id);
    res.json({ success: true });
  });

  app.get("/api/configuracoes-indicadores", (req, res) => res.json(configs));
  app.post("/api/configuracoes-indicadores", (req, res) => {
    const c = req.body;
    const idx = configs.findIndex(x => x.unidade_id === c.unidade_id && x.indicador_id === c.indicador_id);
    if (idx >= 0) configs[idx] = c;
    else configs.push(c);
    res.json(c);
  });
  app.delete("/api/configuracoes-indicadores", (req, res) => {
    const { unidade_id, indicador_id } = req.query;
    configs = configs.filter(c => !(c.unidade_id === unidade_id && c.indicador_id === indicador_id));
    res.json({ success: true });
  });

  app.get("/api/dias-uteis", (req, res) => res.json(diasUteis));
  app.post("/api/dias-uteis", (req, res) => {
    const d = req.body;
    const idx = diasUteis.findIndex(x => x.unidade_id === d.unidade_id && x.ano === d.ano && x.mes === d.mes);
    if (idx >= 0) diasUteis[idx] = d;
    else diasUteis.push(d);
    res.json(d);
  });
  app.delete("/api/dias-uteis", (req, res) => {
    const { unidade_id, ano, mes } = req.query;
    diasUteis = diasUteis.filter(d => !(d.unidade_id === unidade_id && d.ano === Number(ano) && d.mes === Number(mes)));
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
