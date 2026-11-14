import { it,expect } from 'vitest';
import { csv } from '../src/lib/csv';
it('CSV lleva BOM y escapa comas, comillas y saltos',()=>expect(csv([['nombre','nota'],['Ana, López','"sí"\ntexto']])).toBe('\uFEFF"nombre","nota"\r\n"Ana, López","""sí""\ntexto"'));
it('neutraliza fórmulas de Excel en texto no confiable',()=>{for(const value of ['=1+1','+cmd','-cmd','@SUM(1)','\t=1','\r=1']) expect(csv([[value]])).toContain("'");});
