-- Telefone do SESMT da empresa.
-- Usado no selo do capacete e no comprovante público de fiscalização quando a
-- CIPA não possui nenhum membro com área SESMT.
ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS sesmt_phone text;