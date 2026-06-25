import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/kart-cek", destination: "/card-draw", permanent: true },
      { source: "/kartlarim", destination: "/my-cards", permanent: true },
      { source: "/ogren", destination: "/learn", permanent: true },
      { source: "/ogrenilenler", destination: "/learned", permanent: true },
      { source: "/profil", destination: "/profile", permanent: true },
    ];
  },
};

export default withPWA({
  dest: "public",
  register: true,
  disable: process.env.NODE_ENV === "development",
  fallbacks: {
    document: "/offline",
  },
})(nextConfig);
