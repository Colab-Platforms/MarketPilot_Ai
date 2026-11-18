import type { RunnableConfig } from '@langchain/core/runnables';
import {
  BaseCheckpointSaver,
  WRITES_IDX_MAP,
  compareWritesSortKeys,
  copyCheckpoint,
  writesSortKey,
  type ChannelVersions,
  type Checkpoint,
  type CheckpointListOptions,
  type CheckpointMetadata,
  type CheckpointPendingWrite,
  type CheckpointTuple,
  type PendingWrite,
} from '@langchain/langgraph-checkpoint';
import type { AgentCheckpoint } from '@prisma/client';
import { PrismaService } from '@/infra/prisma';

// LangGraph's checkpoint store on our own tables (ADR 0005), bound to one workspace and one run.
// Every read and write runs in the tenant transaction, so RLS applies as for any other table.
// The LangGraph thread id is the agent run id.
export class PrismaCheckpointer extends BaseCheckpointSaver {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceId: string,
    private readonly runId: string,
  ) {
    super();
  }

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const namespace = this.namespaceOf(config);
    const checkpointId = config.configurable?.checkpoint_id as string | undefined;
    this.assertThread(config);
    const row = await this.prisma.withTenant(this.workspaceId, (tx) =>
      checkpointId
        ? tx.agentCheckpoint.findUnique({
            where: { runId_namespace_checkpointId: { runId: this.runId, namespace, checkpointId } },
          })
        : tx.agentCheckpoint.findFirst({ where: { runId: this.runId, namespace }, orderBy: { checkpointId: 'desc' } }),
    );
    return row ? this.toTuple(row) : undefined;
  }

  async *list(config: RunnableConfig, options: CheckpointListOptions = {}): AsyncGenerator<CheckpointTuple> {
    this.assertThread(config);
    const namespace = config.configurable?.checkpoint_ns as string | undefined;
    const before = options.before?.configurable?.checkpoint_id as string | undefined;
    const rows = await this.prisma.withTenant(this.workspaceId, (tx) =>
      tx.agentCheckpoint.findMany({
        where: {
          runId: this.runId,
          ...(namespace !== undefined && { namespace }),
          ...(before && { checkpointId: { lt: before } }),
        },
        orderBy: { checkpointId: 'desc' },
      }),
    );
    let remaining = options.limit ?? Number.POSITIVE_INFINITY;
    for (const row of rows) {
      if (remaining <= 0) return;
      const tuple = await this.toTuple(row);
      const metadata = (tuple.metadata ?? {}) as Record<string, unknown>;
      if (options.filter && !Object.entries(options.filter).every(([key, value]) => metadata[key] === value)) continue;
      remaining -= 1;
      yield tuple;
    }
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
    _newVersions: ChannelVersions,
  ): Promise<RunnableConfig> {
    this.assertThread(config);
    const namespace = this.namespaceOf(config);
    const [[checkpointType, checkpointBytes], [metadataType, metadataBytes]] = await Promise.all([
      this.serde.dumpsTyped(copyCheckpoint(checkpoint)),
      this.serde.dumpsTyped(metadata),
    ]);
    const data = {
      parentCheckpointId: (config.configurable?.checkpoint_id as string | undefined) ?? null,
      checkpointType,
      checkpoint: Buffer.from(checkpointBytes),
      metadataType,
      metadata: Buffer.from(metadataBytes),
    };
    await this.prisma.withTenant(this.workspaceId, (tx) =>
      tx.agentCheckpoint.upsert({
        where: { runId_namespace_checkpointId: { runId: this.runId, namespace, checkpointId: checkpoint.id } },
        create: { workspaceId: this.workspaceId, runId: this.runId, namespace, checkpointId: checkpoint.id, ...data },
        update: data,
      }),
    );
    return { configurable: { thread_id: this.runId, checkpoint_ns: namespace, checkpoint_id: checkpoint.id } };
  }

  async putWrites(config: RunnableConfig, writes: PendingWrite[], taskId: string, taskPath?: string): Promise<void> {
    this.assertThread(config);
    const namespace = this.namespaceOf(config);
    const checkpointId = config.configurable?.checkpoint_id as string | undefined;
    if (!checkpointId) throw new Error('Cannot store writes without a checkpoint id');

    const rows = await Promise.all(
      writes.map(async ([channel, value], index) => {
        const [valueType, bytes] = await this.serde.dumpsTyped(value);
        return {
          workspaceId: this.workspaceId,
          runId: this.runId,
          namespace,
          checkpointId,
          taskId,
          taskPath: taskPath ?? '',
          idx: WRITES_IDX_MAP[channel] ?? index,
          channel,
          valueType,
          value: Buffer.from(bytes),
        };
      }),
    );
    // Regular writes are first-wins (a replayed task must not change history); special writes
    // (errors, interrupts) use negative indexes and always replace.
    await this.prisma.withTenant(this.workspaceId, async (tx) => {
      const regular = rows.filter((row) => row.idx >= 0);
      if (regular.length > 0) await tx.agentCheckpointWrite.createMany({ data: regular, skipDuplicates: true });
      for (const row of rows.filter((r) => r.idx < 0)) {
        const { runId, namespace: ns, checkpointId: cid, taskId: tid, idx } = row;
        await tx.agentCheckpointWrite.upsert({
          where: { runId_namespace_checkpointId_taskId_idx: { runId, namespace: ns, checkpointId: cid, taskId: tid, idx } },
          create: row,
          update: { channel: row.channel, valueType: row.valueType, value: row.value, taskPath: row.taskPath },
        });
      }
    });
  }

  async deleteThread(threadId: string): Promise<void> {
    if (threadId !== this.runId) throw new Error('A run checkpointer can only delete its own run');
    await this.prisma.withTenant(this.workspaceId, async (tx) => {
      await tx.agentCheckpointWrite.deleteMany({ where: { runId: this.runId } });
      await tx.agentCheckpoint.deleteMany({ where: { runId: this.runId } });
    });
  }

  private async toTuple(row: AgentCheckpoint): Promise<CheckpointTuple> {
    const [checkpoint, metadata, pendingWrites] = await Promise.all([
      this.serde.loadsTyped(row.checkpointType, new Uint8Array(row.checkpoint)) as Promise<Checkpoint>,
      this.serde.loadsTyped(row.metadataType, new Uint8Array(row.metadata)) as Promise<CheckpointMetadata>,
      this.pendingWrites(row.namespace, row.checkpointId),
    ]);
    const configurable = { thread_id: this.runId, checkpoint_ns: row.namespace };
    return {
      config: { configurable: { ...configurable, checkpoint_id: row.checkpointId } },
      checkpoint,
      metadata,
      pendingWrites,
      ...(row.parentCheckpointId && {
        parentConfig: { configurable: { ...configurable, checkpoint_id: row.parentCheckpointId } },
      }),
    };
  }

  // Returned in the order live execution applies them (see `writesSortKey`).
  private async pendingWrites(namespace: string, checkpointId: string): Promise<CheckpointPendingWrite[]> {
    const rows = await this.prisma.withTenant(this.workspaceId, (tx) =>
      tx.agentCheckpointWrite.findMany({ where: { runId: this.runId, namespace, checkpointId } }),
    );
    rows.sort((a, b) =>
      compareWritesSortKeys(writesSortKey(a.taskPath, a.taskId, a.idx), writesSortKey(b.taskPath, b.taskId, b.idx)),
    );
    return Promise.all(
      rows.map(async (row): Promise<CheckpointPendingWrite> => [
        row.taskId,
        row.channel,
        await this.serde.loadsTyped(row.valueType, new Uint8Array(row.value)),
      ]),
    );
  }

  private namespaceOf(config: RunnableConfig): string {
    return (config.configurable?.checkpoint_ns as string | undefined) ?? '';
  }

  private assertThread(config: RunnableConfig): void {
    const threadId = config.configurable?.thread_id as string | undefined;
    if (threadId !== undefined && threadId !== this.runId) {
      throw new Error('Checkpoint thread does not match the bound run');
    }
  }
}
