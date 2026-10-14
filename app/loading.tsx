/** 앱 틀 바깥 화면(/login, /invite, /session)을 불러오는 동안의 조용한 표시 */
export default function GlobalLoading() {
    return (
        <div role="status" className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 px-4">
            <span aria-hidden="true" className="size-6 animate-spin rounded-full border-2 border-muted border-t-foreground motion-reduce:animate-none" />
            <p className="text-xs text-muted-foreground">페이지를 불러오는 중입니다...</p>
        </div>
    );
}
