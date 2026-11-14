import { createClient } from '@supabase/supabase-js';
import { randomBytes, randomInt } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
const url=process.env.SUPABASE_URL??'http://127.0.0.1:54321';
if(!['localhost','127.0.0.1','[::1]'].includes(new URL(url).hostname))throw new Error('La demo solo puede configurarse en Supabase local.');
if(!process.env.SUPABASE_SERVICE_ROLE_KEY)throw new Error('Defina la service role local en SUPABASE_SERVICE_ROLE_KEY.');
const db=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const credentials=[];
for(const n of [10,20,1,2,3,4,5]){
 const id=`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const password=n<10?String(randomInt(0,1000000)).padStart(6,'0'):randomBytes(24).toString('base64url');
 const {data,error}=await db.auth.admin.updateUserById(id,{password});if(error)throw error;
 credentials.push({email:data.user.email,password});
}
mkdirSync('.local',{recursive:true});writeFileSync('.local/demo-credentials.json',JSON.stringify(credentials,null,2),{mode:0o600});
console.log('Credenciales aleatorias guardadas exclusivamente en .local/demo-credentials.json (ignorado por Git).');
