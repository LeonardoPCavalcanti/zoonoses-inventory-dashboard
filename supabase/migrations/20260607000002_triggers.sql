-- Triggers: atribuição de responsável, aplicação da movimentação ao saldo,
-- e criação automática de profile para novos usuários do Auth.

-- Atribui o responsável (usuário logado) por padrão.
create or replace function set_responsavel() returns trigger
language plpgsql security definer as $$
begin
  if new.responsavel_id is null then
    new.responsavel_id := auth.uid();
  end if;
  return new;
end; $$;

create trigger trg_mov_responsavel before insert on movimentacoes
for each row execute function set_responsavel();

-- Aplica a movimentação ao saldo do lote — o estoque é verdade no banco.
create or replace function aplicar_movimentacao() returns trigger
language plpgsql as $$
declare saldo int;
begin
  if new.lote_id is null then
    raise exception 'Movimentação exige um lote';
  end if;
  select quantidade into saldo from lotes where id = new.lote_id for update;
  if new.tipo = 'entrada' then
    update lotes set quantidade = quantidade + new.quantidade where id = new.lote_id;
  elsif new.tipo = 'saida' then
    if saldo < new.quantidade then
      raise exception 'Estoque insuficiente: saldo % menor que saída %', saldo, new.quantidade;
    end if;
    update lotes set quantidade = quantidade - new.quantidade where id = new.lote_id;
  elsif new.tipo = 'ajuste' then
    update lotes set quantidade = new.quantidade where id = new.lote_id;
  end if;
  return new;
end; $$;

create trigger trg_mov_aplicar after insert on movimentacoes
for each row execute function aplicar_movimentacao();

-- Cria profile automaticamente para todo novo usuário do Auth.
create or replace function handle_new_user() returns trigger
language plpgsql security definer as $$
begin
  insert into public.profiles (id, nome, papel)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    'operador'
  )
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger trg_auth_new_user after insert on auth.users
for each row execute function handle_new_user();
