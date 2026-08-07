import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: 'http://localhost:8000/api/:path*' // Proxy to Python backend
      }
    ]
  },
  // @ts-ignore
  allowedDevOrigins: ['192.168.1.6', 'localhost', '127.0.0.1']
};

export default nextConfig;
