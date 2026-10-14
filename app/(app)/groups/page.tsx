import CommunityRoutePage from '@/components/community/CommunityRoutePage';
import { BookOpen, CalendarDays, UserPlus, UsersRound } from 'lucide-react';

export default function GroupsPage() {
    return (
        <CommunityRoutePage
            eyebrow="그룹"
            title="예배팀과 소그룹을 함께 묶어 다음 만남으로 연결합니다."
            description="팀별 예배 준비, 예배 후 묵상, 새가족 후속 안내가 흩어지지 않도록 그룹 단위로 정리합니다."
            primaryAction={{ href: '/community', label: '팀 커뮤니티' }}
            secondaryAction={{ href: '/dashboard', label: '오늘 운영판' }}
            metrics={[
                {
                    label: '예배팀',
                    value: '3개',
                    detail: '주일, 청년, 금요기도회 팀을 분리해 봅니다.',
                },
                {
                    label: '소그룹',
                    value: '8개',
                    detail: '말씀 묵상과 새가족 연결을 담당합니다.',
                },
                {
                    label: '다음 만남',
                    value: '수요일',
                    detail: '가장 가까운 모임을 우선 보여줍니다.',
                },
            ]}
            sections={[
                {
                    icon: UsersRound,
                    title: '예배팀 그룹',
                    description: '세션과 역할을 팀 안에서 묶어 준비 상태를 봅니다.',
                    items: ['주일 2부팀', '청년 예배팀', '금요기도회팀'],
                },
                {
                    icon: UserPlus,
                    title: '새가족 연결',
                    description: '예배 후 바로 부담 없는 첫 단계를 제안합니다.',
                    items: ['호스트 만나기', '질문 남기기', '다음 모임 선택'],
                },
                {
                    icon: BookOpen,
                    title: '말씀 나눔',
                    description: '설교 묵상 질문을 그룹별로 이어갑니다.',
                    items: ['본문 질문', '나눔 댓글', '읽음 확인'],
                },
                {
                    icon: CalendarDays,
                    title: '모임 일정',
                    description: '팀 리허설, 소그룹, 기도회 일정을 함께 봅니다.',
                    items: ['리허설', '소그룹', '중보기도'],
                },
            ]}
        />
    );
}
