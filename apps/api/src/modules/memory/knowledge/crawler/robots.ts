import { CrawlerPort, FetchError } from './crawler.port';

const AGENT_TOKEN = 'marketpilotbot';

interface Rule {
  allow: boolean;
  pattern: RegExp;
  length: number;
}

export class RobotsRules {
  constructor(private readonly rules: Rule[], private readonly blockAll = false) {}

  static allowAll(): RobotsRules {
    return new RobotsRules([]);
  }

  static blockAll(): RobotsRules {
    return new RobotsRules([], true);
  }

  // Longest matching rule wins; on a tie, allow wins (RFC 9309).
  isAllowed(pathAndQuery: string): boolean {
    if (this.blockAll) return false;
    let best: Rule | null = null;
    for (const rule of this.rules) {
      if (!rule.pattern.test(pathAndQuery)) continue;
      if (!best || rule.length > best.length || (rule.length === best.length && rule.allow)) best = rule;
    }
    return best ? best.allow : true;
  }
}

function toPattern(path: string): RegExp {
  const escaped = path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped.endsWith('\\$') ? `${escaped.slice(0, -2)}$` : escaped}`);
}

export function parseRobots(text: string): RobotsRules {
  const groups: { agents: string[]; rules: Rule[] }[] = [];
  let current: { agents: string[]; rules: Rule[] } | null = null;
  let lastWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, '').trim();
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if ((field === 'allow' || field === 'disallow') && current && value !== '') {
      current.rules.push({ allow: field === 'allow', pattern: toPattern(value), length: value.length });
    }
  }

  const specific = groups.filter((g) => g.agents.some((a) => a !== '*' && AGENT_TOKEN.includes(a)));
  const chosen = specific.length > 0 ? specific : groups.filter((g) => g.agents.includes('*'));
  return new RobotsRules(chosen.flatMap((g) => g.rules));
}

// RFC 9309: a missing robots.txt (4xx) means everything is allowed; an unreachable
// one (5xx or network failure) means we must not crawl.
export async function loadRobots(crawler: CrawlerPort, origin: string): Promise<RobotsRules> {
  try {
    const response = await crawler.fetch(`${origin}/robots.txt`, { maxBytes: 200_000, timeoutMs: 6_000, accept: 'text/plain' });
    if (response.status >= 500) return RobotsRules.blockAll();
    if (response.status >= 400) return RobotsRules.allowAll();
    return parseRobots(response.body);
  } catch (error) {
    if (error instanceof FetchError && error.reason === 'unsupported_type') return RobotsRules.allowAll();
    // An address we must not reach is a different problem from a robots.txt that is down.
    if (error instanceof FetchError && error.reason === 'blocked') throw error;
    return RobotsRules.blockAll();
  }
}
