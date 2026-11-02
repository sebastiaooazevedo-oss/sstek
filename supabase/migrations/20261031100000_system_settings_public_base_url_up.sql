-- Endereço público usado dentro dos QR-Codes de fiscalização.
--
-- O QR-Code é lido por um celular SEM login (o fiscal não é usuário do
-- sistema). Se ele for montado a partir do endereço do editor de
-- pré-visualização, o celular recebe "invalid authorization" do gateway, porque
-- esse endereço exige sessão da plataforma. Guardamos aqui o domínio onde o
-- sistema está realmente publicado para que os adesivos funcionem em campo.

ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS public_base_url text;

COMMENT ON COLUMN public.system_settings.public_base_url IS
  'Endereço público (https://dominio) usado para montar o link dos QR-Codes de fiscalização. Vazio = usa o endereço atual do navegador.';