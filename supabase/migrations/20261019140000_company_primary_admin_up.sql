-- =====================================================================
-- Administrador principal da empresa (primeiro acesso)
--
-- O superadministrador cadastra, junto com a empresa, o usuário
-- administrativo responsável pelos primeiros acessos e registros.
-- Esse vínculo é protegido: só o superadministrador da plataforma pode
-- alterar ou excluir. O administrador da empresa apenas visualiza.
-- =====================================================================

-- 1) Marca no perfil quem é o administrador principal do tenant.
alter table public.profiles add column if not exists is_primary_admin boolean not null default false;

-- 2) No máximo um administrador principal por empresa.
create unique index if not exists profiles_one_primary_admin_per_company_idx
  on public.profiles (company_id)
  where is_primary_admin and company_id is not null;

-- 3) Backfill: o administrador mais antigo de cada empresa passa a ser o principal.
with first_admin as (
  select distinct on (p.company_id) p.id, p.company_id
  from public.profiles p
  where p.company_id is not null
    and p.role = 'admin'
  order by p.company_id, p.created_at asc
)
update public.profiles p
set is_primary_admin = true
from first_admin f
where p.id = f.id
  and not exists (
    select 1 from public.profiles x
    where x.company_id = f.company_id and x.is_primary_admin
  );

-- 4) Blindagem no banco: nenhuma sessão de empresa altera/remove o principal.
--    Chamadas com service role (edge functions do painel) não têm auth.uid()
--    e continuam permitidas; o superadministrador autenticado também.
create or replace function public.profiles_guard_primary_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_is_platform_admin boolean := false;
begin
  if v_actor is not null then
    v_is_platform_admin := public.is_platform_admin();
  end if;

  if tg_op = 'UPDATE' then
    if new.is_primary_admin is distinct from old.is_primary_admin
       and v_actor is not null and not v_is_platform_admin then
      raise exception 'Somente o superadministrador da plataforma pode definir o administrador principal da empresa.'
        using errcode = '42501';
    end if;

    if old.is_primary_admin and v_actor is not null and not v_is_platform_admin then
      raise exception 'O administrador principal da empresa so pode ser alterado pelo superadministrador da plataforma.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.is_primary_admin and v_actor is not null and not v_is_platform_admin then
      raise exception 'O administrador principal da empresa so pode ser excluido pelo superadministrador da plataforma.'
        using errcode = '42501';
    end if;
    return old;
  end if;

  return new;
end;
$function$;

drop trigger if exists profiles_guard_primary_admin_trg on public.profiles;
create trigger profiles_guard_primary_admin_trg
before update or delete on public.profiles
for each row execute function public.profiles_guard_primary_admin();

-- 5) Tenants de demonstração recebem um administrador principal (conta ainda
--    não ativada — o primeiro acesso é feito pelo próprio usuário).
insert into public.profiles (company_id, name, email, phone, role, status, is_primary_admin)
select c.id, v.name, v.email, v.phone, 'admin', 'active', true
from (values
  ('logprime', 'Renata Lopes', 'renata.lopes@logprime.com.br', '(11) 98812-4471'),
  ('horizonte', 'Paulo Menezes', 'paulo.menezes@horizonte.com.br', '(31) 99614-8820'),
  ('bemviver', 'Camila Duarte', 'camila.duarte@bemviver.com.br', '(41) 99120-7735'),
  ('andrade', 'Andre Salles', 'andre.salles@andrade.com.br', '(19) 98745-2210')
) as v(subdomain, name, email, phone)
join public.companies c on c.subdomain = v.subdomain
where not exists (
  select 1 from public.profiles p where p.company_id = c.id and p.is_primary_admin
);