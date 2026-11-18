import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';

export interface TenantScope {
  workspaceId: string;
  brandId?: string;
  userId?: string;
}

@Injectable()
export class TenantContext {
  private readonly storage = new AsyncLocalStorage<TenantScope>();

  run<T>(scope: TenantScope, fn: () => T): T {
    return this.storage.run(scope, fn);
  }

  current(): TenantScope {
    const scope = this.storage.getStore();
    if (!scope) throw new Error('Tenant scope is not set for this execution context');
    return scope;
  }
}
