-- V2-P7: shared little mailbox. One letter is one factual message between the two partner keys.
create table if not exists public.mailbox_letters (
  id uuid primary key default gen_random_uuid(),
  couple_space_id uuid not null references public.couple_spaces(id) on delete cascade,
  sender_key text not null check (sender_key in ('cat','fish')),
  recipient_key text not null check (recipient_key in ('cat','fish') and recipient_key <> sender_key),
  format text not null default 'letter' check (format in ('letter','postcard')),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  sent_at timestamptz not null default now(),
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (couple_space_id, sender_key) references public.partner_profiles(couple_space_id, partner_key),
  foreign key (couple_space_id, recipient_key) references public.partner_profiles(couple_space_id, partner_key)
);
create index if not exists mailbox_letters_space_sent_idx on public.mailbox_letters(couple_space_id, sent_at desc) where deleted_at is null;
alter table public.mailbox_letters enable row level security;

create or replace function private.mailbox_letter_json(p_id uuid)
returns jsonb language sql stable security invoker set search_path=public,private as $$
 select jsonb_build_object('id',m.id,'senderKey',m.sender_key,'recipientKey',m.recipient_key,'format',m.format,'body',m.body,'sentAt',m.sent_at,'source',m.source,'createdAt',m.created_at,'updatedAt',m.updated_at)
 from public.mailbox_letters m where m.id=p_id and m.deleted_at is null;
$$;

create or replace function public.list_mailbox_letters(p_space_slug text default 'couple-better-game')
returns jsonb language sql stable security invoker set search_path=public,private as $$
 select coalesce(jsonb_agg(private.mailbox_letter_json(m.id) order by m.sent_at desc),'[]'::jsonb)
 from public.mailbox_letters m join public.couple_spaces cs on cs.id=m.couple_space_id
 where cs.slug=p_space_slug and cs.archived_at is null and m.deleted_at is null;
$$;

create or replace function public.create_mailbox_letter(p_payload jsonb,p_space_slug text default 'couple-better-game')
returns jsonb language plpgsql security invoker set search_path=public,private as $$
declare v_space_id uuid; v_id uuid;
begin
 select id into v_space_id from public.couple_spaces where slug=p_space_slug and archived_at is null;
 if v_space_id is null then raise exception 'Couple space not found'; end if;
 insert into public.mailbox_letters(couple_space_id,sender_key,recipient_key,format,body,sent_at,source)
 values(v_space_id,p_payload->>'senderKey',p_payload->>'recipientKey',coalesce(p_payload->>'format','letter'),btrim(p_payload->>'body'),coalesce(nullif(p_payload->>'sentAt','')::timestamptz,now()),'manual') returning id into v_id;
 return private.mailbox_letter_json(v_id);
end;$$;

create or replace function public.update_mailbox_letter(p_letter_id uuid,p_payload jsonb,p_space_slug text default 'couple-better-game')
returns jsonb language plpgsql security invoker set search_path=public,private as $$
declare v_space_id uuid;
begin
 select id into v_space_id from public.couple_spaces where slug=p_space_slug and archived_at is null;
 update public.mailbox_letters set sender_key=p_payload->>'senderKey',recipient_key=p_payload->>'recipientKey',format=coalesce(p_payload->>'format','letter'),body=btrim(p_payload->>'body'),sent_at=coalesce(nullif(p_payload->>'sentAt','')::timestamptz,sent_at),updated_at=now()
 where id=p_letter_id and couple_space_id=v_space_id and deleted_at is null;
 if not found then raise exception 'Letter not found'; end if;
 return private.mailbox_letter_json(p_letter_id);
end;$$;

create or replace function public.delete_mailbox_letter(p_letter_id uuid,p_space_slug text default 'couple-better-game')
returns jsonb language plpgsql security invoker set search_path=public,private as $$
declare v_space_id uuid; v_record jsonb;
begin
 select id into v_space_id from public.couple_spaces where slug=p_space_slug and archived_at is null;
 v_record:=private.mailbox_letter_json(p_letter_id);
 update public.mailbox_letters set deleted_at=now(),updated_at=now() where id=p_letter_id and couple_space_id=v_space_id and deleted_at is null;
 if not found then raise exception 'Letter not found'; end if;
 return v_record;
end;$$;

revoke all on table public.mailbox_letters from public,anon,authenticated;
revoke all on function private.mailbox_letter_json(uuid) from public,anon,authenticated;
revoke all on function public.list_mailbox_letters(text) from public,anon,authenticated;
revoke all on function public.create_mailbox_letter(jsonb,text) from public,anon,authenticated;
revoke all on function public.update_mailbox_letter(uuid,jsonb,text) from public,anon,authenticated;
revoke all on function public.delete_mailbox_letter(uuid,text) from public,anon,authenticated;
grant execute on function private.mailbox_letter_json(uuid) to service_role;
grant execute on function public.list_mailbox_letters(text) to service_role;
grant execute on function public.create_mailbox_letter(jsonb,text) to service_role;
grant execute on function public.update_mailbox_letter(uuid,jsonb,text) to service_role;
grant execute on function public.delete_mailbox_letter(uuid,text) to service_role;