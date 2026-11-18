'use client';

import { Fragment, useState } from 'react';
import type { ProductItem, ServiceItem } from '@marketpilot/contracts';
import { Alert, Badge, Button, Skeleton } from '@marketpilot/ui';
import { formatRupees } from '@/features/fields/field-draft';
import { useProducts, useServices, useUpdateProfile } from './profile-api';
import { AVAILABILITY, ProductEditor } from './product-editor';
import { ServiceEditor } from './service-editor';

const VISIBLE_AT_FIRST = 8;

interface RowProps {
  name: string;
  details: (string | null)[];
  source: 'website' | 'owner';
  featured: boolean;
  canEdit: boolean;
  removing: boolean;
  onEdit: () => void;
  onRemove: () => void;
}

function OfferingRow({ name, details, source, featured, canEdit, removing, onEdit, onRemove }: RowProps) {
  const [confirming, setConfirming] = useState(false);
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-surface px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-label text-ink">{name}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-ink-secondary">
          {details.filter(Boolean).map((detail) => (
            <span key={detail}>{detail}</span>
          ))}
          {featured ? <Badge tone="success">Most popular</Badge> : null}
          <Badge tone={source === 'website' ? 'info' : 'success'}>
            {source === 'website' ? 'From your website' : 'Added by you'}
          </Badge>
        </p>
      </div>
      {canEdit ? (
        confirming ? (
          <div className="flex items-center gap-2" role="group" aria-label={`Remove ${name}?`}>
            <span className="text-caption text-ink-secondary">Remove this?</span>
            <Button variant="danger" size="sm" loading={removing} onClick={onRemove}>
              Remove
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Keep
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onEdit} aria-label={`Edit ${name}`}>
              Edit
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(true)} aria-label={`Remove ${name}`}>
              Remove
            </Button>
          </div>
        )
      ) : null}
    </li>
  );
}

interface ListState<T> {
  items: T[];
  pending: boolean;
  failed: boolean;
  retry: () => void;
}

interface OfferingListProps<T extends { id: string }> {
  id: string;
  title: string;
  noun: string;
  empty: string;
  state: ListState<T>;
  canEdit: boolean;
  row: (item: T, removing: boolean, edit: () => void, remove: () => void) => React.ReactNode;
  editor: (item: T | null, done: () => void) => React.ReactNode;
  removing: string | null;
  remove: (id: string) => void;
}

function OfferingList<T extends { id: string }>(props: OfferingListProps<T>) {
  const { id, title, noun, empty, state, canEdit, row, editor, removing, remove } = props;
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? state.items : state.items.slice(0, VISIBLE_AT_FIRST);
  const done = () => setEditing(null);

  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 id={`${id}-heading`} className="text-heading">
          {title}
          {state.items.length > 0 ? ` (${state.items.length})` : ''}
        </h3>
        {canEdit && editing !== 'new' ? (
          <Button variant="secondary" size="sm" onClick={() => setEditing('new')}>
            Add {noun}
          </Button>
        ) : null}
      </div>
      {editing === 'new' ? editor(null, done) : null}
      {state.pending ? (
        <div className="flex flex-col gap-2" role="status" aria-live="polite">
          <span className="sr-only">Loading</span>
          <Skeleton className="h-control w-full" />
          <Skeleton className="h-control w-full" />
        </div>
      ) : state.failed ? (
        <Alert tone="danger">
          We could not load this list.{' '}
          <button type="button" className="underline underline-offset-2" onClick={state.retry}>
            Try again
          </button>
        </Alert>
      ) : state.items.length === 0 ? (
        editing === 'new' ? null : <p className="text-body text-ink-secondary">{empty}</p>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {visible.map((item) =>
              editing === item.id ? (
                <li key={item.id}>{editor(item, done)}</li>
              ) : (
                <Fragment key={item.id}>
                  {row(item, removing === item.id, () => setEditing(item.id), () => remove(item.id))}
                </Fragment>
              ),
            )}
          </ul>
          {state.items.length > VISIBLE_AT_FIRST ? (
            <Button variant="ghost" className="self-start" onClick={() => setShowAll((v) => !v)}>
              {showAll ? 'Show fewer' : `Show all ${state.items.length}`}
            </Button>
          ) : null}
        </>
      )}
    </section>
  );
}

export function Catalogue({ canEdit }: { canEdit: boolean }) {
  const products = useProducts(true);
  const services = useServices(true);
  const update = useUpdateProfile();
  const [removing, setRemoving] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState(false);

  function remove(kind: 'products' | 'services', id: string) {
    setRemoving(id);
    setRemoveError(false);
    update.mutate(
      { [kind]: [{ id, remove: true }] },
      { onSettled: () => setRemoving(null), onError: () => setRemoveError(true) },
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {removeError ? <Alert tone="danger">We could not remove that. Try again.</Alert> : null}
      <OfferingList<ProductItem>
        id="products"
        title="Your products"
        noun="product"
        empty="No products yet. Add them here, or read your website from the top of this page and approve what we find."
        state={{
          items: products.data?.products ?? [],
          pending: products.isPending,
          failed: products.isError,
          retry: () => void products.refetch(),
        }}
        canEdit={canEdit}
        removing={removing}
        remove={(id) => remove('products', id)}
        editor={(item, done) => <ProductEditor product={item} onDone={done} />}
        row={(item, isRemoving, edit, onRemove) => (
          <OfferingRow
            name={item.name}
            details={[
              item.priceMinor !== null ? formatRupees(item.priceMinor / 100) : 'No price',
              AVAILABILITY[item.availability],
              item.category,
            ]}
            source={item.source}
            featured={item.featured}
            canEdit={canEdit}
            removing={isRemoving}
            onEdit={edit}
            onRemove={onRemove}
          />
        )}
      />
      <OfferingList<ServiceItem>
        id="services"
        title="Your services"
        noun="service"
        empty="No services yet. If you sell services, such as appointments or consultations, add them here."
        state={{
          items: services.data?.services ?? [],
          pending: services.isPending,
          failed: services.isError,
          retry: () => void services.refetch(),
        }}
        canEdit={canEdit}
        removing={removing}
        remove={(id) => remove('services', id)}
        editor={(item, done) => <ServiceEditor service={item} onDone={done} />}
        row={(item, isRemoving, edit, onRemove) => (
          <OfferingRow
            name={item.name}
            details={[
              item.priceMinor !== null ? formatRupees(item.priceMinor / 100) : 'No price',
              item.durationMinutes ? `${item.durationMinutes} min` : null,
            ]}
            source={item.source}
            featured={item.featured}
            canEdit={canEdit}
            removing={isRemoving}
            onEdit={edit}
            onRemove={onRemove}
          />
        )}
      />
    </div>
  );
}
