import * as React from "react"

import { cn } from "@/lib/utils"

/** 앱 공통 입력 칸 모양 (input·select·textarea). 모바일 확대를 막기 위해 기본 16px 글자. */
export const fieldClass =
  "h-11 w-full min-w-0 rounded-2xl border border-input bg-card px-3.5 text-base text-foreground placeholder:text-muted-foreground/80 outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"

/** 검색 칸: 회색 알약 */
export const searchFieldClass =
  "h-10 w-full rounded-full bg-muted px-4 text-base text-foreground placeholder:text-muted-foreground/80 outline-none focus-visible:ring-2 focus-visible:ring-ring/30 sm:text-sm"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn(fieldClass, "h-auto min-h-24 py-2.5 leading-relaxed", className)} {...props} />
}

function Select({ className, ...props }: React.ComponentProps<"select">) {
  return <select data-slot="select" className={cn(fieldClass, "pr-8", className)} {...props} />
}

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input h-11 w-full min-w-0 rounded-2xl border bg-card px-3.5 py-2 text-base text-card-foreground transition-[color,box-shadow] sm:text-sm outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:cursor-not-allowed disabled:border-dashed disabled:bg-muted disabled:text-muted-foreground",
        "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input, Select, Textarea }
