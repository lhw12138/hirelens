import {describe,it,expect} from 'vitest';
import {cosine,validVectors,keywordRank,fuseAndRerank,type VectorSource} from './hybrid-rag';
const source=(id:string,text:string,vector:number[]):VectorSource=>({id,text,vector,kind:'resume',locator:id});
describe('hybrid RAG safeguards',()=>{
 it('rejects wrong dimensions, empty vectors and non-finite values',()=>{
  expect(()=>validVectors([[1,0]],1,2)).not.toThrow();
  for(const value of [[],[[1]],[[0,0]],[[NaN,1]],[[Infinity,1]]])expect(()=>validVectors(value,1,2)).toThrow();
 });
 it('finds Chinese bigrams and whole technology terms',()=>{
  const sources=[source('finance','负责发票金额核对',[1,0]),source('code','Java Redis',[0,1])];
  expect(keywordRank(sources,'发票核对')[0].id).toBe('finance');
  expect(keywordRank(sources,'Redis')[0].id).toBe('code');
 });
 it('combines semantic hits even without literal keyword hits',()=>{
  const sources=[source('meaning','同义表达',[1,0]),source('other','无关',[0,1])];
  expect(fuseAndRerank(sources,[1,0],[],['meaning','other'],1)[0].id).toBe('meaning');
 });
 it('never admits unknown IDs or duplicates from retrieval channels',()=>{
  const sources=[source('owned','允许的引用',[1,0])];
  expect(fuseAndRerank(sources,[1,0],['foreign','owned','owned'],['foreign','owned'],8).map(s=>s.id)).toEqual(['owned']);
 });
 it('cosine respects direction and dimension',()=>{
  expect(cosine([1,0],[0,1])).toBe(0);expect(cosine([1,0],[2,0])).toBe(1);expect(()=>cosine([1],[1,2])).toThrow();
 });
});
