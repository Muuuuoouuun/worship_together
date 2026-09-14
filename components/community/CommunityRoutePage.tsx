import Link from 'next/link';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import GlassCard from '@/components/ui/GlassCard';
import MeshBackground from '@/components/ui/MeshBackground';
import { Badge } from '@/components/ui/Badge';
import { ArrowRight, ChevronRight, type LucideIcon } from 'lucide-react';

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
            <div className="mx-auto flex max-w-7xl flex-col gap-8 animate-in fade-in duration-300">
                <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
                    <div className="space-y-5">
                        <Badge variant="secondary" size="default">
                            {eyebrow}
                        </Badge>
                        <div className="space-y-3">
                            <h1 className="max-w-4xl text-3xl font-serif font-black tracking-tight text-foreground sm:text-4xl md:text-5xl">
                                {title}
                            </h1>
                            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                                {description}
                            </p>
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <Link
                                href={primaryAction.href}
                                className="tap-target inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 active:scale-[0.98]"
                            >
                                {primaryAction.label}
                                <ArrowRight size={16} />
                            </Link>
                            {secondaryAction ? (
                                <Link
                                    href={secondaryAction.href}
                                    className="tap-target inline-flex items-center justify-center rounded-2xl border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-muted active:scale-[0.98]"
                                >
                                    {secondaryAction.label}
                                </Link>
                            ) : null}
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                        {metrics.map((metric) => (
                            <GlassCard key={metric.label} className="border-border/80 bg-card/80 p-5 rounded-2xl shadow-xs">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                    {metric.label}
                                </p>
                                <p className="mt-1 text-2xl font-serif font-black text-foreground">{metric.value}</p>
                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{metric.detail}</p>
                            </GlassCard>
                        ))}
                    </div>
                </section>

                <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {sections.map((section) => {
                        const Icon = section.icon;
                        const content = (
                            <GlassCard className="flex h-full flex-col border-border/80 bg-card/80 p-5 rounded-2xl shadow-xs transition-all hover:border-primary/40 hover:shadow-md">
                                <div className="flex items-start gap-3">
                                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                        <Icon size={20} />
                                    </div>
                                    <div>
                                        <h2 className="text-base font-serif font-bold text-foreground">{section.title}</h2>
                                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{section.description}</p>
                                    </div>
                                </div>
                                <div className="mt-4 space-y-2.5">
                                    {section.items.map((item) => (
                                        <div key={item} className="flex items-center gap-2.5 text-xs text-foreground">
                                            <span className="size-1.5 shrink-0 rounded-full bg-secondary" />
                                            <span>{item}</span>
                                        </div>
                                    ))}
                                </div>
                                {section.href && section.actionLabel ? (
                                    <div className="mt-auto pt-5 border-t border-border/40">
                                        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-secondary hover:underline">
                                            {section.actionLabel}
                                            <ChevronRight size={14} />
                                        </div>
                                    </div>
                                ) : null}
                            </GlassCard>
                        );

                        return section.href ? (
                            <Link key={section.title} href={section.href} className="block h-full outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl">
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
