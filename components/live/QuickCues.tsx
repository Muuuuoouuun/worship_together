'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, CircleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { CUE_TARGET_LABEL, type CueDefinition } from './model';

/*
 * 엄지 자리의 빠른 큐 — 늘 보이는 버튼 몇 개. 한 번 누르면 바로 갑니다 (시트 · 팝업 · 받는 사람 고르기 없음).
 * 누르면 1.2초 동안 '보냄 · 받는 사람에게' 로 바뀌고 그동안 다시 눌러도 한 번만 갑니다.
 * 서버가 실패를 알리면 잠깐 '실패' 로 바뀝니다 (다시 시도 알림은 모델이 띄웁니다).
 */

/** 보낸 뒤 버튼이 '보냄' 으로 머무는 시간 */
const SENT_MS = 1200;
/** 실패 표시가 머무는 시간 */
const FAILED_MS = 1800;

export default function QuickCues({ cues, onSend, desktop = false }: { cues: CueDefinition[]; onSend: (cue: CueDefinition) => Promise<boolean>; desktop?: boolean }) {
    if (cues.length === 0) return null;
    return (
        <div role="group" aria-label="큐 바로 보내기" className={cn('flex items-center gap-2', desktop && 'shrink-0')}>
            {desktop ? (
                <span aria-hidden="true" className="mr-1.5 flex shrink-0 flex-col text-xs leading-tight">
                    <span className="font-semibold">팀에 요청</span>
                    <span className="text-muted-foreground">누르면 바로</span>
                </span>
            ) : null}
            {cues.map((cue) => (
                <QuickCueButton key={cue.id} cue={cue} onSend={onSend} desktop={desktop} />
            ))}
        </div>
    );
}

type SendState = 'idle' | 'sent' | 'failed';

function QuickCueButton({ cue, onSend, desktop }: { cue: CueDefinition; onSend: (cue: CueDefinition) => Promise<boolean>; desktop: boolean }) {
    const [state, setState] = useState<SendState>('idle');
    const busy = useRef(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const target = CUE_TARGET_LABEL[cue.target];

    useEffect(
        () => () => {
            if (timer.current) clearTimeout(timer.current);
        },
        [],
    );

    function settle(next: SendState, ms: number) {
        if (timer.current) clearTimeout(timer.current);
        setState(next);
        timer.current = setTimeout(() => {
            busy.current = false;
            setState('idle');
        }, ms);
    }

    function send() {
        // 보낸 뒤 1.2초 동안은 다시 눌러도 한 번만 갑니다 (두 번 눌림 방지)
        if (busy.current) return;
        busy.current = true;
        settle('sent', SENT_MS);
        let request: Promise<boolean>;
        try {
            request = onSend(cue);
        } catch {
            request = Promise.resolve(false);
        }
        request
            .catch(() => false)
            .then((ok) => {
                if (ok) return;
                // 실패하면 바로 다시 누를 수 있게 막지 않고, 잠깐 '실패' 만 보여 줍니다
                settle('failed', FAILED_MS);
                busy.current = false;
            });
    }

    const sent = state === 'sent';
    const failed = state === 'failed';

    return (
        <button
            type="button"
            onClick={send}
            aria-label={failed ? `실패 다시 눌러 보내기 · ${cue.label}` : sent ? `보냄 ${target}에게 · ${cue.label}` : `${cue.label} ${target}에게 바로 보내기`}
            aria-disabled={sent || undefined}
            className={cn(
                buttonVariants({ variant: sent ? 'brand' : failed ? 'destructive-outline' : 'outline' }),
                'h-12 rounded-xl flex-col gap-0 leading-tight',
                desktop ? 'w-28 shrink-0 px-3' : 'min-w-0 flex-1 px-2',
                sent && 'hover:bg-brand',
            )}
        >
            {sent ? (
                <>
                    <span className="inline-flex items-center gap-1 text-[15px] font-semibold">
                        <Check className="size-4" strokeWidth={3} aria-hidden="true" />
                        보냄
                    </span>{' '}
                    <span className="max-w-full truncate text-[11px] font-medium text-brand-foreground/75">{target}에게</span>
                </>
            ) : failed ? (
                <>
                    <span className="inline-flex items-center gap-1 text-[15px] font-semibold">
                        <CircleAlert className="size-4" aria-hidden="true" />
                        실패
                    </span>{' '}
                    <span className="max-w-full truncate text-[11px] font-medium">다시 눌러 보내기</span>
                </>
            ) : (
                <>
                    <span className="max-w-full truncate text-[15px] font-semibold">{cue.label}</span>{' '}
                    <span className="max-w-full truncate text-[11px] font-medium text-muted-foreground">{target}에게</span>
                </>
            )}
        </button>
    );
}
