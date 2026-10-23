import Link from 'next/link';
import { ArrowRight, BookOpen } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';

/** A visible route into the product for people who have never used worship software. */
export default function FirstSteps() {
    return <section aria-labelledby="first-steps-title" className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-center gap-2"><BookOpen className="size-5 text-brand" aria-hidden="true" /><h2 id="first-steps-title" className="text-base font-semibold">처음 오셨나요?</h2></div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">초대받은 팀에 참여하고 → 내 일정을 확인하고 → 예배에 입장해요. 콘티는 예배에서 부를 곡과 순서예요.</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">지금은 둘러보기 모드예요. 이 기기의 연습 자료는 실제 팀에 공유되지 않아요.</p>
        <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/welcome?step=team" className={buttonVariants({ size: 'sm' })}>초대받은 팀 참여<ArrowRight aria-hidden="true" /></Link>
            <Link href="/guide" className={buttonVariants({ variant: 'outline', size: 'sm' })}>3분 사용 안내 · 연습</Link>
        </div>
    </section>;
}
