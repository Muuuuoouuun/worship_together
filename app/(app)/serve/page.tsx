import type { Metadata } from 'next';
import { CalendarDays, UsersRound } from 'lucide-react';
import CommunityRoutePage from '@/components/community/CommunityRoutePage';

export const metadata: Metadata = { title: '섬김' };

export default function ServePage() {
    return (
        <CommunityRoutePage
            title="섬김"
            description="예배팀 밖의 봉사 자리와 봉사자를 잇는 공간"
            plan="안내 · 영상 · 다과처럼 예배를 함께 세우는 봉사 자리를 올리고, 원하는 사람이 지원하는 기능을 준비하고 있어요."
            planned={['봉사 자리 올리기', '지원 · 배정', '봉사 일정 알림']}
            tone="mint"
            now={[
                { href: '/dashboard/planning', icon: CalendarDays, label: '역할 배치 · 자원', detail: '예배 일정마다 역할을 배치하고, 비어 있는 자리에 팀원이 직접 지원해요.' },
                { href: '/dashboard/team', icon: UsersRound, label: '팀원 역할', detail: '팀 화면에서 팀원마다 담당 역할을 정해요.' },
            ]}
        />
    );
}
