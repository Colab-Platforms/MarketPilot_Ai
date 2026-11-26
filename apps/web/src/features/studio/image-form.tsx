'use client';

import { useId, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import {
  BRIEF_MAX_CHARS,
  BRIEF_MIN_CHARS,
  BUTTON_TEXT_MAX_CHARS,
  HEADLINE_MAX_CHARS,
  IMAGE_DESIGNS,
  IMAGE_FORMATS,
  MAX_IMAGE_VARIANTS,
  SUBHEADING_MAX_CHARS,
  type CreateImageGenerationInput,
  type ImageDesign,
  type ImageFormat,
  type ImageGenerationList,
  type ProductItem,
} from '@marketpilot/contracts';
import { Alert, Button, Field, FieldGroup, Input, SegmentedControl, Select, Switch, Textarea } from '@marketpilot/ui';

const FORMAT_OPTIONS = IMAGE_FORMATS.map((f) => ({ value: f.value, label: f.label }));
const DESIGN_OPTIONS = IMAGE_DESIGNS.map((d) => ({ value: d.value, label: d.label }));
const VARIANT_OPTIONS = Array.from({ length: MAX_IMAGE_VARIANTS }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));
const NO_PRODUCT = '';

interface ImageFormProps {
  products: ProductItem[];
  defaults: ImageGenerationList['defaults'];
  submitting: boolean;
  error: string | null;
  fieldErrors: Record<string, string>;
  onSubmit: (body: CreateImageGenerationInput) => void;
}

export function ImageForm({ products, defaults, submitting, error, fieldErrors, onSubmit }: ImageFormProps) {
  const logoLabelId = useId();
  const [brief, setBrief] = useState('');
  const [format, setFormat] = useState<ImageFormat>('square');
  const [design, setDesign] = useState<ImageDesign>(defaults.design);
  const [productId, setProductId] = useState(NO_PRODUCT);
  const [headline, setHeadline] = useState('');
  const [subheading, setSubheading] = useState('');
  const [buttonText, setButtonText] = useState('');
  const [showLogo, setShowLogo] = useState(defaults.design !== 'photo');
  const [variants, setVariants] = useState('2');
  const [briefTouched, setBriefTouched] = useState(false);

  const briefLength = brief.trim().length;
  const briefProblem =
    briefLength < BRIEF_MIN_CHARS ? `Describe the image in at least ${BRIEF_MIN_CHARS} characters` : undefined;
  const product = products.find((p) => p.id === productId);
  const formatUse = IMAGE_FORMATS.find((f) => f.value === format)?.use;
  const designHint = IMAGE_DESIGNS.find((d) => d.value === design)?.hint;

  function chooseDesign(next: ImageDesign) {
    setDesign(next);
    setShowLogo(next !== 'photo');
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setBriefTouched(true);
    if (briefProblem) return;
    onSubmit({
      brief: brief.trim(),
      format,
      design,
      productId: productId || null,
      headline: headline.trim() || null,
      subheading: design !== 'photo' ? subheading.trim() || null : null,
      buttonText: design === 'designed' ? buttonText.trim() || null : null,
      showLogo: defaults.hasLogo && showLogo,
      variants: Number(variants),
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Field
        label="What should the image show?"
        helper={`For example: our kaju katli on a festive table with diyas, for a Diwali offer. ${briefLength}/${BRIEF_MAX_CHARS}`}
        error={(briefTouched ? briefProblem : undefined) ?? fieldErrors.brief}
      >
        <Textarea
          value={brief}
          maxLength={BRIEF_MAX_CHARS}
          rows={8}
          onChange={(e) => setBrief(e.target.value)}
          onBlur={() => setBriefTouched(true)}
        />
      </Field>

      {products.length > 0 ? (
        <Field
          label="Feature a product"
          optional
          helper={
            product && product.imageUrls.length === 0
              ? 'This product has no photos yet, so the image will only be inspired by its name. Add photos in your brand profile for an exact match.'
              : 'We use its photos so the image shows your real product.'
          }
          error={fieldErrors.productId}
        >
          <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value={NO_PRODUCT}>No specific product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <FieldGroup legend="Design" helper={designHint}>
        <SegmentedControl label="Design" options={DESIGN_OPTIONS} value={design} onChange={chooseDesign} />
      </FieldGroup>

      <FieldGroup legend="Format" helper={formatUse}>
        <SegmentedControl label="Format" options={FORMAT_OPTIONS} value={format} onChange={setFormat} />
      </FieldGroup>

      <Field
        label="Headline"
        optional
        helper={
          design === 'designed'
            ? 'Printed exactly as you type it, in any language. Leave empty and we write a short one.'
            : 'Printed exactly as you type it, in any language. Leave empty for an image without text.'
        }
        error={fieldErrors.headline}
      >
        <Input value={headline} maxLength={HEADLINE_MAX_CHARS} onChange={(e) => setHeadline(e.target.value)} />
      </Field>

      {design !== 'photo' ? (
        <Field label="Subheading" optional helper="A shorter line under the headline." error={fieldErrors.subheading}>
          <Input value={subheading} maxLength={SUBHEADING_MAX_CHARS} onChange={(e) => setSubheading(e.target.value)} />
        </Field>
      ) : null}

      {design === 'designed' ? (
        <Field label="Button text" optional helper="For example: Shop now, Order today." error={fieldErrors.buttonText}>
          <Input value={buttonText} maxLength={BUTTON_TEXT_MAX_CHARS} onChange={(e) => setButtonText(e.target.value)} />
        </Field>
      ) : null}

      {defaults.hasLogo ? (
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <span id={logoLabelId} className="text-label text-ink">
              Show your logo
            </span>
            <span className="text-caption text-ink-secondary">Copied from your brand profile. Check it on the result.</span>
          </div>
          <Switch aria-labelledby={logoLabelId} checked={showLogo} onCheckedChange={setShowLogo} />
        </div>
      ) : (
        <p className="text-caption text-ink-secondary">
          To put your logo on images,{' '}
          <Link href="/brand#brand" className="text-accent underline underline-offset-2">
            add it to your brand profile
          </Link>
          .
        </p>
      )}

      <FieldGroup legend="How many options" helper="Each option is a separate image to choose from.">
        <SegmentedControl label="How many options" options={VARIANT_OPTIONS} value={variants} onChange={setVariants} />
      </FieldGroup>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <Button type="submit" loading={submitting} className="self-start">
        <Sparkles className="size-4" strokeWidth={1.5} aria-hidden="true" />
        Generate images
      </Button>
    </form>
  );
}
