import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

export type TenantTx = Prisma.TransactionClient;

const TENANT_TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 } as const;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  // Every query on a tenant table must run through here. The connection role may
  // bypass RLS, so the transaction drops to `app_runtime` (NOBYPASSRLS) and binds
  // the workspace that the policies compare against.
  withTenant<T>(workspaceId: string, work: (tx: TenantTx) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.workspace_id', ${workspaceId}, true)`;
      await tx.$executeRaw`SET LOCAL ROLE app_runtime`;
      return work(tx);
    }, TENANT_TX_OPTIONS);
  }
}
