'use client';

import { useId, useRef, useState } from 'react';
import { Check, ChevronDown, Plus, Send, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Select, Textarea, fieldClass } from '@/components/ui/input';
import Notice from '@/components/ui/Notice';
import { Avatar, attentionText, dashed, tabOff, tabOn } from '@/components/conti/ui';
import { pill, pillOn } from '@/components/conti/planningUi';
import {
    planningDate, requestKinds, requestStatuses,
    type PlanningCommand, type PlanningPanelProps, type SetlistRequest,
} from '@/types/planning';

type Props = PlanningPanelProps & { initialSetlist?: { id: string; title: string } };
type RunCommand = (command: PlanningCommand, message: string) => Promise<boolean>;
/** 폼 위의 작은 회색 라벨 */
const fieldLabel = 'block text-xs font-medium text-muted-foreground';
/** 펼침 행: 브라우저 기본 삼각형을 숨기고 키보드 초점은 보이게 */
const summaryRow = 'cursor-pointer list-none rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring/30 [&::-webkit-details-marker]:hidden';
const STATUS_TEXT: Record<SetlistRequest['status'], string> = {
    open: 'text-foreground/75',
    reviewing: attentionText,
    resolved: 'text-muted-foreground',
};
const kinds = Object.entries(requestKinds) as [SetlistRequest['kind'], string][];
const statuses = Object.entries(requestStatuses) as [SetlistRequest['status'], string][];
const setlistKey = (request: Pick<SetlistRequest, 'setlistId' | 'setlistTitle'>) => JSON.stringify([request.setlistId, request.setlistTitle]);
const firstLine = (text: string) => text.trim().split('\n')[0]?.trim() ?? '';

function RequestComposer({ members, initialSetlist, disabled, run }: Pick<Props, 'members' | 'initialSetlist'> & { disabled: boolean; run: RunCommand }) {
    const id = useId();
    const leaders = members.filter(member => member.permission === 'owner' || member.role === 'leader');

    return (
        <form onSubmit={async event => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            const setlistTitle = String(data.get('setlistTitle') ?? '').trim();
            const body = String(data.get('body') ?? '').trim();
            const leaderId = String(data.get('leaderId') ?? '');
            if (!setlistTitle || !body || !leaders.some(leader => leader.userId === leaderId)) return;
            const success = await run({
                type: 'request.create', setlistTitle, body, leaderId,
                setlistId: String(data.get('setlistId') ?? '').trim(),
                kind: String(data.get('kind')) as SetlistRequest['kind'],
            }, '요청을 보냈습니다. 목록에서 요청과 답글을 확인하세요.');
            if (success) form.reset();
        }} className="text-foreground">
            <h2 id={`${id}-heading`} className="text-[15px] font-semibold tracking-tight">콘티 요청 보내기</h2>
            <p id={`${id}-help`} className="mt-1 text-xs leading-5 text-muted-foreground">
                아래에 입력한 콘티 제목을 대상으로 담당 인도자에게 요청합니다. 요청이나 완료 처리는 콘티를 자동으로 수정하지 않습니다.
            </p>
            <fieldset disabled={disabled || leaders.length === 0} aria-labelledby={`${id}-heading`} aria-describedby={`${id}-help`} className="mt-4 min-w-0 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1.5">
                        <span className={fieldLabel}>요청 종류</span>
                        <Select name="kind" defaultValue="question" aria-describedby={`${id}-reminder`}>
                            {kinds.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </Select>
                    </label>
                    <label className="space-y-1.5">
                        <span className={fieldLabel}>받는 인도자 <span className="font-normal opacity-70">(필수)</span></span>
                        <Select name="leaderId" required defaultValue={leaders.length === 1 ? leaders[0].userId : ''}>
                            <option value="" disabled>인도자를 선택하세요</option>
                            {leaders.map(member => <option key={member.userId} value={member.userId}>{member.name} · {member.permission === 'owner' ? '팀 관리자' : '인도자'}</option>)}
                        </Select>
                    </label>
                </div>
                <p id={`${id}-reminder`} className="text-xs leading-5 text-muted-foreground">진행 확인 요청은 독촉이 필요한 상황에서 진행 상황을 정중하게 확인하는 요청입니다.</p>
                <div className="space-y-1.5">
                    <label className="block space-y-1.5">
                        <span className={fieldLabel}>콘티 제목 <span className="font-normal opacity-70">(필수)</span></span>
                        <input name="setlistTitle" className={fieldClass} required pattern=".*\S.*" defaultValue={initialSetlist?.title ?? ''} placeholder="예: 주일 2부 예배 콘티" />
                    </label>
                    <input type="hidden" name="setlistId" value={initialSetlist?.id ?? ''} />
                    <p id={`${id}-reference`} className="text-xs text-muted-foreground">등록되지 않은 콘티도 제목만 입력해 요청할 수 있습니다.</p>
                </div>
                <label className="block space-y-1.5">
                    <span className={fieldLabel}>요청 내용 <span className="font-normal opacity-70">(필수)</span></span>
                    <Textarea name="body" className="min-h-32 resize-y" rows={4} required placeholder="궁금한 점이나 확인·수정이 필요한 내용을 적어 주세요." onInput={event => event.currentTarget.setCustomValidity(event.currentTarget.value.trim() ? '' : '요청 내용을 입력해 주세요.')} />
                </label>
                <Button type="submit" className="w-full sm:w-auto">
                    <Send size={15} aria-hidden="true" className={disabled ? 'animate-send-fly' : ''} />
                    {disabled ? '전송 중…' : '요청 보내기'}
                </Button>
            </fieldset>
            {leaders.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">요청을 받을 팀 관리자 또는 인도자가 없습니다. 팀 구성원을 확인해 주세요.</p> : null}
        </form>
    );
}

function RequestContent({ request, names, userId, owner, disabled, run }: {
    request: SetlistRequest; names: Map<string, string>; userId: string; owner: boolean; disabled: boolean; run: RunCommand;
}) {
    const canChangeStatus = owner || request.leaderId === userId;
    const canReply = canChangeStatus || request.authorId === userId;
    const replies = [...request.replies].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    const name = (memberId: string) => names.get(memberId) ?? '이전 팀원';

    return (
        <div className="mt-3.5 max-w-3xl space-y-5">
            {request.body.trim() !== firstLine(request.body) ? <p className="whitespace-pre-wrap break-words rounded-2xl rounded-tl-md bg-muted px-4 py-3 text-sm leading-relaxed text-foreground/85">{request.body}</p> : null}
            <div className="space-y-0.5 text-xs leading-5 text-muted-foreground">
                <p className="break-words">대상 콘티: <strong className="font-medium text-foreground">{request.setlistTitle}</strong></p>
                <p className="break-all">{request.setlistId ? `콘티 ID: ${request.setlistId}` : '제목으로 참조한 미등록 콘티'}</p>
                <p className="break-words">작성자 {name(request.authorId)} → 받는 인도자 {name(request.leaderId)}</p>
                <p>작성 <time dateTime={request.createdAt}>{planningDate(request.createdAt)}</time> · 한국 시간</p>
            </div>
            {canChangeStatus ? (
                <fieldset disabled={disabled} className="min-w-0">
                    <legend className="mb-2 text-xs font-medium text-muted-foreground">진행 상태 변경</legend>
                    <div className="flex flex-wrap gap-1.5">
                        {statuses.map(([status, label]) => {
                            const current = request.status === status;
                            return (
                                <button key={status} type="button" className={current ? cn(pillOn, 'disabled:opacity-100') : pill} aria-pressed={current} disabled={disabled || current} onClick={() => void run({ type: 'request.status', requestId: request.id, status }, `요청 상태를 '${label}'으로 변경했습니다.`)}>
                                    {current && <Check size={13} aria-hidden="true" className="animate-check-pop" />}
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">받는 인도자와 팀 관리자만 변경할 수 있습니다. 완료해도 콘티는 자동으로 수정되지 않습니다.</p>
                </fieldset>
            ) : null}
            <section aria-label="요청 답글" className="space-y-3">
                <h3 className="text-[13px] font-semibold text-foreground">답글 <span className="font-normal tabular-nums text-muted-foreground">{replies.length}</span></h3>
                {replies.length === 0 ? <p className="text-xs text-muted-foreground">아직 답글이 없습니다.</p> : (
                    <ol className="space-y-3">
                        {replies.map(reply => {
                            const mine = reply.authorId === userId;
                            return (
                                <li key={reply.id} className={cn('flex gap-2.5', mine && 'flex-row-reverse text-right')}>
                                    <Avatar name={name(reply.authorId)} size="sm" />
                                    <div className="min-w-0">
                                        <p className={cn('flex flex-wrap items-baseline gap-x-1.5 text-xs', mine && 'justify-end')}>
                                            <span className="break-words font-semibold text-foreground">{name(reply.authorId)}</span>
                                            <time className="text-muted-foreground" dateTime={reply.createdAt}>{planningDate(reply.createdAt)}</time>
                                        </p>
                                        <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-foreground/80">{reply.body}</p>
                                    </div>
                                </li>
                            );
                        })}
                    </ol>
                )}
                {canReply ? (
                    <form onSubmit={async event => {
                        event.preventDefault();
                        const form = event.currentTarget;
                        const body = String(new FormData(form).get('reply') ?? '').trim();
                        if (!body) return;
                        if (await run({ type: 'request.reply', requestId: request.id, body }, '답글을 보냈습니다.')) form.reset();
                    }}>
                        <fieldset disabled={disabled} className="min-w-0 space-y-2">
                            <label className="block space-y-1.5">
                                <span className={fieldLabel}>답글 작성</span>
                                <Textarea name="reply" required rows={3} className="min-h-20 resize-y" placeholder="확인한 내용이나 답변을 남겨 주세요." onInput={event => event.currentTarget.setCustomValidity(event.currentTarget.value.trim() ? '' : '답글을 입력해 주세요.')} />
                            </label>
                            <div className="flex justify-end">
                                <Button type="submit" size="sm">
                                    <Send size={14} aria-hidden="true" className={disabled ? 'animate-send-fly' : ''} />
                                    {disabled ? '처리 중…' : '답글 보내기'}
                                </Button>
                            </div>
                        </fieldset>
                    </form>
                ) : <p className="text-xs text-muted-foreground">작성자, 받는 인도자, 팀 관리자가 답글을 남길 수 있습니다.</p>}
            </section>
            {(owner || request.authorId === userId) ? (
                <div className="flex justify-end border-t border-border/70 pt-2">
                    <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        className="text-destructive hover:bg-destructive/10"
                        disabled={disabled}
                        onClick={async () => {
                            if (window.confirm('이 요청을 삭제하시겠습니까? (답글 포함 모두 삭제)')) {
                                await run({ type: 'request.delete', requestId: request.id }, '요청을 삭제했습니다.');
                            }
                        }}
                    >
                        <Trash2 size={13} aria-hidden="true" />
                        요청 삭제
                    </Button>
                </div>
            ) : null}
        </div>
    );
}

export default function RequestsPanel({ state, members, userId, busy, onCommand, initialSetlist }: Props) {
    const id = useId();
    const [audience, setAudience] = useState<'all' | 'me'>('all');
    const [status, setStatus] = useState<'all' | SetlistRequest['status']>('all');
    const [setlist, setSetlist] = useState('all');
    const [pending, setPending] = useState(false);
    const [notice, setNotice] = useState('');
    const [error, setError] = useState('');
    const inFlight = useRef(false);
    const details = useRef(new Map<string, HTMLDetailsElement>());
    const disabled = busy || pending;
    const owner = members.some(member => member.userId === userId && member.permission === 'owner');
    const names = new Map(members.map(member => [member.userId, member.name]));
    const requests = [...state.requests].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    const initialTarget = initialSetlist ? requests.find(request => initialSetlist.id ? request.setlistId === initialSetlist.id : request.setlistTitle === initialSetlist.title) : undefined;
    const setlists = new Map(requests.map(request => [setlistKey(request), request.setlistTitle]));
    const audienceRequests = audience === 'me' ? requests.filter(request => request.leaderId === userId) : requests;
    const scoped = audienceRequests.filter(request => setlist === 'all' || setlistKey(request) === setlist);
    const visible = scoped.filter(request => status === 'all' || request.status === status);
    const statusFilters: { value: 'all' | SetlistRequest['status']; label: string; count: number }[] = [
        { value: 'all', label: '모든 상태', count: scoped.length },
        ...statuses.map(([value, label]) => ({ value, label, count: scoped.filter(request => request.status === value).length })),
    ];

    const run: RunCommand = async (command, message) => {
        if (busy || inFlight.current) return false;
        inFlight.current = true;
        setPending(true);
        setError('');
        setNotice('');
        try {
            const success = await onCommand(command);
            if (success) {
                setNotice(message);
                if (command.type === 'request.create') {
                    setAudience('all');
                    setStatus('all');
                    setSetlist('all');
                }
            } else setError('저장하지 못했습니다. 입력한 내용을 확인하고 다시 시도해 주세요.');
            return success;
        } catch {
            setError('요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
            return false;
        } finally {
            inFlight.current = false;
            setPending(false);
        }
    };

    function reveal(request: SetlistRequest) {
        setAudience('all');
        setStatus('all');
        setSetlist('all');
        requestAnimationFrame(() => {
            const element = details.current.get(request.id);
            if (!element) return;
            element.open = true;
            element.querySelector('summary')?.focus({ preventScroll: true });
            element.scrollIntoView({ block: 'nearest' });
        });
    }

    return (
        <section aria-label="콘티 요청" className="min-w-0 space-y-7 text-foreground">
            <div className="space-y-2">
                <details open={requests.length === 0 || Boolean(initialSetlist)} className="group border-y border-border/70">
                    <summary className={cn(summaryRow, 'flex min-h-14 items-center gap-3 py-2.5')}>
                        <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground">
                            <Plus size={18} strokeWidth={2.25} />
                        </span>
                        <span className="min-w-0 flex-1 text-[15px] font-medium">새 요청 남기기</span>
                        <ChevronDown size={18} aria-hidden="true" className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="border-t border-border/70 pb-5 pt-4">
                        <RequestComposer key={JSON.stringify(initialSetlist ?? null)} members={members} initialSetlist={initialSetlist} disabled={disabled} run={run} />
                    </div>
                </details>
                <div role="status" aria-live="polite" aria-atomic="true" className={cn('px-1 text-sm transition-all', notice ? 'animate-success-bounce font-medium text-success' : 'text-muted-foreground')}>{pending ? '처리 중입니다…' : notice}</div>
            </div>
            {error ? <Notice tone="error">{error}</Notice> : null}
            <section aria-labelledby={`${id}-list`} className="min-w-0 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                    <h2 id={`${id}-list`} className="text-[17px] font-semibold tracking-tight">요청 목록 <span className="font-normal tabular-nums text-muted-foreground">{requests.length}</span></h2>
                    <div className="flex flex-wrap gap-1.5">
                        {requests[0] ? <Button type="button" variant="outline" size="xs" onClick={() => reveal(requests[0])}>최신 요청 보기</Button> : null}
                        {initialTarget ? <Button type="button" variant="outline" size="xs" onClick={() => reveal(initialTarget)}>선택한 콘티 요청 보기</Button> : null}
                    </div>
                </div>
                <div className="no-scrollbar flex gap-5 overflow-x-auto border-b border-border/70" role="group" aria-label="요청 상태 필터">
                    {statusFilters.map(item => (
                        <button key={item.value} type="button" aria-pressed={status === item.value} className={cn('-mb-px flex h-11 shrink-0 items-center gap-1 border-b-2 text-sm transition-colors', status === item.value ? tabOn : tabOff)} onClick={() => setStatus(item.value)}>
                            {item.label}{' '}<span className="text-xs tabular-nums opacity-70">{item.count}</span>
                        </button>
                    ))}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5">
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label="요청 수신자 필터">
                        <button type="button" aria-pressed={audience === 'all'} className={audience === 'all' ? pillOn : pill} onClick={() => setAudience('all')}>전체 {requests.length}</button>
                        <button type="button" aria-pressed={audience === 'me'} className={audience === 'me' ? pillOn : pill} onClick={() => setAudience('me')}>나에게 온 요청 {requests.filter(request => request.leaderId === userId).length}</button>
                    </div>
                    <label className="flex min-w-0 items-center gap-2">
                        <span className="shrink-0 text-[11px] font-medium text-muted-foreground">대상 콘티</span>
                        <Select value={setlist} onChange={event => setSetlist(event.target.value)} className="h-9 w-auto max-w-52 rounded-full px-3 pr-8 sm:text-xs">
                            <option value="all">모든 콘티</option>
                            {Array.from(setlists, ([key, title]) => <option key={key} value={key}>{title}</option>)}
                        </Select>
                    </label>
                </div>
                <p role="status" className="text-xs text-muted-foreground">{visible.length}개 요청 · 최신 요청 순 · 답글은 오래된 순</p>
                {visible.length === 0 ? (
                    <div className={cn('rounded-3xl px-5 py-8 text-center sm:py-10', dashed)}>
                        <h3 className="text-[15px] font-medium">{requests.length === 0 ? '아직 등록된 요청이 없습니다' : '조건에 맞는 요청이 없습니다'}</h3>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{requests.length === 0 ? '콘티 제목과 궁금한 점을 입력해 인도자에게 첫 요청을 보내 보세요.' : '수신자, 콘티 또는 상태 필터를 변경해 보세요.'}</p>
                        {requests.length > 0 ? <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => { setAudience('all'); setStatus('all'); setSetlist('all'); }}>모든 요청 보기</Button> : null}
                    </div>
                ) : (
                    <ul className="-mt-1">
                        {visible.map(request => {
                            const title = firstLine(request.body) || request.setlistTitle;
                            const author = names.get(request.authorId) ?? '이전 팀원';
                            const done = request.status === 'resolved';
                            return (
                                <li key={request.id} className="border-b border-border/70 last:border-b-0">
                                    <details ref={element => { if (element) details.current.set(request.id, element); else details.current.delete(request.id); }} open={request.id === (initialTarget?.id ?? requests[0]?.id) ? true : undefined} className="group min-w-0 py-4">
                                        <summary className={cn(summaryRow, 'flex items-start gap-3')}>
                                            <span className="min-w-0 flex-1">
                                                <span className="block break-words text-[11px] font-medium text-muted-foreground">
                                                    {requestKinds[request.kind]} · {request.setlistTitle}
                                                    <span className={cn('ml-1', STATUS_TEXT[request.status])}>· {requestStatuses[request.status]}</span>
                                                </span>
                                                <span className={cn('mt-0.5 line-clamp-2 block break-words text-[15px] font-medium leading-snug', done ? 'text-muted-foreground line-through decoration-1' : 'text-foreground')}>{title}</span>
                                                <span className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
                                                    <Avatar name={author} size="xs" />
                                                    <span className="text-foreground/75">{author}</span>
                                                    <span aria-hidden="true">→</span>
                                                    <span className="sr-only">받는 인도자</span>
                                                    {names.get(request.leaderId) ?? '이전 팀원'}
                                                    <span aria-hidden="true">·</span>
                                                    답글 {request.replies.length}
                                                    <span aria-hidden="true">·</span>
                                                    {planningDate(request.createdAt)}
                                                </span>
                                            </span>
                                            <ChevronDown size={18} aria-hidden="true" className="mt-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                                        </summary>
                                        <RequestContent request={request} names={names} userId={userId} owner={owner} disabled={disabled} run={run} />
                                    </details>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>
        </section>
    );
}
