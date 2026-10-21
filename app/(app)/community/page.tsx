import type { Metadata } from 'next';
import { Bell, MessageSquareText, Radio } from 'lucide-react';
import CommunityRoutePage from '@/components/community/CommunityRoutePage';

export const metadata: Metadata = { title: '팀 커뮤니티' };

export default function CommunityPage() {
    return (
        <CommunityRoutePage
            title="팀 커뮤니티"
            description="예배 후 말씀 · 묵상 · 피드백을 팀별로 나누는 공간"
            plan="예배를 마친 뒤 그날의 콘티와 예배 중 큐 기록을 바탕으로 팀원끼리 묵상과 피드백을 남기는 공간을 준비하고 있어요."
            planned={['예배 후 피드백 스레드', '말씀 · 묵상 나눔', '다음 예배로 이어지는 메모']}
            tone="sky"
            now={[
                { href: '/dashboard/songs', icon: MessageSquareText, label: '콘티 곡별 코멘트', detail: '콘티 · 악보의 순서 화면에서 곡마다 의견을 남겨요. 팀원 모두에게 보여요.' },
                { href: '/dashboard/songs?tab=alerts', icon: Bell, label: '팀 소식', detail: '요청 · 배치 · 코멘트 소식을 한곳에서 확인해요.' },
                { href: '/dashboard', icon: Radio, label: '예배 입장', detail: '진행 중인 예배가 있으면 홈 맨 위에서 바로 들어가요.' },
            ]}
        />
    );
}
