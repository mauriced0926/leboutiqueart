import type { ShopifyProduct, ShopifyCart, Product, Cart, CartItem } from './types'

const domain = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN!
const storefrontToken = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN!

const endpoint = `https://${domain}/api/2024-01/graphql.json`

async function shopifyFetch<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': storefrontToken,
    },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 60 },
  })

  if (!res.ok) {
    throw new Error(`Shopify fetch error: ${res.status} ${res.statusText}`)
  }

  const json = await res.json()

  if (json.errors) {
    throw new Error(json.errors[0]?.message ?? 'Shopify GraphQL error')
  }

  return json.data as T
}

// ─── Fragments ────────────────────────────────────────────────────────────────

const PRODUCT_FRAGMENT = `
  fragment ProductFields on Product {
    id
    title
    handle
    description
    descriptionHtml
    tags
    priceRange {
      minVariantPrice { amount currencyCode }
      maxVariantPrice { amount currencyCode }
    }
    images(first: 10) {
      edges { node { url altText width height } }
    }
    options { name values }
    variants(first: 50) {
      edges {
        node {
          id
          title
          availableForSale
          price { amount currencyCode }
          compareAtPrice { amount currencyCode }
          selectedOptions { name value }
        }
      }
    }
    seo { title description }
  }
`

const CART_FRAGMENT = `
  fragment CartFields on Cart {
    id
    checkoutUrl
    totalQuantity
    cost {
      subtotalAmount { amount currencyCode }
      totalAmount { amount currencyCode }
      totalTaxAmount { amount currencyCode }
    }
    lines(first: 100) {
      edges {
        node {
          id
          quantity
          cost { totalAmount { amount currencyCode } }
          merchandise {
            ... on ProductVariant {
              id
              title
              selectedOptions { name value }
              product {
                id
                handle
                title
                images(first: 1) { edges { node { url altText } } }
              }
            }
          }
        }
      }
    }
  }
`

// ─── Normalizers ──────────────────────────────────────────────────────────────

function normalizeProduct(p: ShopifyProduct): Product {
  const images = p.images.edges.map((e) => e.node)
  return {
    id: p.id,
    title: p.title,
    handle: p.handle,
    description: p.description,
    descriptionHtml: p.descriptionHtml,
    price: p.priceRange.minVariantPrice.amount,
    currencyCode: p.priceRange.minVariantPrice.currencyCode,
    featuredImage: images[0] ?? null,
    images,
    variants: p.variants.edges.map((e) => e.node),
    options: p.options,
    tags: p.tags,
  }
}

function normalizeCart(c: ShopifyCart): Cart {
  const items: CartItem[] = c.lines.edges.map(({ node }) => ({
    id: node.merchandise.id,
    lineId: node.id,
    quantity: node.quantity,
    title: node.merchandise.product.title,
    variantTitle: node.merchandise.title,
    price: node.cost.totalAmount.amount,
    currencyCode: node.cost.totalAmount.currencyCode,
    image: node.merchandise.product.images.edges[0]?.node ?? null,
    handle: node.merchandise.product.handle,
  }))

  return {
    id: c.id,
    checkoutUrl: c.checkoutUrl,
    totalQuantity: c.totalQuantity,
    subtotal: c.cost.subtotalAmount.amount,
    total: c.cost.totalAmount.amount,
    currencyCode: c.cost.subtotalAmount.currencyCode,
    items,
  }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getProducts(): Promise<Product[]> {
  const data = await shopifyFetch<{ products: { edges: { node: ShopifyProduct }[] } }>(`
    ${PRODUCT_FRAGMENT}
    query GetProducts {
      products(first: 50, sortKey: CREATED_AT, reverse: true) {
        edges { node { ...ProductFields } }
      }
    }
  `)
  return data.products.edges.map((e) => normalizeProduct(e.node))
}

export async function getProduct(handle: string): Promise<Product | null> {
  const data = await shopifyFetch<{ productByHandle: ShopifyProduct | null }>(`
    ${PRODUCT_FRAGMENT}
    query GetProduct($handle: String!) {
      productByHandle(handle: $handle) { ...ProductFields }
    }
  `, { handle })
  return data.productByHandle ? normalizeProduct(data.productByHandle) : null
}

// ─── Cart Mutations ────────────────────────────────────────────────────────────

export async function createCart(): Promise<Cart> {
  const data = await shopifyFetch<{ cartCreate: { cart: ShopifyCart } }>(`
    ${CART_FRAGMENT}
    mutation CartCreate {
      cartCreate { cart { ...CartFields } }
    }
  `)
  return normalizeCart(data.cartCreate.cart)
}

export async function addToCart(cartId: string, merchandiseId: string, quantity: number): Promise<Cart> {
  const data = await shopifyFetch<{ cartLinesAdd: { cart: ShopifyCart } }>(`
    ${CART_FRAGMENT}
    mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
      cartLinesAdd(cartId: $cartId, lines: $lines) { cart { ...CartFields } }
    }
  `, { cartId, lines: [{ merchandiseId, quantity }] })
  return normalizeCart(data.cartLinesAdd.cart)
}

export async function updateCartItem(cartId: string, lineId: string, quantity: number): Promise<Cart> {
  const data = await shopifyFetch<{ cartLinesUpdate: { cart: ShopifyCart } }>(`
    ${CART_FRAGMENT}
    mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
      cartLinesUpdate(cartId: $cartId, lines: $lines) { cart { ...CartFields } }
    }
  `, { cartId, lines: [{ id: lineId, quantity }] })
  return normalizeCart(data.cartLinesUpdate.cart)
}

export async function removeFromCart(cartId: string, lineIds: string[]): Promise<Cart> {
  const data = await shopifyFetch<{ cartLinesRemove: { cart: ShopifyCart } }>(`
    ${CART_FRAGMENT}
    mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
      cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { cart { ...CartFields } }
    }
  `, { cartId, lineIds })
  return normalizeCart(data.cartLinesRemove.cart)
}

export async function getCart(cartId: string): Promise<Cart | null> {
  const data = await shopifyFetch<{ cart: ShopifyCart | null }>(`
    ${CART_FRAGMENT}
    query GetCart($cartId: ID!) {
      cart(id: $cartId) { ...CartFields }
    }
  `, { cartId })
  return data.cart ? normalizeCart(data.cart) : null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatPrice(amount: string, currencyCode: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(parseFloat(amount))
}
