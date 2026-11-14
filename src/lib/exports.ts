import type { Organization, Member, TimeEvent, Correction } from './types';
import { eventLabel } from './types';
import { localDay, localDateTime, localTime } from './attendance';
import type { Shift } from './attendance';
import { csv, download } from './csv';
export interface ExportContext { org: Organization; members: Member[]; from: string; to: string; memberId: string }
const within = (iso: string, c: ExportContext) => { const d = localDay(iso, c.org.timezone); return d >= c.from && d <= c.to; };
export function ledgerRows(events: TimeEvent[], corrections: Correction[], context: ExportContext): unknown[][] {
  const members = new Map(context.members.map(m => [m.user_id, m])); const originals = new Map(events.map(e => [e.id, e]));
  const included = corrections.filter(c => (!context.memberId || c.member_id === context.memberId) &&
    (within(c.created_at, context) || (c.occurred_at && within(c.occurred_at, context)) || (c.target_event_id && originals.has(c.target_event_id) && within(originals.get(c.target_event_id)!.occurred_at, context))));
  const targetIds = new Set(included.map(c => c.target_event_id));
  const rows: unknown[][] = [['empresa','numero_empleado','nombre','fecha','tipo','fecha_hora_local','fecha_hora_utc','metodo','origen','folio','motivo_correccion','hash','id','tipo_correccion','evento_objetivo','fecha_correccion_utc','creado_por']];
  for (const e of events.filter(e => (!context.memberId || e.member_id === context.memberId) && (within(e.occurred_at, context) || targetIds.has(e.id))).sort((a,b)=>a.occurred_at.localeCompare(b.occurred_at))) {
    const m=members.get(e.member_id); rows.push([context.org.name,m?.employee_number,m?.full_name,localDay(e.occurred_at,context.org.timezone),eventLabel(e.event_type),localDateTime(e.occurred_at,context.org.timezone),e.occurred_at,e.method,'original',e.hash.slice(0,8).toUpperCase(),'',e.hash,e.id,'','','','']);
  }
  for (const c of included.sort((a,b)=>a.created_at.localeCompare(b.created_at))) {
    const m=members.get(c.member_id);const target=c.target_event_id?originals.get(c.target_event_id):undefined;const at=c.occurred_at??target?.occurred_at??c.created_at;const type=c.event_type??target?.event_type;
    rows.push([context.org.name,m?.employee_number,m?.full_name,localDay(at,context.org.timezone),type?eventLabel(type):'',localDateTime(at,context.org.timezone),at,'','corrección',c.id.replace(/-/g,'').slice(0,8).toUpperCase(),c.reason,'',c.id,c.kind,c.target_event_id,c.created_at,c.created_by]);
  }
  return rows;
}
export function shiftRows(shifts: Shift[], context: ExportContext): unknown[][] {
  const members=new Map(context.members.map(m=>[m.user_id,m]));
  return [['empresa','numero_empleado','nombre','fecha','entrada_local','salida_local','horas','estado','origen','folio_entrada','folio_salida'],...shifts.map(s=>{const m=members.get(s.member_id);return [context.org.name,m?.employee_number,m?.full_name,s.day,s.entry?localDateTime(s.entry.occurred_at,context.org.timezone):'',s.exit?localDateTime(s.exit.occurred_at,context.org.timezone):'',s.hours?.toFixed(4)??'',s.status,s.corrected?'corregido':'original',s.entry?.folio,s.exit?.folio]})];
}
export function saveCsv(rows: unknown[][], filename:string) {download(new Blob([csv(rows)],{type:'text/csv;charset=utf-8'}),filename)}
export async function savePdf(shifts:Shift[],context:ExportContext) {
  const [{jsPDF},{default:autoTable}]=await Promise.all([import('jspdf'),import('jspdf-autotable')]);const doc=new jsPDF();const members=new Map(context.members.map(m=>[m.user_id,m]));
  doc.setFontSize(19);doc.text(context.org.name,14,19);doc.setFontSize(10);doc.text(`Registro de jornada | ${context.from} al ${context.to}`,14,28);doc.text(`Generado: ${localDateTime(new Date().toISOString(),context.org.timezone)} | ${context.org.timezone}`,14,35);
  autoTable(doc,{startY:43,head:[['Empleado / fecha','Entrada','Salida','Horas','Estado']],body:shifts.map(s=>[`${members.get(s.member_id)?.full_name??''}\n${s.day}`,s.entry?localTime(s.entry.occurred_at,context.org.timezone):'—',s.exit?`${localTime(s.exit.occurred_at,context.org.timezone)}\n${localDay(s.exit.occurred_at,context.org.timezone)}`:'—',s.hours?.toFixed(2)??'—',`${s.status}${s.corrected?' / corregido':''}`]),styles:{fontSize:8,cellPadding:3},headStyles:{fillColor:[23,50,77]},margin:{bottom:28}});
  const y=(doc as unknown as {lastAutoTable:{finalY:number}}).lastAutoTable.finalY;if(y>245)doc.addPage();doc.setFontSize(11);doc.text(`Total de horas de turnos completos: ${shifts.reduce((n,s)=>n+(s.hours??0),0).toFixed(2)}`,14,y>245?22:y+14);
  for(let page=1;page<=doc.getNumberOfPages();page++){doc.setPage(page);doc.setFontSize(8);doc.setTextColor(80);doc.text('Información proveniente del registro electrónico de la empresa.',14,279);doc.text('Totales informativos. No constituye cálculo legal de tiempo extra.',14,284);doc.text(`${page} / ${doc.getNumberOfPages()}`,185,284)}
  doc.save(`jornada_${context.from}_${context.to}.pdf`);
}
