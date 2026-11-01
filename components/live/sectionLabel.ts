/** Display names only. Preserve the original song form and all custom labels. */
export function sectionLabel(name: string): string {
    const match = /^(intro|verse|pre[ -]?chorus|chorus|bridge|interlude|outro|ending)(?:\s*(\d+))?$/i.exec(name.trim());
    if (!match) return name;
    const key = match[1].toLowerCase().replace(/[ -]/g, '');
    const number = match[2];
    if (key === 'verse') return number ? `${number}절` : '절';
    const labels: Record<string, string> = { intro: '전주', prechorus: '후렴 전', chorus: '후렴', bridge: '브릿지', interlude: '간주', outro: '마침', ending: '마침' };
    return `${labels[key]}${number ? ` ${number}` : ''}`;
}
