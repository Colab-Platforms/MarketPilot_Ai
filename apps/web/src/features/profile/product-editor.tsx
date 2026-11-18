'use client';

import { useState, type FormEvent } from 'react';
import { MAX_PRODUCT_IMAGES, type ProductItem } from '@marketpilot/contracts';
import { Alert, Button, Checkbox, Field, Input, Select, Textarea } from '@marketpilot/ui';
import { ImageListInput } from '@/features/media/image-list-input';
import { saveErrors } from './save-errors';
import { useUpdateProfile } from './profile-api';

export const AVAILABILITY: Record<ProductItem['availability'], string> = {
  in_stock: 'In stock',
  out_of_stock: 'Out of stock',
  preorder: 'Pre-order',
  unknown: 'Availability not set',
};

// Adds a product (when none is given) or edits one. Both save through the single profile update.
export function ProductEditor({ product, onDone }: { product: ProductItem | null; onDone: () => void }) {
  const update = useUpdateProfile();
  const [values, setValues] = useState({
    name: product?.name ?? '',
    description: product?.description ?? '',
    category: product?.category ?? '',
    price: product?.priceMinor == null ? '' : String(product.priceMinor / 100),
    availability: product?.availability ?? 'in_stock',
    url: product?.url ?? '',
    featured: product?.featured ?? false,
  });
  const [imageUrls, setImageUrls] = useState<string[]>(product?.imageUrls ?? []);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const imagesChanged = imageUrls.join('\n') !== (product?.imageUrls ?? []).join('\n');
  const set =(key: keyof typeof values) => (value: string | boolean) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors(({ [key]: _cleared, ...rest }) => rest);
  };

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (uploading) return;
    const price = values.price.trim() === '' ? null : Number(values.price.replace(/,/g, ''));
    const found: Record<string, string> = {};
    if (!values.name.trim()) found.name = 'Enter a name';
    if (price !== null && (!Number.isFinite(price) || price < 0)) found.price = 'Enter a price, like 1499';
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    update.mutate(
      {
        products: [
          {
            ...(product && { id: product.id }),
            name: values.name.trim(),
            description: values.description.trim() || null,
            category: values.category.trim() || null,
            price,
            availability: values.availability,
            url: values.url.trim() || null,
            ...(imagesChanged && { imageUrls }),
            featured: values.featured,
          },
        ],
      },
      { onSuccess: onDone, onError: (error) => setErrors(saveErrors(error, 'products.0')) },
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 rounded-md border border-line bg-subtle p-4">
      {errors.form ? <Alert tone="danger">{errors.form}</Alert> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name" error={errors.name}>
          <Input value={values.name} onChange={(e) => set('name')(e.target.value)} maxLength={200} />
        </Field>
        <Field label="Category" error={errors.category}>
          <Input value={values.category} onChange={(e) => set('category')(e.target.value)} maxLength={120} />
        </Field>
        <Field label="Price (rupees)" error={errors.price}>
          <Input value={values.price} onChange={(e) => set('price')(e.target.value)} inputMode="decimal" />
        </Field>
        <Field label="Availability" error={errors.availability}>
          <Select value={values.availability} onChange={(e) => set('availability')(e.target.value)}>
            {Object.entries(AVAILABILITY).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Link to the product" error={errors.url} className="md:col-span-2">
          <Input value={values.url} onChange={(e) => set('url')(e.target.value)} inputMode="url" />
        </Field>
        <Field label="Description" error={errors.description} className="md:col-span-2">
          <Textarea rows={3} value={values.description} onChange={(e) => set('description')(e.target.value)} />
        </Field>
      </div>
      <ImageListInput
        label="Images"
        purpose="product_image"
        max={MAX_PRODUCT_IMAGES}
        firstLabel="Main"
        urls={imageUrls}
        onChange={(update) => {
          setImageUrls(update);
          setErrors(({ imageUrls: _cleared, ...rest }) => rest);
        }}
        onUploadingChange={setUploading}
        error={errors.imageUrls}
      />
      <label className="flex min-h-touch items-center gap-3 text-body text-ink">
        <Checkbox checked={values.featured} onChange={(e) => set('featured')(e.target.checked)} />
        One of our most popular products
      </label>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone} disabled={update.isPending}>
          Cancel
        </Button>
        <Button type="submit" loading={update.isPending} disabled={uploading}>
          {uploading ? 'Uploading images' : product ? 'Save product' : 'Add product'}
        </Button>
      </div>
    </form>
  );
}
