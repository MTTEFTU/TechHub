/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.shopify.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      {    protocol: 'https',
        hostname: 'www.mobiledokan.com', }
    ],
  },
};

module.exports = nextConfig;
