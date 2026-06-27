import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3', 'pdf-lib', 'ws', 'serialport'],
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*', '172.16.*.*', '127.0.0.1'],
};

export default nextConfig;
