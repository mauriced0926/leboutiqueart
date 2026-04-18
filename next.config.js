/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.shopify.com' },
      { protocol: 'https', hostname: 'www.maicoldiaz.com' },
      { protocol: 'https', hostname: 'maicoldiaz.com' },
    ],
  },
}

module.exports = nextConfig
