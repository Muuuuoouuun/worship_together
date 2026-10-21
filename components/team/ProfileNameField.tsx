'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateProfileName } from '@/actions/teamActions';
import { showAppToast } from '@/lib/appToast';
import DeviceNotifyToggle from '@/components/app/DeviceNotifyToggle';

/** 팀에서 보이는 내 이름. 바꾸면 내가 들어간 모든 팀 명단 · 코멘트 작성자 · 예배 중 큐에 같은 이름이 쓰입니다. */
export default function ProfileNameField({ name, titleClassName }: { name: string; titleClassName: string }) {
    const router = useRouter();
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(name);
    const [pending, startTransition] = useTransition();

    function save(event: FormEvent) {
        event.preventDefault();
        startTransition(async () => {
            const result = await updateProfileName(value);
            if (!result.ok) {
                showAppToast({ tone: 'danger', title: result.error });
                return;
            }
            setEditing(false);
            showAppToast({ group: 'profile', tone: 'success', title: '이름을 바꿨어요', ttl: 2500 });
            router.refresh();
        });
    }

    return (
        <section aria-labelledby="profile-name" className="min-w-0">
            <h2 id="profile-name" className={titleClassName}>내 이름 · 알림</h2>
            {editing ? (
                <form onSubmit={save} className="mt-3 flex items-center gap-2">
                    <label htmlFor="profile-name-input" className="sr-only">팀에서 보이는 이름</label>
                    <Input id="profile-name-input" value={value} onChange={(event) => setValue(event.target.value)} maxLength={40} autoFocus className="min-w-0 flex-1" />
                    <Button type="submit" disabled={pending || !value.trim()}>저장</Button>
                    <Button type="button" variant="ghost" onClick={() => { setEditing(false); setValue(name); }}>취소</Button>
                </form>
            ) : (
                <div className="mt-3 flex min-h-11 items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-[15px] font-medium text-foreground">{name}</p>
                    <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
                        <Pencil aria-hidden="true" />
                        바꾸기
                    </Button>
                </div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">모든 팀 명단 · 코멘트 · 예배 중 큐에 이 이름이 보여요.</p>
            <DeviceNotifyToggle className="mt-6 border-t border-border/70 pt-5" />
        </section>
    );
}
