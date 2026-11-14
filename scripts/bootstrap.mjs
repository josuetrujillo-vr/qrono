import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
const config=z.object({SUPABASE_URL:z.url(),SUPABASE_SERVICE_ROLE_KEY:z.string().min(20),ORG_NAME:z.string().min(1).max(120),ORG_SLUG:z.string().regex(/^[a-z0-9][a-z0-9-]{1,39}$/),OWNER_EMAIL:z.email(),OWNER_NAME:z.string().min(1).max(120),OWNER_PASSWORD:z.string().min(12).max(128)}).safeParse(process.env);
if(!config.success){console.error('Defina SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ORG_NAME, ORG_SLUG, OWNER_EMAIL, OWNER_NAME y OWNER_PASSWORD (12+ caracteres).');process.exit(1)}
const c=config.data;const db=createClient(c.SUPABASE_URL,c.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
function check(result){if(result.error)throw new Error(result.error.message);return result.data}
let createdUser;
try{
 let org=check(await db.from('organizations').select('id').eq('slug',c.ORG_SLUG).maybeSingle());
 if(!org)org=check(await db.from('organizations').insert({name:c.ORG_NAME,slug:c.ORG_SLUG}).select('id').single());
 const existing=check(await db.from('members').select('user_id').eq('org_id',org.id).eq('role','owner'));
 if(existing.length)throw new Error('La empresa ya tiene propietario. Use el panel para administrar cuentas.');
 const {user}=check(await db.auth.admin.createUser({email:c.OWNER_EMAIL,password:c.OWNER_PASSWORD,email_confirm:true}));createdUser=user.id;
 check(await db.from('members').insert({user_id:user.id,org_id:org.id,role:'owner',full_name:c.OWNER_NAME}));createdUser=undefined;
 const docs=check(await db.from('policy_documents').select('id').eq('org_id',org.id));
 if(!docs.length)check(await db.from('policy_documents').insert(['aviso_privacidad','acuerdo_registro'].map(kind=>({org_id:org.id,kind,version:1,body_markdown:'REVISAR CON ABOGADO — PLACEHOLDER. Recabamos nombre, número de empleado y marcas con hora y método. No se recaba ubicación ni biometría. Complete responsable, finalidades, conservación, derechos y condiciones del acuerdo antes del uso real.'}))));
 check(await db.from('audit_log').insert({org_id:org.id,actor_id:user.id,action:'bootstrap_organization',entity:'organizations',entity_id:org.id}));
 console.log(`Empresa creada: ${c.ORG_SLUG}. Inicie sesión con el correo del propietario y publique los textos legales revisados.`);
}catch(error){if(createdUser)await db.auth.admin.deleteUser(createdUser);console.error(error.message);process.exitCode=1}
