import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

const localDevOrigins = Array.from(
  new Set([
    "127.0.0.1",
    "localhost",
    ...Object.values(networkInterfaces())
      .flat()
      .filter((address): address is NonNullable<typeof address> =>
        Boolean(address && address.family === "IPv4" && !address.internal),
      )
      .map((address) => address.address),
  ]),
);

const nextConfig: NextConfig = {
  allowedDevOrigins: localDevOrigins,
  output: "standalone",
  poweredByHeader: false,
  devIndicators: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
