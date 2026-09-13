import {afterEach, describe, expect, it, vi} from 'vitest';

const database = vi.hoisted(() => ({
  query: vi.fn(() => { throw new Error('transient candidate retrieval must not query the vector cache'); }),
  connect: vi.fn(() => { throw new Error('transient candidate retrieval must not write the vector cache'); }),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/server/db/client', () => ({getPool: () => database}));

import {prepareRetrieval} from './rag';
import type {Criterion, HiringTask, Person} from '@/lib/workflow';

describe('candidate transient retrieval', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    database.query.mockClear();
    database.connect.mockClear();
  });

  it('uses the HR hybrid retrieval algorithm without persisting temporary IDs', async () => {
    const vector = Array.from({length: 384}, (_, index) => index === 0 ? 1 : 0);
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/health')) return new Response(JSON.stringify({ready: true, dimensions: 384, modelKey: 'test-e5'}), {status: 200});
      const body = JSON.parse(String(init?.body)) as {texts: string[]};
      return new Response(JSON.stringify({modelKey: 'test-e5', vectors: body.texts.map(() => vector)}), {status: 200});
    }));

    const criteria: Criterion[] = [{id: 'delivery', name: '交付能力', description: '能够完成项目交付', weight: 100, mustHave: false}];
    const person: Person = {
      id: crypto.randomUUID(), name: '候选人', synthetic: false, filename: '候选人确认稿',
      resume: '负责项目规划并按期完成交付。', resumeConfirmed: true,
      sources: [{id: 'resume-1', kind: 'resume', locator: '简历第1段', text: '负责项目规划并按期完成交付。'}],
      questions: [], answers: {}, interviewComplete: false,
    };
    const task: HiringTask = {
      id: crypto.randomUUID(), title: '候选人匹配自测', jd: '负责项目交付', synthetic: false,
      confirmed: true, criteria, candidates: [person], audit: [],
    };

    const retrieval = await prepareRetrieval(task, person, criteria, 'screening', false);

    expect(retrieval.results.get('delivery')?.map(source => source.id)).toEqual(['resume-1']);
    expect(retrieval.trace.mode).toBe('hybrid');
    expect(retrieval.trace.cacheHit).toBe(false);
    expect(database.query).not.toHaveBeenCalled();
    expect(database.connect).not.toHaveBeenCalled();
  });
});
