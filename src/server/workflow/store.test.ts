import {beforeEach, describe, expect, it, vi} from 'vitest';

const state=vi.hoisted(()=>({token:'one-token',where:undefined as unknown}));
vi.mock('server-only',()=>({}));
vi.mock('next/headers',()=>({cookies:async()=>({get:()=>({value:state.token})})}));
vi.mock('@/lib/session',()=>({verifyHrSession:async(token:string)=>token==='one-token'
  ?{id:'11111111-1111-4111-8111-111111111111',email:'one@example.com'}
  :{id:'22222222-2222-4222-8222-222222222222',email:'two@example.com'}}));
vi.mock('drizzle-orm',()=>({
  eq:(column:unknown,value:unknown)=>({operator:'eq',column,value}),
  and:(...parts:unknown[])=>({operator:'and',parts}),
  desc:(column:unknown)=>({operator:'desc',column}),
  sql:(strings:TemplateStringsArray,...values:unknown[])=>({operator:'sql',strings:[...strings],values}),
}));
vi.mock('@/server/db/client',()=>({getDatabase:()=>({
  select:()=>({from:()=>({where:(condition:unknown)=>{state.where=condition;return{orderBy:async()=>[]};}})}),
  update:()=>({set:()=>({where:(condition:unknown)=>{state.where=condition;return{returning:async()=>[{id:'11111111-1111-4111-8111-111111111111'}]};}})}),
})}));

import {listTasks, requireOwner, saveTask} from './store';
import type {HiringTask} from '@/lib/workflow';

describe('HR workspace ownership',()=>{
  beforeEach(()=>{state.token='one-token';state.where=undefined;});
  it('derives the owner from the signed account session',async()=>{
    await expect(requireOwner()).resolves.toBe('one@example.com');
    state.token='two-token';
    await expect(requireOwner()).resolves.toBe('two@example.com');
  });
  it('filters task listings by the current owner value',async()=>{
    await listTasks('one@example.com');
    const condition=state.where as {parts:Array<{operator:string;value?:unknown}>};
    expect(condition.parts[0]).toMatchObject({operator:'eq',value:'one@example.com'});
  });
  it('allows an optimistic save while another candidate is scoring',async()=>{
    const task={id:'11111111-1111-4111-8111-111111111111',title:'测试',jd:'测试岗位描述',synthetic:true,confirmed:true,criteria:[],candidates:[],audit:[],scoringJob:{id:'job-1',candidateId:'person-1',action:'screen',status:'running',queuedAt:new Date().toISOString()}} as HiringTask;
    await expect(saveTask(task,1,'one@example.com','保存其他候选人','person-2')).resolves.toBeTruthy();
    const condition=state.where as {parts:Array<{operator:string;strings?:string[]}>};
    expect(condition.parts.filter(part=>part.operator==='sql').flatMap(part=>part.strings||[]).join('')).not.toContain('scoringJob');
  });
});
