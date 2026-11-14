import { describe, it, expect } from 'vitest';
import { createQrToken, verifyQrToken } from '../supabase/functions/_shared/qr';
const org='00000000-0000-4000-8000-000000000001';
const secret='a'.repeat(64);
const now=1800000010000;
describe('QR firmado por empresa',()=>{
 it('admite el slot actual',async()=>expect(await verifyQrToken(await createQrToken(org,secret,now),org,secret,now)).toBe(true));
 it('admite el slot anterior',async()=>expect(await verifyQrToken(await createQrToken(org,secret,now-30000),org,secret,now)).toBe(true));
 it('rechaza dos slots atrás',async()=>expect(await verifyQrToken(await createQrToken(org,secret,now-60000),org,secret,now)).toBe(false));
 it('rechaza futuro',async()=>expect(await verifyQrToken(await createQrToken(org,secret,now+30000),org,secret,now)).toBe(false));
 it('rechaza firma alterada',async()=>{const t=await createQrToken(org,secret,now);expect(await verifyQrToken(t.slice(0,-1)+(t.endsWith('A')?'B':'A'),org,secret,now)).toBe(false)});
 it('rechaza otra empresa',async()=>expect(await verifyQrToken(await createQrToken(org,secret,now),'00000000-0000-4000-8000-000000000002',secret,now)).toBe(false));
 it('rechaza formato excesivo/malformado',async()=>{for(const t of ['',org+'.NaN.x', 'x'.repeat(5000)]) expect(await verifyQrToken(t,org,secret,now)).toBe(false)});
});
