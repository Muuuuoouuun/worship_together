import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const avatarVariants = cva(
  "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold tracking-tight select-none",
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
        // 콘티·악보 화면의 파스텔 아바타와 같은 색
        default: "bg-muted text-foreground",
        leader: "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/25 dark:text-emerald-100",
        vocal: "bg-sky-100 text-sky-800 dark:bg-sky-400/25 dark:text-sky-100",
        band: "bg-violet-100 text-violet-800 dark:bg-violet-400/25 dark:text-violet-100",
        media: "bg-amber-100 text-amber-800 dark:bg-amber-400/25 dark:text-amber-100",
        primary: "bg-primary text-primary-foreground",
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
  // 세 글자 한글 이름은 콘티 화면처럼 성을 빼고 이름 두 글자 (김찬양 → 찬양)
  if (/^[가-힣]{3}$/.test(trimmed)) return trimmed.slice(1);
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
