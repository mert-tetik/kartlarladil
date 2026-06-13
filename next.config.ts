import type { NextConfig } from "next";

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

export default nextConfig;
