-- Retain launch schema.
-- Apply this to a disposable/dev Supabase project before testing the hardened app.

create extension if not exists pgcrypto;

drop table if exists public.relics cascade;
drop table if exists public.daily_log cascade;
drop table if exists public.retention_events cascade;
drop table if exists public.events cascade;
drop table if exists public.circle_members cascade;
drop table if exists public.circles cascade;
drop table if exists public.streaks cascade;
drop table if exists public.profiles cascade;
drop table if exists public.users cascade;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-z0-9_.]{2,24}$')
);

create table public.streaks (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  streak_start date not null default current_date,
  best_days integer not null default 0 check (best_days >= 0),
  celebrated_milestones integer[] not null default '{}',
  volume_score integer not null default 0 check (volume_score >= 0),
  last_event_at timestamptz,
  binge_count integer not null default 0 check (binge_count >= 0),
  triumph_count integer not null default 0 check (triumph_count >= 0),
  partnered_count integer not null default 0 check (partnered_count >= 0),
  updated_at timestamptz not null default now()
);

create table public.circles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  invite_code text not null unique check (invite_code ~ '^[A-Z2-9]{6}$'),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.circle_members (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(circle_id, user_id)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  username text not null,
  kind text not null check (kind in ('triumph','lapse','conscious','milestone_first','milestone_return','milestone','joined_circle','crown_transfer','relic')),
  body text not null,
  cta text,
  circle_id uuid references public.circles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.retention_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in ('triumph','lapse','conscious')),
  volume_before integer not null check (volume_before >= 0),
  volume_after integer not null check (volume_after >= 0),
  penalty_multiplier integer not null default 1 check (penalty_multiplier >= 1),
  streak_days_at_event integer not null default 0 check (streak_days_at_event >= 0),
  created_at timestamptz not null default now()
);

create table public.daily_log (
  user_id uuid not null references public.profiles(id) on delete cascade,
  log_date date not null,
  day_type text not null check (day_type in ('triumph','conscious','lapse')),
  created_at timestamptz not null default now(),
  primary key(user_id, log_date)
);

create table public.relics (
  user_id uuid not null references public.profiles(id) on delete cascade,
  relic_type text not null check (relic_type in ('iron_will','transmuter','phoenix')),
  created_at timestamptz not null default now(),
  primary key(user_id, relic_type)
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at before update on public.profiles
for each row execute function public.touch_updated_at();

create trigger streaks_touch_updated_at before update on public.streaks
for each row execute function public.touch_updated_at();

create or replace function public.current_streak_days(streak_start date)
returns integer
language sql
stable
as $$
  select greatest(0, current_date - streak_start);
$$;

create or replace function public.user_circle_ids(uid uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select circle_id from public.circle_members where user_id = uid;
$$;

create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text := '';
  i integer;
begin
  for i in 1..6 loop
    code := code || substr(alphabet, floor(random() * length(alphabet) + 1)::integer, 1);
  end loop;
  return code;
end;
$$;

create or replace function public.complete_onboarding(p_username text, p_streak_days integer, p_best_days integer default null, p_invite_code text default null)
returns table(profile_id uuid, joined_circle_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  normalized text := lower(trim(p_username));
  streak_days integer := greatest(0, least(coalesce(p_streak_days, 0), 9999));
  best_days integer := greatest(streak_days, least(coalesce(p_best_days, streak_days), 9999));
  target_circle public.circles%rowtype;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if normalized !~ '^[a-z0-9_.]{2,24}$' then
    raise exception 'Invalid username';
  end if;

  insert into public.profiles(id, username, onboarded)
  values (uid, normalized, true)
  on conflict (id) do update
    set username = excluded.username,
        onboarded = true,
        updated_at = now();

  insert into public.streaks(user_id, streak_start, best_days, celebrated_milestones, volume_score)
  values (
    uid,
    current_date - streak_days,
    best_days,
    array(select m from unnest(array[30,60,90,180,365]) as m where m <= streak_days),
    streak_days
  )
  on conflict (user_id) do update
    set streak_start = excluded.streak_start,
        best_days = greatest(public.streaks.best_days, excluded.best_days),
        celebrated_milestones = excluded.celebrated_milestones,
        volume_score = excluded.volume_score,
        updated_at = now();

  if p_invite_code is not null and trim(p_invite_code) <> '' then
    select * into target_circle
    from public.circles
    where invite_code = upper(trim(p_invite_code));

    if target_circle.id is null then
      raise exception 'Invite code not found';
    end if;

    insert into public.circle_members(circle_id, user_id)
    values(target_circle.id, uid)
    on conflict (circle_id, user_id) do nothing;

    insert into public.events(user_id, username, kind, body, cta, circle_id)
    values(uid, normalized, 'joined_circle', 'joined the circle.', 'The rivalry begins.', target_circle.id);

    joined_circle_id := target_circle.id;
  end if;

  profile_id := uid;
  return next;
end;
$$;

create or replace function public.create_circle()
returns table(id uuid, name text, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  uname text;
  code text;
  new_circle_id uuid;
  tries integer := 0;
begin
  select username into uname from public.profiles where profiles.id = uid and onboarded = true;
  if uid is null or uname is null then
    raise exception 'Onboarded profile required';
  end if;

  loop
    code := public.generate_invite_code();
    begin
      insert into public.circles(name, invite_code, creator_id)
      values (uname || '''s circle', code, uid)
      returning circles.id into new_circle_id;
      exit;
    exception when unique_violation then
      tries := tries + 1;
      if tries >= 5 then raise; end if;
    end;
  end loop;

  insert into public.circle_members(circle_id, user_id)
  values(new_circle_id, uid)
  on conflict (circle_id, user_id) do nothing;

  insert into public.events(user_id, username, kind, body, cta, circle_id)
  values(uid, uname, 'joined_circle', 'created a circle.', 'The brotherhood is open.', new_circle_id);

  return query select circles.id, circles.name, circles.invite_code from public.circles where circles.id = new_circle_id;
end;
$$;

create or replace function public.join_circle(p_invite_code text)
returns table(id uuid, name text, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  uname text;
  target public.circles%rowtype;
begin
  select username into uname from public.profiles where profiles.id = uid and onboarded = true;
  if uid is null or uname is null then
    raise exception 'Onboarded profile required';
  end if;

  select * into target from public.circles where circles.invite_code = upper(trim(p_invite_code));
  if target.id is null then
    raise exception 'Invite code not found';
  end if;

  insert into public.circle_members(circle_id, user_id)
  values(target.id, uid)
  on conflict (circle_id, user_id) do nothing;

  insert into public.events(user_id, username, kind, body, cta, circle_id)
  values(uid, uname, 'joined_circle', 'joined the circle.', 'The rivalry begins.', target.id);

  return query select target.id, target.name, target.invite_code;
end;
$$;

create or replace function public.log_retention_event(p_event_type text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  uname text;
  s public.streaks%rowtype;
  days integer;
  live_volume integer;
  multiplier integer;
  penalty_rate numeric;
  penalty integer;
  volume_after integer;
  today date := current_date;
  my_circle uuid;
  new_best integer;
  new_binge integer;
begin
  if p_event_type not in ('triumph','lapse','conscious') then
    raise exception 'Invalid event type';
  end if;

  select username into uname from public.profiles where id = uid and onboarded = true;
  select * into s from public.streaks where user_id = uid;
  select circle_id into my_circle from public.circle_members where user_id = uid order by created_at limit 1;

  if uid is null or uname is null or s.user_id is null then
    raise exception 'Onboarded profile and streak required';
  end if;

  days := public.current_streak_days(s.streak_start);
  live_volume := s.volume_score + days;

  if p_event_type = 'triumph' then
    insert into public.retention_events(user_id, event_type, volume_before, volume_after, penalty_multiplier, streak_days_at_event)
    values(uid, 'triumph', live_volume, live_volume, 1, days);

    insert into public.daily_log(user_id, log_date, day_type)
    values(uid, today, 'triumph')
    on conflict (user_id, log_date) do update set day_type = excluded.day_type;

    update public.streaks
      set triumph_count = triumph_count + 1,
          partnered_count = partnered_count + 1
      where user_id = uid;

    insert into public.events(user_id, username, kind, body, cta, circle_id)
    values(uid, uname, 'triumph', uname || ' held the line. The streak endures.', days || ' days and the streak holds.', my_circle);
    return;
  end if;

  multiplier := case when s.last_event_at is not null and now() - s.last_event_at < interval '14 days'
    then greatest(1, s.binge_count + 1)
    else 1
  end;
  penalty_rate := least(0.15 * multiplier, 1.0);
  penalty := round(live_volume * penalty_rate);
  volume_after := greatest(0, live_volume - penalty);
  new_best := greatest(s.best_days, days);
  new_binge := case when s.last_event_at is not null and now() - s.last_event_at < interval '14 days'
    then s.binge_count + 1
    else 1
  end;

  update public.streaks
    set streak_start = today,
        best_days = new_best,
        celebrated_milestones = '{}',
        volume_score = volume_after,
        last_event_at = now(),
        binge_count = new_binge,
        partnered_count = partnered_count + case when p_event_type = 'conscious' then 1 else 0 end
    where user_id = uid;

  insert into public.retention_events(user_id, event_type, volume_before, volume_after, penalty_multiplier, streak_days_at_event)
  values(uid, p_event_type, live_volume, volume_after, multiplier, days);

  insert into public.daily_log(user_id, log_date, day_type)
  values(uid, today, p_event_type)
  on conflict (user_id, log_date) do update set day_type = excluded.day_type;

  insert into public.events(user_id, username, kind, body, cta, circle_id)
  values(
    uid,
    uname,
    p_event_type,
    case when p_event_type = 'lapse'
      then uname || ' reset after ' || days || ' days. The reservoir drains to ' || volume_after || '.'
      else uname || ' chose a conscious reset. The reservoir drains to ' || volume_after || '.'
    end,
    'Best remains ' || new_best || ' days.',
    my_circle
  );
end;
$$;

alter table public.profiles enable row level security;
alter table public.streaks enable row level security;
alter table public.circles enable row level security;
alter table public.circle_members enable row level security;
alter table public.events enable row level security;
alter table public.retention_events enable row level security;
alter table public.daily_log enable row level security;
alter table public.relics enable row level security;

create policy "profiles read self and circle peers" on public.profiles
for select using (
  id = auth.uid()
  or exists (
    select 1
    from public.circle_members mine
    join public.circle_members theirs on theirs.circle_id = mine.circle_id
    where mine.user_id = auth.uid() and theirs.user_id = profiles.id
  )
);
create policy "profiles insert self" on public.profiles for insert with check (id = auth.uid());
create policy "profiles update self" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "streaks read self and circle peers" on public.streaks
for select using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.circle_members mine
    join public.circle_members theirs on theirs.circle_id = mine.circle_id
    where mine.user_id = auth.uid() and theirs.user_id = streaks.user_id
  )
);
create policy "streaks insert self" on public.streaks for insert with check (user_id = auth.uid());
create policy "streaks update self" on public.streaks for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "circles read member circles" on public.circles
for select using (id in (select public.user_circle_ids(auth.uid())));
create policy "circles insert self creator" on public.circles for insert with check (creator_id = auth.uid());

create policy "circle_members read own circles" on public.circle_members
for select using (circle_id in (select public.user_circle_ids(auth.uid())));
create policy "circle_members insert self" on public.circle_members for insert with check (user_id = auth.uid());

create policy "events read own circles or self" on public.events
for select using (
  user_id = auth.uid()
  or (circle_id is not null and circle_id in (select public.user_circle_ids(auth.uid())))
);
create policy "events insert self" on public.events for insert with check (user_id = auth.uid());

create policy "retention_events read self" on public.retention_events for select using (user_id = auth.uid());
create policy "retention_events insert self" on public.retention_events for insert with check (user_id = auth.uid());

create policy "daily_log read self and circle peers" on public.daily_log
for select using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.circle_members mine
    join public.circle_members theirs on theirs.circle_id = mine.circle_id
    where mine.user_id = auth.uid() and theirs.user_id = daily_log.user_id
  )
);
create policy "daily_log upsert self" on public.daily_log for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "relics read self and circle peers" on public.relics
for select using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.circle_members mine
    join public.circle_members theirs on theirs.circle_id = mine.circle_id
    where mine.user_id = auth.uid() and theirs.user_id = relics.user_id
  )
);
create policy "relics insert self" on public.relics for insert with check (user_id = auth.uid());

grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

notify pgrst, 'reload schema';
