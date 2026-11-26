'use client';

import { useState } from 'react';
import { ImageIcon } from 'lucide-react';
import type { CreateImageGenerationInput, ImageGeneration } from '@marketpilot/contracts';
import { Alert, Card, Skeleton } from '@marketpilot/ui';
import { PageHeader } from '@/components/page-header';
import { ApiError } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { useProducts } from '@/features/profile/profile-api';
import { CreateTabs } from './create-tabs';
import { GenerationCard } from './generation-card';
import { ImageForm } from './image-form';
import { useCreateImageGeneration, useImageGenerations } from './studio-api';

const GENERATE_ROLES = new Set(['owner', 'admin', 'manager', 'creator']);

function ResultsSkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-live="polite">
      <span className="sr-only">Loading your images</span>
      <Skeleton className="h-tile w-full" />
      <Skeleton className="h-tile w-full" />
    </div>
  );
}

function EmptyResults() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-line px-4 py-12 text-center">
      <ImageIcon className="size-5 text-ink-tertiary" strokeWidth={1.5} aria-hidden="true" />
      <p className="text-body text-ink-secondary">Images you create appear here, ready to open and download.</p>
    </div>
  );
}

const retryInput = (g: ImageGeneration): CreateImageGenerationInput => ({
  brief: g.brief,
  format: g.format,
  productId: g.productId,
  headline: g.headline,
  subheading: g.subheading,
  buttonText: g.buttonText,
  design: g.design,
  showLogo: g.showLogo,
  variants: g.variants,
});

export function CreatePage() {
  const role = useAuthStore((state) => state.context?.role);
  const canGenerate = role ? GENERATE_ROLES.has(role) : false;
  const generations = useImageGenerations();
  const products = useProducts(canGenerate);
  const create = useCreateImageGeneration();

  const [retryingId, setRetryingId] = useState<string | null>(null);

  const submit = (body: CreateImageGenerationInput, retryOf: string | null = null) => {
    setRetryingId(retryOf);
    create.mutate({ body, idempotencyKey: crypto.randomUUID() });
  };
  const error = create.error instanceof ApiError ? create.error : null;
  const available = generations.data?.available ?? true;
  const defaults = generations.data?.defaults;

  return (
    <div className="mx-auto flex w-full max-w-page flex-col">
      <PageHeader
        title="Create"
        description="Make post images in your brand style from a short description."
        actions={<CreateTabs />}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section aria-labelledby="new-image" className="lg:col-span-5">
          <Card className="flex flex-col gap-4">
            <h2 id="new-image" className="text-heading">
              New image
            </h2>
            {!canGenerate ? (
              <Alert tone="info">Your role can view images but not create them. Ask an owner or manager.</Alert>
            ) : !available ? (
              <Alert tone="info">Image creation is not set up for this workspace yet.</Alert>
            ) : !defaults ? (
              <div className="flex flex-col gap-4" role="status" aria-live="polite">
                <span className="sr-only">Loading the form</span>
                <Skeleton className="h-tile w-full" />
                <Skeleton className="h-control w-full" />
              </div>
            ) : (
              <ImageForm
                defaults={defaults}
                products={products.data?.products ?? []}
                submitting={create.isPending}
                error={create.isError ? (error?.message ?? 'We could not start creating your image. Try again.') : null}
                fieldErrors={error?.fields ?? {}}
                onSubmit={(body) => submit(body)}
              />
            )}
          </Card>
        </section>

        <section aria-labelledby="your-images" className="flex flex-col gap-4 lg:col-span-7">
          <h2 id="your-images" className="text-heading">
            Your images
          </h2>
          {generations.isPending ? (
            <ResultsSkeleton />
          ) : generations.isError ? (
            <Alert tone="danger">
              We could not load your images.{' '}
              <button type="button" className="underline underline-offset-2" onClick={() => void generations.refetch()}>
                Try again
              </button>
            </Alert>
          ) : generations.data.generations.length === 0 ? (
            <EmptyResults />
          ) : (
            generations.data.generations.map((g) => (
              <GenerationCard
                key={g.id}
                generation={g}
                retrying={create.isPending && retryingId === g.id}
                onRetry={(failed) => submit(retryInput(failed), failed.id)}
              />
            ))
          )}
        </section>
      </div>
    </div>
  );
}
