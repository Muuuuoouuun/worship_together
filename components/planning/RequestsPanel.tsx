'use client';

import { useId, useRef, useState } from 'react';
import { Check, Send } from 'lucide-react';
import {
    planningDate, requestKinds, requestStatuses,
    type PlanningCommand, type PlanningPanelProps, type SetlistRequest,
} from '@/types/planning';

type Props = PlanningPanelProps & { initialSetlist?: { id: string; title: string } };
type RunCommand = (command: PlanningCommand, message: string) => Promise<boolean>;
const control = 'min-h-12 w-full min-w-0 rounded-xl border border-input bg-card px-3 py-3 text-base text-foreground disabled:border-dashed disabled:bg-muted! disabled:text-muted-foreground!';
const button = 'tap-bounce inline-flex min-h-12 min-w-12 items-center justify-center gap-1.5 rounded-xl border border-border px-4 py-3 text-sm font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:border-dashed disabled:bg-muted! disabled:text-muted-foreground!';
const kinds = Object.entries(requestKinds) as [SetlistRequest['kind'], string][];
const statuses = Object.entries(requestStatuses) as [SetlistRequest['status'], string][];
const setlistKey = (request: Pick<SetlistRequest, 'setlistId' | 'setlistTitle'>) => JSON.stringify([request.setlistId, request.setlistTitle]);

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
        }} className="rounded-2xl border border-border bg-card p-4 text-foreground sm:p-6">
            <h2 id={`${id}-heading`} className="text-lg font-bold">콘티 요청 보내기</h2>
            <p id={`${id}-help`} className="mt-2 text-sm leading-6 text-muted-foreground">
                아래에 입력한 콘티 제목을 대상으로 담당 인도자에게 요청합니다. 요청이나 완료 처리는 콘티를 자동으로 수정하지 않습니다.
            </p>
            <fieldset disabled={disabled || leaders.length === 0} aria-labelledby={`${id}-heading`} aria-describedby={`${id}-help`} className="mt-5 min-w-0 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2 text-sm font-medium">
                        <span className="block">요청 종류</span>
                        <select name="kind" className={control} defaultValue="question" aria-describedby={`${id}-reminder`}>
                            {kinds.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                    </label>
                    <label className="space-y-2 text-sm font-medium">
                        <span className="block">받는 인도자 <span className="text-muted-foreground">(필수)</span></span>
                        <select name="leaderId" className={control} required defaultValue={leaders.length === 1 ? leaders[0].userId : ''}>
                            <option value="" disabled>인도자를 선택하세요</option>
                            {leaders.map(member => <option key={member.userId} value={member.userId}>{member.name} · {member.permission === 'owner' ? '팀 관리자' : '인도자'}</option>)}
                        </select>
                    </label>
                </div>
                <p id={`${id}-reminder`} className="text-sm leading-6 text-muted-foreground">진행 확인 요청은 독촉이 필요한 상황에서 진행 상황을 정중하게 확인하는 요청입니다.</p>
                <div>
                    <label className="space-y-2 text-sm font-medium">
                        <span className="block">콘티 제목 <span className="text-muted-foreground">(필수)</span></span>
                        <input name="setlistTitle" className={control} required pattern=".*\S.*" defaultValue={initialSetlist?.title ?? ''} placeholder="예: 주일 2부 예배 콘티" />
                    </label>
                    <input type="hidden" name="setlistId" value={initialSetlist?.id ?? ''} />
                </div>
                <p id={`${id}-reference`} className="text-sm text-muted-foreground">등록되지 않은 콘티도 제목만 입력해 요청할 수 있습니다.</p>
                <label className="block space-y-2 text-sm font-medium">
                    <span className="block">요청 내용 <span className="text-muted-foreground">(필수)</span></span>
                    <textarea name="body" className={`${control} min-h-32 resize-y`} rows={4} required placeholder="궁금한 점이나 확인·수정이 필요한 내용을 적어 주세요." onInput={event => event.currentTarget.setCustomValidity(event.currentTarget.value.trim() ? '' : '요청 내용을 입력해 주세요.')} />
                </label>
                <button type="submit" className={`${button} w-full bg-primary text-primary-foreground sm:w-auto`}>
                    <Send size={15} className={disabled ? 'animate-send-fly' : ''} />
                    {disabled ? '전송 중…' : '요청 보내기'}
                </button>
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
        <div className="space-y-5 border-t border-border p-4 sm:p-5">
            <div className="space-y-2 text-sm text-muted-foreground">
                <p className="break-words">대상 콘티: <strong className="text-foreground">{request.setlistTitle}</strong></p>
                <p className="break-all">{request.setlistId ? `콘티 ID: ${request.setlistId}` : '제목으로 참조한 미등록 콘티'}</p>
                <p className="break-words">작성자 {name(request.authorId)} → 받는 인도자 {name(request.leaderId)}</p>
                <p>작성 <time dateTime={request.createdAt}>{planningDate(request.createdAt)}</time> · 한국 시간</p>
            </div>
            <p className="whitespace-pre-wrap break-words leading-7">{request.body}</p>
            {canChangeStatus ? (
                <fieldset disabled={disabled} className="min-w-0">
                    <legend className="mb-2 text-sm font-semibold">진행 상태 변경</legend>
                    <div className="flex flex-wrap gap-2">
                        {statuses.map(([status, label]) => (
                            <button key={status} type="button" className={`${button} ${request.status === status ? 'bg-primary text-primary-foreground shadow-[0_0_15px_rgba(21,62,59,0.2)]' : 'bg-card text-foreground hover:bg-muted'}`} aria-pressed={request.status === status} disabled={disabled || request.status === status} onClick={() => void run({ type: 'request.status', requestId: request.id, status }, `요청 상태를 '${label}'으로 변경했습니다.`)}>
                                {request.status === status && <Check size={14} className="animate-check-pop" />}
                                {label}
                            </button>
                        ))}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">받는 인도자와 팀 관리자만 변경할 수 있습니다. 완료해도 콘티는 자동으로 수정되지 않습니다.</p>
                </fieldset>
            ) : null}
            <section aria-label="요청 답글" className="space-y-3">
                <h3 className="font-semibold">답글 <span className="text-muted-foreground">{replies.length}</span></h3>
                {replies.length === 0 ? <p className="text-sm text-muted-foreground">아직 답글이 없습니다.</p> : (
                    <ol className="space-y-3">
                        {replies.map(reply => (
                            <li key={reply.id} className="rounded-xl bg-muted p-4">
                                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                                    <span className="break-words font-semibold">{name(reply.authorId)}</span>
                                    <time className="text-muted-foreground" dateTime={reply.createdAt}>{planningDate(reply.createdAt)}</time>
                                </div>
                                <p className="mt-2 whitespace-pre-wrap break-words leading-7">{reply.body}</p>
                            </li>
                        ))}
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
                        <fieldset disabled={disabled} className="min-w-0 space-y-3">
                            <label className="block space-y-2 text-sm font-medium">
                                <span className="block">답글 작성</span>
                                <textarea name="reply" required rows={3} className={`${control} resize-y`} placeholder="확인한 내용이나 답변을 남겨 주세요." onInput={event => event.currentTarget.setCustomValidity(event.currentTarget.value.trim() ? '' : '답글을 입력해 주세요.')} />
                            </label>
                            <button type="submit" className={`${button} bg-primary text-primary-foreground`}>
                                <Send size={15} className={disabled ? 'animate-send-fly' : ''} />
                                {disabled ? '처리 중…' : '답글 보내기'}
                            </button>
                        </fieldset>
                    </form>
                ) : <p className="text-sm text-muted-foreground">작성자, 받는 인도자, 팀 관리자가 답글을 남길 수 있습니다.</p>}
            </section>
            {(owner || request.authorId === userId) ? (
                <div className="pt-2 border-t border-border flex justify-end">
                    <button
                        type="button"
                        className="text-xs text-destructive hover:underline font-semibold"
                        disabled={disabled}
                        onClick={async () => {
                            if (window.confirm('이 요청을 삭제하시겠습니까? (답글 포함 모두 삭제)')) {
                                await run({ type: 'request.delete', requestId: request.id }, '요청을 삭제했습니다.');
                            }
                        }}
                    >
                        요청 삭제
                    </button>
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
        <section aria-label="콘티 요청" className="min-w-0 space-y-6 text-foreground">
            <details open={requests.length === 0 || Boolean(initialSetlist)} className="rounded-2xl border border-border bg-card p-3">
                <summary className="min-h-12 cursor-pointer px-2 py-3 font-bold">새 요청 남기기</summary>
                <RequestComposer key={JSON.stringify(initialSetlist ?? null)} members={members} initialSetlist={initialSetlist} disabled={disabled} run={run} />
            </details>
            <div role="status" aria-live="polite" aria-atomic="true" className={`text-sm transition-all ${notice ? 'animate-success-bounce text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-muted-foreground'}`}>{pending ? '처리 중입니다…' : notice}</div>
            {error ? <p role="alert" className="rounded-xl border border-destructive bg-card p-4 text-destructive">{error}</p> : null}
            <section aria-labelledby={`${id}-list`} className="min-w-0 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 id={`${id}-list`} className="text-lg font-bold">요청 목록 <span className="text-muted-foreground">{requests.length}</span></h2>
                    <div className="flex flex-wrap gap-2">
                        {requests[0] ? <button type="button" className={`${button} bg-card`} onClick={() => reveal(requests[0])}>최신 요청 보기</button> : null}
                        {initialTarget ? <button type="button" className={`${button} bg-card`} onClick={() => reveal(initialTarget)}>선택한 콘티 요청 보기</button> : null}
                    </div>
                </div>
                <div className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
                    <div className="flex flex-wrap gap-2" role="group" aria-label="요청 수신자 필터">
                        <button type="button" aria-pressed={audience === 'all'} className={`${button} ${audience === 'all' ? 'bg-primary text-primary-foreground' : 'bg-card'}`} onClick={() => setAudience('all')}>전체 {requests.length}</button>
                        <button type="button" aria-pressed={audience === 'me'} className={`${button} ${audience === 'me' ? 'bg-primary text-primary-foreground' : 'bg-card'}`} onClick={() => setAudience('me')}>나에게 온 요청 {requests.filter(request => request.leaderId === userId).length}</button>
                    </div>
                    <label className="block space-y-2 text-sm font-medium">
                        <span className="block">대상 콘티</span>
                        <select value={setlist} onChange={event => setSetlist(event.target.value)} className={control}>
                            <option value="all">모든 콘티</option>
                            {Array.from(setlists, ([key, title]) => <option key={key} value={key}>{title}</option>)}
                        </select>
                    </label>
                    <div className="flex flex-wrap gap-2" role="group" aria-label="요청 상태 필터">
                        <button type="button" aria-pressed={status === 'all'} className={`${button} ${status === 'all' ? 'bg-primary text-primary-foreground' : 'bg-card'}`} onClick={() => setStatus('all')}>모든 상태 {scoped.length}</button>
                        {statuses.map(([value, label]) => <button key={value} type="button" aria-pressed={status === value} className={`${button} ${status === value ? 'bg-primary text-primary-foreground' : 'bg-card'}`} onClick={() => setStatus(value)}>{label} {scoped.filter(request => request.status === value).length}</button>)}
                    </div>
                </div>
                <p role="status" className="text-sm text-muted-foreground">{visible.length}개 요청 · 최신 요청 순 · 답글은 오래된 순</p>
                {visible.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center sm:p-10">
                        <h3 className="font-semibold">{requests.length === 0 ? '아직 등록된 요청이 없습니다' : '조건에 맞는 요청이 없습니다'}</h3>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{requests.length === 0 ? '콘티 제목과 궁금한 점을 입력해 인도자에게 첫 요청을 보내 보세요.' : '수신자, 콘티 또는 상태 필터를 변경해 보세요.'}</p>
                        {requests.length > 0 ? <button type="button" className={`${button} mt-4 bg-card`} onClick={() => { setAudience('all'); setStatus('all'); setSetlist('all'); }}>모든 요청 보기</button> : null}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {visible.map(request => (
                            <details key={request.id} ref={element => { if (element) details.current.set(request.id, element); else details.current.delete(request.id); }} open={request.id === (initialTarget?.id ?? requests[0]?.id) ? true : undefined} className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card">
                                <summary className="min-h-12 cursor-pointer break-words p-4 sm:p-5">
                                    <span className="font-semibold">{request.setlistTitle}</span>
                                    <span className="ml-2 inline-block rounded-lg bg-muted px-2 py-1 text-sm">{requestKinds[request.kind]} · {requestStatuses[request.status]}</span>
                                    <span className="mt-2 block text-sm text-muted-foreground">{names.get(request.authorId) ?? '이전 팀원'} → {names.get(request.leaderId) ?? '이전 팀원'} · 답글 {request.replies.length} · {planningDate(request.createdAt)}</span>
                                </summary>
                                <RequestContent request={request} names={names} userId={userId} owner={owner} disabled={disabled} run={run} />
                            </details>
                        ))}
                    </div>
                )}
            </section>
        </section>
    );
}
