begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'a@example.com', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', 'b@example.com', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}');

insert into public.goalio_states (user_id, state_version, state) values
  ('00000000-0000-0000-0000-00000000000a', 1, '{"owner":"a"}'::jsonb),
  ('00000000-0000-0000-0000-00000000000b', 1, '{"owner":"b"}'::jsonb);

set local role anon;
select throws_ok(
  $$ select count(*) from public.goalio_states $$,
  '42501',
  null,
  'anonymous visitors cannot read goalio state'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select is((select count(*)::integer from public.goalio_states), 1, 'user A sees one row');
select is((select user_id::text from public.goalio_states), '00000000-0000-0000-0000-00000000000a', 'user A sees only its row');
select throws_ok(
  $$ insert into public.goalio_states (user_id, state_version, state) values ('00000000-0000-0000-0000-00000000000b', 1, '{}'::jsonb) $$,
  '42501',
  null,
  'user A cannot insert for user B'
);
select is(
  (with changed as (
    update public.goalio_states set state = '{"owner":"changed"}'::jsonb
    where user_id = '00000000-0000-0000-0000-00000000000b'
    returning 1
  ) select count(*)::integer from changed),
  0,
  'user A updates no user B rows'
);
select is(
  (with changed as (
    update public.goalio_states set state = '{"owner":"a-updated"}'::jsonb
    where user_id = '00000000-0000-0000-0000-00000000000a'
    returning 1
  ) select count(*)::integer from changed),
  1,
  'user A can update its own row'
);

reset role;
select is(
  (select state->>'owner' from public.goalio_states where user_id = '00000000-0000-0000-0000-00000000000b'),
  'b',
  'user B row stayed unchanged'
);

select * from finish();
rollback;
