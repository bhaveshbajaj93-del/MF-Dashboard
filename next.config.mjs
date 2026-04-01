

const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.amfiindia.com" },
      { protocol: "https", hostname: "*.valueresearchonline.com" },
    ],
  },
};

export default nextConfig;
