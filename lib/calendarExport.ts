import { planningDate, type TeamSchedule } from '@/types/planning';
import { worshipRoles, type WorshipRole } from '@/types/team';

function formatToIcsDate(isoString: string): string {
    const d = new Date(isoString);
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
        d.getUTCFullYear() +
        pad(d.getUTCMonth() + 1) +
        pad(d.getUTCDate()) +
        'T' +
        pad(d.getUTCHours()) +
        pad(d.getUTCMinutes()) +
        pad(d.getUTCSeconds()) +
        'Z'
    );
}

function escapeIcsText(str: string): string {
    return str
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n');
}

export function generateIcsContent(
    event: TeamSchedule,
    teamName = '예배팀',
    memberNames?: Map<string, string>
): string {
    const startStr = formatToIcsDate(event.startsAt);
    const endStr = formatToIcsDate(event.endsAt);
    const nowStr = formatToIcsDate(new Date().toISOString());
    const uid = `${event.id}@worshiptogether.app`;

    const roleLines: string[] = [];
    if (event.slots.length > 0) {
        for (const slot of event.slots) {
            const roleName = worshipRoles[slot.role as WorshipRole] ?? slot.role;
            const person = slot.memberId
                ? memberNames?.get(slot.memberId) ?? '팀원'
                : '미정(빈자리)';
            roleLines.push(`• ${roleName}: ${person}`);
        }
    }

    const descParts: string[] = [
        `[${teamName}] ${event.title}`,
        `일시: ${planningDate(event.startsAt)}`,
    ];
    if (event.location) descParts.push(`장소: ${event.location}`);
    if (event.setlistTitle) {
        descParts.push(
            `콘티: ${event.setlistTitle}${event.setlistSongs?.length ? ` (${event.setlistSongs.join(', ')})` : ''}`
        );
    }
    if (event.notes) descParts.push(`메모: ${event.notes}`);
    if (roleLines.length > 0) {
        descParts.push('\n<섬김 명단>\n' + roleLines.join('\n'));
    }

    const description = escapeIcsText(descParts.join('\n'));
    const summary = escapeIcsText(`[${teamName}] ${event.title}`);
    const location = escapeIcsText(event.location || '');

    return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Worship Together//Schedule//KO',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${nowStr}`,
        `DTSTART:${startStr}`,
        `DTEND:${endStr}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${description}`,
        location ? `LOCATION:${location}` : '',
        'STATUS:CONFIRMED',
        'END:VEVENT',
        'END:VCALENDAR',
    ]
        .filter(Boolean)
        .join('\r\n');
}

export function downloadIcsFile(
    event: TeamSchedule,
    teamName = '예배팀',
    memberNames?: Map<string, string>
) {
    if (typeof window === 'undefined') return;
    const content = generateIcsContent(event, teamName, memberNames);
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeTitle = event.title.replace(/[/\\?%*:|"<>]/g, '_');
    link.download = `${safeTitle}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

export function getGoogleCalendarUrl(
    event: TeamSchedule,
    teamName = '예배팀',
    memberNames?: Map<string, string>
): string {
    const startStr = formatToIcsDate(event.startsAt);
    const endStr = formatToIcsDate(event.endsAt);
    const title = `[${teamName}] ${event.title}`;

    const roleLines: string[] = [];
    if (event.slots.length > 0) {
        for (const slot of event.slots) {
            const roleName = worshipRoles[slot.role as WorshipRole] ?? slot.role;
            const person = slot.memberId
                ? memberNames?.get(slot.memberId) ?? '팀원'
                : '미정';
            roleLines.push(`• ${roleName}: ${person}`);
        }
    }

    const descParts: string[] = [];
    if (event.setlistTitle) {
        descParts.push(
            `콘티: ${event.setlistTitle}${event.setlistSongs?.length ? ` (${event.setlistSongs.join(', ')})` : ''}`
        );
    }
    if (event.notes) descParts.push(`메모: ${event.notes}`);
    if (roleLines.length > 0) {
        descParts.push('\n[섬김 명단]\n' + roleLines.join('\n'));
    }

    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: title,
        dates: `${startStr}/${endStr}`,
        details: descParts.join('\n'),
        location: event.location || '',
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function getMyGoogleCalendarUrl(
    event: TeamSchedule,
    slotRole: WorshipRole,
    teamName = '예배팀'
): string {
    const startStr = formatToIcsDate(event.startsAt);
    const endStr = formatToIcsDate(event.endsAt);
    const roleName = worshipRoles[slotRole] ?? slotRole;
    const title = `[${teamName}] ${event.title} (${roleName})`;

    const descParts: string[] = [
        `내 담당 사역: ${roleName}`,
        `일시: ${planningDate(event.startsAt)}`,
    ];
    if (event.location) descParts.push(`장소: ${event.location}`);
    if (event.setlistTitle) {
        descParts.push(`콘티: ${event.setlistTitle}${event.setlistSongs?.length ? ` (${event.setlistSongs.join(', ')})` : ''}`);
    }
    if (event.notes) descParts.push(`메모: ${event.notes}`);

    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: title,
        dates: `${startStr}/${endStr}`,
        details: descParts.join('\n'),
        location: event.location || '',
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function generateMyScheduleShareText(
    items: Array<{ event: TeamSchedule; role: WorshipRole }>,
    memberName: string
): string {
    if (items.length === 0) return `[⛪ ${memberName}님의 사역 일정]\n예정된 사역 일정이 없습니다.`;
    const lines = [`[⛪ ${memberName}님의 사역 일정 안내]\n`];
    for (const { event, role } of items) {
        const dateStr = planningDate(event.startsAt);
        const roleName = worshipRoles[role] ?? role;
        const setlist = event.setlistTitle ? `\n  - 콘티: ${event.setlistTitle}${event.setlistSongs?.length ? ` (${event.setlistSongs.length}곡)` : ''}` : '';
        lines.push(`■ ${event.title} [${roleName}]`);
        lines.push(`  - 일시: ${dateStr}`);
        if (event.location) lines.push(`  - 장소: ${event.location}`);
        if (setlist) lines.push(`  ${setlist}`);
    }
    lines.push(`\n총 ${items.length}회 사역 예정입니다.`);
    return lines.join('\n');
}
