import {beforeEach, describe, expect, it, vi} from 'vitest';

const state=vi.hoisted(()=>({
  inserted:undefined as {email:string;passwordHash:string}|undefined,
  selected:[] as Array<{id:string;email:string;passwordHash:string}>,
}));
const createHrSession=vi.hoisted(()=>vi.fn(async (id:string,email:string)=>`session:${id}:${email}`));

vi.mock('server-only',()=>({}));
vi.mock('@/lib/attempt-limit',()=>({allowAttempt:()=>true}));
vi.mock('@/lib/session',()=>({createHrSession}));
vi.mock('bcryptjs',()=>({
  hash:async(password:string)=>`hashed:${password}`,
  compare:async(password:string,passwordHash:string)=>passwordHash===`hashed:${password}`,
}));
vi.mock('@/server/db/client',()=>({getDatabase:()=>({
  insert:()=>({values:(value:{email:string;passwordHash:string})=>({onConflictDoNothing:()=>({returning:async()=>{
    state.inserted=value;
    return [{id:'11111111-1111-4111-8111-111111111111',email:value.email,passwordHash:value.passwordHash}];
  }})})}),
  select:()=>({from:()=>({where:async()=>state.selected})}),
})}));

import {POST} from './route';

describe('HR account API',()=>{
  beforeEach(()=>{
    state.inserted=undefined;state.selected=[];createHrSession.mockClear();
    delete process.env.HR_ADMIN_EMAIL;delete process.env.HR_ADMIN_PASSWORD;
  });
  it('registers a normalized account and starts its own session',async()=>{
    const response=await POST(new Request('http://localhost/api/auth/login',{method:'POST',body:JSON.stringify({action:'register',email:' One@Example.COM ',password:'Abcd1234'})}));
    expect(response.status).toBe(200);
    expect(state.inserted).toEqual({email:'one@example.com',passwordHash:'hashed:Abcd1234'});
    expect(createHrSession).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111','one@example.com');
    expect(response.headers.get('set-cookie')).toContain('hirelens_session=');
  });
  it('logs in the selected account identity rather than a configured global owner',async()=>{
    state.selected=[{id:'22222222-2222-4222-8222-222222222222',email:'two@example.com',passwordHash:'hashed:Abcd1234'}];
    const response=await POST(new Request('http://localhost/api/auth/login',{method:'POST',body:JSON.stringify({action:'login',email:'two@example.com',password:'Abcd1234'})}));
    expect(response.status).toBe(200);
    expect(createHrSession).toHaveBeenCalledWith('22222222-2222-4222-8222-222222222222','two@example.com');
  });
  it('rejects an invalid registration password before writing',async()=>{
    const response=await POST(new Request('http://localhost/api/auth/login',{method:'POST',body:JSON.stringify({action:'register',email:'one@example.com',password:'abcdefgh'})}));
    expect(response.status).toBe(400);
    expect(state.inserted).toBeUndefined();
  });
});
