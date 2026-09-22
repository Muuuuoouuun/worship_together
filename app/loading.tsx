export default function GlobalLoading() {
    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4">
            <div className="relative flex h-12 w-12 items-center justify-center">
                <div className="absolute h-12 w-12 animate-ping rounded-full bg-primary/20" />
                <div className="h-8 w-8 animate-spin rounded-full border-3 border-primary border-t-transparent" />
            </div>
            <p className="text-xs font-medium text-muted-foreground animate-pulse">
                페이지를 불러오는 중입니다...
            </p>
        </div>
    );
}
