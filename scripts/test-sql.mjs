// PostgreSQL real, aislado de cualquier servicio o base existente.
import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const bin = process.env.PG_BIN ?? (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/17/bin' : '/usr/lib/postgresql/17/bin');
const ext = process.platform === 'win32' ? '.exe' : '';
const data = path.resolve('.local/pg-test');
const port = process.env.PG_TEST_PORT ?? '55439';
const database = `checador_test_${Date.now()}`;
function run(name, args, input) {
  const result = spawnSync(path.join(bin, name + ext), args, { input, encoding: 'utf8', windowsHide: true, timeout: 120000, ...(name === 'pg_ctl' ? { stdio: 'ignore' } : {}) });
  if (result.error || result.status !== 0) throw new Error(result.error?.message ?? result.stderr + result.stdout);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stdout.write(result.stderr);
}
mkdirSync(path.dirname(data), { recursive: true });
if (!existsSync(path.join(data, 'PG_VERSION'))) run('initdb', ['-D', data, '-U', 'postgres', '--auth=trust', '--encoding=UTF8', '--locale=C']);
let started = false;
try {
  run('pg_ctl', ['-D', data, '-l', path.resolve('.local/postgres-test.log'), '-o', `-p ${port} -h 127.0.0.1`, '-w', 'start']);
  started = true;
  const connection = ['-h', '127.0.0.1', '-p', port, '-U', 'postgres'];
  run('createdb', [...connection, database]);
  const psql = [...connection, '-d', database, '-X', '-v', 'ON_ERROR_STOP=1'];
  run('psql', psql, `
    do $$ begin
      if not exists(select from pg_roles where rolname='anon') then create role anon nologin; end if;
      if not exists(select from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
      if not exists(select from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
    end $$;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated, service_role, anon;
    grant execute on function auth.uid() to authenticated, service_role, anon;
    create table auth.users (id uuid primary key, instance_id uuid, aud text, role text, email text unique,
      encrypted_password text, email_confirmed_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb,
      created_at timestamptz, updated_at timestamptz, confirmation_token text, recovery_token text, email_change text, email_change_token_new text);
    create table auth.identities (id uuid primary key, user_id uuid references auth.users(id), provider_id text,
      identity_data jsonb, provider text, last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz,
      unique(provider_id,provider));
  `);
  // Mantiene el mismo orden de migraciones que Supabase CLI.
  const { readdirSync } = await import('node:fs');
  if (existsSync('supabase/migrations')) {
    for (const file of readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort()) run('psql', [...psql, '-f', `supabase/migrations/${file}`]);
    run('psql', [...psql, '-f', 'supabase/seed.sql']);
  }
  run('psql', [...psql, '-f', 'supabase/tests/database.sql']);
  console.log('SQL: todas las verificaciones finalizaron correctamente.');
} finally {
  if (started) {
    run('dropdb', ['-h', '127.0.0.1', '-p', port, '-U', 'postgres', database]);
    run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']);
  }
}
