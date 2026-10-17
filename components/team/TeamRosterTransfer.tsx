'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { Download, FileJson, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fieldClass } from '@/components/ui/input';
import Notice from '@/components/ui/Notice';
import { cn } from '@/lib/utils';
import {
    exportTeamRoster, importTeamRoster, parseTeamRosterBundle, TEAM_BUNDLE_MAX_BYTES, teamRoles,
    type TeamRosterBundle,
} from '@/lib/teamPrototype';

/** 파일 선택 칸: 공통 입력 칸 + 회색 알약 '파일 선택' 버튼 */
const fileClass = cn(
    fieldClass,
    'h-auto min-h-11 py-1.5 pl-1.5 text-sm text-muted-foreground file:mr-3 file:h-8 file:rounded-full file:border-0 file:bg-muted file:px-3.5 file:text-xs file:font-semibold file:text-foreground hover:file:bg-muted/70 disabled:border-dashed',
);

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
        <section className="min-w-0 border-t border-border/70 pt-6" aria-labelledby="roster-transfer-heading">
            <h2 id="roster-transfer-heading" className="text-[17px] font-semibold tracking-tight text-foreground">다른 기기로 팀 명단 옮기기</h2>
            <p id="roster-transfer-help" className="mt-1 text-xs leading-relaxed text-muted-foreground">팀 이름·팀원 이름·역할을 JSON 파일로 저장해 모바일이나 태블릿에서 가져올 수 있습니다. 가져올 때마다 독립된 새 사본을 만들며 기존 팀을 덮어쓰지 않습니다. 로그인·가입 초대·자동 동기화 기능은 아닙니다.</p>
            <div className="mt-2 divide-y divide-border/70">
                <div className="flex min-w-0 flex-col gap-3 py-3.5 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground" aria-hidden="true">
                            <Download size={18} />
                        </span>
                        <p className="min-w-0 break-words text-[15px] font-medium text-foreground">{teamName ? `선택한 팀: ${teamName}` : '내보내려면 팀을 만들거나 선택하세요.'}</p>
                    </div>
                    <Button type="button" variant="outline" className="w-full shrink-0 sm:w-auto" disabled={!teamId || disabled} onClick={downloadRoster}>
                        <Download aria-hidden="true" /> 명단 파일 내보내기
                    </Button>
                </div>
                <div className="flex min-w-0 flex-col gap-3 py-3.5 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground" aria-hidden="true">
                            <FileJson size={18} />
                        </span>
                        <label htmlFor="team-roster-file" className="min-w-0 text-[15px] font-medium text-foreground">받은 명단 파일 선택 · JSON, 최대 128KB</label>
                    </div>
                    <input id="team-roster-file" type="file" accept=".json,application/json" disabled={disabled || reading} onChange={(event) => void readRoster(event)} aria-describedby="roster-transfer-help" className={cn(fileClass, 'sm:w-72')} />
                </div>
            </div>
            {reading && <p role="status" className="mt-2 text-sm text-muted-foreground">명단 파일을 확인하고 있습니다.</p>}
            {preview && (
                <div className="mt-3 rounded-3xl bg-muted/60 p-4 sm:p-5">
                    <h3 className="break-words text-[15px] font-semibold text-foreground">{preview.team.name} · 팀원 {preview.team.members.length}명</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">파일 저장 시각: {new Date(preview.exportedAt).toLocaleString('ko-KR')}</p>
                    <ul className="my-3 max-h-48 divide-y divide-border/70 overflow-y-auto text-sm" aria-label="가져올 팀원 미리보기">
                        {preview.team.members.map((member) => (
                            <li key={member.name} className="flex items-center justify-between gap-3 py-2">
                                <span className="min-w-0 break-words text-foreground">{member.name}</span>
                                <span className="shrink-0 text-xs text-muted-foreground"><span className="sr-only"> · </span>{teamRoles[member.role]}</span>
                            </li>
                        ))}
                    </ul>
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" disabled={disabled || reading} onClick={saveRoster}><Upload aria-hidden="true" /> 새 사본으로 가져오기</Button>
                        <Button type="button" variant="outline" onClick={() => setPreview(null)}>취소</Button>
                    </div>
                </div>
            )}
            {notice && <Notice tone={notice.error ? 'error' : 'success'} className="mt-3 break-words">{notice.message}</Notice>}
        </section>
    );
}
