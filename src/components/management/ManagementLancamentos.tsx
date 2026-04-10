import React, { useState, useEffect } from 'react';
import { Upload, Save, Loader2, ArrowRightLeft } from 'lucide-react';
import { format } from 'date-fns';
import type {
  Unidade,
  Indicador,
  Lancamento,
  ConfiguracaoIndicador,
  Categoria,
  User,
} from '../../types';
import { getMgmtLancamentos } from '../../services/db';
import { Card, Button, Input, Select } from './ManagementUI';

interface ManagementLancamentosProps {
  unidades: Unidade[];
  indicadores: Indicador[];
  categorias: Categoria[];
  configs: ConfiguracaoIndicador[];
  currentUser: User;
  onSave: (l: Partial<Lancamento>[]) => Promise<void>;
}

export default function ManagementLancamentos({
  unidades,
  indicadores,
  categorias,
  configs,
  currentUser,
  onSave,
}: ManagementLancamentosProps) {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedUnidade, setSelectedUnidade] = useState('');
  const [values, setValues] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedUnidade && selectedDate) {
      getMgmtLancamentos({ data: selectedDate, unidade_id: selectedUnidade }).then((data) => {
        const newValues: Record<string, number> = {};
        data.forEach((l: Lancamento) => {
          newValues[l.indicador_id] = l.valor;
        });
        setValues(newValues);
      });
    }
  }, [selectedDate, selectedUnidade]);

  const handleSave = async () => {
    if (!selectedUnidade) return;
    setLoading(true);
    const toSave: Partial<Lancamento>[] = Object.entries(values).map(([indicador_id, valor]) => ({
      id: `${selectedDate}-${selectedUnidade}-${indicador_id}`,
      data: selectedDate,
      unidade_id: selectedUnidade,
      indicador_id,
      valor: Number(valor),
      usuario_id: currentUser.id,
    }));
    await onSave(toSave);
    setLoading(false);
  };

  const getIndicadorLabel = (ind: Indicador) => {
    const config = configs.find(
      (c) => c.unidade_id === selectedUnidade && c.indicador_id === ind.id
    );
    return config?.nome_personalizado || ind.nome;
  };

  const isIndicadorVisible = (ind: Indicador) => {
    const config = configs.find(
      (c) => c.unidade_id === selectedUnidade && c.indicador_id === ind.id
    );
    return config ? config.visivel : true;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Lançamento Diário</h1>
          <p className="text-slate-500">Registre os indicadores do dia</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2">
            <Upload className="w-4 h-4" />
            Importar Excel
          </Button>
          <Button onClick={handleSave} disabled={loading || !selectedUnidade} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Lançamentos
          </Button>
        </div>
      </div>

      <Card className="p-6 bg-indigo-50/30 border-indigo-100">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Data do Lançamento</label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Unidade de Negócio</label>
            <Select value={selectedUnidade} onChange={(e) => setSelectedUnidade(e.target.value)}>
              <option value="">Selecione uma unidade...</option>
              {unidades
                .filter((u) => u.ativo)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
            </Select>
          </div>
        </div>
      </Card>

      {!selectedUnidade ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <ArrowRightLeft className="w-12 h-12 mb-4 opacity-20" />
          <p>Selecione uma unidade para iniciar os lançamentos</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...categorias]
            .sort((a, b) => a.ordem - b.ordem)
            .map((cat) => (
              <div key={cat.id}>
                <Card className="flex flex-col h-full">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                    <h3 className="font-bold text-indigo-600 text-xs uppercase tracking-wider">
                      {cat.nome}
                    </h3>
                  </div>
                  <div className="p-4 space-y-4 flex-1">
                    {indicadores
                      .filter(
                        (i) => i.categoria === cat.nome && i.digitavel && isIndicadorVisible(i)
                      )
                      .map((ind) => (
                        <div key={ind.id} className="flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-900">
                              {getIndicadorLabel(ind)}
                            </p>
                            <p className="text-[10px] text-slate-500 uppercase">
                              {ind.unidade_medida}
                            </p>
                          </div>
                          <div className="w-32">
                            <Input
                              type="number"
                              value={values[ind.id] || ''}
                              onChange={(e) =>
                                setValues((prev) => ({
                                  ...prev,
                                  [ind.id]: parseFloat(e.target.value),
                                }))
                              }
                              placeholder="0.00"
                              className="text-right font-mono"
                            />
                          </div>
                        </div>
                      ))}
                    {indicadores.filter(
                      (i) => i.categoria === cat.nome && i.digitavel && isIndicadorVisible(i)
                    ).length === 0 && (
                      <p className="text-xs text-slate-400 italic">
                        Nenhum indicador visível nesta categoria.
                      </p>
                    )}
                  </div>
                </Card>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
