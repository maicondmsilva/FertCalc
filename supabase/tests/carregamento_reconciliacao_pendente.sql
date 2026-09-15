-- Somente leitura: não inferir carga física de registros históricos sem evidência.
select c.numero_carregamento,c.status,c.quantidade_total,c.quantidade_liberada,
       c.quantidade_carregada,c.quantidade_cancelada,c.data_real_carregamento,
       coalesce(e.carregado,0) as quantidade_comprovada_execucoes,
       coalesce(e.execucoes,0) as numero_execucoes
from public.carregamentos c
left join lateral(
 select count(*) as execucoes,
        sum(quantidade_carregada) filter(where status='concluido') as carregado
 from public.carregamento_execucoes where carregamento_id=c.id
) e on true
where c.status='carregado'
  and coalesce(e.carregado,0)=0 and coalesce(c.quantidade_carregada,0)=0;
