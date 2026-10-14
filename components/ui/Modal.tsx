"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSheetDismiss } from "@/hooks/useSheetDismiss";

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  isBottomSheetOnMobile?: boolean;
}

function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  isBottomSheetOnMobile = true,
}: ModalProps) {
  // Esc 로 닫고(겹친 창이면 맨 위만), 열려 있는 동안 뒤 화면 스크롤을 막습니다.
  useSheetDismiss(() => onOpenChange(false), open);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
    >
      {/* 백드롭 */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      {/* 모달 창 */}
      <div
        className={cn(
          "relative z-50 w-full max-h-[90dvh] overflow-y-auto border border-border/70 bg-card p-6 shadow-xl transition-all sm:max-w-lg sm:rounded-3xl",
          isBottomSheetOnMobile
            ? "rounded-t-3xl pb-[calc(env(safe-area-inset-bottom)+1.5rem)] animate-in slide-in-from-bottom duration-200 sm:slide-in-from-bottom-0 sm:fade-in"
            : "rounded-2xl animate-in zoom-in-95 duration-150",
          className
        )}
      >
        {/* 모바일 바텀시트 핸들 바 */}
        {isBottomSheetOnMobile && (
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border sm:hidden" />
        )}

        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 pr-6">
            {title && (
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="tap-target -mr-2 -mt-2 inline-flex size-9 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="닫기"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

export { Modal };
