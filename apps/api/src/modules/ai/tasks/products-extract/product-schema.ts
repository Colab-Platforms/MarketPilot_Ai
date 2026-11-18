export const PRODUCT_SCHEMA_NAME = 'website_products';

// No union types: "nothing" is an empty string, as in the profile answer format.
export const PRODUCT_ANSWER_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    products: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'The product name exactly as written on the page.' },
          description: { type: 'string', description: 'One sentence from the page about the product, or empty.' },
          category: { type: 'string', description: 'The category as written on the page, or empty.' },
          price: { type: 'string', description: 'Digits only, such as 499, and only if the page states a price for it. Otherwise empty.' },
          image: { type: 'string', description: 'One image address from the Images list that shows this product, or empty.' },
          evidence: { type: 'string', description: 'A short verbatim quote from the pages that contains the product name.' },
        },
        required: ['name', 'description', 'category', 'price', 'image', 'evidence'],
        additionalProperties: false,
      },
    },
  },
  required: ['products'],
  additionalProperties: false,
};
