import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const avatarVariants = cva(
  "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold select-none",
  {
    variants: {
      size: {
        xs: "size-6 text-[10px]",
        sm: "size-8 text-xs",
        default: "size-10 text-sm",
        lg: "size-12 text-base",
        xl: "size-16 text-xl",
      },
      roleVariant: {
        default: "border border-border/80 bg-muted text-foreground",
        leader: "ring-2 ring-secondary bg-secondary/15 text-secondary border-transparent",
        vocal: "ring-2 ring-emerald-500/60 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-transparent",
        band: "ring-2 ring-accent/60 bg-accent/15 text-accent dark:text-accent-foreground border-transparent",
        media: "ring-2 ring-amber-500/60 bg-amber-500/15 text-amber-700 dark:text-amber-300 border-transparent",
        primary: "ring-2 ring-primary bg-primary/15 text-primary border-transparent",
      },
    },
    defaultVariants: {
      size: "default",
      roleVariant: "default",
    },
  }
);

export interface AvatarProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof avatarVariants> {
  name?: string;
  src?: string;
  alt?: string;
  online?: boolean;
}

function getInitials(name?: string): string {
  if (!name) return "?";
  const trimmed = name.trim();
  if (trimmed.length <= 2) return trimmed;
  // 한글의 경우 보통 앞 2자 또는 성+이름
  const parts = trimmed.split(/\s+/);
  if (parts.length > 1) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return trimmed.slice(0, 2);
}

function Avatar({
  name,
  src,
  alt,
  size,
  roleVariant,
  online,
  className,
  ...props
}: AvatarProps) {
  const [imageError, setImageError] = React.useState(false);
  const initials = React.useMemo(() => getInitials(name), [name]);

  return (
    <div
      data-slot="avatar"
      className={cn(avatarVariants({ size, roleVariant, className }))}
      title={name}
      {...props}
    >
      {src && !imageError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt || name || "User avatar"}
          onError={() => setImageError(true)}
          className="size-full object-cover"
        />
      ) : (
        <span>{initials}</span>
      )}
      {online !== undefined && (
        <span
          className={cn(
            "absolute bottom-0 right-0 block rounded-full ring-2 ring-card",
            size === "xs" && "size-1.5",
            size === "sm" && "size-2",
            size === "default" && "size-2.5",
            size === "lg" && "size-3",
            size === "xl" && "size-4",
            online ? "bg-emerald-500" : "bg-muted-foreground/50"
          )}
        />
      )}
    </div>
  );
}

interface AvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  max?: number;
  total?: number;
  children: React.ReactNode;
}

function AvatarGroup({ max = 4, total, className, children, ...props }: AvatarGroupProps) {
  const childArray = React.Children.toArray(children);
  const visibleChildren = max ? childArray.slice(0, max) : childArray;
  const remaining = total !== undefined ? total - visibleChildren.length : childArray.length - visibleChildren.length;

  return (
    <div
      className={cn("flex items-center -space-x-2 overflow-hidden", className)}
      {...props}
    >
      {visibleChildren.map((child, i) => (
        <div key={i} className="ring-2 ring-card rounded-full">
          {child}
        </div>
      ))}
      {remaining > 0 && (
        <div className="ring-2 ring-card rounded-full">
          <div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
            +{remaining}
          </div>
        </div>
      )}
    </div>
  );
}

export { Avatar, AvatarGroup, avatarVariants };
