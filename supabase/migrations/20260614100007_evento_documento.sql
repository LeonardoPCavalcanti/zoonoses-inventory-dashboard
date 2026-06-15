-- Novo tipo de evento para anexos de documento. ADD VALUE precisa estar em sua
-- própria migração (não pode ser usado na mesma transação em que é criado).
alter type pedido_evento_tipo add value if not exists 'DOCUMENTO_ANEXADO';
