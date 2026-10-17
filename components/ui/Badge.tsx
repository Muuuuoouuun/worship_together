import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 font-medium transition-colors select-none",
  {
    variants: {
      variant: {
        /** 검정 알약 */
        default:
          "bg-primary text-primary-foreground border border-transparent",
        /** 회색 칩 (역할·분류 표시) */
        secondary:
          "bg-muted text-foreground border border-transparent",
        outline:
          "border border-border bg-card text-foreground",
        subtle:
          "bg-muted text-muted-foreground border border-transparent",
        success:
          "border border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        warning:
          "border border-transparent bg-amber-500/10 text-amber-700 dark:text-amber-200",
        destructive:
          "border border-transparent bg-destructive/10 text-destructive",
        accent:
          "border border-transparent bg-brand/10 text-brand",
      },
      size: {
        sm: "px-2 py-0.5 text-[11px] rounded-full leading-tight",
        default: "px-2.5 py-1 text-xs rounded-full leading-normal",
        lg: "px-3 py-1.5 text-sm rounded-full font-semibold",
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
        return "bg-muted-foreground/50";
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
