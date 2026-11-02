-- Fix: "Database error querying schema" on login
--
-- Causa: o GoTrue (serviço de autenticação do Supabase) lê a linha de auth.users
-- esperando string vazia (''), nunca NULL, nas colunas de token. Contas criadas
-- por INSERT direto em auth.users ficam com essas colunas NULL e o login falha
-- com "Database error querying schema" antes mesmo de validar a senha.
--
-- Esta migration é idempotente: normaliza NULL -> '' em todas as contas.

UPDATE auth.users
SET confirmation_token       = COALESCE(confirmation_token, ''),
    recovery_token           = COALESCE(recovery_token, ''),
    email_change_token_new   = COALESCE(email_change_token_new, ''),
    email_change             = COALESCE(email_change, ''),
    email_change_token_current = COALESCE(email_change_token_current, ''),
    email_change_confirm_status = COALESCE(email_change_confirm_status, 0),
    phone_change             = COALESCE(phone_change, ''),
    phone_change_token       = COALESCE(phone_change_token, ''),
    reauthentication_token   = COALESCE(reauthentication_token, '')
WHERE confirmation_token IS NULL
   OR recovery_token IS NULL
   OR email_change_token_new IS NULL
   OR email_change IS NULL
   OR email_change_token_current IS NULL
   OR phone_change IS NULL
   OR phone_change_token IS NULL
   OR reauthentication_token IS NULL;

-- Garante que toda conta tenha identidade de provider para login por senha.
INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
SELECT gen_random_uuid(), u.id, u.id::text, 'email',
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       u.last_sign_in_at, u.created_at, now()
FROM auth.users u
WHERE u.email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM auth.identities i WHERE i.user_id = u.id AND i.provider = 'email'
  );