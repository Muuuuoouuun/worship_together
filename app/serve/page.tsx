import CommunityRoutePage from '@/components/community/CommunityRoutePage';
import { BadgeCheck, CalendarDays, CheckCircle2, ClipboardList } from 'lucide-react';

export default function ServePage() {
    return (
        <CommunityRoutePage
            currentPath="/serve"
            eyebrow="섬김"
            title="예배 후 마음이 실제 섬김 약속으로 이어지게 합니다."
            description="필요한 역할, 시간, 준비사항, 담당자를 명확히 보여주어 예배팀과 공동체 섬김이 자연스럽게 연결됩니다."
            primaryAction={{ href: '/dashboard/planning?filter=vacant', label: '열린 섬김 역할 보기' }}
            secondaryAction={{ href: '/groups', label: '그룹 찾기' }}
            metrics={[
                {
                    label: '필요',
                    value: '6개',
                    detail: '이번 주 열린 섬김 역할 샘플입니다.',
                },
                {
                    label: '확정',
                    value: '1탭',
                    detail: '추가 조율 없이 가능 여부를 빠르게 확인합니다.',
                },
                {
                    label: '준비',
                    value: '명확',
                    detail: '도착 시간과 기대 역할을 같이 보여줍니다.',
                },
            ]}
            sections={[
                {
                    icon: BadgeCheck,
                    title: '열린 섬김',
                    description: '막연한 모집 대신 구체적인 빈자리를 보여줍니다.',
                    items: ['주일 안내팀', '청년부 세팅', '기도회 케어 follow-up'],
                },
                {
                    icon: CalendarDays,
                    title: '섬김 일정',
                    description: '날짜, 도착 시간, 담당자를 한 번에 확인합니다.',
                    items: ['다가오는 역할', '리더 연락처', '준비 메모'],
                },
                {
                    icon: CheckCircle2,
                    title: '확정 상태',
                    description: '요청, 대기, 확정, 완료를 분리합니다.',
                    items: ['가능 여부 확인', '대기 요청', '완료 기록'],
                },
                {
                    icon: ClipboardList,
                    title: '리더 보기',
                    description: '아직 응답이 없는 빈자리를 먼저 보여줍니다.',
                    items: ['미충원 역할', '최근 확정', '후속 알림'],
                },
            ]}
        />
    );
}
