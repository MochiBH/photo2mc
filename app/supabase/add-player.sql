-- Adds one player account. Fill in the five values on the "values" line, run it once in the Supabase SQL editor,
-- then add the username to ALLOWED in app/server/players.mjs (or the ALLOWED_USERNAMES setting) and redeploy.
-- Do not save a real password in this file: type it into the editor, run, and discard.
do $$
declare
  rec record;
  uid uuid := gen_random_uuid();
  addr text;
begin
  select * into rec from (values
    ('username-here', 'CHANGE-THIS-PASSWORD', 'RiotName', 'TAG', 'jungle')   -- role is 'jungle' or 'support'
  ) as t(username, password, riot_name, riot_tag, role);
  addr := lower(rec.username) || '@players.jungle-coach.invalid';
  if exists (select 1 from auth.users where email = addr) then raise exception 'That username already has an account'; end if;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', addr, extensions.crypt(rec.password, extensions.gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('username', lower(rec.username)), now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text, 'email', jsonb_build_object('sub', uid::text, 'email', addr, 'email_verified', true, 'phone_verified', false), now(), now(), now());
  insert into public.profiles (id, display_name, riot_name, riot_tag, region, role) values (uid, rec.username, rec.riot_name, rec.riot_tag, 'na', rec.role);
end $$;
