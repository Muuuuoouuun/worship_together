import type { Metadata } from 'next';
import { CalendarDays, MessageSquareText } from 'lucide-react';
import CommunityRoutePage from '@/components/community/CommunityRoutePage';

export const metadata: Metadata = { title: '케어' };

export default function CarePage() {
    return (
        <CommunityRoutePage
            title="케어"
            description="기도제목과 돌봄 요청을 공개 범위와 담당자를 정해 나누는 공간"
            plan="기도제목을 비공개 · 리더 · 팀 전체 중 어디까지 나눌지 정하고, 리더가 놓치지 않도록 후속 연락을 챙기는 기능을 준비하고 있어요."
            planned={['공개 범위 선택', '긴급도 표시', '리더 후속 연락']}
            tone="lilac"
            now={[
                { href: '/dashboard/planning?tab=requests', icon: MessageSquareText, label: '요청 보내기', detail: '인도자 · 관리자에게 직접 요청을 보내고 답을 받아요.' },
                { href: '/dashboard/planning', icon: CalendarDays, label: '일정 · 불참 알리기', detail: '참석이 어려우면 일정에서 사유와 함께 알리고 대타를 요청해요.' },
            ]}
        />
    );
}
