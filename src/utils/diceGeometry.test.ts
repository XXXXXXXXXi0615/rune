import { describe, expect, it } from 'vitest';
import { orientationMapForDice } from '@/features/interactive/diceGeometry';

describe('standard dice face orientation maps', () => {
  it.each([['d4',4],['d6',6],['d8',8],['d12',12],['d20',20]] as const)('%s maps every result to a normalized quaternion', (kind, faces) => {
    const map=orientationMapForDice(kind,faces);
    expect(map.map(item=>item.result)).toEqual(Array.from({length:faces},(_,index)=>index+1));
    for(const item of map){const [x,y,z,w]=item.quaternion;expect(Math.hypot(x,y,z,w)).toBeCloseTo(1,5)}
  });

  it('does not claim exact orientation for approximation geometries', () => {
    expect(orientationMapForDice('d10',10)).toEqual([]);
    expect(orientationMapForDice('d-percent',100)).toEqual([]);
    expect(orientationMapForDice('d24',24)).toEqual([]);
    expect(orientationMapForDice('custom',36)).toEqual([]);
  });
});
