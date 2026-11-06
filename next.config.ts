import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow testing the dev server from a phone on the same Wi-Fi.
  allowedDevOrigins: ["10.4.4.166"],
};

export default nextConfig;
