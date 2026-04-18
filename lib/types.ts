export interface ShopifyImage {
  url: string
  altText: string | null
  width?: number
  height?: number
}

export interface ShopifyMoneyV2 {
  amount: string
  currencyCode: string
}

export interface ShopifyProductVariant {
  id: string
  title: string
  availableForSale: boolean
  price: ShopifyMoneyV2
  compareAtPrice: ShopifyMoneyV2 | null
  selectedOptions: { name: string; value: string }[]
}

export interface ShopifyProduct {
  id: string
  title: string
  handle: string
  description: string
  descriptionHtml: string
  priceRange: {
    minVariantPrice: ShopifyMoneyV2
    maxVariantPrice: ShopifyMoneyV2
  }
  images: { edges: { node: ShopifyImage }[] }
  variants: { edges: { node: ShopifyProductVariant }[] }
  options: { name: string; values: string[] }[]
  tags: string[]
  seo: { title: string; description: string }
}

export interface ShopifyCart {
  id: string
  checkoutUrl: string
  totalQuantity: number
  cost: {
    subtotalAmount: ShopifyMoneyV2
    totalAmount: ShopifyMoneyV2
    totalTaxAmount: ShopifyMoneyV2 | null
  }
  lines: {
    edges: {
      node: ShopifyCartLine
    }[]
  }
}

export interface ShopifyCartLine {
  id: string
  quantity: number
  cost: {
    totalAmount: ShopifyMoneyV2
  }
  merchandise: {
    id: string
    title: string
    selectedOptions: { name: string; value: string }[]
    product: {
      id: string
      handle: string
      title: string
      images: { edges: { node: ShopifyImage }[] }
    }
  }
}

// Normalized types for the frontend
export interface Product {
  id: string
  title: string
  handle: string
  description: string
  descriptionHtml: string
  price: string
  compareAtPrice?: string
  currencyCode: string
  featuredImage: ShopifyImage | null
  images: ShopifyImage[]
  variants: ShopifyProductVariant[]
  options: { name: string; values: string[] }[]
  tags: string[]
}

export interface CartItem {
  id: string
  lineId: string
  quantity: number
  title: string
  variantTitle: string
  price: string
  currencyCode: string
  image: ShopifyImage | null
  handle: string
}

export interface Cart {
  id: string
  checkoutUrl: string
  totalQuantity: number
  subtotal: string
  total: string
  currencyCode: string
  items: CartItem[]
}
