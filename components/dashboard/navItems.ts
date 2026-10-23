import {
    BadgeCheck,
    BookOpen,
    CalendarDays,
    HandHeart,
    HeartHandshake,
    LayoutGrid,
    ListMusic,
    Network,
    UsersRound,
    type LucideIcon,
} from 'lucide-react';

export type NavItem = {
    icon: LucideIcon;
    label: string;
    href: string;
    description?: string;
};

export const primaryNavItems: NavItem[] = [
    { icon: LayoutGrid, label: '오늘', href: '/dashboard', description: '이번 주 예배 준비와 현황' },
    { icon: ListMusic, label: '콘티·악보', href: '/dashboard/songs', description: '곡 목록과 콘티 구성' },
    { icon: CalendarDays, label: '일정·요청', href: '/dashboard/planning', description: '연습 일정과 인도자 소통' },
    { icon: UsersRound, label: '팀·초대', href: '/dashboard/team', description: '팀원 관리 및 역할 배정' },
];

export const secondaryNavItems: NavItem[] = [
    { icon: HeartHandshake, label: '팀 커뮤니티', href: '/community', description: '예배 후 묵상과 나눔' },
    { icon: HandHeart, label: '케어', href: '/care', description: '기도제목과 돌봄 요청' },
    { icon: BadgeCheck, label: '섬김', href: '/serve', description: '봉사 및 봉사자 연결' },
    { icon: Network, label: '그룹', href: '/groups', description: '소그룹 및 사역팀' },
];

export const guideNavItem: NavItem = { icon: BookOpen, label: '처음 사용 안내', href: '/guide', description: '역할별 따라 하기 · 용어 · 예배 화면 연습' };

/** 현재 주소에서 이 메뉴가 선택됐는지 (하위 화면도 포함: /dashboard/songs/library → 콘티·악보) */
export function isNavActive(pathname: string, href: string): boolean {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname === href || pathname.startsWith(`${href}/`);
}
