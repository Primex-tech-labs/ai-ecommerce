/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@repo/ui", "@repo/commerce-core", "@repo/ai-client", "@repo/stellar"],
};

export default nextConfig;
