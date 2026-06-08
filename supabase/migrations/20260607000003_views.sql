-- Estoque agregado por produto, com flags de alerta.
-- security_invoker => o RLS das tabelas-base se aplica (anon não lê).
create or replace view vw_estoque_produto with (security_invoker = true) as
select
  p.id            as produto_id,
  p.nome,
  p.unidade,
  p.estoque_minimo,
  p.setor_id,
  p.categoria_id,
  p.ativo,
  coalesce(sum(l.quantidade), 0)::int as estoque_total,
  (coalesce(sum(l.quantidade), 0) <= p.estoque_minimo) as estoque_baixo,
  min(l.validade) filter (where l.quantidade > 0) as proxima_validade
from produtos p
left join lotes l on l.produto_id = p.id
group by p.id;
