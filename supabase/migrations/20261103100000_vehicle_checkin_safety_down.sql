-- Reversão do check-in de segurança v2 (os check-ins continuam; somem só as colunas novas).
drop trigger if exists vehicle_repair_touch on public.vehicle_repair_requests;
drop function if exists public.touch_vehicle_repair_request();
drop policy if exists vehicle_repair_read on public.vehicle_repair_requests;
drop table if exists public.vehicle_repair_requests;

drop index if exists public.vehicle_checkins_report_idx;
alter table if exists public.vehicle_checkins
  drop constraint if exists vehicle_checkins_damages_array,
  drop constraint if exists vehicle_checkins_repairs_array,
  drop column if exists vehicle_category,
  drop column if exists plate_confirmed,
  drop column if exists damages,
  drop column if exists repair_requests;
