/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  pageExtensions: ['page.tsx', 'page.ts', 'page.jsx', 'page.js'],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
