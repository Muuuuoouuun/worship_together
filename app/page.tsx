import Link from "next/link";
import MeshBackground from "@/components/ui/MeshBackground";
import GlassCard from "@/components/ui/GlassCard";
import {
  ArrowRight,
  BadgeCheck,
  HandHeart,
  HeartHandshake,
  Music2,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

const entryPoints = [
  {
    href: "/dashboard",
    icon: Music2,
    title: "Worship with the church",
    description: "Join live worship, review the next setlist, and stay connected after the service.",
  },
  {
    href: "/care",
    icon: HandHeart,
    title: "Ask for prayer or care",
    description: "Share a need with clear privacy boundaries and a path for pastoral follow-up.",
  },
  {
    href: "/serve",
    icon: BadgeCheck,
    title: "Find a place to serve",
    description: "See concrete ministry needs and move toward a confirmed serving commitment.",
  },
  {
    href: "/groups",
    icon: UsersRound,
    title: "Join a group",
    description: "Find fellowship, newcomer steps, and smaller spaces for discipleship.",
  },
];

const trustItems = [
  {
    icon: ShieldCheck,
    title: "Privacy-aware care",
    description: "Prayer requests are framed around visibility, urgency, and ownership.",
  },
  {
    icon: HeartHandshake,
    title: "Mutual support",
    description: "Members can respond through prayer, service, and follow-up instead of passive scrolling.",
  },
  {
    icon: Music2,
    title: "Worship stays central",
    description: "The live worship tools remain focused while the broader community has a clear home.",
  },
];

export default function Home() {
  return (
    <div className="relative min-h-screen bg-background text-primary selection:bg-secondary/25 selection:text-primary">
      <MeshBackground />

      <section className="relative min-h-[84svh] overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgba(21,62,59,0.88), rgba(21,62,59,0.58) 46%, rgba(21,62,59,0.22)), url('https://images.unsplash.com/photo-1507692049790-de58290a4334?auto=format&fit=crop&w=1900&q=80')",
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_70%,#F7F5EF_100%)]" />

        <nav className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3 text-surface">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-surface/15 backdrop-blur-md">
              <HeartHandshake size={18} />
            </div>
            <span className="font-serif text-xl font-bold">Worship Together</span>
          </Link>
          <div className="hidden items-center gap-6 text-sm font-semibold text-surface/80 md:flex">
            <Link href="/community" className="transition hover:text-surface">Community</Link>
            <Link href="/care" className="transition hover:text-surface">Care</Link>
            <Link href="/serve" className="transition hover:text-surface">Serve</Link>
            <Link href="/groups" className="transition hover:text-surface">Groups</Link>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-md bg-surface px-4 py-2 text-sm font-semibold text-primary shadow-md transition hover:scale-[1.01]"
          >
            Open Today
          </Link>
        </nav>

        <div className="relative z-10 mx-auto flex min-h-[calc(84svh-88px)] max-w-7xl items-end px-4 pb-16 pt-16 sm:px-6 lg:px-8">
          <div className="max-w-3xl text-surface">
            <span className="inline-flex rounded-md bg-surface/15 px-3 py-1 text-xs font-bold uppercase text-surface/80 backdrop-blur-md">
              Worship Together
            </span>
            <h1 className="mt-5 text-5xl font-serif font-black leading-[1.04] md:text-7xl">
              Worship, care, and service for one church family.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-surface/80 md:text-xl">
              A calm community home for joining worship, requesting prayer, serving this week, and finding a group after the service ends.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/community"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-secondary px-6 py-3 text-sm font-bold text-surface shadow-xl transition hover:scale-[1.01]"
              >
                Enter community
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-md border border-surface/25 bg-surface/10 px-6 py-3 text-sm font-bold text-surface backdrop-blur-md transition hover:bg-surface/20"
              >
                Join worship
              </Link>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {entryPoints.map((entry) => {
            const Icon = entry.icon;

            return (
              <Link key={entry.title} href={entry.href} className="block h-full">
                <GlassCard className="flex h-full flex-col border-primary/10 bg-white/70 p-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/5 text-primary/70">
                    <Icon size={20} />
                  </div>
                  <h2 className="mt-5 text-xl font-serif font-bold text-primary">{entry.title}</h2>
                  <p className="mt-3 text-sm leading-relaxed text-primary/60">{entry.description}</p>
                  <div className="mt-auto pt-6 text-sm font-semibold text-secondary">
                    Open path
                  </div>
                </GlassCard>
              </Link>
            );
          })}
        </section>

        <section className="mt-16 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <span className="inline-flex rounded-md bg-primary/5 px-3 py-1 text-xs font-bold uppercase text-primary/55">
              Built for belonging
            </span>
            <h2 className="mt-5 max-w-2xl text-4xl font-serif font-black leading-tight text-primary md:text-5xl">
              Every visit should lead to one meaningful next step.
            </h2>
          </div>
          <div className="grid gap-4">
            {trustItems.map((item) => {
              const Icon = item.icon;

              return (
                <GlassCard key={item.title} className="border-primary/10 bg-white/60 p-5">
                  <div className="flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-secondary/10 text-secondary">
                      <Icon size={18} />
                    </div>
                    <div>
                      <h3 className="font-serif text-lg font-bold text-primary">{item.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-primary/60">{item.description}</p>
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
