# Check-in de segurança de veículos — implantação

## O que mudou
- Check-in de retirada e devolução em 7 etapas: veículo (por tipo), placa digitada, hodômetro, combustível,
  conferência de segurança por tipo de veículo, mapa de avarias com foto, 5 fotos obrigatórias,
  solicitações de reparo com foto, revisão e declaração.
- Aba **Check-ins realizados** (permissão `vehicles.checkinReport`): filtros por período, condutor, placa,
  tipo e "só com avaria", 10/30/50 por página, CSV e impressão/PDF, ficha completa e acompanhamento dos reparos.
- Avarias não reparadas passam para o próximo check-in como **pré-existentes**.

## Passos no Supabase (nesta ordem)
1. SQL Editor → executar `supabase/migrations/20261103100000_vehicle_checkin_safety_up.sql`.
   (Reversão: `..._down.sql`.)
2. Publicar a função: `supabase functions deploy veiculos`
   (ela importa `supabase/functions/_shared/checkin.ts`).
3. Plataforma → Permissões: ligar **Ver check-ins realizados e reparos** para os perfis que devem ver o painel.
   Administradores novos já recebem a permissão por padrão.

## Regras validadas no servidor
- Placa digitada precisa conferir com o cadastro.
- Hodômetro inteiro, nunca menor que o da retirada.
- Fotos obrigatórias: frente, traseira, lateral esquerda, lateral direita e painel.
- Avaria nova exige foto; avaria grave exige descrição.
- Solicitação de reparo exige o que reparar e pelo menos 1 foto.
- Toda foto precisa estar na pasta da própria empresa no armazenamento.
- Concluir/cancelar reparo exige descrição (permissão `vehicles.edit`).

## Testes
- `npm test` (regras puras) e `PGHOST=... PGPORT=... supabase/tests/local/run.sh` (banco: RLS e restrições).
