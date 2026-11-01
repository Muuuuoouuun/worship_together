'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { selectTeam } from '@/actions/teamActions';

/**
 * 알림 · 초대 · 공유 링크의 ?team= 이 지금 팀과 다르면 그 팀으로 바꿉니다.
 * 그래야 이 화면만이 아니라 사이드바 · 홈 · 다른 화면도 같은 팀을 봅니다.
 */
export default function TeamParamSync({ currentId, teamIds }: { currentId: string; teamIds: string[] }) {
    const params = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();
    const requested = params.get('team');
    const done = useRef<string | null>(null);

    useEffect(() => {
        if (!requested || requested === currentId || !teamIds.includes(requested) || done.current === requested) return;
        done.current = requested;
        void selectTeam(requested).then((result) => {
            if (result.ok) router.refresh();
        });
    }, [requested, currentId, teamIds, pathname, router]);

    return null;
}
