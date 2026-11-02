-- Down: não reverte a normalização.
-- Recriar NULL nessas colunas reintroduziria o erro "Database error querying schema",
-- então esta migration é intencionalmente irreversível no dado.
-- Nenhuma estrutura (tabela/coluna/índice) foi criada ou alterada.

SELECT 1;