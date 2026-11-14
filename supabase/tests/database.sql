-- Puede ejecutarse con psql -v ON_ERROR_STOP=1 despuÃ©s de migraciones/seed.
begin;
create schema testing;
create function testing.ok(value boolean, message text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAIL: %', message; end if; raise notice 'PASS: %', message; end $$;
create function testing.fails(statement text, message text) returns void language plpgsql as $$
begin
  begin execute statement; exception when others then raise notice 'PASS: % (%)', message, sqlerrm; return; end;
  raise exception 'FAIL (operaciÃ³n aceptada): %', message;
end $$;
grant usage on schema testing to authenticated, service_role, anon;
grant execute on all functions in schema testing to authenticated, service_role, anon;

select testing.ok((select count(*)=5 from public.members where role='employee'), 'seed con cinco empleados');
select testing.ok((select count(*)=5 from public.weekly_limits), 'lÃ­mites informativos');

-- Segunda empresa para comprobar aislamiento tambiÃ©n de administradores.
insert into organizations(id,name,slug) values ('00000000-0000-4000-8000-000000000002','Otra empresa','otra');
insert into auth.users(id,email) values ('20000000-0000-4000-8000-000000000001','otra.001@empleados.checador.app');
insert into members(user_id,org_id,role,employee_number,full_name) values
 ('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','employee','001','Otra persona');

select testing.fails($q$select record_time_event('10000000-0000-4000-8000-000000000001',null,'qr')$q$, 'marca exige polÃ­ticas vigentes');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select accept_current_policies((select array_agg(id) from policy_documents),'prueba SQL');
select testing.ok((select count(*)=2 from policy_acceptances), 'acepta ambos documentos vigentes');
select testing.ok((select count(*)=1 from members), 'empleado solo ve su ficha');
select testing.ok((select count(*)=1 from organizations), 'empleado no ve otra empresa');
select testing.fails('select * from org_secrets', 'secretos no legibles');
select testing.fails($q$select record_time_event('10000000-0000-4000-8000-000000000001',null,'qr')$q$, 'cliente no puede invocar inserciÃ³n de servicio');
select testing.fails($q$insert into time_events(org_id,member_id,event_type,method) values ('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','in','qr')$q$, 'cliente no inserta marcas');
select testing.fails($q$select create_correction('10000000-0000-4000-8000-000000000001','insert',null,'in',now(),'Prueba sin privilegios')$q$, 'empleado no corrige');
reset role;

select testing.ok((record_time_event('10000000-0000-4000-8000-000000000001',null,'qr')->>'event_type')='in','primera marca es entrada');
select testing.fails($q$select record_time_event('10000000-0000-4000-8000-000000000001',null,'qr')$q$, 'intervalo mÃ­nimo rechaza doble toque');
select testing.ok((select prev_hash='GENESIS' and length(hash)=64 from time_events limit 1),'hash inicial');
select testing.fails('update time_events set event_type=''out''','UPDATE inmutable incluso propietario');
select testing.fails('delete from time_events','DELETE inmutable incluso propietario');
select testing.fails('truncate time_events cascade','TRUNCATE inmutable');
update organizations set min_interval_seconds=0 where slug='demo';
select testing.ok((record_time_event('10000000-0000-4000-8000-000000000001',null,'qr')->>'event_type')='out','segunda marca es salida');
select testing.ok((select count(*)=2 and count(distinct chain_index)=2 from time_events),'secuencia inequÃ­voca');

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
select testing.ok((select count(*)=0 from time_events),'otro empleado no lee marcas');
select testing.ok((select count(*)=0 from v_effective_events),'vista respeta RLS');
select testing.ok(jsonb_array_length(get_ledger()->'events')=0,'snapshot respeta RLS');
select testing.fails($q$select verify_hash_chain('10000000-0000-4000-8000-000000000001')$q$, 'empleado no verifica cadena ajena');
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
select testing.ok((select count(*)=0 from time_events),'otra empresa no lee marcas');
select testing.ok((select count(*)=0 from policy_acceptances),'otra empresa no lee aceptaciones');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000010',true);
select testing.ok((select count(*)=2 from time_events),'owner lee organizaciÃ³n');
select testing.ok((select count(*)=1 from organizations),'owner no lee otra organizaciÃ³n');
select testing.ok((verify_hash_chain('10000000-0000-4000-8000-000000000001')->>'valid')::boolean,'cadena sana');
select testing.fails($q$select create_correction('10000000-0000-4000-8000-000000000001','insert',null,'in',now(),'corto')$q$,'motivo mÃ­nimo');
select testing.fails($q$select create_correction('20000000-0000-4000-8000-000000000001','insert',null,'in',now(),'Motivo fuera de empresa')$q$,'correcciÃ³n no cruza empresa');
select create_correction('10000000-0000-4000-8000-000000000001','void',(select id from time_events order by chain_index desc limit 1),null,null,'Salida marcada por equivocaciÃ³n');
select testing.ok((select count(*)=1 from v_effective_events),'anulaciÃ³n excluye evento efectivo');
select testing.ok((select count(*)=2 from time_events),'original anulado se conserva');
select create_correction('10000000-0000-4000-8000-000000000001','insert',null,'out',now(),'Salida faltante de prueba');
select testing.ok((select count(*)=1 from v_effective_events where source='correccion'),'inserciÃ³n efectiva identificada');
select create_correction('10000000-0000-4000-8000-000000000001','void',(select id from event_corrections where kind='insert' limit 1),null,null,'CorrecciÃ³n insertada por error');
select testing.ok((select count(*)=0 from v_effective_events where source='correccion'),'anula inserciÃ³n sin reescribirla');
select testing.fails($q$select accept_current_policies('[]'::uuid[],'prueba obsoleta')$q$,'rechaza aceptaciÃ³n de versiones no mostradas');
select testing.fails($q$select save_settings('No/Existe',1,60)$q$, 'zona horaria validada');
create temporary table shown_policies as select array_agg(id) as ids from policy_documents;
select publish_policy('aviso_privacidad','REVISAR CON ABOGADO. Nueva versiÃ³n de prueba.');
select testing.fails($q$select accept_current_policies((select ids from shown_policies),'Versiones vistas antes de publicar')$q$,'no acepta versión diferente a la mostrada');
reset role;
select testing.fails($q$select record_time_event('10000000-0000-4000-8000-000000000001',null,'qr')$q$, 'nueva versiÃ³n exige aceptaciÃ³n');
select testing.fails('update event_corrections set reason=''Reescritura invÃ¡lida''','correcciones inmutables');
select testing.fails('delete from audit_log','auditorÃ­a inmutable');
select testing.fails('update policy_documents set body_markdown=''Sobrescrito''','documentos versionados inmutables');

-- AlteraciÃ³n privilegiada, Ãºnicamente en la transacciÃ³n de pruebas.
alter table time_events disable trigger time_events_immutable;
update time_events set hash=repeat('0',64) where chain_index=1;
alter table time_events enable trigger time_events_immutable;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000010',true);
select testing.ok(not (verify_hash_chain('10000000-0000-4000-8000-000000000001')->>'valid')::boolean,'detecta alteraciÃ³n directa');
reset role;

-- Los intentos se reservan antes de Auth: las solicitudes concurrentes cuentan.
select begin_pin_attempt('10000000-0000-4000-8000-000000000020','001') from generate_series(1,5);
select testing.ok((begin_pin_attempt('10000000-0000-4000-8000-000000000020','001')->>'blocked')::boolean,'bloqueo tras cinco intentos pendientes/fallidos');
select testing.ok(not (begin_pin_attempt('10000000-0000-4000-8000-000000000020','999')->>'blocked')::boolean,'intento de nÃºmero inexistente recibe ruta genÃ©rica');
update members set active=false,deactivated_at=now() where user_id='10000000-0000-4000-8000-000000000020';
select testing.fails($q$select begin_pin_attempt('10000000-0000-4000-8000-000000000020','002')$q$,'quiosco revocado no opera');
set local role service_role;
select testing.fails('delete from time_events','service role no borra marcas');
select testing.fails('update audit_log set action=''alterado''','service role no modifica auditorÃ­a');
reset role;
rollback;
