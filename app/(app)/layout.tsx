import DashboardLayout from '@/components/dashboard/DashboardLayout';

/** 대시보드·커뮤니티 화면이 함께 쓰는 틀. 화면을 옮겨도 사이드바와 하단 내비는 그대로 남습니다. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
    return <DashboardLayout>{children}</DashboardLayout>;
}
