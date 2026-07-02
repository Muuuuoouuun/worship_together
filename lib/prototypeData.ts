export type WorshipPhase = 'before' | 'during' | 'after';
export type ReadinessState = 'ready' | 'checking' | 'needs-help';
export type TaskState = 'done' | 'active' | 'waiting';
export type NotificationKind = 'score' | 'notice' | 'cue' | 'community';

export interface WorkflowTask {
    detail: string;
    owner: string;
    state: TaskState;
    title: string;
}

export interface SectionReadiness {
    checksDone: number;
    checksTotal: number;
    cue: string;
    members: string[];
    name: string;
    note: string;
    state: ReadinessState;
}

export interface SetlistSongSnapshot {
    bpm: number;
    key: string;
    note: string;
    pages: number;
    sectionCue: string;
    title: string;
}

export interface TeamNotification {
    detail: string;
    kind: NotificationKind;
    title: string;
    urgent?: boolean;
}

export interface TeamStat {
    detail: string;
    label: string;
    value: string;
}

export interface CommunityPost {
    author: string;
    detail: string;
    reactions: string;
    title: string;
    type: string;
}

export interface WorshipTeamSnapshot {
    activePhase: WorshipPhase;
    community: CommunityPost[];
    groupLabel: string;
    id: string;
    leader: string;
    live: {
        bpm: number;
        cues: string[];
        page: number;
        section: string;
    };
    location: string;
    name: string;
    nextAction: string;
    notifications: TeamNotification[];
    readiness: SectionReadiness[];
    serviceName: string;
    serviceTime: string;
    setlist: SetlistSongSnapshot[];
    stats: TeamStat[];
    theme: string;
    workflow: Record<WorshipPhase, WorkflowTask[]>;
}

export const phaseLabels: Record<WorshipPhase, string> = {
    before: '예배 전',
    during: '예배 중',
    after: '예배 후',
};

export const phaseDescriptions: Record<WorshipPhase, string> = {
    before: '콘티, 공지, 악보, 개인 준비 체크를 한 화면에서 정리합니다.',
    during: '악보 페이지, 드럼 BPM, 인도자/악기장 큐를 빠르게 공유합니다.',
    after: '말씀 묵상, 피드백, 다음 섬김 연결을 팀 커뮤니티로 이어갑니다.',
};

export const worshipPrototypeTeams: WorshipTeamSnapshot[] = [
    {
        id: 'sunday-main',
        name: '주일 2부팀',
        groupLabel: 'Main Sunday Team',
        serviceName: '주일 2부 예배',
        serviceTime: '7월 5일 주일 11:00',
        location: '본당',
        leader: '김하은 인도자',
        theme: '신실하신 하나님',
        activePhase: 'before',
        nextAction: '드럼 엔딩 카운트 확인 후 전체 공지 발송',
        live: {
            bpm: 72,
            cues: ['브릿지 2번 반복', '드럼 하이햇 살짝 느리게', '다음 섹션: 후렴'],
            page: 3,
            section: 'Chorus',
        },
        setlist: [
            {
                title: '믿음으로 서리라',
                key: 'D',
                bpm: 72,
                pages: 6,
                sectionCue: '후렴 뒤 2마디 쉼',
                note: '오프닝은 패드만 시작',
            },
            {
                title: '주님의 은혜',
                key: 'G',
                bpm: 68,
                pages: 5,
                sectionCue: '브릿지 2회',
                note: '마지막 후렴 반복',
            },
            {
                title: '보내소서',
                key: 'A',
                bpm: 76,
                pages: 7,
                sectionCue: '엔딩 태그 길게',
                note: '말씀 전 기도 연결',
            },
        ],
        readiness: [
            {
                name: '인도자',
                members: ['김하은'],
                state: 'ready',
                checksDone: 4,
                checksTotal: 4,
                cue: '말씀 전 기도 멘트 확인',
                note: '콘티와 공지 모두 확인됨',
            },
            {
                name: '보컬',
                members: ['박민서', '이유진'],
                state: 'checking',
                checksDone: 3,
                checksTotal: 4,
                cue: '2곡 브릿지 화음 진입',
                note: '유진 파트만 리허설 후 확정',
            },
            {
                name: '건반',
                members: ['최다니엘'],
                state: 'ready',
                checksDone: 4,
                checksTotal: 4,
                cue: 'Pad A 프리셋',
                note: '악보와 BPM 프리셋 확인',
            },
            {
                name: '드럼',
                members: ['정요셉'],
                state: 'needs-help',
                checksDone: 2,
                checksTotal: 4,
                cue: '엔딩 카운트 확정 필요',
                note: '3곡 마지막 컷오프 요청',
            },
            {
                name: '미디어',
                members: ['장미나'],
                state: 'checking',
                checksDone: 3,
                checksTotal: 4,
                cue: '말씀 본문 슬라이드',
                note: '본문 최종 문구 대기',
            },
        ],
        workflow: {
            before: [
                {
                    title: '콘티 공유',
                    owner: '인도자',
                    state: 'done',
                    detail: '3곡 순서, 키, BPM, 섹션 큐를 팀 전체에 공유했습니다.',
                },
                {
                    title: '악보 확인',
                    owner: '각 세션',
                    state: 'active',
                    detail: '드럼과 미디어가 마지막 확인 중입니다.',
                },
                {
                    title: '공지사항 발송',
                    owner: '팀장',
                    state: 'waiting',
                    detail: '말씀 본문과 엔딩 카운트가 확정되면 발송됩니다.',
                },
            ],
            during: [
                {
                    title: '악보 페이지 동기화',
                    owner: '인도자',
                    state: 'active',
                    detail: '현재 3페이지, Chorus 섹션을 기준으로 팔로워가 따라갑니다.',
                },
                {
                    title: '드럼 BPM',
                    owner: '악기장',
                    state: 'active',
                    detail: '72 BPM 블링크 메트로놈이 켜져 있습니다.',
                },
                {
                    title: '실시간 버튼 큐',
                    owner: '인도자/악기장',
                    state: 'done',
                    detail: '빠르요, 느려요, 브릿지, 다음 섹션 큐를 즉시 보냅니다.',
                },
            ],
            after: [
                {
                    title: '말씀 묵상 공유',
                    owner: '소그룹 리더',
                    state: 'active',
                    detail: '오늘 설교 질문과 팀별 묵상 스레드가 열렸습니다.',
                },
                {
                    title: '예배 피드백',
                    owner: '팀장',
                    state: 'waiting',
                    detail: '큐 로그를 바탕으로 다음 리허설 보완점을 남깁니다.',
                },
                {
                    title: '다음 주 준비',
                    owner: '콘티 담당',
                    state: 'waiting',
                    detail: '이번 콘티를 템플릿으로 복제할 수 있습니다.',
                },
            ],
        },
        notifications: [
            {
                kind: 'score',
                title: '악보 업데이트',
                detail: '보내소서 A키 7p 버전이 방금 교체되었습니다.',
                urgent: true,
            },
            {
                kind: 'notice',
                title: '공지 대기',
                detail: '말씀 본문 확정 후 전체 세션에 발송하세요.',
            },
            {
                kind: 'cue',
                title: '라이브 큐 프리셋',
                detail: '빠르요/느려요/브릿지/다음 섹션 버튼이 준비됨.',
            },
        ],
        stats: [
            { label: '준비율', value: '80%', detail: '20개 체크 중 16개 완료' },
            { label: '콘티 사용', value: '12회', detail: '최근 90일 기준 반복 사용' },
            { label: '알림', value: '3건', detail: '악보 1, 공지 1, 큐 1' },
        ],
        community: [
            {
                type: '말씀',
                title: '시편 95편 묵상 질문',
                author: '담임목사',
                detail: '오늘의 예배가 감사에서 순종으로 이어지도록 함께 나눕니다.',
                reactions: '8명 읽음',
            },
            {
                type: '팀 피드백',
                title: '리허설 후 보완점',
                author: '김하은',
                detail: '브릿지 진입 전 두 마디를 더 비워두기로 했습니다.',
                reactions: '댓글 4',
            },
        ],
    },
    {
        id: 'youth',
        name: '청년 예배팀',
        groupLabel: 'Youth Team',
        serviceName: '청년부 토요예배',
        serviceTime: '7월 4일 토요일 18:30',
        location: '비전홀',
        leader: '서준 리더',
        theme: '다시 시작하는 믿음',
        activePhase: 'during',
        nextAction: '찬양 후 묵상 질문을 청년 소그룹에 고정',
        live: {
            bpm: 84,
            cues: ['일렉 솔로 4마디', '후렴 바로 진입', '미디어 다음 가사'],
            page: 2,
            section: 'Bridge',
        },
        setlist: [
            {
                title: '다시 주께',
                key: 'E',
                bpm: 84,
                pages: 5,
                sectionCue: 'Bridge 바로 진입',
                note: '일렉 리드 시작',
            },
            {
                title: '나의 고백',
                key: 'B',
                bpm: 70,
                pages: 4,
                sectionCue: '기도 후 잔잔히',
                note: '보컬 유니즌',
            },
        ],
        readiness: [
            {
                name: '인도자',
                members: ['서준'],
                state: 'ready',
                checksDone: 4,
                checksTotal: 4,
                cue: '청년 소그룹 질문 연결',
                note: '예배 후 나눔까지 준비됨',
            },
            {
                name: '기타',
                members: ['태오', '현우'],
                state: 'ready',
                checksDone: 4,
                checksTotal: 4,
                cue: '1곡 솔로 4마디',
                note: '톤 프리셋 저장됨',
            },
            {
                name: '드럼',
                members: ['유찬'],
                state: 'checking',
                checksDone: 3,
                checksTotal: 4,
                cue: '84 BPM 유지',
                note: '클릭 볼륨만 확인 필요',
            },
            {
                name: '미디어',
                members: ['소율'],
                state: 'ready',
                checksDone: 4,
                checksTotal: 4,
                cue: '다음 가사 빠르게',
                note: '가사 싱크 확인됨',
            },
        ],
        workflow: {
            before: [
                {
                    title: '콘티 생성',
                    owner: '서준',
                    state: 'done',
                    detail: '지난달 청년부 선곡 통계를 참고해 2곡 콘티를 만들었습니다.',
                },
                {
                    title: '세션 공지',
                    owner: '악기장',
                    state: 'done',
                    detail: '기타 톤과 드럼 클릭 세팅을 공지했습니다.',
                },
                {
                    title: '소그룹 연결',
                    owner: '소그룹 리더',
                    state: 'active',
                    detail: '예배 후 나눔 질문을 준비 중입니다.',
                },
            ],
            during: [
                {
                    title: '라이브 큐',
                    owner: '인도자',
                    state: 'active',
                    detail: '후렴 진입과 가사 전환 큐가 실시간으로 표시됩니다.',
                },
                {
                    title: 'BPM 유지',
                    owner: '드럼',
                    state: 'active',
                    detail: '84 BPM 기준으로 빠르요/느려요 버튼을 확인합니다.',
                },
                {
                    title: '악보 넘기기',
                    owner: '팔로워',
                    state: 'active',
                    detail: '현재 2페이지 Bridge를 따라가고 있습니다.',
                },
            ],
            after: [
                {
                    title: '청년 묵상',
                    owner: '소그룹 리더',
                    state: 'active',
                    detail: '말씀 질문을 팀 커뮤니티에 고정합니다.',
                },
                {
                    title: '피드백 수집',
                    owner: '악기장',
                    state: 'waiting',
                    detail: '라이브 큐 로그에서 박자 이슈를 확인합니다.',
                },
                {
                    title: '다음 콘티 초안',
                    owner: '서준',
                    state: 'waiting',
                    detail: '청년부 선호곡 통계를 확인합니다.',
                },
            ],
        },
        notifications: [
            {
                kind: 'cue',
                title: '실시간 큐',
                detail: '미디어 다음 가사 요청이 방금 전송됨.',
                urgent: true,
            },
            {
                kind: 'community',
                title: '묵상 스레드',
                detail: '청년 소그룹 3개가 오늘 질문을 받았습니다.',
            },
        ],
        stats: [
            { label: '라이브 큐', value: '9개', detail: '이번 예배 중 전송' },
            { label: 'BPM 편차', value: '+1', detail: '목표 대비 평균' },
            { label: '묵상 참여', value: '18명', detail: '예배 후 1시간 내' },
        ],
        community: [
            {
                type: '묵상',
                title: '다시 시작하는 믿음',
                author: '서준',
                detail: '실패 이후에도 하나님께 돌아가는 실제 선택을 나눕니다.',
                reactions: '댓글 7',
            },
            {
                type: '공지',
                title: '다음 주 청년 찬양팀 모집',
                author: '운영팀',
                detail: '베이스와 싱어 1명씩 추가 섬김이 필요합니다.',
                reactions: '지원 2',
            },
        ],
    },
    {
        id: 'friday-prayer',
        name: '금요기도회팀',
        groupLabel: 'Friday Prayer Team',
        serviceName: '금요기도회',
        serviceTime: '7월 3일 금요일 20:00',
        location: '기도실',
        leader: '한지우 간사',
        theme: '중보와 회복',
        activePhase: 'after',
        nextAction: '기도제목 비공개 범위를 확인하고 리더 follow-up 지정',
        live: {
            bpm: 64,
            cues: ['기도 반주 유지', '다음 중보 제목', '보컬 마이크 낮게'],
            page: 5,
            section: 'Prayer',
        },
        setlist: [
            {
                title: '주의 임재 안에',
                key: 'C',
                bpm: 64,
                pages: 8,
                sectionCue: '기도 반주 길게',
                note: '말씀 후 자연스럽게',
            },
            {
                title: '회복의 노래',
                key: 'F',
                bpm: 66,
                pages: 6,
                sectionCue: '중보기도 뒤 반복',
                note: '엔딩은 자유롭게',
            },
        ],
        readiness: [
            {
                name: '인도자',
                members: ['한지우'],
                state: 'ready',
                checksDone: 4,
                checksTotal: 4,
                cue: '중보 제목 순서',
                note: '기도 흐름 공유됨',
            },
            {
                name: '건반',
                members: ['윤서'],
                state: 'ready',
                checksDone: 4,
                checksTotal: 4,
                cue: '기도 반주 유지',
                note: '패드와 피아노 밸런스 확인',
            },
            {
                name: '보컬',
                members: ['나은'],
                state: 'checking',
                checksDone: 3,
                checksTotal: 4,
                cue: '마이크 낮게',
                note: '기도 중 음량 조정 필요',
            },
            {
                name: '케어',
                members: ['중보팀'],
                state: 'needs-help',
                checksDone: 2,
                checksTotal: 4,
                cue: '비공개 요청 분류',
                note: '긴급 기도제목 담당자 지정 필요',
            },
        ],
        workflow: {
            before: [
                {
                    title: '기도 제목 정리',
                    owner: '중보팀',
                    state: 'done',
                    detail: '공개/리더 전용/비공개 기준으로 정리했습니다.',
                },
                {
                    title: '콘티 공유',
                    owner: '인도자',
                    state: 'done',
                    detail: '기도 흐름 중심으로 2곡 콘티를 공유했습니다.',
                },
                {
                    title: '케어 경계 확인',
                    owner: '케어 리더',
                    state: 'active',
                    detail: '긴급 요청 담당자를 지정 중입니다.',
                },
            ],
            during: [
                {
                    title: '기도 반주',
                    owner: '건반',
                    state: 'done',
                    detail: '64 BPM 기준으로 길게 유지했습니다.',
                },
                {
                    title: '중보 섹션 알림',
                    owner: '인도자',
                    state: 'done',
                    detail: '다음 중보 제목 큐가 공유되었습니다.',
                },
                {
                    title: '미디어/음향',
                    owner: '미디어',
                    state: 'active',
                    detail: '보컬 마이크를 낮추는 요청이 기록되었습니다.',
                },
            ],
            after: [
                {
                    title: '말씀/기도 묵상 공유',
                    owner: '인도자',
                    state: 'active',
                    detail: '기도회 후 묵상 스레드가 열렸습니다.',
                },
                {
                    title: '케어 follow-up',
                    owner: '케어 리더',
                    state: 'active',
                    detail: '비공개 요청을 담당자별로 나눕니다.',
                },
                {
                    title: '다음 기도회 준비',
                    owner: '중보팀',
                    state: 'waiting',
                    detail: '이번 주 응답/간증을 다음 공지로 연결합니다.',
                },
            ],
        },
        notifications: [
            {
                kind: 'community',
                title: '비공개 기도제목',
                detail: '리더 전용 요청 2건의 담당자 지정이 필요합니다.',
                urgent: true,
            },
            {
                kind: 'score',
                title: '기도 반주 악보',
                detail: '주의 임재 안에 8p 악보가 케어팀에도 공유됨.',
            },
        ],
        stats: [
            { label: '기도제목', value: '14건', detail: '공개 9, 리더 3, 비공개 2' },
            { label: '후속조치', value: '5건', detail: '케어 리더 지정 필요' },
            { label: '묵상', value: '11명', detail: '기도회 후 읽음' },
        ],
        community: [
            {
                type: '기도',
                title: '중보와 회복을 위한 나눔',
                author: '한지우',
                detail: '오늘 받은 마음과 계속 기도할 제목을 안전하게 공유합니다.',
                reactions: '기도 12',
            },
            {
                type: '케어',
                title: '비공개 follow-up 안내',
                author: '케어 리더',
                detail: '리더 전용 요청은 담당자만 볼 수 있도록 묶었습니다.',
                reactions: '담당 3',
            },
        ],
    },
];
