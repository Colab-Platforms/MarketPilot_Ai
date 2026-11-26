import { AssemblyPort, type AssembledVideo } from './assembly.port';

// Used when ffmpeg or the caption font is missing: assembly is switched off, not broken.
export class UnavailableAssembly extends AssemblyPort {
  readonly available = false;

  assemble(): Promise<AssembledVideo> {
    return Promise.reject(new Error('Reel assembly is not set up on this server'));
  }
}
