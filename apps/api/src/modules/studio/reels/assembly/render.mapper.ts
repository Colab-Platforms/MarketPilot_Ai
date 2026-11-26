import type { ReelAssembly, ReelRender } from '@marketpilot/contracts';
import type { ProjectRow } from '../reel.mapper';
import { assemblyInputs, type SoundAvailability } from './assembly-inputs';

// The latest render, and whether the reel as it stands now can be assembled.
export function toRenderView(
  row: ProjectRow,
  available: boolean,
  sound: SoundAvailability,
): { render: ReelRender | null; assembly: ReelAssembly } {
  const inputs = assemblyInputs(row, sound);
  const blockedBy = 'blockedBy' in inputs ? inputs.blockedBy : null;
  const latest = row.renders[0];
  const render: ReelRender | null = latest
    ? {
        id: latest.id,
        status: latest.status,
        url: latest.url,
        durationSeconds: latest.durationSeconds,
        assetId: latest.assetId,
        outdated:
          latest.status === 'succeeded' &&
          ('hash' in inputs ? latest.inputsHash !== inputs.hash : true),
        message: latest.message,
        createdAt: latest.createdAt.toISOString(),
      }
    : null;
  return { render, assembly: { available, blockedBy } };
}
