-- SOLO desarrollo local. No ejecutar en producción; credenciales iniciales aleatorias no recuperables.
insert into public.organizations(id,name,slug) values ('00000000-0000-4000-8000-000000000001','Taller Horizonte','demo');
do $$
declare account record; uid uuid;
begin
 for account in select * from (values
  (10,'owner',null,'Mariana López','admin@demo.checador.local'),
  (20,'kiosk',null,'Recepción','quiosco@demo.checador.local'),
  (1,'employee','001','Ana García','demo.001@empleados.checador.app'),
  (2,'employee','002','Luis Hernández','demo.002@empleados.checador.app'),
  (3,'employee','003','Sofía Martínez','demo.003@empleados.checador.app'),
  (4,'employee','004','Diego Pérez','demo.004@empleados.checador.app'),
  (5,'employee','005','Valeria Torres','demo.005@empleados.checador.app')
 ) as t(n,member_role,number,name,email) loop
  uid:=('10000000-0000-4000-8000-' || lpad(account.n::text,12,'0'))::uuid;
  insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,
    confirmation_token,recovery_token,email_change,email_change_token_new)
  values(uid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',account.email,
    extensions.crypt(encode(extensions.gen_random_bytes(32),'hex'),extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','');
  insert into auth.identities(id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
  values(gen_random_uuid(),uid,uid::text,jsonb_build_object('sub',uid::text,'email',account.email,'email_verified',true),'email',now(),now(),now());
  insert into public.members(user_id,org_id,role,employee_number,full_name)
  values(uid,'00000000-0000-4000-8000-000000000001',account.member_role,account.number,account.name);
 end loop;
end $$;
insert into public.policy_documents(org_id,kind,version,body_markdown) values
 ('00000000-0000-4000-8000-000000000001','aviso_privacidad',1,'REVISAR CON ABOGADO — TEXTO PLACEHOLDER, NO APTO PARA PRODUCCIÓN.
La empresa [RAZÓN SOCIAL, DOMICILIO Y CONTACTO] recaba nombre, número de empleado y registros de entrada/salida con hora y método para administrar la jornada. No recaba biometría ni ubicación. Completar finalidades, transferencias, conservación, medidas de seguridad y mecanismos de derechos ARCO antes de su uso real.'),
 ('00000000-0000-4000-8000-000000000001','acuerdo_registro',1,'REVISAR CON ABOGADO — TEXTO PLACEHOLDER, NO APTO PARA PRODUCCIÓN.
El registro utiliza la hora del servidor y la identificación mediante cuenta/PIN o QR. Los registros originales se conservan; los errores se corrigen con motivo y trazabilidad. Completar el procedimiento de aclaraciones y las condiciones de uso. Este texto no constituye asesoría jurídica ni acredita cumplimiento normativo.');
