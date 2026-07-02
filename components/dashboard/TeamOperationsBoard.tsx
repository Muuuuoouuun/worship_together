"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import GlassCard from '@/components/ui/GlassCard';
import {
    AlertCircle,
    ArrowRight,
    Bell,
    BookOpenCheck,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Gauge,
    ListMusic,
    Megaphone,
    MessageSquareText,
    Mic2,
    Music2,
    Radio,
    Send,
    Sparkles,
    UsersRound,
    type LucideIcon,
} from 'lucide-react';
import {
    phaseDescriptions,
    phaseLabels,
    worshipPrototypeTeams,
    type NotificationKind,
    type ReadinessState,
    type TaskState,
    type WorshipPhase,
    type WorshipTeamSnapshot,
} from '@/lib/prototypeData';

interface TeamOperationsBoardProps {
    currentSessionId?: string;
    libraryHref?: string;
}

const taskStateMeta: Record<TaskState, { label: string; className: string; icon: LucideIcon }> = {
    done: {
        label: '완료',
        className: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700',
        icon: CheckCircle2,
    },
    active: {
        label: '진행',
        className: 'border-secondary/25 bg-secondary/10 text-secondary',
        icon: Sparkles,
    },
    waiting: {
        label: '대기',
        className: 'border-amber-500/20 bg-amber-500/10 text-amber-700',
        icon: AlertCircle,
    },
};

const readinessMeta: Record<ReadinessState, { label: string; className: string; dotClassName: string }> = {
    ready: {
        label: '준비 완료',
        className: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700',
        dotClassName: 'bg-emerald-500',
    },
    checking: {
        label: '확인 중',
        className: 'border-amber-500/20 bg-amber-500/10 text-amber-700',
        dotClassName: 'bg-amber-500',
    },
    'needs-help': {
        label: '도움 필요',
        className: 'border-red-500/20 bg-red-500/10 text-red-600',
        dotClassName: 'bg-red-500',
    },
};

const notificationIcon: Record<NotificationKind, LucideIcon> = {
    score: BookOpenCheck,
    notice: Megaphone,
    cue: Radio,
    community: MessageSquareText,
};

const cueButtons = [
    { label: '느려요!', message: '템포를 살짝 내려주세요.' },
    { label: '빨라요!', message: '템포를 살짝 올려주세요.' },
    { label: '브릿지', message: '브릿지로 이동합니다.' },
    { label: '다음 섹션', message: '다음 섹션 준비해주세요.' },
];

export default function TeamOperationsBoard({
    currentSessionId,
    libraryHref = '/dashboard/songs',
}: TeamOperationsBoardProps) {
    const [selectedTeamId, setSelectedTeamId] = useState(worshipPrototypeTeams[0]?.id ?? '');
    const selectedTeam = useMemo(
        () => worshipPrototypeTeams.find((team) => team.id === selectedTeamId) ?? worshipPrototypeTeams[0]!,
        [selectedTeamId]
    );
    const [selectedPhase, setSelectedPhase] = useState<WorshipPhase>(selectedTeam.activePhase);
    const [currentPage, setCurrentPage] = useState(selectedTeam.live.page);
    const [currentBpm, setCurrentBpm] = useState(selectedTeam.live.bpm);
    const [sentCues, setSentCues] = useState<string[]>(selectedTeam.live.cues);

    useEffect(() => {
        setSelectedPhase(selectedTeam.activePhase);
        setCurrentPage(selectedTeam.live.page);
        setCurrentBpm(selectedTeam.live.bpm);
        setSentCues(selectedTeam.live.cues);
    }, [selectedTeam]);

    const activeWorkflow = selectedTeam.workflow[selectedPhase];
    const totalChecks = selectedTeam.readiness.reduce((sum, section) => sum + section.checksTotal, 0);
    const doneChecks = selectedTeam.readiness.reduce((sum, section) => sum + section.checksDone, 0);
    const readinessPercent = totalChecks ? Math.round((doneChecks / totalChecks) * 100) : 0;
    const liveHref = currentSessionId ? `/session/${currentSessionId}` : '/dashboard';
    const currentSong = selectedTeam.setlist[0];
    const maxPages = Math.max(...selectedTeam.setlist.map((song) => song.pages), currentPage);

    const handleTeamSelect = (team: WorshipTeamSnapshot) => {
        setSelectedTeamId(team.id);
    };

    const handleCueSend = (message: string) => {
        setSentCues((current) => [`방금: ${message}`, ...current].slice(0, 5));
    };

    return (
        <div className="mx-auto flex max-w-7xl flex-col gap-6">
            <section className="grid gap-5 xl:grid-cols-[1.28fr_0.72fr]">
                <GlassCard className="overflow-hidden border-primary/10 bg-primary p-0 text-surface">
                    <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[0.95fr_1.05fr] lg:p-8">
                        <div className="flex min-w-0 flex-col justify-between gap-8">
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-md bg-surface/12 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-surface/70">
                                        Worship Together
                                    </span>
                                    <span className="rounded-md bg-secondary px-3 py-1 text-xs font-bold text-surface">
                                        프로토타입 운영판
                                    </span>
                                </div>
                                <h1 className="mt-5 text-3xl font-serif font-black leading-tight tracking-tight sm:text-4xl md:text-5xl">
                                    팀별 예배 전, 중, 후 업무를 한 화면에서 끝냅니다.
                                </h1>
                                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-surface/72 md:text-base">
                                    콘티 생성과 공유, 세션 준비, 악보와 공지 알림, 라이브 큐, 예배 후 말씀과 묵상 나눔을 팀 단위로 묶은 앱/웹 프로토타입입니다.
                                </p>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-3">
                                {worshipPrototypeTeams.map((team) => {
                                    const selected = team.id === selectedTeam.id;

                                    return (
                                        <button
                                            key={team.id}
                                            type="button"
                                            onClick={() => handleTeamSelect(team)}
                                            aria-pressed={selected}
                                            className={`rounded-md border px-4 py-3 text-left transition ${
                                                selected
                                                    ? 'border-surface/40 bg-surface text-primary shadow-lg'
                                                    : 'border-surface/15 bg-surface/8 text-surface hover:bg-surface/14'
                                            }`}
                                        >
                                            <p className="text-xs font-bold uppercase tracking-[0.18em] opacity-55">
                                                {team.groupLabel}
                                            </p>
                                            <p className="mt-2 text-sm font-bold">{team.name}</p>
                                            <p className="mt-1 text-xs opacity-65">{team.serviceTime}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="rounded-md border border-surface/15 bg-surface/10 p-4 backdrop-blur-md sm:p-5">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-surface/55">오늘의 예배</p>
                                    <h2 className="mt-2 text-2xl font-serif font-black text-surface sm:text-3xl">
                                        {selectedTeam.serviceName}
                                    </h2>
                                    <p className="mt-2 text-sm leading-relaxed text-surface/68">
                                        {selectedTeam.location} | {selectedTeam.leader} | {selectedTeam.theme}
                                    </p>
                                </div>
                                <Link
                                    href={liveHref}
                                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-surface px-4 py-3 text-sm font-bold text-primary transition hover:scale-[1.01]"
                                >
                                    {currentSessionId ? '라이브 입장' : '세션 준비'}
                                    <ArrowRight size={16} />
                                </Link>
                            </div>

                            <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                                <HeroMetric label="준비율" value={`${readinessPercent}%`} detail={`${doneChecks}/${totalChecks} 체크`} />
                                <HeroMetric label="콘티" value={`${selectedTeam.setlist.length}곡`} detail="악보/BPM 포함" />
                                <HeroMetric label="다음 할 일" value="1개" detail={selectedTeam.nextAction} />
                            </div>

                            <div className="mt-5 overflow-hidden rounded-md border border-surface/15">
                                {selectedTeam.setlist.map((song, index) => (
                                    <div
                                        key={song.title}
                                        className="grid gap-3 border-b border-surface/10 px-4 py-3 last:border-b-0 sm:grid-cols-[2.5rem_1fr_auto]"
                                    >
                                        <span className="text-lg font-black text-secondary">{index + 1}</span>
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-bold text-surface">{song.title}</p>
                                            <p className="mt-1 text-xs text-surface/58">
                                                {song.key} | {song.bpm} BPM | {song.pages}p
                                            </p>
                                        </div>
                                        <p className="text-xs leading-relaxed text-surface/68 sm:max-w-44 sm:text-right">
                                            {song.sectionCue}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </GlassCard>

                <GlassCard className="border-primary/10 bg-white/70 p-5">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/35">악보와 공지사항</p>
                            <h2 className="mt-2 text-2xl font-serif font-black text-primary">알림 센터</h2>
                        </div>
                        <div className="flex h-11 w-11 items-center justify-center rounded-md bg-secondary/10 text-secondary">
                            <Bell size={19} />
                        </div>
                    </div>

                    <div className="mt-5 space-y-3">
                        {selectedTeam.notifications.map((notification) => {
                            const Icon = notificationIcon[notification.kind];

                            return (
                                <div
                                    key={`${notification.kind}-${notification.title}`}
                                    className={`rounded-md border px-4 py-3 ${
                                        notification.urgent
                                            ? 'border-red-500/20 bg-red-500/10'
                                            : 'border-primary/10 bg-background/65'
                                    }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/75 text-primary/65">
                                            <Icon size={16} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-primary">{notification.title}</p>
                                            <p className="mt-1 text-xs leading-relaxed text-primary/55">{notification.detail}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-5 grid gap-3">
                        {selectedTeam.stats.map((stat) => (
                            <div
                                key={stat.label}
                                className="grid grid-cols-[5.5rem_1fr] items-center gap-3 rounded-md border border-primary/10 bg-white/65 px-4 py-3"
                            >
                                <div>
                                    <p className="text-[11px] font-bold uppercase text-primary/35">{stat.label}</p>
                                    <p className="mt-1 text-xl font-serif font-black text-primary">{stat.value}</p>
                                </div>
                                <p className="text-xs leading-relaxed text-primary/55">{stat.detail}</p>
                            </div>
                        ))}
                    </div>
                </GlassCard>
            </section>

            <section className="grid gap-6 xl:grid-cols-[0.86fr_1.14fr]">
                <GlassCard className="border-primary/10 bg-white/68 p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/35">예배 흐름</p>
                            <h2 className="mt-2 text-2xl font-serif font-black text-primary">전, 중, 후 업무 보드</h2>
                            <p className="mt-2 text-sm leading-relaxed text-primary/55">
                                {phaseDescriptions[selectedPhase]}
                            </p>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {(Object.keys(phaseLabels) as WorshipPhase[]).map((phase) => {
                                const selected = phase === selectedPhase;

                                return (
                                    <button
                                        key={phase}
                                        type="button"
                                        onClick={() => setSelectedPhase(phase)}
                                        aria-pressed={selected}
                                        className={`rounded-md border px-3 py-2 text-sm font-bold transition ${
                                            selected
                                                ? 'border-primary bg-primary text-surface'
                                                : 'border-primary/10 bg-white/70 text-primary/60 hover:bg-white hover:text-primary'
                                        }`}
                                    >
                                        {phaseLabels[phase]}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="mt-5 space-y-3">
                        {activeWorkflow.map((task) => {
                            const meta = taskStateMeta[task.state];
                            const Icon = meta.icon;

                            return (
                                <div key={task.title} className="rounded-md border border-primary/10 bg-background/65 px-4 py-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="text-sm font-bold text-primary">{task.title}</h3>
                                                <span className="text-xs text-primary/35">{task.owner}</span>
                                            </div>
                                            <p className="mt-2 text-sm leading-relaxed text-primary/55">{task.detail}</p>
                                        </div>
                                        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-bold ${meta.className}`}>
                                            <Icon size={13} />
                                            {meta.label}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <Link
                            href={libraryHref}
                            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-bold text-surface transition hover:scale-[1.01]"
                        >
                            <ListMusic size={16} />
                            콘티 생성/공유
                        </Link>
                        <Link
                            href="/community"
                            className="inline-flex items-center justify-center gap-2 rounded-md border border-primary/10 bg-white/75 px-4 py-3 text-sm font-bold text-primary transition hover:bg-white"
                        >
                            <MessageSquareText size={16} />
                            묵상 공유
                        </Link>
                    </div>
                </GlassCard>

                <GlassCard className="border-primary/10 bg-white/68 p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/35">세션 준비</p>
                            <h2 className="mt-2 text-2xl font-serif font-black text-primary">그룹별 세션 상태</h2>
                            <p className="mt-2 text-sm leading-relaxed text-primary/55">
                                인도자, 보컬, 악기, 미디어를 같은 예배팀 안에서 묶어 준비 상태와 큐를 봅니다.
                            </p>
                        </div>
                        <div className="rounded-md border border-primary/10 bg-background/75 px-4 py-3">
                            <p className="text-[11px] font-bold uppercase text-primary/35">전체 준비율</p>
                            <p className="mt-1 text-2xl font-serif font-black text-primary">{readinessPercent}%</p>
                        </div>
                    </div>

                    <div className="mt-5 overflow-hidden rounded-md border border-primary/10 bg-white/60">
                        <div className="grid grid-cols-[1.1fr_0.9fr_0.7fr_0.9fr] gap-2 border-b border-primary/10 px-4 py-3 text-[11px] font-bold uppercase text-primary/35 max-md:hidden">
                            <span>세션</span>
                            <span>멤버</span>
                            <span>체크</span>
                            <span>큐</span>
                        </div>
                        <div className="divide-y divide-primary/10">
                            {selectedTeam.readiness.map((section) => {
                                const meta = readinessMeta[section.state];

                                return (
                                    <div
                                        key={section.name}
                                        className="grid gap-3 px-4 py-4 md:grid-cols-[1.1fr_0.9fr_0.7fr_0.9fr] md:items-center"
                                    >
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${meta.dotClassName}`} />
                                                <p className="font-bold text-primary">{section.name}</p>
                                            </div>
                                            <p className="mt-1 text-xs leading-relaxed text-primary/50">{section.note}</p>
                                        </div>
                                        <p className="text-sm text-primary/65">{section.members.join(', ')}</p>
                                        <div>
                                            <span className={`inline-flex rounded-md border px-2.5 py-1.5 text-xs font-bold ${meta.className}`}>
                                                {section.checksDone}/{section.checksTotal} · {meta.label}
                                            </span>
                                        </div>
                                        <p className="text-sm leading-relaxed text-primary/60">{section.cue}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </GlassCard>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
                <GlassCard className="border-primary/10 bg-white/72 p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex items-start gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-secondary/10 text-secondary">
                                <Mic2 size={19} />
                            </div>
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/35">예배 중 도구</p>
                                <h2 className="mt-2 text-2xl font-serif font-black text-primary">라이브 컨트롤 미리보기</h2>
                                <p className="mt-2 text-sm leading-relaxed text-primary/55">
                                    악보 넘기기, 드럼 BPM, 인도자와 악기장의 버튼 알림을 로컬 상태로 바로 체험합니다.
                                </p>
                            </div>
                        </div>
                        <Link
                            href={liveHref}
                            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-bold text-surface transition hover:scale-[1.01]"
                        >
                            실제 세션 열기
                            <ArrowRight size={16} />
                        </Link>
                    </div>

                    <div className="mt-5 grid gap-4 lg:grid-cols-[0.88fr_1.12fr]">
                        <div className="rounded-md border border-primary/10 bg-background/65 p-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-bold uppercase text-primary/35">악보</p>
                                    <p className="mt-1 text-lg font-serif font-black text-primary">{currentSong?.title ?? '곡 없음'}</p>
                                </div>
                                <BookOpenCheck className="text-primary/45" size={22} />
                            </div>
                            <div className="mt-5 flex items-center justify-between gap-3">
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                                    className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-primary/10 bg-white/75 text-primary transition hover:bg-white"
                                    aria-label="이전 악보 페이지"
                                >
                                    <ChevronLeft size={18} />
                                </button>
                                <div className="min-w-0 text-center">
                                    <p className="text-[11px] font-bold uppercase text-primary/35">현재 페이지</p>
                                    <p className="mt-1 text-4xl font-serif font-black text-primary">
                                        {currentPage}
                                        <span className="ml-1 text-base font-semibold text-primary/35">/{maxPages}</span>
                                    </p>
                                    <p className="mt-1 text-sm text-primary/50">{selectedTeam.live.section}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage((page) => Math.min(maxPages, page + 1))}
                                    className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-primary/10 bg-white/75 text-primary transition hover:bg-white"
                                    aria-label="다음 악보 페이지"
                                >
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="rounded-md border border-primary/10 bg-white/65 p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-bold uppercase text-primary/35">드럼 BPM</p>
                                        <p className="mt-1 text-4xl font-serif font-black text-primary">
                                            {currentBpm}
                                            <span className="ml-1 text-base font-semibold text-primary/35">BPM</span>
                                        </p>
                                    </div>
                                    <Gauge className="text-secondary" size={25} />
                                </div>
                                <div className="mt-4 grid grid-cols-4 gap-2">
                                    {[-5, -1, 1, 5].map((delta) => (
                                        <button
                                            key={delta}
                                            type="button"
                                            onClick={() => setCurrentBpm((bpm) => Math.max(40, Math.min(220, bpm + delta)))}
                                            className="rounded-md border border-primary/10 bg-background/75 px-2 py-2 text-sm font-bold text-primary transition hover:bg-white"
                                        >
                                            {delta > 0 ? `+${delta}` : delta}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-md border border-primary/10 bg-white/65 p-4">
                                <p className="text-xs font-bold uppercase text-primary/35">버튼 알림</p>
                                <div className="mt-4 grid grid-cols-2 gap-2">
                                    {cueButtons.map((cue) => (
                                        <button
                                            key={cue.label}
                                            type="button"
                                            onClick={() => handleCueSend(cue.message)}
                                            className="inline-flex items-center justify-center gap-2 rounded-md border border-primary/10 bg-background/75 px-3 py-3 text-sm font-bold text-primary transition hover:border-secondary/30 hover:bg-secondary/10 hover:text-secondary"
                                        >
                                            <Send size={14} />
                                            {cue.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 rounded-md border border-primary/10 bg-background/65 p-4">
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-xs font-bold uppercase text-primary/35">최근 라이브 큐</p>
                            <span className="rounded-md bg-secondary/10 px-2.5 py-1 text-[11px] font-bold text-secondary">
                                {sentCues.length}개
                            </span>
                        </div>
                        <div className="mt-3 grid gap-2 md:grid-cols-3">
                            {sentCues.slice(0, 3).map((cue) => (
                                <div key={cue} className="rounded-md border border-primary/10 bg-white/68 px-3 py-3 text-sm font-semibold text-primary/70">
                                    {cue}
                                </div>
                            ))}
                        </div>
                    </div>
                </GlassCard>

                <GlassCard className="border-primary/10 bg-white/72 p-5">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/35">팀 커뮤니티</p>
                            <h2 className="mt-2 text-2xl font-serif font-black text-primary">말씀과 묵상 공유</h2>
                            <p className="mt-2 text-sm leading-relaxed text-primary/55">
                                예배가 끝난 뒤 설교, 묵상, 피드백이 같은 팀 공간에 남습니다.
                            </p>
                        </div>
                        <UsersRound className="text-primary/40" size={24} />
                    </div>

                    <div className="mt-5 space-y-3">
                        {selectedTeam.community.map((post) => (
                            <div key={`${post.type}-${post.title}`} className="rounded-md border border-primary/10 bg-background/65 p-4">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-md bg-primary/5 px-2.5 py-1 text-[11px] font-bold text-primary/55">
                                        {post.type}
                                    </span>
                                    <span className="text-xs text-primary/35">{post.author}</span>
                                </div>
                                <h3 className="mt-3 text-base font-bold text-primary">{post.title}</h3>
                                <p className="mt-2 text-sm leading-relaxed text-primary/55">{post.detail}</p>
                                <p className="mt-3 text-xs font-semibold text-secondary">{post.reactions}</p>
                            </div>
                        ))}
                    </div>

                    <Link
                        href="/community"
                        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md border border-primary/10 bg-white/75 px-4 py-3 text-sm font-bold text-primary transition hover:bg-white"
                    >
                        커뮤니티 전체 보기
                        <ArrowRight size={16} />
                    </Link>
                </GlassCard>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
                {worshipPrototypeTeams.map((team) => (
                    <GlassCard key={team.id} className="border-primary/10 bg-white/62 p-5">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary/35">
                                    {team.groupLabel}
                                </p>
                                <h3 className="mt-2 text-xl font-serif font-black text-primary">{team.name}</h3>
                            </div>
                            <Music2 className="text-primary/35" size={20} />
                        </div>
                        <p className="mt-3 text-sm leading-relaxed text-primary/55">{team.serviceName} · {team.serviceTime}</p>
                        <p className="mt-3 text-sm font-semibold text-primary">{team.nextAction}</p>
                    </GlassCard>
                ))}
            </section>
        </div>
    );
}

function HeroMetric({ detail, label, value }: { detail: string; label: string; value: string }) {
    return (
        <div className="rounded-md border border-surface/15 bg-surface/10 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-surface/50">{label}</p>
            <p className="mt-1 text-2xl font-serif font-black text-surface">{value}</p>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-surface/62">{detail}</p>
        </div>
    );
}
