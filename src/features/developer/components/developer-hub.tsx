import Link from "next/link";
import { ArrowRight, BadgeDollarSign, Clapperboard, ShieldCheck } from "lucide-react";

const tools = [
  {
    href: "/content-automation",
    icon: Clapperboard,
    title: "Content automation",
    description: "Sosyal içerik üretimi, yayın hedefleri ve otomasyon kuyrukları.",
    accent: "bg-[#e7f0df] text-[#1e422f]",
  },
  {
    href: "/developer/budget",
    icon: BadgeDollarSign,
    title: "Budget interface",
    description: "Aylık servis maliyetlerini TL cinsinden kaydet, takip et ve güncelle.",
    accent: "bg-[#fff0d5] text-[#713d09]",
  },
  {
    href: "/developer/admin",
    icon: ShieldCheck,
    title: "Admin panel",
    description: "Kullanıcılar, abonelikler, kart ilerlemesi ve toplu metrikler.",
    accent: "bg-[#e8e7f6] text-[#39346f]",
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

        <section className="mt-8 grid gap-4 md:grid-cols-3" aria-label="Developer tools">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link className="group flex min-h-64 flex-col rounded-xl border border-[#d9ddd4] bg-[#fcfbf8] p-6 transition-colors hover:border-[#aeb8aa] hover:bg-white" href={tool.href} key={tool.href}>
                <span className={`grid size-12 place-items-center rounded-lg ${tool.accent}`}><Icon className="size-6" aria-hidden="true" /></span>
                <h2 className="mt-8 text-xl font-semibold">{tool.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[#657269]">{tool.description}</p>
                <span className="mt-auto inline-flex items-center gap-2 pt-7 text-sm font-semibold text-[#273a2d]">Aç <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" /></span>
              </Link>
            );
          })}
        </section>
      </div>
    </main>
  );
}
