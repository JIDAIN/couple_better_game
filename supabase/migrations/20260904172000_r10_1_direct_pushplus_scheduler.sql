-- R10.1: deliver WeChat reminders directly from Supabase -> PushPlus.
-- Actor-specific PushPlus tokens are encrypted in Supabase Vault and are never
-- returned by public RPCs. pg_cron wakes the dispatcher every 5 minutes.

create extension if not exists http with schema extensions;
create extension if not exists pg_cron;

create or replace function private.life_pushplus_secret_name(p_actor text)
returns text
language plpgsql
immutable
security invoker
set search_path = pg_catalog
as $$
begin
  if p_actor not in ('cat', 'fish') then
    raise exception 'Invalid reminder actor';
  end if;
  return 'life_pushplus_' || p_actor;
end;
$$;

create or replace function private.life_pushplus_token(p_actor text)
returns text
language sql
stable
security definer
set search_path = pg_catalog, vault, private
as $$
  select nullif(btrim(v.decrypted_secret), '')
  from vault.decrypted_secrets v
  where v.name = private.life_pushplus_secret_name(p_actor)
  order by v.updated_at desc
  limit 1;
$$;

create or replace function public.get_life_pushplus_status(p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if p_actor not in ('cat', 'fish') then
    raise exception 'Invalid reminder actor';
  end if;

  return jsonb_build_object(
    'actor', p_actor,
    'configured', private.life_pushplus_token(p_actor) is not null
  );
end;
$$;

create or replace function public.set_life_pushplus_token(
  p_actor text,
  p_token text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, vault
as $$
declare
  v_token text := btrim(coalesce(p_token, ''));
  v_name text;
  v_secret_id uuid;
begin
  if p_actor not in ('cat', 'fish') then
    raise exception 'Invalid reminder actor';
  end if;
  if length(v_token) < 10 or length(v_token) > 256 then
    raise exception 'PushPlus token format is invalid';
  end if;

  v_name := private.life_pushplus_secret_name(p_actor);

  select v.id into v_secret_id
  from vault.decrypted_secrets v
  where v.name = v_name
  order by v.updated_at desc
  limit 1;

  if v_secret_id is null then
    perform vault.create_secret(
      v_token,
      v_name,
      'couple-better-game PushPlus token for ' || p_actor
    );
  else
    perform vault.update_secret(v_secret_id, v_token);
  end if;

  return jsonb_build_object('actor', p_actor, 'configured', true);
end;
$$;

create or replace function public.clear_life_pushplus_token(p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, vault
as $$
declare
  v_name text;
begin
  if p_actor not in ('cat', 'fish') then
    raise exception 'Invalid reminder actor';
  end if;

  v_name := private.life_pushplus_secret_name(p_actor);
  delete from vault.secrets where name = v_name;

  return jsonb_build_object('actor', p_actor, 'configured', false);
end;
$$;

create or replace function private.life_pushplus_message(
  p_actor text,
  p_reminder jsonb
) returns jsonb
language plpgsql
immutable
security invoker
set search_path = pg_catalog
as $$
declare
  v_ai_name text;
  v_kind text := p_reminder->>'kind';
  v_days integer;
begin
  if p_actor not in ('cat', 'fish') then
    raise exception 'Invalid reminder actor';
  end if;
  v_ai_name := case when p_actor = 'cat' then '团子' else '仔仔' end;

  if v_kind = 'daily_record' then
    return jsonb_build_object(
      'title', v_ai_name || '提醒｜今天还没记录',
      'content', '今天还没有看到你的生活记录。记一点就好，不用补全，也不用和 Ta 比较。——' || v_ai_name
    );
  end if;

  v_days := coalesce((p_reminder->>'daysUntil')::integer, 0);
  if v_days = 0 then
    return jsonb_build_object(
      'title', v_ai_name || '提醒｜今天是你们的纪念日',
      'content', '今天是你们的纪念日 💛 不需要完成什么任务，给彼此留一点开心的时间就很好。——' || v_ai_name
    );
  elsif v_days = 1 then
    return jsonb_build_object(
      'title', v_ai_name || '提醒｜明天是你们的纪念日',
      'content', '明天就是你们的纪念日啦 💛 想庆祝的话，可以提前留一点时间给彼此。——' || v_ai_name
    );
  end if;

  return jsonb_build_object(
    'title', v_ai_name || '提醒｜纪念日还有 ' || v_days || ' 天',
    'content', '还有 ' || v_days || ' 天就是你们的纪念日啦 💛 想庆祝的话，可以提前想想怎么一起过。——' || v_ai_name
  );
end;
$$;

create or replace function private.life_pushplus_send(
  p_actor text,
  p_title text,
  p_content text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, extensions, private
as $$
declare
  v_token text;
  v_response extensions.http_response;
  v_body jsonb;
  v_provider_id text;
  v_error text;
begin
  v_token := private.life_pushplus_token(p_actor);
  if v_token is null then
    return jsonb_build_object('ok', false, 'error', 'PushPlus token is not configured');
  end if;

  begin
    select * into v_response
    from extensions.http_post(
      'https://www.pushplus.plus/send',
      jsonb_build_object(
        'token', v_token,
        'title', p_title,
        'content', p_content,
        'template', 'html',
        'channel', 'wechat'
      )::text,
      'application/json'
    );

    begin
      v_body := coalesce(v_response.content, '{}')::jsonb;
    exception when others then
      v_body := '{}'::jsonb;
    end;

    if v_response.status between 200 and 299
       and coalesce((v_body->>'code')::integer, 0) = 200 then
      v_provider_id := nullif(btrim(coalesce(v_body->>'data', '')), '');
      return jsonb_build_object('ok', true, 'providerMessageId', v_provider_id);
    end if;

    v_error := left(
      'HTTP ' || coalesce(v_response.status::text, 'unknown') || ': ' || coalesce(v_response.content, 'empty response'),
      1000
    );
    return jsonb_build_object('ok', false, 'error', v_error);
  exception when others then
    return jsonb_build_object('ok', false, 'error', left(sqlerrm, 1000));
  end;
end;
$$;

create or replace function public.test_life_pushplus(p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_ai_name text;
  v_result jsonb;
begin
  if p_actor not in ('cat', 'fish') then
    raise exception 'Invalid reminder actor';
  end if;
  if private.life_pushplus_token(p_actor) is null then
    return jsonb_build_object('actor', p_actor, 'ok', false, 'error', 'PushPlus token is not configured');
  end if;

  v_ai_name := case when p_actor = 'cat' then '团子' else '仔仔' end;
  v_result := private.life_pushplus_send(
    p_actor,
    v_ai_name || '提醒｜微信提醒已连接',
    '微信提醒已经连接成功。以后需要提醒你的时候，我会从这里发给你。——' || v_ai_name
  );

  return jsonb_build_object(
    'actor', p_actor,
    'ok', coalesce((v_result->>'ok')::boolean, false),
    'providerMessageId', v_result->>'providerMessageId',
    'error', v_result->>'error'
  );
end;
$$;

create or replace function private.dispatch_life_pushplus_for_actor(
  p_actor text,
  p_now timestamptz default now(),
  p_space_slug text default 'couple-better-game'
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_claim jsonb;
  v_reminder jsonb;
  v_message jsonb;
  v_send jsonb;
  v_sent integer := 0;
  v_failed integer := 0;
begin
  -- Do not reserve a delivery until this actor has a real destination.
  if private.life_pushplus_token(p_actor) is null then
    return jsonb_build_object('actor', p_actor, 'configured', false, 'sent', 0, 'failed', 0);
  end if;

  v_claim := public.claim_life_notification_reminders(p_actor, p_now, p_space_slug);

  for v_reminder in
    select value from jsonb_array_elements(coalesce(v_claim->'reminders', '[]'::jsonb))
  loop
    v_message := private.life_pushplus_message(p_actor, v_reminder);
    v_send := private.life_pushplus_send(p_actor, v_message->>'title', v_message->>'content');

    if coalesce((v_send->>'ok')::boolean, false) then
      perform public.complete_life_notification_delivery(
        (v_reminder->>'deliveryId')::uuid,
        p_actor,
        true,
        v_send->>'providerMessageId',
        null,
        p_space_slug
      );
      v_sent := v_sent + 1;
    else
      perform public.complete_life_notification_delivery(
        (v_reminder->>'deliveryId')::uuid,
        p_actor,
        false,
        null,
        v_send->>'error',
        p_space_slug
      );
      v_failed := v_failed + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'actor', p_actor,
    'configured', true,
    'sent', v_sent,
    'failed', v_failed
  );
end;
$$;

create or replace function private.dispatch_life_pushplus_reminders(
  p_now timestamptz default now(),
  p_space_slug text default 'couple-better-game'
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  v_cat jsonb;
  v_fish jsonb;
begin
  v_cat := private.dispatch_life_pushplus_for_actor('cat', p_now, p_space_slug);
  v_fish := private.dispatch_life_pushplus_for_actor('fish', p_now, p_space_slug);
  return jsonb_build_object('cat', v_cat, 'fish', v_fish);
end;
$$;

revoke all on function private.life_pushplus_secret_name(text) from public, anon, authenticated;
revoke all on function private.life_pushplus_token(text) from public, anon, authenticated;
revoke all on function private.life_pushplus_message(text, jsonb) from public, anon, authenticated;
revoke all on function private.life_pushplus_send(text, text, text) from public, anon, authenticated;
revoke all on function private.dispatch_life_pushplus_for_actor(text, timestamptz, text) from public, anon, authenticated;
revoke all on function private.dispatch_life_pushplus_reminders(timestamptz, text) from public, anon, authenticated;
revoke all on function public.get_life_pushplus_status(text) from public, anon, authenticated;
revoke all on function public.set_life_pushplus_token(text, text) from public, anon, authenticated;
revoke all on function public.clear_life_pushplus_token(text) from public, anon, authenticated;
revoke all on function public.test_life_pushplus(text) from public, anon, authenticated;

grant execute on function public.get_life_pushplus_status(text) to service_role;
grant execute on function public.set_life_pushplus_token(text, text) to service_role;
grant execute on function public.clear_life_pushplus_token(text) to service_role;
grant execute on function public.test_life_pushplus(text) to service_role;

-- Replace only our own named job so the migration remains idempotent.
do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid from cron.job where jobname = 'life-pushplus-reminders-v1'
  loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    'life-pushplus-reminders-v1',
    '*/5 * * * *',
    'select private.dispatch_life_pushplus_reminders();'
  );
end;
$$;
