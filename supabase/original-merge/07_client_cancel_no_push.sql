-- 07_client_cancel_no_push.sql — العميل اللي بيلغي حجزه بنفسه ميجيلوش إشعار "تعذّر تأكيد حجزك، اختار مقدم آخر"
-- (للتطبيق الأصلي فقط). الإشعار ده مخصوص لما المقدم/الإدارة هم اللي يلغوا.
-- الفكرة: إلغاء العميل بيتسجّل cancelled_by = 'client'، والـtrigger ما بيبعتش إشعار العميل في الحالة دي.
-- باقي الإشعارات (تأكيد، في الطريق، اكتمال، وإلغاء المقدم) بتفضل زي ما هي. آمن ويتشغّل أكتر من مرة.

-- 1) cancel_booking: يسجّل إن العميل هو اللي لغى
create or replace function public.cancel_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_client_id uuid;
  v_booking_status text;
begin
  select id into v_client_id from clients where auth_id = auth.uid();
  if v_client_id is null then
    raise exception 'not_client';
  end if;

  select status into v_booking_status from bookings where id = p_booking_id and client_id = v_client_id;
  if not found then
    raise exception 'not_found';
  end if;

  -- فقط pending أو confirmed يمكن إلغاؤهم
  if v_booking_status not in ('pending', 'confirmed') then
    raise exception 'not_cancellable';
  end if;

  update bookings set status = 'cancelled', cancelled_by = 'client'
   where id = p_booking_id and client_id = v_client_id;
end;
$function$;

-- 2) الـtrigger اللي بيبعت للـEdge Function: يتخطى إلغاء العميل لنفسه
create or replace function public.notify_booking_change()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
begin
  -- العميل لغى حجزه بنفسه: مفيش إشعار "تعذّر تأكيد حجزك" ليه
  if TG_OP = 'UPDATE'
     and NEW.status = 'cancelled' and OLD.status is distinct from 'cancelled'
     and NEW.cancelled_by = 'client' then
    return NEW;
  end if;

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

-- فحص: لازم الدالتين فيهم الشرط
select proname,
       position('cancelled_by' in pg_get_functiondef(p.oid)) > 0 as has_client_cancel_logic
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and proname in ('cancel_booking', 'notify_booking_change');
