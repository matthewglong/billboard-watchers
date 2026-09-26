import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

// To test on a phone, open http://<this computer's LAN address>:3000 while
// `npm run dev` is running. Next blocks cross-origin requests to dev assets
// unless the origin is listed, so list this machine's own LAN addresses.
const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((net) => net && net.family === "IPv4" && !net.internal)
  .map((net) => net!.address);

const nextConfig: NextConfig = {
  allowedDevOrigins: [...lanAddresses, "*.local"],
};

export default nextConfig;
