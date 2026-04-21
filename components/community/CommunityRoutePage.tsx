import Link from 'next/link';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import GlassCard from '@/components/ui/GlassCard';
import MeshBackground from '@/components/ui/MeshBackground';
import { ArrowRight, type LucideIcon } from 'lucide-react';

interface RouteAction {
    href: string;
    label: string;
}

interface RouteMetric {
    detail: string;
    label: string;
    value: string;
}

interface RouteSection {
    actionLabel?: string;
    description: string;
    href?: string;
    icon: LucideIcon;
    items: string[];
    title: string;
}

interface CommunityRoutePageProps {
    currentPath: string;
    description: string;
    eyebrow: string;
    metrics: RouteMetric[];
    primaryAction: RouteAction;
    secondaryAction?: RouteAction;
    sections: RouteSection[];
    title: string;
}

export default function CommunityRoutePage({
    currentPath,
    description,
    eyebrow,
    metrics,
    primaryAction,
    secondaryAction,
    sections,
    title,
}: CommunityRoutePageProps) {
    return (
        <DashboardLayout currentPath={currentPath}>
            <MeshBackground />
            <div className="mx-auto flex max-w-7xl flex-col gap-8">
                <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
                    <div className="space-y-5">
                        <span className="inline-flex rounded-md bg-secondary/10 px-3 py-1 text-xs font-bold uppercase text-secondary">
                            {eyebrow}
                        </span>
                        <div className="space-y-4">
                            <h1 className="max-w-4xl text-4xl font-serif font-black tracking-tight text-primary md:text-6xl">
                                {title}
                            </h1>
                            <p className="max-w-3xl text-base leading-relaxed text-primary/60 md:text-lg">
                                {description}
                            </p>
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <Link
                                href={primaryAction.href}
                                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-surface transition hover:scale-[1.01]"
                            >
                                {primaryAction.label}
                                <ArrowRight size={16} />
                            </Link>
                            {secondaryAction ? (
                                <Link
                                    href={secondaryAction.href}
                                    className="inline-flex items-center justify-center rounded-md border border-primary/10 bg-white/70 px-5 py-3 text-sm font-semibold text-primary transition hover:bg-white"
                                >
                                    {secondaryAction.label}
                                </Link>
                            ) : null}
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                        {metrics.map((metric) => (
                            <GlassCard key={metric.label} className="border-primary/10 bg-white/55 p-5">
                                <p className="text-[11px] font-bold uppercase text-primary/35">
                                    {metric.label}
                                </p>
                                <p className="mt-2 text-2xl font-serif font-black text-primary">{metric.value}</p>
                                <p className="mt-1 text-sm leading-relaxed text-primary/55">{metric.detail}</p>
                            </GlassCard>
                        ))}
                    </div>
                </section>

                <section className="grid gap-5 lg:grid-cols-3">
                    {sections.map((section) => {
                        const Icon = section.icon;
                        const content = (
                            <GlassCard className="flex h-full flex-col border-primary/10 bg-white/55 p-5">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/5 text-primary/65">
                                        <Icon size={19} />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-serif font-bold text-primary">{section.title}</h2>
                                        <p className="mt-2 text-sm leading-relaxed text-primary/55">{section.description}</p>
                                    </div>
                                </div>
                                <div className="mt-5 space-y-3">
                                    {section.items.map((item) => (
                                        <div key={item} className="flex gap-3 text-sm leading-relaxed text-primary/65">
                                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" />
                                            <span>{item}</span>
                                        </div>
                                    ))}
                                </div>
                                {section.href && section.actionLabel ? (
                                    <div className="mt-auto pt-6">
                                        <div className="inline-flex items-center gap-2 text-sm font-semibold text-secondary">
                                            {section.actionLabel}
                                            <ArrowRight size={15} />
                                        </div>
                                    </div>
                                ) : null}
                            </GlassCard>
                        );

                        return section.href ? (
                            <Link key={section.title} href={section.href} className="block h-full">
                                {content}
                            </Link>
                        ) : (
                            <div key={section.title}>{content}</div>
                        );
                    })}
                </section>
            </div>
        </DashboardLayout>
    );
}
