import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 font-medium transition-colors select-none",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border border-transparent shadow-xs",
        secondary:
          "bg-secondary text-secondary-foreground border border-transparent shadow-xs",
        outline:
          "border border-border bg-card text-foreground hover:bg-muted/50",
        subtle:
          "bg-muted text-muted-foreground border border-transparent",
        success:
          "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        warning:
          "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400",
        destructive:
          "border-destructive/30 bg-destructive/10 text-destructive dark:text-destructive-foreground",
        accent:
          "border-accent/25 bg-accent/10 text-accent dark:text-accent-foreground",
      },
      size: {
        sm: "px-2 py-0.5 text-[11px] rounded-md leading-tight",
        default: "px-2.5 py-1 text-xs rounded-lg leading-normal",
        lg: "px-3 py-1.5 text-sm rounded-xl font-semibold",
      },
      dot: {
        true: "pl-2",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      dot: false,
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dotColor?: string;
  pulse?: boolean;
}

function Badge({
  className,
  variant,
  size,
  dot = false,
  dotColor,
  pulse = false,
  children,
  ...props
}: BadgeProps) {
  const getDotBg = () => {
    if (dotColor) return dotColor;
    switch (variant) {
      case "success":
        return "bg-emerald-500";
      case "warning":
        return "bg-amber-500";
      case "destructive":
        return "bg-destructive";
      case "secondary":
        return "bg-secondary";
      case "accent":
        return "bg-accent";
      case "default":
        return "bg-primary-foreground";
      default:
        return "bg-primary";
    }
  };

  return (
    <div
      data-slot="badge"
      className={cn(badgeVariants({ variant, size, dot, className }))}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            "size-1.5 rounded-full shrink-0",
            getDotBg(),
            pulse && "animate-pulse"
          )}
        />
      )}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
