import Link from "next/link";
import { ArrowRight, BadgeDollarSign, BarChart3, BookOpen, Clapperboard, LineChart, Mail, ShieldCheck } from "lucide-react";

const tools = [
  {
    href: "/content-automation",
    icon: Clapperboard,
    title: "Content Automation",
    description: "Sosyal içerik üretimi, yayın hedefleri ve otomasyon kuyrukları.",
    accent: "bg-[#1fa463]",
  },
  {
    href: "/developer/budget",
    icon: BadgeDollarSign,
    title: "Budget interface",
    description: "Aylık servis maliyetlerini TL cinsinden kaydet, takip et ve güncelle.",
    accent: "bg-[#e38b08]",
  },
  {
    href: "/developer/admin",
    icon: ShieldCheck,
    title: "Admin panel",
    description: "Kullanıcılar, abonelikler, kart ilerlemesi ve toplu metrikler.",
    accent: "bg-[#5c50d9]",
  },
  {
    href: "/developer/analytics",
    icon: BarChart3,
    title: "Analytics",
    description: "Kullanıcı, kart ve abonelik performansını toplu olarak incele.",
    accent: "bg-[#168bb8]",
  },
  {
    href: "/developer/vocabulary",
    icon: BookOpen,
    title: "Vocabulary catalog",
    description: "Ana kelime listesini, ornekleri ve dil detaylarini salt okunur katalogda incele.",
    accent: "bg-[#c45d2c]",
  },
  {
    href: "/developer/social-analytics",
    icon: LineChart,
    title: "Social medias",
    description: "Bağlı sosyal medya hesaplarının Upload-Post verilerini tek panelde izle.",
    accent: "bg-[#22a653]",
  },
  {
    href: "/developer/admin/contact",
    icon: Mail,
    title: "Contact inbox",
    description: "Kullanıcıların landing sayfasından gönderdiği puan ve mesajları incele.",
    accent: "bg-[#d85a2d]",
  },
];

export function DeveloperHub({ email }: { email: string }) {
  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-[#f5f3ee] px-4 py-8 text-[#1f2922] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-[#d9ddd4] pb-7">
          <p className="text-sm text-[#5d6c61]">Supabase doğrulamasıyla giriş yapıldı · {email}</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Developer workspace</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[#58665c]">FoxiesDeck’in içerik, maliyet ve operasyon kontrolleri tek güvenli çalışma alanında.</p>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Developer tools">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link className={`group flex min-h-64 flex-col rounded-xl p-6 text-white transition-[filter] hover:brightness-105 ${tool.accent}`} href={tool.href} key={tool.href}>
                <span className="text-white"><Icon className="size-7" aria-hidden="true" /></span>
                <h2 className="mt-8 text-xl font-semibold">{tool.title}</h2>
                <p className="mt-2 text-sm leading-6 text-white">{tool.description}</p>
                <span className="mt-auto inline-flex items-center gap-2 pt-7 text-sm font-semibold text-white">Aç <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" /></span>
              </Link>
            );
          })}
        </section>
      </div>
    </main>
  );
}
