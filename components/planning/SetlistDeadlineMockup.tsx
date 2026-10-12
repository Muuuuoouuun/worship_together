'use client';

import { useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
    AlarmClock, BellRing, CalendarClock, CircleCheck, Clock, EyeOff, Hand, Hourglass, Inbox,
    ListMusic, Megaphone, MessageCircleHeart, Moon, Send, Settings2, ShieldAlert, Undo2, UsersRound,
    type LucideIcon,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';

// 콘티 마감 알림 · 인도자 독촉 기능 목업. 서버 저장 없이 화면 상태만 시뮬레이션합니다.
export type MockupView = 'member' | 'leader' | 'settings' | 'inbox';
export type MockupPhase = 'before' | 'soon' | 'overdue' | 'done';
type Tone = 'calm' | 'warn' | 'danger' | 'ok';
type Nudge = { id: string; name: string; part: string; message: string; time: string; anonymous?: boolean };

const button = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border/80 bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground transition-all hover:bg-muted active:scale-[0.98] disabled:cursor-not-allowed disabled:border-dashed disabled:bg-muted! disabled:text-muted-foreground!';
const primaryButton = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-xs transition-all hover:bg-primary/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground';
const chip = (active: boolean) => `rounded-full border px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 ${active ? 'border-primary bg-primary text-primary-foreground shadow-2xs' : 'border-border bg-background text-foreground hover:bg-muted'}`;

const tones: Record<Tone, { banner: string; icon: string; bar: string; badge: 'subtle' | 'warning' | 'destructive' | 'success' }> = {
    calm: { banner: 'border-border bg-card', icon: 'bg-primary/10 text-primary', bar: 'bg-primary', badge: 'subtle' },
    warn: { banner: 'border-amber-500/30 bg-amber-500/10', icon: 'bg-amber-500/15 text-amber-700 dark:text-amber-400', bar: 'bg-amber-500', badge: 'warning' },
    danger: { banner: 'border-destructive/30 bg-destructive/5', icon: 'bg-destructive/15 text-destructive', bar: 'bg-destructive', badge: 'destructive' },
    ok: { banner: 'border-emerald-500/30 bg-emerald-500/10', icon: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400', bar: 'bg-emerald-600', badge: 'success' },
};
const phases: Record<MockupPhase, { label: string; now: string; status: string; tone: Tone; position: number }> = {
    before: { label: '마감 전', now: '10월 14일 (수) 16:00', status: '마감까지 1일 6시간', tone: 'calm', position: 36 },
    soon: { label: '마감 임박', now: '10월 15일 (목) 20:00', status: '마감까지 2시간', tone: 'warn', position: 49 },
    overdue: { label: '마감 지남', now: '10월 16일 (금) 12:00', status: '마감 14시간 지남', tone: 'danger', position: 61 },
    done: { label: '콘티 등록됨', now: '10월 16일 (금) 13:10', status: '마감 15시간 후 등록', tone: 'ok', position: 62 },
};
const mockEvent = { title: '주일 2부 예배', date: '10월 18일 (일) 11:00', location: '본당 3층 대예배실', deadline: '10월 15일 (목) 22:00' };
const leader = { name: '이인도', part: '인도자' };
const me = { name: '김보컬', part: '보컬' };
const songs = ['주께 가까이', '하나님의 세계', '은혜', '예수 우리 왕이여', '주님 다시 오실 때까지'];
const otherNudges: Nudge[] = [
    { id: 'n1', name: '박건반', part: '건반', message: '곡 제목만 먼저 알려주셔도 좋아요', time: '3시간 전' },
    { id: 'n2', name: '팀원 1명', part: '이름 숨김', message: '콘티 언제쯤 올라올까요?', time: '1시간 전', anonymous: true },
    { id: 'n3', name: '최드럼', part: '드럼', message: '미리 연습하고 싶어요', time: '25분 전' },
];
const presets = ['콘티 언제쯤 올라올까요?', '미리 연습하고 싶어요', '곡 제목만 먼저 알려주셔도 좋아요', '키와 BPM이 궁금해요'];
const etaOptions = [
    { id: 'tonight', label: '오늘 밤 안에 올릴게요', until: '오늘 23:59' },
    { id: 'morning', label: '내일 오전까지 올릴게요', until: '내일 12:00' },
    { id: 'titles', label: '곡 제목부터 먼저 공유할게요', until: '오늘 18:00' },
];
const views: { id: MockupView; title: string; short: string; icon: LucideIcon }[] = [
    { id: 'member', title: '팀원 화면', short: '팀원', icon: UsersRound },
    { id: 'leader', title: '인도자 화면', short: '인도자', icon: Megaphone },
    { id: 'settings', title: '마감 설정', short: '설정', icon: Settings2 },
    { id: 'inbox', title: '알림 미리보기', short: '알림', icon: Inbox },
];

export default function SetlistDeadlineMockup({ initialView = 'member', initialPhase = 'overdue' }: { initialView?: MockupView; initialPhase?: MockupPhase }) {
    const [view, setView] = useState<MockupView>(initialView);
    const [phase, setPhase] = useState<MockupPhase>(initialPhase);
    const [myNudge, setMyNudge] = useState<{ message: string; anonymous: boolean } | null>(null);
    const [eta, setEta] = useState<string | null>(null);
    const timeline = view === 'member' || view === 'leader';

    return <div className="space-y-5 pb-10">
        <section className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4 text-sm leading-6">
            <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" size="sm">목업</Badge><span className="font-bold">콘티 마감 알림 · 인도자에게 콘티 요청</span></div>
            <p className="mt-1.5 text-muted-foreground">실제 팀에 저장하거나 알림을 보내지 않습니다. 화면을 바꾸고 시간 상태를 눌러 흐름을 확인해 보세요.</p>
        </section>

        <div role="tablist" aria-label="목업 화면" className="grid grid-cols-4 gap-1 rounded-2xl border border-border/60 bg-muted/50 p-1.5 shadow-2xs">
            {views.map(item => {
                const active = view === item.id;
                return <button key={item.id} role="tab" aria-selected={active} onClick={() => setView(item.id)} className={`flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold transition-all active:scale-[0.98] sm:text-sm ${active ? 'border border-border/60 bg-card font-bold text-foreground shadow-xs' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}`}>
                    <item.icon size={16} className={`shrink-0 ${active ? 'text-primary' : ''}`} />
                    <span className="hidden truncate sm:inline">{item.title}</span><span className="truncate sm:hidden">{item.short}</span>
                </button>;
            })}
        </div>

        {timeline && <div className="flex flex-wrap items-center gap-2" role="group" aria-label="시간 상태 시뮬레이션">
            <span className="mr-1 flex items-center gap-1 text-xs font-bold text-muted-foreground"><Clock size={14} /> 지금 시각</span>
            {(Object.keys(phases) as MockupPhase[]).map(key => <button key={key} type="button" aria-pressed={phase === key} className={chip(phase === key)} onClick={() => setPhase(key)}>{phases[key].label}</button>)}
            <span className="w-full text-[11px] text-muted-foreground">{phases[phase].now} 기준</span>
        </div>}

        {view === 'member' && <MemberView phase={phase} myNudge={myNudge} eta={eta} onNudge={setMyNudge} />}
        {view === 'leader' && <LeaderView phase={phase} myNudge={myNudge} eta={eta} onEta={setEta} onRegister={() => setPhase('done')} />}
        {view === 'settings' && <SettingsView />}
        {view === 'inbox' && <InboxView />}
    </div>;
}

function Banner({ tone, icon: Icon, title, children, action }: { tone: Tone; icon: LucideIcon; title: string; children: ReactNode; action?: ReactNode }) {
    return <section role={tone === 'danger' ? 'alert' : undefined} className={`rounded-2xl border p-4 shadow-2xs ${tones[tone].banner}`}>
        <div className="flex gap-3">
            <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tones[tone].icon}`}><Icon size={20} className={tone === 'danger' ? 'animate-pulse' : ''} /></div>
            <div className="min-w-0 flex-1"><p className="font-bold leading-6">{title}</p><p className="mt-1 text-sm leading-6 text-foreground/80">{children}</p></div>
        </div>
        {action && <div className="mt-3 flex flex-wrap gap-2 pl-[52px]">{action}</div>}
    </section>;
}

function DeadlineTimeline({ phase }: { phase: MockupPhase }) {
    const info = phases[phase];
    return <div className="rounded-xl border border-border/60 bg-muted/30 px-3 pb-3 pt-10">
        <div className="relative h-2 rounded-full bg-border/80">
            <div className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${tones[info.tone].bar}`} style={{ width: `${info.position}%` }} />
            <div className="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-foreground" aria-hidden="true" />
            <div className="absolute -top-9 flex -translate-x-1/2 flex-col items-center transition-all duration-500" style={{ left: `${info.position}%` }}>
                <span className="whitespace-nowrap rounded-md bg-foreground px-1.5 py-0.5 text-[10px] font-bold text-background">지금</span>
                <span className="h-3.5 w-px bg-foreground" />
            </div>
        </div>
        <div className="mt-2.5 grid grid-cols-3 gap-1 text-[11px] leading-4 text-muted-foreground">
            <p>일정 확정<br />10/11 (일)</p>
            <p className="text-center font-bold text-foreground">콘티 마감<br />10/15 (목) 22:00</p>
            <p className="text-right">예배<br />10/18 (일) 11:00</p>
        </div>
    </div>;
}

function EventHeader({ phase, part }: { phase: MockupPhase; part: string }) {
    const info = phases[phase];
    return <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5"><span className="rounded-md bg-secondary/15 px-2 py-0.5 text-xs font-bold text-secondary">{part}</span><span className="text-xs font-medium text-muted-foreground">{mockEvent.date}</span></div>
            <h2 className="mt-1 text-lg font-bold">{mockEvent.title}</h2>
            <p className="text-xs text-muted-foreground">{mockEvent.location} · 인도 {leader.name}</p>
        </div>
        <Badge variant={tones[info.tone].badge} size="default" dot pulse={phase === 'overdue'}>{info.status}</Badge>
    </header>;
}

function SetlistBlock({ phase, waiting }: { phase: MockupPhase; waiting: Nudge[] }) {
    if (phase === 'done') return <div className="space-y-2 rounded-xl border border-primary/25 bg-primary/5 p-3.5">
        <div className="flex flex-wrap items-center gap-2"><ListMusic size={16} className="text-primary" /><span className="text-sm font-bold">{mockEvent.title} 콘티</span><span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">{songs.length}곡</span><span className="text-[11px] text-muted-foreground">10/16 (금) 13:10 등록</span></div>
        <div className="flex flex-wrap gap-1.5">{songs.map((song, index) => <span key={song} className="rounded-md border border-border/80 bg-background px-2 py-0.5 text-xs font-medium">{index + 1}. {song}</span>)}</div>
    </div>;
    return <div className="space-y-3 rounded-xl border border-dashed border-border/80 bg-muted/20 p-3.5">
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><ListMusic size={16} /> 아직 등록된 콘티가 없습니다.</p>
        {waiting.length > 0 && <div className="flex items-center gap-2.5">
            <div className="flex -space-x-2">{waiting.slice(0, 4).map(item => <Avatar key={item.id} name={item.anonymous ? '?' : item.name.slice(0, 1)} title={item.name} size="xs" className="ring-2 ring-card" />)}</div>
            <p className="text-xs font-semibold"><span className="text-destructive">{waiting.length}명</span>이 콘티를 기다리고 있어요</p>
        </div>}
    </div>;
}

function MemberView({ phase, myNudge, eta, onNudge }: { phase: MockupPhase; myNudge: { message: string; anonymous: boolean } | null; eta: string | null; onNudge: (nudge: { message: string; anonymous: boolean } | null) => void }) {
    const composer = useRef<HTMLDivElement>(null);
    const waiting = phase === 'overdue' ? [...otherNudges, ...(myNudge ? [{ id: 'me', name: myNudge.anonymous ? '팀원 1명' : me.name, part: me.part, message: myNudge.message, time: '방금', anonymous: myNudge.anonymous }] : [])] : [];
    const etaOption = etaOptions.find(option => option.id === eta);
    const openComposer = () => composer.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    return <div className="space-y-4">
        {phase === 'before' && <Banner tone="calm" icon={CalendarClock} title={`콘티는 ${mockEvent.deadline}까지 올라와요`}>마감이 지나도 콘티가 없으면 알려드리고, 인도자에게 요청할 수 있는 버튼이 열려요.</Banner>}
        {phase === 'soon' && <Banner tone="warn" icon={Hourglass} title="콘티 마감 2시간 전이에요">인도자에게 마감 알림이 자동으로 전송됐어요. 조금만 기다려 주세요.</Banner>}
        {phase === 'overdue' && <Banner tone="danger" icon={AlarmClock} title="콘티 마감 시간이 14시간 지났어요" action={!myNudge && <button type="button" className={`${button} border-destructive/30 text-destructive`} onClick={openComposer}><Hand size={14} /> 인도자에게 요청하기</button>}>{mockEvent.title} 콘티가 아직 등록되지 않았어요. 인도자에게 정중하게 요청할 수 있어요.</Banner>}
        {phase === 'done' && <Banner tone="ok" icon={CircleCheck} title={`콘티가 올라왔어요 · ${songs.length}곡`} action={<Link href="/dashboard/songs" className={button}><ListMusic size={14} /> 콘티 보기</Link>}>{myNudge ? '보낸 요청은 자동으로 완료 처리됐어요. ' : ''}연습을 시작해 보세요.</Banner>}

        <article className="space-y-3 rounded-2xl border border-border/70 bg-card p-4 shadow-xs sm:p-5">
            <EventHeader phase={phase} part={`내 사역 · ${me.part}`} />
            <DeadlineTimeline phase={phase} />
            <SetlistBlock phase={phase} waiting={waiting} />
            {phase === 'overdue' && etaOption && <div className="rounded-xl border border-primary/25 bg-background p-3.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Avatar name={leader.name.slice(0, 1)} title={leader.name} size="xs" roleVariant="leader" /><span className="font-bold text-foreground">{leader.name} 인도자 답변</span><span>방금</span></div>
                <p className="mt-2 font-bold">“{etaOption.label}”</p>
                <p className="mt-1 text-xs text-muted-foreground">예정 {etaOption.until} · 그때까지는 추가 요청 없이 기다려 주세요.</p>
            </div>}
        </article>

        <div ref={composer}>
            {(phase === 'before' || phase === 'soon') && <section className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
                <button type="button" disabled className={`${primaryButton} w-full`}><Hand size={16} /> 인도자에게 콘티 요청하기</button>
                <p className="mt-2.5 text-xs leading-5 text-muted-foreground">마감({mockEvent.deadline}) 이후에 요청할 수 있어요. 마감 전에는 인도자가 준비할 시간을 존중해 주세요. 궁금한 점은 <Link href="/dashboard/planning?tab=requests" className="font-semibold text-primary underline-offset-2 hover:underline">요청함</Link>에 질문으로 남길 수 있어요.</p>
            </section>}
            {phase === 'overdue' && (myNudge ? <SentNudge nudge={myNudge} onCancel={() => onNudge(null)} /> : <NudgeComposer onSend={onNudge} />)}
        </div>

        <section className="rounded-2xl border border-border/60 bg-muted/30 p-4">
            <h3 className="text-sm font-bold">요청은 이렇게 전달돼요</h3>
            <ol className="mt-2 space-y-1.5 text-xs leading-5 text-muted-foreground">
                <li><b className="text-foreground">1.</b> 여러 팀원의 요청은 묶어서 인도자에게 한 번에 전달돼요.</li>
                <li><b className="text-foreground">2.</b> 인도자가 예정 시간을 답하면 기다리는 팀원 모두에게 공유돼요.</li>
                <li><b className="text-foreground">3.</b> 콘티가 등록되면 보낸 요청은 자동으로 완료돼요.</li>
            </ol>
        </section>
    </div>;
}

function NudgeComposer({ onSend }: { onSend: (nudge: { message: string; anonymous: boolean }) => void }) {
    const [preset, setPreset] = useState(presets[0]);
    const [extra, setExtra] = useState('');
    const [anonymous, setAnonymous] = useState(false);
    return <section className="space-y-4 rounded-2xl border-2 border-primary/30 bg-card p-4 shadow-xs sm:p-5">
        <div>
            <h3 className="flex items-center gap-2 font-bold"><MessageCircleHeart size={18} className="text-primary" /> {leader.name} 인도자님께 콘티 요청</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">다른 팀원의 요청과 묶여서 한 번에 전달돼요.</p>
        </div>
        <fieldset>
            <legend className="mb-2 text-xs font-bold text-muted-foreground">보낼 말 고르기</legend>
            <div className="flex flex-wrap gap-1.5">{presets.map(item => <button key={item} type="button" aria-pressed={preset === item} className={chip(preset === item)} onClick={() => setPreset(item)}>{item}</button>)}</div>
        </fieldset>
        <label className="block text-xs font-bold text-muted-foreground">덧붙일 말 (선택)
            <textarea value={extra} onChange={event => setExtra(event.target.value)} rows={2} maxLength={200} placeholder="예: 토요일 연습 전에 키를 맞춰 보고 싶어요." className="mt-2 w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal text-foreground" />
        </label>
        <Toggle checked={anonymous} onChange={setAnonymous} icon={EyeOff} label="이름 숨기고 보내기" help="인도자에게 ‘팀원 1명’으로 표시돼요." />
        <button type="button" className={`${primaryButton} w-full`} onClick={() => onSend({ message: extra.trim() ? `${preset} ${extra.trim()}` : preset, anonymous })}><Send size={16} /> 요청 보내기</button>
        <p className="text-center text-[11px] text-muted-foreground">같은 콘티에는 3시간에 한 번 요청할 수 있어요.</p>
    </section>;
}

function SentNudge({ nudge, onCancel }: { nudge: { message: string; anonymous: boolean }; onCancel: () => void }) {
    return <section className="animate-success-bounce space-y-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 sm:p-5">
        <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-300"><CircleCheck size={18} /> 요청을 보냈어요</div>
        <p className="rounded-xl bg-background/80 p-3 text-sm leading-6">“{nudge.message}”<span className="mt-1 block text-xs text-muted-foreground">{nudge.anonymous ? '이름 숨김 · ' : ''}12:00 보냄 · 인도자 확인 전</span></p>
        <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground"><Clock size={13} /> 15:00부터 다시 요청할 수 있어요</span>
            <button type="button" className={button} onClick={onCancel}><Undo2 size={14} /> 요청 취소</button>
        </div>
    </section>;
}

function LeaderView({ phase, myNudge, eta, onEta, onRegister }: { phase: MockupPhase; myNudge: { message: string; anonymous: boolean } | null; eta: string | null; onEta: (eta: string | null) => void; onRegister: () => void }) {
    const nudges: Nudge[] = phase === 'overdue' || phase === 'done' ? [...otherNudges, ...(myNudge ? [{ id: 'me', name: myNudge.anonymous ? '팀원 1명' : me.name, part: myNudge.anonymous ? '이름 숨김' : me.part, message: myNudge.message, time: '방금', anonymous: myNudge.anonymous }] : [])] : [];
    const etaOption = etaOptions.find(option => option.id === eta);
    return <div className="space-y-4">
        {phase === 'before' && <Banner tone="calm" icon={CalendarClock} title="콘티 마감까지 1일 6시간 남았어요">{mockEvent.deadline}까지 {mockEvent.title} 콘티를 등록해 주세요. 마감 24시간 전과 3시간 전에 다시 알려드려요.</Banner>}
        {phase === 'soon' && <Banner tone="warn" icon={Hourglass} title="콘티 마감 2시간 전이에요">배정된 팀원 6명이 콘티를 기다리고 있어요. 곡 제목만 먼저 올려도 팀원들이 연습을 시작할 수 있어요.</Banner>}
        {phase === 'overdue' && <Banner tone="danger" icon={AlarmClock} title="콘티 마감이 14시간 지났어요">팀원 {nudges.length}명이 콘티를 요청했어요. 예정 시간을 알려주면 기다리는 팀원 모두에게 전달돼요.</Banner>}
        {phase === 'done' && <Banner tone="ok" icon={CircleCheck} title="콘티를 등록했어요">배정된 팀원 6명에게 알림을 보냈고, 받은 요청 {nudges.length}건은 자동으로 완료됐어요.</Banner>}

        <article className="space-y-3 rounded-2xl border border-border/70 bg-card p-4 shadow-xs sm:p-5">
            <EventHeader phase={phase} part="인도" />
            <DeadlineTimeline phase={phase} />
            <SetlistBlock phase={phase} waiting={[]} />
            {phase !== 'done' && <div className="flex flex-col gap-2 sm:flex-row">
                <button type="button" className={`${primaryButton} flex-1`} onClick={onRegister}><ListMusic size={16} /> 지금 콘티 등록하기</button>
                <button type="button" className={`${button} min-h-12 flex-1 text-sm`} onClick={onRegister}>곡 제목만 먼저 올리기</button>
            </div>}
            {phase !== 'done' && <p className="text-[11px] text-muted-foreground">목업에서는 누르면 ‘콘티 등록됨’ 상태로 바뀝니다.</p>}
        </article>

        {phase === 'overdue' && <section className="space-y-3 rounded-2xl border border-border/70 bg-card p-4 shadow-xs sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 font-bold"><BellRing size={18} className="text-destructive" /> 콘티를 기다리는 팀원 <span className="text-destructive">{nudges.length}</span></h3>
                <span className="text-[11px] text-muted-foreground">알림은 3시간마다 묶어서 받아요</span>
            </div>
            <ul className="divide-y divide-border/60">{nudges.map(item => <li key={item.id} className="flex gap-3 py-2.5">
                <Avatar name={item.anonymous ? '?' : item.name} size="sm" />
                <div className="min-w-0 flex-1">
                    <p className="text-xs"><b className="text-sm">{item.name}</b> <span className="text-muted-foreground">· {item.part} · {item.time}</span></p>
                    <p className="mt-0.5 break-words text-sm text-foreground/90">“{item.message}”</p>
                </div>
            </li>)}</ul>
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5">
                <p className="text-sm font-bold">예정 시간 알려주기</p>
                <p className="mt-0.5 text-xs text-muted-foreground">기다리는 팀원 모두에게 전달되고, 그 시간까지 추가 마감 알림을 멈춰요.</p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">{etaOptions.map(option => <button key={option.id} type="button" aria-pressed={eta === option.id} className={chip(eta === option.id)} onClick={() => onEta(eta === option.id ? null : option.id)}>{option.label}</button>)}</div>
                {etaOption && <p role="status" className="mt-2.5 flex items-start gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400"><CircleCheck size={14} className="mt-0.5 shrink-0" /> 팀원 {nudges.length}명에게 ‘{etaOption.label}’를 전달했어요 · {etaOption.until}까지 알림 일시 중지</p>}
            </div>
        </section>}

        <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-xs sm:p-5">
            <h3 className="flex items-center gap-2 font-bold"><CalendarClock size={18} className="text-primary" /> 다가오는 콘티 마감</h3>
            <ul className="mt-2 divide-y divide-border/60">
                {[
                    { title: mockEvent.title, date: '10/18 (일) 11:00', deadline: '10/15 (목) 22:00', badge: <Badge variant={tones[phases[phase].tone].badge} size="sm">{phases[phase].status}</Badge> },
                    { title: '수요 찬양예배', date: '10/21 (수) 19:30', deadline: '10/19 (월) 22:00', badge: <Badge variant="subtle" size="sm">준비 중</Badge> },
                    { title: mockEvent.title, date: '10/25 (일) 11:00', deadline: '10/22 (목) 22:00', badge: <Badge variant="subtle" size="sm">준비 중</Badge> },
                ].map(item => <li key={item.date} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0"><p className="text-sm font-bold">{item.title} <span className="font-medium text-muted-foreground">{item.date}</span></p><p className="text-xs text-muted-foreground">마감 {item.deadline}</p></div>
                    {item.badge}
                </li>)}
            </ul>
        </section>
    </div>;
}

function Toggle({ checked, onChange, icon: Icon, label, help, children }: { checked: boolean; onChange: (value: boolean) => void; icon?: LucideIcon; label: string; help?: string; children?: ReactNode }) {
    return <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-sm font-semibold">{Icon && <Icon size={15} className="shrink-0 text-muted-foreground" />}{label}</p>
            {help && <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{help}</p>}
            {children}
        </div>
        <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-border'}`}>
            <span className={`absolute top-1 size-5 rounded-full bg-card shadow-xs transition-all ${checked ? 'left-6' : 'left-1'}`} />
        </button>
    </div>;
}

const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
// 이번 주 예배(10월 18일 일요일) 기준으로 마감 시각 예시를 계산합니다.
const deadlineExample = (daysBefore: number, time: string) => `10월 ${18 - daysBefore}일 (${weekdays[(7 - (daysBefore % 7)) % 7]}) ${time}`;
const deadlinePresets = [
    { id: 'd3', label: '예배 3일 전 22:00', days: 3, time: '22:00' },
    { id: 'd2', label: '예배 2일 전 21:00', days: 2, time: '21:00' },
    { id: 'w1', label: '예배 1주 전 23:59', days: 7, time: '23:59' },
    { id: 'custom', label: '직접 정하기', days: 0, time: '' },
];
const beforeOptions = ['24시간 전', '3시간 전', '1시간 전', '마감 시각'];
const select = 'min-h-10 rounded-xl border border-input bg-background px-2.5 text-sm font-semibold text-foreground';

function SettingsView() {
    const [preset, setPreset] = useState('d3');
    const [customDays, setCustomDays] = useState(4);
    const [customTime, setCustomTime] = useState('20:00');
    const [before, setBefore] = useState<string[]>(['24시간 전', '3시간 전']);
    const [notifyLeader, setNotifyLeader] = useState(true);
    const [notifyDuty, setNotifyDuty] = useState(true);
    const [escalate, setEscalate] = useState(true);
    const [escalateHours, setEscalateHours] = useState(12);
    const [allowEarly, setAllowEarly] = useState(false);
    const [cooldown, setCooldown] = useState(3);
    const [anonymous, setAnonymous] = useState(true);
    const [quiet, setQuiet] = useState(true);
    const chosen = deadlinePresets.find(item => item.id === preset)!;
    const days = preset === 'custom' ? customDays : chosen.days;
    const time = preset === 'custom' ? customTime : chosen.time;
    const example = deadlineExample(days, time);

    return <div className="space-y-4">
        <section className="space-y-3 rounded-2xl border border-border/70 bg-card p-4 shadow-xs sm:p-5">
            <h3 className="flex items-center gap-2 font-bold"><CalendarClock size={18} className="text-primary" /> 콘티 마감 기준</h3>
            <div className="flex flex-wrap gap-1.5">{deadlinePresets.map(item => <button key={item.id} type="button" aria-pressed={preset === item.id} className={chip(preset === item.id)} onClick={() => setPreset(item.id)}>{item.label}</button>)}</div>
            {preset === 'custom' && <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">예배
                <select className={select} value={customDays} onChange={event => setCustomDays(Number(event.target.value))}>{[1, 2, 3, 4, 5, 6, 7].map(day => <option key={day} value={day}>{day}일 전</option>)}</select>
                <input type="time" className={select} value={customTime} onChange={event => setCustomTime(event.target.value)} />까지
            </div>}
            <p className="rounded-xl bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">이번 주 <b className="text-foreground">{mockEvent.title}</b>(10/18 일 11:00)이라면<br />콘티 마감은 <b className="text-primary">{example}</b>이에요. 일정마다 따로 바꿀 수도 있어요.</p>
        </section>

        <section className="space-y-3 rounded-2xl border border-border/70 bg-card p-4 shadow-xs sm:p-5">
            <h3 className="flex items-center gap-2 font-bold"><Hourglass size={18} className="text-amber-600 dark:text-amber-400" /> 마감 전 인도자에게 미리 알림</h3>
            <div className="flex flex-wrap gap-1.5">{beforeOptions.map(item => <button key={item} type="button" aria-pressed={before.includes(item)} className={chip(before.includes(item))} onClick={() => setBefore(current => current.includes(item) ? current.filter(value => value !== item) : [...current, item])}>{item}</button>)}</div>
        </section>

        <section className="space-y-4 rounded-2xl border border-border/70 bg-card p-4 shadow-xs sm:p-5">
            <h3 className="flex items-center gap-2 font-bold"><AlarmClock size={18} className="text-destructive" /> 마감이 지나면</h3>
            <Toggle checked={notifyLeader} onChange={setNotifyLeader} icon={BellRing} label="인도자에게 긴급 알림" help="‘콘티 마감 시간이 지났어요’ 알림과 상단 배너를 띄워요." />
            <Toggle checked={notifyDuty} onChange={setNotifyDuty} icon={UsersRound} label="배정된 팀원에게 미등록 안내" help="팀원 화면에 ‘인도자에게 요청하기’ 버튼이 열려요." />
            <Toggle checked={escalate} onChange={setEscalate} icon={ShieldAlert} label="팀 관리자에게도 알림" help="오래 미등록이면 관리자가 인도자와 연락할 수 있게 해요.">
                {escalate && <label className="mt-2 flex items-center gap-2 text-xs font-semibold">마감 후
                    <select className={select} value={escalateHours} onChange={event => setEscalateHours(Number(event.target.value))}>{[6, 12, 24].map(hour => <option key={hour} value={hour}>{hour}시간</option>)}</select>
                    지나도 없으면
                </label>}
            </Toggle>
        </section>

        <section className="space-y-4 rounded-2xl border border-border/70 bg-card p-4 shadow-xs sm:p-5">
            <h3 className="flex items-center gap-2 font-bold"><Hand size={18} className="text-primary" /> 팀원 요청(독촉) 규칙</h3>
            <Toggle checked={allowEarly} onChange={setAllowEarly} label="마감 전에도 요청 허용" help="끄면 마감이 지난 뒤에만 요청 버튼이 열려요." />
            <div className="flex items-center justify-between gap-3">
                <div><p className="text-sm font-semibold">같은 팀원 재요청 간격</p><p className="text-xs text-muted-foreground">인도자에게 가는 알림도 이 간격으로 묶여요.</p></div>
                <select className={select} value={cooldown} onChange={event => setCooldown(Number(event.target.value))}>{[1, 3, 6].map(hour => <option key={hour} value={hour}>{hour}시간</option>)}</select>
            </div>
            <Toggle checked={anonymous} onChange={setAnonymous} icon={EyeOff} label="이름 숨김 요청 허용" help="인도자에게 ‘팀원 1명’으로 표시돼요. 관리자도 이름을 볼 수 없어요." />
            <Toggle checked={quiet} onChange={setQuiet} icon={Moon} label="밤 시간 알림 모아두기" help="23:00–07:00 사이 요청은 아침 7시에 한 번에 전달해요." />
        </section>

        <section className="rounded-2xl border border-primary/25 bg-primary/5 p-4 sm:p-5">
            <h3 className="text-sm font-bold">이렇게 동작해요</h3>
            <ul className="mt-2 space-y-1.5 text-xs leading-5 text-foreground/85">
                <li>• 콘티 마감 <b>{example}</b></li>
                <li>• 인도자 미리 알림: {before.length ? beforeOptions.filter(item => before.includes(item)).join(', ') : '보내지 않음'}</li>
                <li>• 마감 후: {[notifyLeader && '인도자 긴급 알림', notifyDuty && '팀원 요청 버튼 열림', escalate && `${escalateHours}시간 뒤 관리자 알림`].filter(Boolean).join(' · ') || '추가 알림 없음'}</li>
                <li>• 팀원 요청: {allowEarly ? '마감 전부터' : '마감 후부터'} · {cooldown}시간 간격{anonymous ? ' · 이름 숨김 가능' : ''}{quiet ? ' · 밤 시간 모아서 전달' : ''}</li>
            </ul>
            <button type="button" disabled className={`${primaryButton} mt-4 w-full sm:w-auto`}>설정 저장 (목업)</button>
        </section>
    </div>;
}

const inboxGroups: { audience: string; icon: LucideIcon; items: { title: string; body: string; time: string; urgent?: boolean; action?: string }[] }[] = [
    {
        audience: '인도자가 받는 알림', icon: Megaphone, items: [
            { title: '콘티 마감 24시간 전이에요', body: `${mockEvent.title} 콘티를 ${mockEvent.deadline}까지 등록해 주세요.`, time: '10월 14일 (수) 22:00', action: '콘티 등록' },
            { title: '콘티 마감 3시간 전이에요', body: `${mockEvent.title} · 배정된 팀원 6명이 기다리고 있어요. 곡 제목만 먼저 올려도 좋아요.`, time: '10월 15일 (목) 19:00', action: '콘티 등록' },
            { urgent: true, title: '콘티 마감 시간이 지났어요', body: `${mockEvent.title} 콘티가 아직 없어요. 예정 시간을 알려주면 팀원들이 덜 기다려요.`, time: '10월 15일 (목) 22:00', action: '예정 시간 알리기' },
            { title: '박건반 외 2명이 콘티를 요청했어요', body: '“곡 제목만 먼저 알려주셔도 좋아요” 외 2개 · 3시간 동안 받은 요청을 묶었어요.', time: '10월 16일 (금) 12:00', action: '요청 보기' },
        ],
    },
    {
        audience: '팀원이 받는 알림', icon: UsersRound, items: [
            { title: '아직 콘티가 올라오지 않았어요', body: `${mockEvent.title} 콘티 마감(${mockEvent.deadline})이 지났어요. 인도자에게 요청할 수 있어요.`, time: '10월 15일 (목) 22:00', action: '인도자에게 요청' },
            { title: '인도자 답변 · 오늘 밤 안에 올릴게요', body: `${leader.name} · ${mockEvent.title} 콘티 예정 시간 오늘 23:59`, time: '10월 16일 (금) 12:05' },
            { title: `콘티가 올라왔어요 · ${songs.length}곡`, body: `${mockEvent.title} · 보낸 요청은 자동으로 완료됐어요.`, time: '10월 16일 (금) 13:10', action: '콘티 보기' },
        ],
    },
    {
        audience: '팀 관리자가 받는 알림', icon: ShieldAlert, items: [
            { urgent: true, title: '콘티 미등록 12시간 경과', body: `${mockEvent.title} · 인도 ${leader.name} · 팀원 요청 3건. 인도자와 연락해 주세요.`, time: '10월 16일 (금) 10:00', action: '일정 보기' },
        ],
    },
];

function InboxView() {
    return <div className="space-y-5">
        {inboxGroups.map(group => <section key={group.audience} className="space-y-2.5">
            <h3 className="flex items-center gap-2 text-sm font-bold"><group.icon size={16} className="text-primary" /> {group.audience}</h3>
            {group.items.map(item => <article key={item.title} className={`rounded-xl border p-4 ${item.urgent ? 'border-destructive/30 bg-destructive/5' : 'border-border/60 bg-card'}`}>
                <p className="font-bold">{item.urgent && <span className="text-destructive">긴급 · </span>}{item.title}</p>
                <p className="mt-1.5 text-sm leading-6 text-foreground/90">{item.body}</p>
                <p className="mt-1.5 text-xs text-muted-foreground">{item.time} · 미확인</p>
                <div className="mt-3 flex flex-wrap gap-2">{item.action && <button type="button" className={button}>{item.action}</button>}<button type="button" className={button}>확인</button></div>
            </article>)}
        </section>)}
        <section className="rounded-2xl border border-dashed border-border bg-muted/30 p-4 text-xs leading-5 text-muted-foreground">
            <p className="flex items-center gap-1.5 text-sm font-bold text-foreground"><BellRing size={15} /> 알림 전달 방식</p>
            <p className="mt-1.5">앱이 열려 있으면 지금처럼 ‘내 알림’, 메뉴 배지, 상단 배너로 바로 보여요.</p>
            <p>앱을 닫은 상태에서 받으려면 웹 푸시나 카카오 알림톡 연동이 추가로 필요해요.</p>
        </section>
    </div>;
}
