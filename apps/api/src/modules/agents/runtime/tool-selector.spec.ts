import { z } from 'zod';
import { ALL_ROLES, type AnyTool, type ToolDomain } from '@/common';
import { selectTools } from './tool-selector';

function tool(name: string, domain: ToolDomain, pages?: string[]): AnyTool {
  return {
    name,
    domain,
    kind: 'read',
    label: name,
    description: name,
    args: z.object({}),
    roles: ALL_ROLES,
    pages,
    run: async () => null,
    summarize: () => '',
  };
}

describe('selectTools', () => {
  const base = [tool('tools.search', 'meta'), tool('brain.search', 'brain'), tool('profile.get', 'profile', ['/brand'])];

  it('offers every allowed tool while the catalogue fits under the cap', () => {
    expect(selectTools({ tools: base, domains: [], route: undefined, ranked: [], cap: 15 })).toEqual([
      'tools.search',
      'brain.search',
      'profile.get',
    ]);
  });

  it('above the cap, orders always-on, page, domain, then rank, and cuts at the cap', () => {
    const many = [
      ...base,
      tool('analytics.post_metrics', 'analytics'),
      tool('analytics.query', 'analytics'),
      tool('calendar.list', 'calendar'),
      tool('caption.generate', 'content'),
    ];
    const selected = selectTools({
      tools: many,
      domains: ['analytics'],
      route: '/brand/profile',
      ranked: ['caption.generate', 'calendar.list'],
      cap: 6,
    });
    expect(selected).toEqual([
      'tools.search',
      'brain.search',
      'profile.get',
      'analytics.post_metrics',
      'analytics.query',
      'caption.generate',
    ]);
  });

  it('never offers a tool the role was not given, even if ranked', () => {
    const selected = selectTools({ tools: base, domains: [], route: undefined, ranked: ['publish.propose_now'], cap: 2 });
    expect(selected).not.toContain('publish.propose_now');
    expect(selected).toHaveLength(2);
  });
});
