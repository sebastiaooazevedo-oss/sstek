-- Reversão dos pedidos de substituição de EPI.
drop trigger if exists epi_replacement_touch on public.epi_replacement_requests;
drop function if exists public.touch_epi_replacement_request();

drop policy if exists epi_replacement_read on public.epi_replacement_requests;
drop policy if exists epi_replacement_insert on public.epi_replacement_requests;
drop policy if exists epi_replacement_update on public.epi_replacement_requests;
drop policy if exists epi_replacement_delete on public.epi_replacement_requests;

drop table if exists public.epi_replacement_requests;