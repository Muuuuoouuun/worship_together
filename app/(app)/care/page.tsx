import type { Metadata } from 'next';
import CommunityRoutePage from '@/components/community/CommunityRoutePage';
import { ClipboardList, HandHeart, MessageCircle, ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
    title: '케어',
};

export default function CarePage() {
    return (
        <CommunityRoutePage
            title="케어"
            description="기도와 돌봄 요청은 공개 범위와 담당자를 분명히 합니다."
            summary="예배 후 말씀과 묵상에서 이어지는 기도제목을 안전하게 받고, 리더가 놓치지 않도록 후속조치를 큐로 관리합니다."
            tone="lilac"
            primaryAction={{ href: '/community', label: '기도 및 나눔 작성' }}
            secondaryAction={{ href: '/dashboard/planning', label: '일정 및 소통 확인' }}
            metrics={[
                {
                    label: '공개 범위',
                    value: '4단계',
                    detail: '비공개, 리더, 그룹, 전체 공개를 구분합니다.',
                },
                {
                    label: '응답 목표',
                    value: '24h',
                    detail: '긴급 케어는 하루 안에 첫 응답을 목표로 합니다.',
                },
                {
                    label: '담당',
                    value: '지정',
                    detail: '리더 follow-up이 필요한 요청을 앞에 둡니다.',
                },
            ]}
            sections={[
                {
                    icon: ShieldCheck,
                    title: '요청 경계',
                    description: '기도제목이 어디까지 공유되는지 먼저 보여줍니다.',
                    items: ['공개 범위 선택', '긴급도 표시', '비공개 follow-up'],
                },
                {
                    icon: HandHeart,
                    title: '돌봄 응답',
                    description: '기도, 식사, 방문, 연락 같은 실제 응답을 기록합니다.',
                    items: ['기도하기', '도움 제안', '완료 표시'],
                },
                {
                    icon: ClipboardList,
                    title: '리더 큐',
                    description: '흩어진 메시지 대신 담당자와 상태를 한 곳에 둡니다.',
                    items: ['담당자 지정', '상태 추적', '미해결 우선'],
                },
                {
                    icon: MessageCircle,
                    title: '조심스러운 언어',
                    description: '공개 피드가 아니라 목회적 대화처럼 느껴지게 합니다.',
                    items: ['부담 낮은 문장', '공개 압박 방지', '구체적 다음 단계'],
                },
            ]}
        />
    );
}
