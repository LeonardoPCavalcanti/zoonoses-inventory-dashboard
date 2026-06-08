-- Habilita o Realtime (postgres_changes) nas tabelas do domínio:
-- é o que faz o estoque atualizar ao vivo em todos os clientes.
alter publication supabase_realtime add table movimentacoes;
alter publication supabase_realtime add table lotes;
alter publication supabase_realtime add table produtos;
alter publication supabase_realtime add table setores;
alter publication supabase_realtime add table categorias;
alter publication supabase_realtime add table fornecedores;
