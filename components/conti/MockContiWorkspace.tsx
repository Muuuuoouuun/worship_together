'use client';

import { useMemo, useState } from 'react';
import ContiWorkspace, { type WorkspaceMode } from './ContiWorkspace';
import type { ContiData } from './context';
import { MEMBERS, MOCK_FEED_SEEN_AT, MOCK_MEMBERS, MOCK_NOW, MOCK_VIEWER_ID, SETLISTS, THIS_WEEK_SETLIST_ID, TODAY, buildMockPlanningState } from './mockData';
import type { ScreenId } from './model';
import { buildPlanningView } from './planningBridge';
import { useMemoryPlanning } from './usePlanning';

/** 디자인 시안 페이지: 목업 데이터를 실제 화면과 같은 변환·명령 규칙으로 보여줍니다. 저장은 메모리에만 합니다. */
export default function MockContiWorkspace({ initialScreen, mode }: { initialScreen: ScreenId; mode: WorkspaceMode }) {
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

    return <ContiWorkspace data={data} initialScreen={initialScreen} mode={mode} />;
}
