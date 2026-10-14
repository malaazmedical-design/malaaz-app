-- Rotate the notify-booking webhook secret (the old one was exposed). Run on the ORIGINAL project in the SQL Editor.
-- 1) Replace PASTE_NEW_SECRET_HERE below with the new value (the SAME value you saved as the Edge Function secret WEBHOOK_SECRET).
-- 2) Run. Do NOT commit or paste the edited file anywhere; close the tab afterwards.
-- The secret is stored in Supabase Vault; the two trigger functions read it from there, so it never appears in function text.
begin;

do $$
begin
  if exists (select 1 from vault.secrets where name = 'webhook_secret') then
    perform vault.update_secret((select id from vault.secrets where name = 'webhook_secret'), 'PASTE_NEW_SECRET_HERE');
  else
    perform vault.create_secret('PASTE_NEW_SECRET_HERE', 'webhook_secret', 'notify-booking webhook secret');
  end if;
end $$;

create or replace function public.notify_booking_change()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
begin
  perform net.http_post(
    url := 'https://omsictbrqlsohrmxeuym.supabase.co/functions/v1/notify-booking',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'webhook_secret')
    ),
    body := jsonb_build_object(
      'type', TG_OP,
      'record', to_jsonb(NEW),
      'old_record', case when TG_OP = 'UPDATE' then to_jsonb(OLD) else null end
    )
  );
  return NEW;
end;
$function$;

create or replace function public.notify_booking_offer_change()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
begin
  perform net.http_post(
    url := 'https://omsictbrqlsohrmxeuym.supabase.co/functions/v1/notify-booking',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'webhook_secret')
    ),
    body := jsonb_build_object(
      'type', 'OFFER_INSERT',
      'record', to_jsonb(NEW)
    )
  );
  return NEW;
end;
$function$;

commit;

-- sanity check (prints only the length, never the value): expect 48
select length(decrypted_secret) as secret_length from vault.decrypted_secrets where name = 'webhook_secret';
