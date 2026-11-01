'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { ContiProvider, type ContiData } from '@/components/conti/context';
import { MEMBERS, MOCK_FEED_SEEN_AT, MOCK_MEMBERS, MOCK_NOW, MOCK_VIEWER_ID, SETLISTS, THIS_WEEK_SETLIST_ID, TODAY, buildMockPlanningState } from '@/components/conti/mockData';
import { buildPlanningView } from '@/components/conti/planningBridge';
import { useMemoryPlanning } from '@/components/conti/usePlanning';

/**
 * 데스크톱 홈 시안이 함께 쓰는 목업 데이터. 모바일 기준 화면(콘티·순서 리디자인의 '이번 주')과
 * 같은 데이터·같은 변환 규칙(useConti)을 쓰므로, 시안은 화면 모양만 다르고 내용은 같습니다.
 */
export default function HomeDraftProvider({ children }: { children: ReactNode }) {
    const [initial] = useState(buildMockPlanningState);
    const [feedSeenAt, setFeedSeenAt] = useState<string>(MOCK_FEED_SEEN_AT);
    const planning = useMemoryPlanning(initial, MOCK_MEMBERS, MOCK_VIEWER_ID);

    const data = useMemo<ContiData>(() => {
        const built = buildPlanningView({ state: planning.state, members: planning.members, userId: MOCK_VIEWER_ID, today: TODAY, now: MOCK_NOW, setlists: SETLISTS, feedSeenAt });
        return {
            today: TODAY,
            setlists: SETLISTS,
            thisWeekId: THIS_WEEK_SETLIST_ID,
            editor: null,
            roster: MEMBERS.map((item) => item.name),
            planning: {
                ...built,
                sample: true,
                ready: true,
                busy: planning.busy,
                error: planning.error,
                actions: { dispatch: planning.dispatch, markFeedSeen: setFeedSeenAt },
                planningHref: '/dashboard/planning',
            },
        };
    }, [planning, feedSeenAt]);

    return <ContiProvider value={data}>{children}</ContiProvider>;
}
