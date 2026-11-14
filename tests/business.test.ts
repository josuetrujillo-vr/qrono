import { describe,it,expect,vi } from 'vitest';
import { nextEventType, assertInterval, employeeEmail, checkinSchema, adminSchema } from '../supabase/functions/_shared/business';
import { authenticatePin } from '../supabase/functions/_shared/pin';
describe('reglas de entrada',()=>{
 it('alterna desde entrada inicial',()=>{expect(nextEventType(null)).toBe('in');expect(nextEventType('in')).toBe('out');expect(nextEventType('out')).toBe('in')});
 it('intervalo usa hora de servidor y acepta el límite exacto',()=>{expect(()=>assertInterval(60000,1,60)).toThrow();expect(()=>assertInterval(60000,0,60)).not.toThrow()});
 it('normaliza email con números que conservan ceros',()=>expect(employeeEmail('DEMO','001')).toBe('demo.001@empleados.checador.app'));
 it('PIN exactamente seis dígitos y payload cerrado',()=>{expect(checkinSchema.safeParse({method:'kiosk_pin',employee_number:'001',pin:'12345'}).success).toBe(false);expect(checkinSchema.safeParse({method:'qr',token:'abc',occurred_at:'2000'}).success).toBe(false);expect(adminSchema.safeParse({action:'create_employee',employee_number:'001',full_name:'Ana',pin:'123456',role:'owner'}).success).toBe(false)});
 it('no autentica cuando la reserva está bloqueada',async()=>{const verify=vi.fn();await expect(authenticatePin({begin:async()=>({blocked:true}),verify,finish:vi.fn()})).rejects.toMatchObject({status:429});expect(verify).not.toHaveBeenCalled()});
 it('registra fallo sin revelar existencia',async()=>{const finish=vi.fn();await expect(authenticatePin({begin:async()=>({blocked:false,attempt_id:'x'}),verify:async()=>null,finish})).rejects.toMatchObject({message:'Número o PIN incorrectos'});expect(finish).toHaveBeenCalledWith('x',false)});
 it('registra intento exitoso',async()=>{const finish=vi.fn();expect(await authenticatePin({begin:async()=>({blocked:false,attempt_id:'x'}),verify:async()=> 'user',finish})).toBe('user');expect(finish).toHaveBeenCalledWith('x',true)});
});
