# Implantação — Catálogo de empresas e assistente de nova empresa

O que esta etapa entrega:

- **Módulos por empresa.** Antes eram uma chave única para a plataforma inteira.
- **Assistente de nova empresa** no painel do Superadministrador: cria a empresa em uma única operação. Se algo falhar, nada fica gravado.
- **Link de acesso** do administrador da empresa, para convite expirado ou senha esquecida.
- **Endereço amarrado à empresa:** em `alfa.<domínio>` só entra quem pertence à Alfa.
- **Registro do plano de dados** de cada empresa (compartilhado ou dedicado), para o futuro modelo híbrido.

> **Ordem obrigatória:** primeiro o banco, depois a função de servidor e por último o site.
> Se o site novo for publicado antes do banco, a lista de módulos da empresa volta vazia e todos os módulos ficam ligados. Não quebra nada, mas ignora o plano contratado.

## 1. Banco de dados (Supabase → SQL Editor)

1. Faça um backup antes (Database → Backups) ou rode o export da estrutura (`supabase/tools/exportar_estrutura.sql`).
2. Cole e rode `supabase/migrations/20261102100000_tenant_catalog_up.sql`.
3. Confira o resultado:

   ```sql
   select column_name from information_schema.columns
   where table_schema = 'public' and table_name = 'companies'
     and column_name in ('enabled_modules', 'data_plane', 'dedicated_api_url', 'onboarding');
   -- deve listar as 4 colunas
   ```

Para desfazer: `supabase/migrations/20261102100000_tenant_catalog_down.sql`.

**Efeito nas empresas existentes:** nenhum. Todas começam com `enabled_modules = {}`, o que significa todos os módulos ligados, exatamente como hoje. A chave geral da plataforma continua valendo para todas.

## 2. Função de servidor `platform-admin`

1. Supabase → Edge Functions → Secrets: crie `PLATFORM_ROOT_DOMAIN` com o seu domínio, sem `https://` (ex.: `sstek.com.br`).
2. Publique a função. Ela agora usa `supabase/functions/_shared/onboarding.ts`.
   - Pela linha de comando: `npx supabase functions deploy platform-admin --project-ref <ref>`
   - Ou pelo painel, incluindo também o arquivo `_shared/onboarding.ts`.

## 3. Login por link (convite e redefinição de senha)

Supabase → Authentication → URL Configuration → **Redirect URLs**, acrescente:

```
https://*.sstek.com.br/**
https://sstek.com.br/**
```

(Troque pelo seu domínio.) Sem isso, os links de convite caem no endereço padrão em vez do endereço da empresa.

## 4. Site (hospedagem)

Variável de ambiente do build: `VITE_PUBLIC_ROOT_DOMAIN=sstek.com.br` (o seu domínio).

## 5. Conferência rápida depois de publicar

| Teste | Esperado |
|---|---|
| Painel → Empresas → **Nova empresa** → criar uma empresa de teste | Tela "Empresa criada" com endereço e link do convite |
| Abrir o link do convite | Abre `https://<empresa>.<domínio>/redefinir-senha` para criar a senha |
| Entrar com o administrador da empresa de teste | Dashboard da empresa; menu só com os módulos do plano |
| Empresas → **Módulos** → desligar CIPA → recarregar a empresa | CIPA some do menu e `/app/cipa` mostra "Módulo não habilitado" |
| Com a conta da empresa A, abrir o endereço da empresa B | Aviso "Este endereço é de outra empresa", sem dados |
| Abrir `https://<domínio>/app` logado como usuário de empresa | Aviso com o botão para o endereço da empresa |

## Testes automáticos desta etapa

- `npm test`: regras do endereço, CNPJ, subdomínio, planos e validação do assistente.
- `supabase/tests/local/run.sh`: migration em banco descartável, com testes executados como usuário real (não como administrador do banco). Verifica:
  - os módulos efetivos por empresa;
  - o isolamento entre empresas;
  - a resolução do endereço;
  - a reversão e a reaplicação da migration.
