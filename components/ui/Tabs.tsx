"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabs() {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error("Tabs components must be used within a Tabs provider");
  }
  return context;
}

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
}

function Tabs({ value, onValueChange, className, children, ...props }: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={cn("w-full", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "pill" | "underline";
}

function TabsList({ className, variant = "pill", children, ...props }: TabsListProps) {
  return (
    <div
      role="tablist"
      className={cn(
        "no-scrollbar flex items-center gap-1 overflow-x-auto p-1 text-muted-foreground",
        variant === "pill" && "rounded-xl border border-border bg-card shadow-xs",
        variant === "underline" && "border-b border-border bg-transparent p-0",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  variant?: "pill" | "underline";
}

function TabsTrigger({
  value,
  variant = "pill",
  className,
  children,
  ...props
}: TabsTriggerProps) {
  const { value: selectedValue, onValueChange } = useTabs();
  const isSelected = selectedValue === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isSelected}
      onClick={() => onValueChange(value)}
      className={cn(
        "tap-target inline-flex items-center justify-center whitespace-nowrap px-3.5 py-2 text-sm font-semibold transition-all select-none disabled:pointer-events-none disabled:opacity-50",
        variant === "pill" && [
          "rounded-lg",
          isSelected
            ? "bg-primary text-primary-foreground shadow-xs font-bold"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        ],
        variant === "underline" && [
          "border-b-2 -mb-px rounded-none px-4 py-2.5",
          isSelected
            ? "border-primary text-primary font-bold"
            : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
        ],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

function TabsContent({ value, className, children, ...props }: TabsContentProps) {
  const { value: selectedValue } = useTabs();
  if (selectedValue !== value) return null;

  return (
    <div
      role="tabpanel"
      className={cn("mt-3 outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
