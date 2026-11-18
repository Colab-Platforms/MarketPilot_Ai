-- CreateEnum
CREATE TYPE "CopilotRole" AS ENUM ('user', 'assistant');

-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('running', 'awaiting_approval', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "ToolCallStatus" AS ENUM ('ok', 'error', 'denied');

-- CreateEnum
CREATE TYPE "PendingActionStatus" AS ENUM ('pending', 'approved', 'rejected', 'executed', 'failed');

-- CreateTable
CREATE TABLE "conversation" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT,
    "summary" TEXT,
    "summary_through_id" UUID,
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "run_id" UUID,
    "role" "CopilotRole" NOT NULL,
    "content" TEXT NOT NULL,
    "blocks" JSONB NOT NULL DEFAULT '[]',
    "prompt_tokens" INTEGER,
    "completion_tokens" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_run" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "AgentRunStatus" NOT NULL DEFAULT 'running',
    "idempotency_key" TEXT,
    "steps" INTEGER NOT NULL DEFAULT 0,
    "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
    "completion_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "models" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "page" JSONB,
    "trace_id" TEXT,
    "error" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "agent_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_checkpoint" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "namespace" TEXT NOT NULL DEFAULT '',
    "checkpoint_id" TEXT NOT NULL,
    "parent_checkpoint_id" TEXT,
    "checkpoint_type" TEXT NOT NULL,
    "checkpoint" BYTEA NOT NULL,
    "metadata_type" TEXT NOT NULL,
    "metadata" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_checkpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_checkpoint_write" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "namespace" TEXT NOT NULL DEFAULT '',
    "checkpoint_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "task_path" TEXT NOT NULL DEFAULT '',
    "idx" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "value_type" TEXT NOT NULL,
    "value" BYTEA NOT NULL,

    CONSTRAINT "agent_checkpoint_write_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tool_call" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "step" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "args" JSONB NOT NULL,
    "status" "ToolCallStatus" NOT NULL,
    "result_summary" TEXT,
    "error" TEXT,
    "duration_ms" INTEGER NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tool_call_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_action" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "tool_name" TEXT NOT NULL,
    "proposal" JSONB NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "changes" JSONB NOT NULL DEFAULT '[]',
    "credits" INTEGER NOT NULL DEFAULT 0,
    "status" "PendingActionStatus" NOT NULL DEFAULT 'pending',
    "decided_by_user_id" UUID,
    "decided_at" TIMESTAMP(3),
    "note" TEXT,
    "result" JSONB,
    "undo" JSONB,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_action_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversation_workspace_id_user_id_last_activity_at_idx" ON "conversation"("workspace_id", "user_id", "last_activity_at");

-- CreateIndex
CREATE INDEX "conversation_last_activity_at_idx" ON "conversation"("last_activity_at");

-- CreateIndex
CREATE INDEX "message_conversation_id_created_at_idx" ON "message"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "message_workspace_id_idx" ON "message"("workspace_id");

-- CreateIndex
CREATE INDEX "agent_run_workspace_id_status_idx" ON "agent_run"("workspace_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "agent_run_conversation_id_idempotency_key_key" ON "agent_run"("conversation_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "agent_checkpoint_workspace_id_idx" ON "agent_checkpoint"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_checkpoint_run_id_namespace_checkpoint_id_key" ON "agent_checkpoint"("run_id", "namespace", "checkpoint_id");

-- CreateIndex
CREATE INDEX "agent_checkpoint_write_workspace_id_idx" ON "agent_checkpoint_write"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_checkpoint_write_run_id_namespace_checkpoint_id_task__key" ON "agent_checkpoint_write"("run_id", "namespace", "checkpoint_id", "task_id", "idx");

-- CreateIndex
CREATE UNIQUE INDEX "tool_call_idempotency_key_key" ON "tool_call"("idempotency_key");

-- CreateIndex
CREATE INDEX "tool_call_run_id_step_idx" ON "tool_call"("run_id", "step");

-- CreateIndex
CREATE INDEX "tool_call_workspace_id_idx" ON "tool_call"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "pending_action_idempotency_key_key" ON "pending_action"("idempotency_key");

-- CreateIndex
CREATE INDEX "pending_action_run_id_idx" ON "pending_action"("run_id");

-- CreateIndex
CREATE INDEX "pending_action_workspace_id_status_idx" ON "pending_action"("workspace_id", "status");

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_brand_id_workspace_id_fkey" FOREIGN KEY ("brand_id", "workspace_id") REFERENCES "brand"("id", "workspace_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_run" ADD CONSTRAINT "agent_run_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_checkpoint" ADD CONSTRAINT "agent_checkpoint_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "agent_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_checkpoint_write" ADD CONSTRAINT "agent_checkpoint_write_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "agent_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_call" ADD CONSTRAINT "tool_call_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "agent_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_action" ADD CONSTRAINT "pending_action_brand_id_workspace_id_fkey" FOREIGN KEY ("brand_id", "workspace_id") REFERENCES "brand"("id", "workspace_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_action" ADD CONSTRAINT "pending_action_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "agent_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Hand-written: messages are append-only, so the runtime role may not change or delete them.
-- Rows still go when their conversation is deleted (cascade runs as the table owner).
REVOKE UPDATE, DELETE ON "message" FROM app_runtime;

-- Hand-written: row-level security, same policy as every tenant table (see onboarding_foundation).
DO $$
DECLARE
  tenant_table text;
BEGIN
  FOREACH tenant_table IN ARRAY ARRAY[
    'conversation', 'message', 'agent_run', 'agent_checkpoint',
    'agent_checkpoint_write', 'tool_call', 'pending_action'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (workspace_id = nullif(current_setting(''app.workspace_id'', true), '''')::uuid) WITH CHECK (workspace_id = nullif(current_setting(''app.workspace_id'', true), '''')::uuid)',
      tenant_table
    );
  END LOOP;
END $$;
