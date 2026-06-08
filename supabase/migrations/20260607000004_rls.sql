-- Row Level Security: autenticados leem tudo; escrita por papel.
alter table profiles enable row level security;
alter table setores enable row level security;
alter table categorias enable row level security;
alter table fornecedores enable row level security;
alter table produtos enable row level security;
alter table lotes enable row level security;
alter table movimentacoes enable row level security;

-- Verifica papel admin do usuário corrente.
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from profiles where id = auth.uid() and papel = 'admin');
$$;

-- Leitura: qualquer usuário autenticado.
create policy sel_auth on profiles      for select to authenticated using (true);
create policy sel_auth on setores       for select to authenticated using (true);
create policy sel_auth on categorias    for select to authenticated using (true);
create policy sel_auth on fornecedores  for select to authenticated using (true);
create policy sel_auth on produtos      for select to authenticated using (true);
create policy sel_auth on lotes         for select to authenticated using (true);
create policy sel_auth on movimentacoes for select to authenticated using (true);

-- Operador + admin: produtos, lotes e registro de movimentações.
create policy wr_prod on produtos for all to authenticated using (true) with check (true);
create policy wr_lote on lotes    for all to authenticated using (true) with check (true);
create policy ins_mov on movimentacoes for insert to authenticated with check (true);

-- Cadastros base: somente admin escreve.
create policy wr_setor on setores      for all to authenticated using (is_admin()) with check (is_admin());
create policy wr_categ on categorias   for all to authenticated using (is_admin()) with check (is_admin());
create policy wr_forn  on fornecedores for all to authenticated using (is_admin()) with check (is_admin());

-- Profiles: cada um edita o seu; admin gere todos.
create policy upd_profile on profiles for update to authenticated
  using (id = auth.uid() or is_admin()) with check (id = auth.uid() or is_admin());
