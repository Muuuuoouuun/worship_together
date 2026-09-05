'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { Download, Upload } from 'lucide-react';
import {
    exportTeamRoster, importTeamRoster, parseTeamRosterBundle, TEAM_BUNDLE_MAX_BYTES, teamRoles,
    type TeamRosterBundle,
} from '@/lib/teamPrototype';

const actionClass = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm font-bold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:border-dashed disabled:bg-muted! disabled:text-muted-foreground!';

export default function TeamRosterTransfer({ teamId, teamName, disabled = false }: {
    teamId?: string;
    teamName?: string;
    disabled?: boolean;
}) {
    const [preview, setPreview] = useState<TeamRosterBundle | null>(null);
    const [reading, setReading] = useState(false);
    const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null);
    const latestRead = useRef(0);

    function showError(error: unknown) {
        setNotice({ message: error instanceof Error ? error.message : '파일을 처리하지 못했습니다. 다시 시도해주세요.', error: true });
    }

    function downloadRoster() {
        if (!teamId) return;
        let objectUrl: string | undefined;
        let link: HTMLAnchorElement | undefined;
        try {
            const json = exportTeamRoster(teamId);
            objectUrl = URL.createObjectURL(new Blob([json], { type: 'application/json;charset=utf-8' }));
            link = document.createElement('a');
            link.href = objectUrl;
            link.download = `worship-team-roster-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(link);
            link.click();
            setNotice({ message: '명단 파일 다운로드를 요청했습니다. 파일을 다른 기기로 옮긴 뒤 이 화면에서 가져오세요. 자동으로 전송되지는 않습니다.', error: false });
        } catch (error) {
            showError(error);
        } finally {
            link?.remove();
            if (objectUrl) {
                const urlToRevoke = objectUrl;
                // Give mobile browsers time to begin reading the download before cleanup.
                window.setTimeout(() => URL.revokeObjectURL(urlToRevoke), 60_000);
            }
        }
    }

    async function readRoster(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        const request = ++latestRead.current;
        setPreview(null);
        setNotice(null);
        setReading(true);
        try {
            if (file.size > TEAM_BUNDLE_MAX_BYTES) throw new Error('명단 파일은 128KB 이하만 가져올 수 있습니다.');
            const text = await file.text();
            if (request !== latestRead.current) return;
            setPreview(parseTeamRosterBundle(text));
        } catch (error) {
            if (request === latestRead.current) showError(error);
        } finally {
            if (request === latestRead.current) setReading(false);
        }
    }

    function saveRoster() {
        if (!preview) return;
        try {
            importTeamRoster(preview);
            setNotice({ message: `${preview.team.name} 팀원 ${preview.team.members.length}명의 명단을 새 사본으로 저장했습니다. 원래 팀과 자동 동기화되지 않습니다.`, error: false });
            setPreview(null);
        } catch (error) {
            showError(error);
        }
    }

    return (
        <section className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-6" aria-labelledby="roster-transfer-heading">
            <h2 id="roster-transfer-heading" className="text-xl font-bold text-primary">다른 기기로 팀 명단 옮기기</h2>
            <p id="roster-transfer-help" className="mt-2 text-sm leading-relaxed text-muted-foreground">팀 이름·팀원 이름·역할을 JSON 파일로 저장해 모바일이나 태블릿에서 가져올 수 있습니다. 가져올 때마다 독립된 새 사본을 만들며 기존 팀을 덮어쓰지 않습니다. 로그인·가입 초대·자동 동기화 기능은 아닙니다.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="min-w-0">
                    <p className="mb-2 break-words text-sm font-semibold">{teamName ? `선택한 팀: ${teamName}` : '내보내려면 팀을 만들거나 선택하세요.'}</p>
                    <button type="button" className={`${actionClass} w-full`} disabled={!teamId || disabled} onClick={downloadRoster}>
                        <Download size={18} aria-hidden="true" /> 명단 파일 내보내기
                    </button>
                </div>
                <div className="min-w-0">
                    <label htmlFor="team-roster-file" className="mb-2 block text-sm font-semibold">받은 명단 파일 선택 · JSON, 최대 128KB</label>
                    <input id="team-roster-file" type="file" accept=".json,application/json" disabled={disabled || reading} onChange={(event) => void readRoster(event)} aria-describedby="roster-transfer-help" className="min-h-12 w-full min-w-0 rounded-lg border border-border bg-background text-sm file:mr-3 file:min-h-12 file:border-0 file:bg-muted file:px-3 file:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:border-dashed disabled:bg-muted! disabled:text-muted-foreground!" />
                </div>
            </div>
            {reading && <p role="status" className="mt-3 text-sm">명단 파일을 확인하고 있습니다.</p>}
            {preview && (
                <div className="mt-4 rounded-lg border border-border bg-background p-4">
                    <h3 className="break-words font-bold text-primary">{preview.team.name} · 팀원 {preview.team.members.length}명</h3>
                    <p className="mt-1 text-sm text-muted-foreground">파일 저장 시각: {new Date(preview.exportedAt).toLocaleString('ko-KR')}</p>
                    <ul className="my-3 max-h-48 space-y-1 overflow-y-auto text-sm" aria-label="가져올 팀원 미리보기">
                        {preview.team.members.map((member) => <li key={member.name} className="break-words">{member.name} · {teamRoles[member.role]}</li>)}
                    </ul>
                    <div className="flex flex-wrap gap-2">
                        <button type="button" className={`${actionClass} bg-primary text-primary-foreground`} disabled={disabled || reading} onClick={saveRoster}><Upload size={18} aria-hidden="true" /> 새 사본으로 가져오기</button>
                        <button type="button" className={actionClass} onClick={() => setPreview(null)}>취소</button>
                    </div>
                </div>
            )}
            {notice && <p role={notice.error ? 'alert' : 'status'} className={`mt-4 break-words text-sm ${notice.error ? 'text-destructive' : 'text-foreground'}`}>{notice.message}</p>}
        </section>
    );
}
