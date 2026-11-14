import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const paths=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const signatures=[[/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,})/,'token GitHub'],[/\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{15,}/,'clave Supabase'],[/\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}/,'JWT'],[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,'clave privada'],[/\bsbp_[a-f0-9]{30,}/,'token Supabase']];
const issues=[];
for(const file of paths){
 if(/(^|\/)\.env/.test(file)&&!file.endsWith('.env.example'))issues.push(`${file}: archivo de entorno privado`);
 if(/(^|\/)(\.local|node_modules|dist|\.aws|\.codex|test-results)\//.test(file)||/\.(pem|key|pfx|p12|dump|backup)$/.test(file))issues.push(`${file}: archivo privado o generado`);
 if(/\.(png|jpg|ico|woff2?)$/.test(file))continue;
 const source=readFileSync(file,'utf8');for(const [pattern,label]of signatures)if(pattern.test(source))issues.push(`${file}: ${label}`);
}
if(issues.length){console.error(issues.join('\n'));process.exit(1)}
console.log(`Revisados ${paths.length} archivos versionados: sin credenciales detectadas por los patrones configurados.`);
