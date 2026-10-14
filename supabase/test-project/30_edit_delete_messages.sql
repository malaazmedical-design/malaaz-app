-- Test project only. Each side can edit its own text messages and delete its own messages (text, photo or file)
-- while the consultation is live. A deleted message stays as "message deleted" (and its file is removed from storage).
alter table public.consultation_messages add column if not exists edited_at timestamptz;
alter table public.consultation_messages add column if not exists deleted_at timestamptz;

create or replace function public.edit_consultation_message(p_msg uuid, p_body text)
 returns text language plpgsql security definer set search_path to 'public'
as $$
declare m public.consultation_messages; v_role text; v_state text;
begin
  select * into m from public.consultation_messages where id = p_msg;
  if m.id is null then return 'missing'; end if;
  v_role := public.consult_role(m.consultation_id);
  if v_role is distinct from m.sender then return 'forbidden'; end if;
  select state into v_state from public.consultations where id = m.consultation_id;
  if v_state <> 'live' then return 'closed'; end if;
  if m.deleted_at is not null or m.file_path is not null then return 'locked'; end if;
  if coalesce(length(trim(p_body)), 0) = 0 then return 'empty'; end if;
  update public.consultation_messages set body = trim(p_body), edited_at = now() where id = p_msg;
  return 'ok';
end; $$;

create or replace function public.delete_consultation_message(p_msg uuid)
 returns text language plpgsql security definer set search_path to 'public', 'storage'
as $$
declare m public.consultation_messages; v_role text; v_state text;
begin
  select * into m from public.consultation_messages where id = p_msg;
  if m.id is null then return 'missing'; end if;
  v_role := public.consult_role(m.consultation_id);
  if v_role is distinct from m.sender then return 'forbidden'; end if;
  select state into v_state from public.consultations where id = m.consultation_id;
  if v_state <> 'live' then return 'closed'; end if;
  if m.deleted_at is not null then return 'ok'; end if;
  if m.file_path is not null then
    delete from storage.objects where bucket_id = 'consultation-files' and name = m.file_path;
  end if;
  update public.consultation_messages set body = null, file_path = null, file_name = null, deleted_at = now() where id = p_msg;
  return 'ok';
end; $$;

revoke all on function public.edit_consultation_message(uuid, text) from public, anon;
revoke all on function public.delete_consultation_message(uuid) from public, anon;
grant execute on function public.edit_consultation_message(uuid, text) to authenticated;
grant execute on function public.delete_consultation_message(uuid) to authenticated;
