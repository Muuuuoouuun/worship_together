import type { Metadata } from 'next';
import { Plus, UsersRound } from 'lucide-react';
import CommunityRoutePage from '@/components/community/CommunityRoutePage';

export const metadata: Metadata = { title: '그룹' };

export default function GroupsPage() {
    return (
        <CommunityRoutePage
            title="그룹"
            description="소그룹 · 사역팀을 묶어 보는 공간"
            plan="여러 예배팀과 소그룹을 한 교회 안에서 묶어 보고, 그룹끼리 일정과 소식을 나누는 기능을 준비하고 있어요."
            planned={['교회 안 팀 묶기', '그룹 공지', '그룹 간 일정 보기']}
            tone="sand"
            now={[
                { href: '/dashboard/team', icon: UsersRound, label: '팀 · 초대 · 권한', detail: '팀을 여러 개 만들거나 참여하고, 위의 팀 바꾸기로 오가요.' },
                { href: '/welcome?step=team', icon: Plus, label: '새 팀 만들기 · 참여', detail: '초대 코드로 다른 팀에 참여하거나 새 팀을 만들어요.' },
            ]}
        />
    );
}
