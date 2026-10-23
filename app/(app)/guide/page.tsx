import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BookOpen, Headphones, Play, UsersRound } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';

export const metadata: Metadata = { title: '처음 사용 안내' };

const courses = [
    {
        id: 'member', title: '초대받은 팀원', icon: UsersRound,
        steps: [
            ['팀에 참여해요', '받은 초대 링크를 열고 로그인하세요. 팀 이름을 확인하고 “이 예배팀에 참여하기”를 누르세요. 이미 명단에 내 이름이 있으면 그 자리를 선택하세요.'],
            ['내 일정을 확인해요', '“일정·요청”에서 내가 배정된 예배나 연습을 열어 참석·불참을 알려주세요. 역할이 다르면 관리자에게 수정을 요청하세요.'],
            ['곡과 악보를 준비해요', '“콘티·악보”에서 이번 주 예배를 골라 곡 순서와 Key(조성)를 확인하세요. 모르는 부분은 곡 코멘트나 “요청”으로 물어보세요.'],
            ['예배에 입장해요', '인도자가 시작하면 “오늘”의 진행 중인 예배에서 입장하세요. “지금”은 곡과 진행 신호, “악보”는 악보, “펄스”는 박자를 보여줘요.'],
        ], href: '/welcome?step=team', action: '초대 코드로 참여하기',
    },
    {
        id: 'leader', title: '팀 관리자 · 인도자', icon: BookOpen,
        steps: [
            ['팀을 만들고 초대해요', '“팀·초대”에서 팀을 만들고 초대 링크를 보내세요. 가입한 팀원의 역할을 배정하세요. 담당 역할과 관리자 권한은 서로 달라요.'],
            ['곡과 콘티를 만들어요', '“곡 보관함”에서 곡을 등록한 뒤 “새 콘티 만들기”로 예배 날짜와 곡 순서를 정하세요. “송폼”에 도입·1절·후렴 등의 순서를 적을 수 있어요.'],
            ['일정과 역할을 배정해요', '“일정·요청”에서 예배·연습 시간과 장소를 넣고 담당자를 배정하세요. 참석 응답과 빈자리를 확인한 뒤 대체 지원자를 확정하세요.'],
            ['예배를 시작해요', '“오늘”에서 콘티를 확인하고 예배 시작을 누르세요. 팀원이 입장하면 곡·섹션을 넘기고 짧은 큐를 보내 함께 진행하세요.'],
        ], href: '/dashboard/team', action: '팀·초대로 이동',
    },
    {
        id: 'sound', title: '음향 · 영상 담당', icon: Headphones,
        steps: [
            ['내 역할을 확인해요', '팀에 참여한 뒤 명단의 역할이 “음향” 또는 “영상·자막”인지 확인하세요. 다른 역할이면 관리자에게 알려주세요.'],
            ['예배 순서를 미리 봐요', '“콘티·악보”에서 곡·Key·특이사항을 확인하세요. 진행 중인 예배에 입장하면 현재 곡과 다음 진행을 함께 볼 수 있어요.'],
            ['받은 신호를 확인해요', '“보컬 올려요” 같은 큐가 오면 내용을 보고 확인하세요. 기기에 전달된 표시와 사람이 확인한 표시는 달라요.'],
        ], href: '/session/drafts/live-preview?control=0', action: '팀원 화면 연습하기',
    },
];

export default function GuidePage() {
    return <div className="space-y-8">
        <header className="max-w-2xl space-y-3">
            <p className="text-xs font-medium text-brand">함께 준비하는 첫 예배</p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">처음이어도, 순서대로 해보세요</h1>
            <p className="text-sm leading-7 text-muted-foreground">받은 초대에 참여하고, 내 일정을 확인하고, 예배에 입장하면 돼요. 맡은 역할을 골라 필요한 순서만 따라가세요.</p>
            <nav aria-label="역할별 사용 안내" className="flex flex-wrap gap-2">
                {courses.map(course => <a key={course.id} href={`#${course.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>{course.title}</a>)}
            </nav>
        </header>

        <section aria-labelledby="practice-title" className="rounded-3xl border border-border bg-emerald-50 p-5 dark:bg-card sm:p-6">
            <div className="flex items-center gap-3"><Play className="size-5 text-brand" aria-hidden="true" /><h2 id="practice-title" className="text-lg font-semibold">먼저 연습해 볼까요?</h2></div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">로그인 없이 예시 곡으로 곡 넘기기·악보·큐를 체험하세요. 연습 화면의 신호는 실제 팀에 보내지 않아요. 휴대폰에서는 하단 탭, 컴퓨터에서는 넓은 악보 화면이 열려요.</p>
            <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/session/drafts/live-preview?control=0" className={buttonVariants({ size: 'sm' })}>팀원으로 연습 <ArrowRight aria-hidden="true" /></Link>
                <Link href="/session/drafts/live-preview" className={buttonVariants({ variant: 'outline', size: 'sm' })}>인도자로 연습</Link>
            </div>
        </section>

        <div className="grid items-start gap-5 xl:grid-cols-2">
            {courses.map(({ id, title, icon: Icon, steps, href, action }) => <section key={id} id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 rounded-3xl border border-border bg-card p-5 sm:p-6">
                <div className="flex items-center gap-3"><Icon className="size-5 text-brand" aria-hidden="true" /><h2 id={`${id}-title`} className="text-lg font-semibold">{title}</h2></div>
                <ol className="mt-5 space-y-5">
                    {steps.map(([heading, description], i) => <li key={heading} className="flex gap-3">
                        <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{i + 1}</span>
                        <div><h3 className="text-sm font-semibold">{heading}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p></div>
                    </li>)}
                </ol>
                <Link href={href} className={`${buttonVariants({ variant: 'outline', size: 'sm' })} mt-5`}>{action}<ArrowRight aria-hidden="true" /></Link>
            </section>)}

            <section aria-labelledby="terms-title" className="rounded-3xl border border-border bg-card p-5 sm:p-6">
                <h2 id="terms-title" className="text-lg font-semibold">화면 속 말, 쉽게 알아보기</h2>
                <dl className="mt-5 space-y-4 text-sm">
                    {[
                        ['콘티', '예배에서 부를 곡과 그 순서를 정리한 목록이에요.'],
                        ['송폼 · 섹션', '한 곡 안의 도입(Intro), 1절(Verse), 후렴(Chorus), 연결(Bridge), 마침(Outro) 순서예요.'],
                        ['큐', '“한 번 더”, “마지막 후렴”처럼 예배 중 보내는 짧은 진행 신호예요.'],
                        ['BPM · 펄스', 'BPM은 1분 동안의 박자 수, 펄스는 그 박자를 눈으로 보여주는 화면이에요.'],
                        ['Key', '곡을 부르거나 연주할 조성이에요. 예: C, D, G.'],
                    ].map(([term, text]) => <div key={term}><dt className="font-semibold">{term}</dt><dd className="mt-1 leading-6 text-muted-foreground">{text}</dd></div>)}
                </dl>
            </section>
        </div>

        <section aria-labelledby="help-title" className="rounded-3xl bg-muted p-5 sm:p-6">
            <h2 id="help-title" className="text-lg font-semibold">막혔을 때는 이렇게 해보세요</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
                <li>초대가 만료됐다면 관리자에게 새 링크나 코드를 받아주세요. 초대는 발급 후 7일간 유효해요.</li>
                <li>팀이 안 보이면 가입할 때 쓴 로그인 방법인지 확인하세요. Google과 네이버는 서로 다른 계정이에요.</li>
                <li>버튼을 누를 수 없다면 내 역할과 권한을 확인하세요. 예배 시작·진행은 기본적으로 관리자와 인도자가 맡아요.</li>
                <li>연결이 끊기면 화면의 연결 상태를 확인하고 다시 연결될 때까지 기다려주세요. 중요한 신호는 인도자와 직접 확인하세요.</li>
                <li>로그인 없이 둘러보는 자료는 이 브라우저에만 저장돼요. 실제 팀 공유는 로그인해서 팀에 참여한 뒤 사용하세요.</li>
            </ul>
        </section>
    </div>;
}
