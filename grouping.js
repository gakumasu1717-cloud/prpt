const VERSION_PATTERNS = [
    /^(.*?)[\s._-]+(?:v(?:er(?:sion)?)?|rev(?:ision)?|r)\s*([0-9]+(?:\.[0-9a-z]+){0,4}(?:[-+][0-9a-z.-]+)?)\s*$/iu,
    /^(.*?)\s*[\[(（]\s*(?:v(?:er(?:sion)?)?|rev(?:ision)?|r)?\s*([0-9]+(?:\.[0-9a-z]+){0,4}(?:[-+][0-9a-z.-]+)?)\s*[\])）]\s*$/iu,
    /^(.*?\D)\s+([0-9]+(?:\.[0-9a-z]+){1,4}(?:[-+][0-9a-z.-]+)?)\s*$/iu,
    /^(.*?\D)\s+([0-9]+)\s*$/iu,
];

export function parsePresetName(name) {
    const cleanName = String(name ?? '').trim();
    for (const pattern of VERSION_PATTERNS) {
        const match = cleanName.match(pattern);
        if (!match || !match[1].trim()) continue;
        return { original: cleanName, base: tidyBase(match[1]), version: match[2] };
    }
    return { original: cleanName, base: tidyBase(cleanName), version: null };
}

function tidyBase(value) {
    return value.trim().replace(/[\s._-]+$/u, '').replace(/\s+/gu, ' ');
}

export function normalizeBase(value) {
    return tidyBase(String(value ?? ''))
        .normalize('NFKC')
        .toLocaleLowerCase()
        .replace(/(?:prompt|프롬프트)/giu, '')
        .replace(/[\p{P}\p{S}\s_]+/gu, '');
}

function bigrams(value) {
    const chars = Array.from(value);
    if (chars.length < 2) return chars;
    return chars.slice(0, -1).map((char, index) => char + chars[index + 1]);
}

export function nameSimilarity(left, right) {
    const a = normalizeBase(left);
    const b = normalizeBase(right);
    if (a === b) return 1;
    if (!a || !b) return 0;
    if (a.includes(b) || b.includes(a)) {
        return Math.min(a.length, b.length) / Math.max(a.length, b.length) >= 0.72 ? 0.92 : 0.65;
    }
    const aPairs = bigrams(a);
    const bPairs = bigrams(b);
    const remaining = [...bPairs];
    let overlap = 0;
    for (const pair of aPairs) {
        const index = remaining.indexOf(pair);
        if (index < 0) continue;
        overlap += 1;
        remaining.splice(index, 1);
    }
    return (2 * overlap) / (aPairs.length + bPairs.length || 1);
}

function versionParts(version) {
    if (!version) return [];
    return version.split(/[.+-]/u).map(part => /^\d+$/u.test(part) ? Number(part) : part.toLocaleLowerCase());
}

export function compareVersionsDesc(a, b) {
    const left = versionParts(a.version);
    const right = versionParts(b.version);
    const length = Math.max(left.length, right.length);
    for (let index = 0; index < length; index += 1) {
        const x = left[index] ?? -1;
        const y = right[index] ?? -1;
        if (x === y) continue;
        if (typeof x === 'number' && typeof y === 'number') return y - x;
        return String(y).localeCompare(String(x), undefined, { numeric: true, sensitivity: 'base' });
    }
    return a.original.localeCompare(b.original, undefined, { numeric: true, sensitivity: 'base' });
}

export function sortPresets(presets, mode = 'version-desc') {
    const sorted = [...presets];
    if (mode === 'version-asc') return sorted.sort((left, right) => compareVersionsDesc(right, left));
    if (mode === 'name-asc') return sorted.sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' }));
    if (mode === 'name-desc') return sorted.sort((left, right) => right.name.localeCompare(left.name, undefined, { numeric: true, sensitivity: 'base' }));
    return sorted.sort(compareVersionsDesc);
}

export function sortGroups(groups, mode = 'version-desc') {
    const label = group => String(group.name ?? group.base ?? '');
    const byName = (left, right) => label(left).localeCompare(label(right), undefined, { numeric: true, sensitivity: 'base' });
    if (mode === 'name-asc') return [...groups].sort(byName);
    if (mode === 'name-desc') return [...groups].sort((left, right) => byName(right, left));
    return [...groups].sort((left, right) => {
        const leftLead = sortPresets(left.presets, mode)[0] ?? { original: label(left), name: label(left), version: null };
        const rightLead = sortPresets(right.presets, mode)[0] ?? { original: label(right), name: label(right), version: null };
        const versionOrder = mode === 'version-asc' ? compareVersionsDesc(rightLead, leftLead) : compareVersionsDesc(leftLead, rightLead);
        return versionOrder || byName(left, right);
    });
}

export function buildAutoGroups(presets, threshold = 0.74) {
    const groups = [];
    for (const preset of presets) {
        const parsed = { ...preset, ...parsePresetName(preset.name) };
        let best = null;
        let bestScore = -1;
        for (const group of groups) {
            const score = nameSimilarity(parsed.base, group.base);
            if (score > bestScore) {
                best = group;
                bestScore = score;
            }
        }
        if (!best || bestScore < threshold) {
            groups.push({ base: parsed.base || parsed.original, auto: true, presets: [parsed] });
        } else {
            best.presets.push(parsed);
            if (parsed.base.length < best.base.length && parsed.base.length > 0) best.base = parsed.base;
        }
    }
    for (const group of groups) group.presets.sort(compareVersionsDesc);
    return groups.sort((a, b) => a.base.localeCompare(b.base, undefined, { numeric: true, sensitivity: 'base' }));
}
