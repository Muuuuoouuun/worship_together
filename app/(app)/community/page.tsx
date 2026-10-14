import CommunityRoutePage from '@/components/community/CommunityRoutePage';
import { BookOpenCheck, HeartHandshake, MessageSquareText, Music2, UsersRound } from 'lucide-react';

export default function CommunityPage() {
    return (
        <CommunityRoutePage
            eyebrow="팀 커뮤니티"
            title="예배 후 말씀, 묵상, 피드백이 팀별로 이어집니다."
            description="각 예배팀은 콘티와 라이브 큐 로그를 바탕으로 설교 묵상, 세션 피드백, 케어 follow-up, 다음 예배 준비를 같은 공간에서 나눕니다."
            primaryAction={{ href: '/dashboard', label: '오늘 예배 보기' }}
            secondaryAction={{ href: '/dashboard/songs', label: '콘티 열기' }}
            metrics={[
                {
                    label: '팀',
                    value: '3개',
                    detail: '주일 2부팀, 청년 예배팀, 금요기도회팀을 그룹별로 분리합니다.',
                },
                {
                    label: '묵상',
                    value: '2개',
                    detail: '말씀 질문과 팀 피드백 스레드가 예배 후 열립니다.',
                },
                {
                    label: '후속조치',
                    value: '5건',
                    detail: '케어, 공지, 다음 리허설 준비를 한 곳에서 추적합니다.',
                },
            ]}
            sections={[
                {
                    icon: Music2,
                    title: '예배팀별 공간',
                    description: '예배팀마다 콘티, 세션, 공지, 묵상 스레드가 따로 묶입니다.',
                    items: ['주일 2부팀', '청년 예배팀', '금요기도회팀'],
                    href: '/dashboard',
                    actionLabel: '운영판 보기',
                },
                {
                    icon: BookOpenCheck,
                    title: '말씀 묵상 공유',
                    description: '설교 본문과 나눔 질문을 예배 후 팀 커뮤니티에 고정합니다.',
                    items: ['본문과 핵심 질문', '소그룹 나눔', '읽음과 댓글'],
                },
                {
                    icon: MessageSquareText,
                    title: '라이브 큐 피드백',
                    description: '예배 중 보낸 빠르요, 느려요, 섹션 큐를 다음 리허설 자료로 남깁니다.',
                    items: ['큐 로그 리뷰', '악기장 코멘트', '다음 주 보완점'],
                },
                {
                    icon: HeartHandshake,
                    title: '케어와 follow-up',
                    description: '기도제목과 케어 요청은 공개 범위에 맞춰 안전하게 이어집니다.',
                    items: ['공개/리더/비공개 분류', '담당자 지정', '응답 기록'],
                    href: '/care',
                    actionLabel: '케어 보기',
                },
                {
                    icon: UsersRound,
                    title: '그룹 연결',
                    description: '예배 후 묵상이 소그룹과 섬김팀의 다음 만남으로 연결됩니다.',
                    items: ['소그룹 초대', '섬김 요청', '새가족 후속 안내'],
                    href: '/groups',
                    actionLabel: '그룹 보기',
                },
            ]}
        />
    );
}
