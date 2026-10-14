import Link from 'next/link';
import { HelpCircle, Home, Music } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import StatusScreen from './StatusScreen';

export default function NotFound() {
    return (
        <StatusScreen
            icon={HelpCircle}
            eyebrow="404 Error"
            title="요청하신 페이지를 찾을 수 없습니다"
            description="페이지 주소가 잘못되었거나, 이동 또는 삭제되어 표시할 수 없습니다."
            actions={
                <>
                    <Link href="/dashboard" className={buttonVariants()}>
                        <Home aria-hidden="true" />
                        오늘로 가기
                    </Link>
                    <Link href="/dashboard/songs" className={buttonVariants({ variant: 'outline' })}>
                        <Music aria-hidden="true" />
                        콘티·악보
                    </Link>
                </>
            }
        />
    );
}
