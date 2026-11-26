'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Clapperboard } from 'lucide-react';
import type { CreateReelInput, ReelSummary } from '@marketpilot/contracts';
import { Alert, Card, Skeleton } from '@marketpilot/ui';
import { PageHeader } from '@/components/page-header';
import { ApiError } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { useProducts } from '@/features/profile/profile-api';
import { CreateTabs } from '@/features/studio/create-tabs';
import { ReelBriefForm } from './reel-brief-form';
import { ReelStatusChip } from './reel-status-chip';
import { useCreateReel, useReels } from './reel-api';

const PLAN_ROLES = new Set(['owner', 'admin', 'manager', 'creator']);

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-3" role="status" aria-live="polite">
      <span className="sr-only">Loading your reels</span>
      <Skeleton className="h-control-lg w-full" />
      <Skeleton className="h-control-lg w-full" />
    </div>
  );
}

function ReelRow({ reel }: { reel: ReelSummary }) {
  return (
    <li>
      <Link
        href={`/create/reels/${reel.id}`}
        className="flex items-center gap-3 rounded-md border border-line bg-surface px-4 py-3 transition-colors duration-fast ease-standard hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-label text-ink">
            {reel.title ?? `Reel for ${reel.productName}`}
          </span>
          <span className="truncate text-caption text-ink-secondary">
            {reel.productName}
            {reel.sceneCount > 0 ? ` · ${reel.sceneCount} scenes` : ''}
          </span>
        </div>
        <ReelStatusChip status={reel.status} />
        <ChevronRight
          className="size-4 shrink-0 text-ink-tertiary"
          strokeWidth={1.5}
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}

export function ReelsPage() {
  const router = useRouter();
  const role = useAuthStore((state) => state.context?.role);
  const canPlan = role ? PLAN_ROLES.has(role) : false;
  const reels = useReels();
  const products = useProducts(canPlan);
  const create = useCreateReel();

  const submit = (body: CreateReelInput) =>
    create.mutate(
      { body, idempotencyKey: crypto.randomUUID() },
      { onSuccess: (reel) => router.push(`/create/reels/${reel.id}`) },
    );
  const error = create.error instanceof ApiError ? create.error : null;
  const productList = products.data?.products ?? [];

  function formArea() {
    if (!canPlan)
      return (
        <Alert tone="info">
          Your role can view reels but not plan them. Ask an owner or manager.
        </Alert>
      );
    if (reels.data && !reels.data.available)
      return <Alert tone="info">Reel planning is not set up for this workspace yet.</Alert>;
    if (!reels.data || products.isPending) {
      return (
        <div className="flex flex-col gap-4" role="status" aria-live="polite">
          <span className="sr-only">Loading the form</span>
          <Skeleton className="h-control w-full" />
          <Skeleton className="h-tile w-full" />
        </div>
      );
    }
    if (productList.length === 0) {
      return (
        <Alert tone="info">
          Reels are built around a product.{' '}
          <Link href="/brand#products" className="underline underline-offset-2">
            Add a product to your brand profile
          </Link>{' '}
          first.
        </Alert>
      );
    }
    return (
      <ReelBriefForm
        products={productList}
        defaults={reels.data.defaults}
        submitting={create.isPending}
        error={
          create.isError
            ? (error?.message ?? 'We could not start planning your reel. Try again.')
            : null
        }
        fieldErrors={error?.fields ?? {}}
        onSubmit={submit}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-page flex-col">
      <PageHeader
        title="Create"
        description="Plan a product reel: pick an idea, then shape the storyboard scene by scene."
        actions={<CreateTabs />}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section aria-labelledby="new-reel" className="lg:col-span-5">
          <Card className="flex flex-col gap-4">
            <h2 id="new-reel" className="text-heading">
              New reel
            </h2>
            {formArea()}
          </Card>
        </section>

        <section aria-labelledby="your-reels" className="flex flex-col gap-4 lg:col-span-7">
          <h2 id="your-reels" className="text-heading">
            Your reels
          </h2>
          {reels.isPending ? (
            <ListSkeleton />
          ) : reels.isError ? (
            <Alert tone="danger">
              We could not load your reels.{' '}
              <button
                type="button"
                className="underline underline-offset-2"
                onClick={() => void reels.refetch()}
              >
                Try again
              </button>
            </Alert>
          ) : reels.data.reels.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-line px-4 py-12 text-center">
              <Clapperboard
                className="size-5 text-ink-tertiary"
                strokeWidth={1.5}
                aria-hidden="true"
              />
              <p className="text-body text-ink-secondary">
                Reels you plan appear here, with their ideas and storyboards.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {reels.data.reels.map((reel) => (
                <ReelRow key={reel.id} reel={reel} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
