// Pruebas de UI con contratos Supabase simulados; no sustituyen la integración real.
import { test, expect, type Page } from '@playwright/test';
const org={id:'00000000-0000-4000-8000-000000000001',name:'Taller Horizonte',slug:'demo',timezone:'America/Mexico_City',week_starts_on:1,min_interval_seconds:60};
const policies=['aviso_privacidad','acuerdo_registro'].map((kind,i)=>({id:`policy-${i}`,org_id:org.id,kind,version:1,body_markdown:'REVISAR CON ABOGADO. Documento de prueba con información de privacidad.',created_at:new Date().toISOString()}));
async function setup(page:Page,role='employee',accepted=true){
 const member={user_id:'10000000-0000-4000-8000-000000000001',org_id:org.id,role,employee_number:'001',full_name:role==='kiosk'?'Recepción':'Ana García',active:true};
 const events:Record<string,unknown>[]=[];const captures:Record<string,unknown>[]=[];
 await page.route('http://127.0.0.1:54321/**',async route=>{
  const req=route.request();const path=new URL(req.url()).pathname;const input=req.postDataJSON()??{};let data:unknown=[];
  if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*'}});return}
  if(path.includes('/auth/v1/token')){
   const user={id:member.user_id,email:'demo.001@empleados.checador.app',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()};
   const token=`${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:member.user_id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.test`;
   data={access_token:token,token_type:'bearer',expires_in:3600,refresh_token:'test-refresh',user};
  }else if(path.endsWith('/members')) data=req.headers().accept?.includes('object')?member:[member];
  else if(path.endsWith('/organizations'))data=org;
  else if(path.endsWith('/policy_documents'))data=policies;
  else if(path.endsWith('/policy_acceptances'))data=accepted?policies.map(p=>({document_id:p.id})):[];
  else if(path.endsWith('/accept_current_policies')){accepted=true;data=null;}
  else if(path.endsWith('/v_effective_events'))data=events.map(e=>({...e,source:'original',folio:'ABC12345'}));
  else if(path.endsWith('/get_ledger'))data={events,corrections:[],members:[member],limits:[{year:2026,hours:48}],snapshot_at:new Date().toISOString()};
  else if(path.endsWith('/time_events'))data=events;
  else if(path.endsWith('/event_corrections'))data=[];
  else if(path.endsWith('/weekly_limits'))data=[{year:2026,hours:48}];
  else if(path.endsWith('/qr-token'))data={token:`${org.id}.12345678.abcdefghijklmnop`,expires_at:new Date(Date.now()+30000).toISOString(),server_time:new Date().toISOString(),slot_seconds:30};
  else if(path.endsWith('/checkin')){
   captures.push(input);
   if(input.dry_run)data={event_type:'in'};
   else{const occurred_at=new Date().toISOString();data={event_id:'event-1',event_type:'in',occurred_at,employee_name:'Ana García',folio:'ABC12345'};events.push({id:'event-1',org_id:org.id,member_id:member.user_id,event_type:'in',occurred_at,method:input.method,hash:'abc12345'+'a'.repeat(56),created_at:occurred_at,chain_index:1})}
  }
  await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'},body:JSON.stringify(data)});
 });
 return {captures};
}
async function login(page:Page,admin=false){
 if(admin){await page.getByRole('tab',{name:'Administrador'}).click();await page.getByLabel('Correo electrónico').fill('admin@test.local');await page.getByLabel('Contraseña',{exact:true}).fill(crypto.randomUUID())}
 else{await page.getByLabel('Código de empresa').fill('demo');await page.getByLabel('Número de empleado',{exact:true}).fill('001');await page.getByLabel('PIN de 6 dígitos',{exact:true}).fill('123456')}
 await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();
}
test('empleado vuelve al QR tras login y aceptación, confirma y ve folio en historial',async({page})=>{
 const {captures}=await setup(page,'employee',false);await page.goto('/c?t=qr-prueba');await login(page);
 await expect(page.getByRole('heading',{name:'Conozca y acepte el registro'})).toBeVisible();await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Aceptar y continuar'}).click();
 await expect(page.getByRole('heading',{name:'ENTRADA',exact:true})).toBeVisible();await page.getByRole('button',{name:'Confirmar marca'}).click();await expect(page.getByText('ABC12345',{exact:true})).toBeVisible();
 await page.getByRole('link',{name:'Volver a mi jornada'}).click();await page.getByRole('link',{name:'Historial',exact:true}).click();await expect(page.getByText('ABC12345',{exact:true})).toBeVisible();
 expect(captures).toEqual([{method:'qr',token:'qr-prueba',dry_run:true},{method:'qr',token:'qr-prueba'}]);
});
test('QR vencido muestra recuperación clara',async({page})=>{
 await setup(page);await page.route('**/functions/v1/checkin',route=>route.fulfill({status:410,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({error:'El código expiró, escanee de nuevo'})}));
 await page.goto('/c?t=vencido');await login(page);await expect(page.getByRole('alert')).toContainText('El código expiró');await expect(page.getByRole('link',{name:'Escanear de nuevo'})).toBeVisible();
});
test('quiosco recibe QR y marca por PIN, impide nuevas marcas sin conexión',async({page})=>{
 const {captures}=await setup(page,'kiosk');await page.goto('/login');await login(page,true);await expect(page.getByRole('img',{name:'Código QR dinámico para registrar entrada o salida'})).toBeVisible();
 await page.getByLabel('Número de empleado',{exact:true}).fill('001');await page.getByLabel('PIN de 6 dígitos',{exact:true}).fill('123456');await page.getByRole('button',{name:'Registrar entrada / salida',exact:true}).click();await expect(page.getByText('ABC12345',{exact:true})).toBeVisible();expect(captures[0]).toEqual({method:'kiosk_pin',employee_number:'001',pin:'123456'});
 await page.evaluate(()=>window.dispatchEvent(new Event('offline')));await expect(page.getByRole('alert')).toContainText('Sin conexión');await expect(page.getByRole('button',{name:'Registrar entrada / salida',exact:true})).toBeDisabled();
});
test('administración navega por personas, registros, reportes y configuración',async({page})=>{
 await setup(page,'owner');await page.goto('/login');await login(page,true);await expect(page.getByRole('heading',{name:'Resumen de jornada'})).toBeVisible();
 await page.getByRole('link',{name:'Personas',exact:true}).click();await expect(page.getByRole('heading',{name:'Personas y quioscos'})).toBeVisible();await page.getByRole('button',{name:'Agregar empleado',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'Cerrar ventana'}).click();
 await page.getByRole('link',{name:'Registros',exact:true}).click();await expect(page.getByRole('heading',{name:'Registros de jornada',exact:true})).toBeVisible();
 await page.getByRole('link',{name:'Reportes',exact:true}).click();await expect(page.getByRole('button',{name:'Bitácora completa · CSV'})).toBeVisible();
 await page.getByRole('link',{name:'Configuración',exact:true}).click();await expect(page.getByRole('heading',{name:'Configuración',exact:true})).toBeVisible();
});
test('login móvil sin desbordamientos',async({page})=>{
 await page.setViewportSize({width:390,height:844});await setup(page);await page.goto('/login');await expect(page.getByRole('button',{name:'Iniciar sesión',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await expect(page).toHaveTitle('Qrono · Registro de jornada');await expect(page.locator('.brand')).toContainText('qrono');await page.screenshot({path:'.local/login-mobile.png',fullPage:true});
});
