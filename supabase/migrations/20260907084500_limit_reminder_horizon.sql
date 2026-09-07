-- Keep the reminder center compact: materialize medicine reminders only 90 days ahead.
delete from public.life_reminder_instances where source_kind='medicine' and rule_id is null and due_at>now()+interval '90 days' and notified_at is null;

create or replace function private.materialize_medicine_expiry_reminders(p_space_slug text default 'couple-better-game',p_now timestamptz default now())
returns integer language plpgsql security definer set search_path=public,private as $$
declare v_space_id uuid; m record; v_actor text; v_offset integer; v_due_date date; v_expiry date; v_count integer:=0; v_key text; v_today date; v_horizon date;
begin
 v_today:=(p_now at time zone 'Asia/Shanghai')::date; v_horizon:=v_today+90;
 select id into v_space_id from public.couple_spaces where slug=p_space_slug and archived_at is null; if v_space_id is null then return 0; end if;
 for m in select * from public.medicine_items where couple_space_id=v_space_id and archived_at is null loop
   v_expiry:=case when m.package_expiry_date is null then case when m.opened_date is not null and m.opened_shelf_life_days is not null then m.opened_date+m.opened_shelf_life_days else null end when m.opened_date is null or m.opened_shelf_life_days is null then m.package_expiry_date else least(m.package_expiry_date,m.opened_date+m.opened_shelf_life_days) end;
   if v_expiry is null then continue; end if;
   foreach v_offset in array array[30,7,1,0] loop v_due_date:=v_expiry-v_offset; if v_due_date<v_today or v_due_date>v_horizon then continue; end if;
     foreach v_actor in array array['cat','fish']::text[] loop v_key:='medicine:'||m.id::text||':'||v_actor||':'||v_offset::text||':'||v_expiry::text;
       insert into public.life_reminder_instances(couple_space_id,recipient,source_kind,source_ref,title,content,due_at,dedupe_key,metadata) values(v_space_id,v_actor,'medicine',m.id::text,'药箱提醒｜'||m.name,case when v_offset=0 then m.name||' 今天到期' else m.name||' 还有 '||v_offset||' 天到期' end,(v_due_date::timestamp+time '09:00') at time zone 'Asia/Shanghai',v_key,jsonb_build_object('medicineId',m.id,'expiryDate',v_expiry,'daysUntil',v_offset)) on conflict(couple_space_id,recipient,dedupe_key) do nothing; if found then v_count:=v_count+1; end if;
     end loop;
   end loop;
 end loop; return v_count;
end; $$;

create or replace function public.list_life_reminders(p_actor text,p_include_completed boolean default false,p_space_slug text default 'couple-better-game') returns jsonb language sql stable security invoker set search_path=public as $$
 select coalesce(jsonb_agg(x.payload order by x.sort_at),'[]'::jsonb) from (select jsonb_build_object('id',i.id,'ruleId',i.rule_id,'recipient',i.recipient,'sourceKind',i.source_kind,'title',i.title,'content',i.content,'dueAt',i.due_at,'status',i.status,'snoozedUntil',i.snoozed_until,'notifiedAt',i.notified_at,'completedAt',i.completed_at,'metadata',i.metadata) payload,coalesce(i.snoozed_until,i.due_at) sort_at from public.life_reminder_instances i join public.couple_spaces c on c.id=i.couple_space_id where c.slug=p_space_slug and c.archived_at is null and i.recipient=p_actor and (p_include_completed or i.status in ('pending','snoozed')) order by coalesce(i.snoozed_until,i.due_at) limit 100) x;
$$;
