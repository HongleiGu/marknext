// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true, // Enable React's Strict Mode for development
  // swcMinify: true,       // Enable SWC minification for production builds
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'], // Specify the extensions Next.js should look for
};

export default nextConfig;