import * as React from "react";
import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: LucideIcon;
  iconClassName?: string;
  iconBgClassName?: string;
  href?: string;
  badge?: React.ReactNode;
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconClassName,
  iconBgClassName = "bg-primary/10 text-primary",
  href,
  badge,
  className,
  ...props
}: StatCardProps) {
  const content = (
    <div
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition-all duration-200",
        href && "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md active:translate-y-0 active:scale-[0.99]",
        className
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {Icon && (
            <div
              className={cn(
                "flex size-10 items-center justify-center rounded-xl shrink-0 transition-transform group-hover:scale-105",
                iconBgClassName,
                iconClassName
              )}
            >
              <Icon size={20} />
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-muted-foreground">{title}</p>
            <div className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {value}
            </div>
          </div>
        </div>
        {badge && <div>{badge}</div>}
      </div>

      {(subtitle || href) && (
        <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3 text-xs text-muted-foreground">
          {subtitle && <span>{subtitle}</span>}
          {href && (
            <span className="ml-auto inline-flex items-center gap-1 font-semibold text-primary group-hover:underline">
              자세히 보기
              <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl">
        {content}
      </Link>
    );
  }

  return content;
}

export { StatCard };
