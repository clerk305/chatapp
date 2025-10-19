/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['res.cloudinary.com'],
  },
  // Disable Turbopack for now to avoid font loading issues
  experimental: {
    turbo: false,
  },
};

export default nextConfig;
