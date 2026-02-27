const PURE_ROMAN = /^(I{1,3}|IV|VI{0,3}|IX|X{1,3})$/i;
const PURE_DIGIT = /^[1-9][0-9]?$/;
const BLOK_CODE_SUFFIX = /\s+[A-Z]{1,3}(\s+\d+)?$/;

function normalize(name) {
    return name
        .toUpperCase()
        .replace(/^(PERUM\.?|PERUMAHAN|KOMPLEK|KOMPLEX|KMP\.?|PERUMNAS)\s+/i, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function extractUnitNumber(name) {
    const parts = name.trim().split(' ');
    if (parts.length < 2) return { num: null, base: name };

    const last = parts[parts.length - 1];
    const secondLast = parts[parts.length - 2];

    const isRoman = PURE_ROMAN.test(last);
    const isDigit = PURE_DIGIT.test(last);

    if (!isRoman && !isDigit) return { num: null, base: name };

    // Kalau digit, cek apakah didahului kode huruf (misal "AD 14" → 14 bukan nomor unit)
    if (isDigit && secondLast) {
        const prevIsAlphaCode = /^[A-Z]{1,3}$/.test(secondLast) && !PURE_ROMAN.test(secondLast);
        if (prevIsAlphaCode) return { num: null, base: name };
    }

    return { num: last.toUpperCase(), base: parts.slice(0, -1).join(' ') };
}

function hasDifferentUnitNumber(a, b) {
    const { num: numA } = extractUnitNumber(a);
    const { num: numB } = extractUnitNumber(b);
    if (numA && numB) return numA !== numB;
    if (numA && !numB) return true;
    if (!numA && numB) return true;
    return false;
}

function similarityForGrouping(a, b) {
    const { base: baseA } = extractUnitNumber(a);
    const { base: baseB } = extractUnitNumber(b);

    const cleanA = baseA.replace(BLOK_CODE_SUFFIX, '').trim();
    const cleanB = baseB.replace(BLOK_CODE_SUFFIX, '').trim();

    const shorter = cleanA.length <= cleanB.length ? cleanA : cleanB;
    const longer  = cleanA.length <= cleanB.length ? cleanB : cleanA;
    if (shorter && longer.startsWith(shorter)) return 0.95;

    const maxLen = Math.max(cleanA.length, cleanB.length);
    if (maxLen === 0) return 1;

    const m = cleanA.length, n = cleanB.length;
    const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = cleanA[i - 1] === cleanB[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return 1 - dp[m][n] / maxLen;
}

function labelScore(norm) {
    const { num } = extractUnitNumber(norm);
    if (num) return [0, norm.length];
    if (BLOK_CODE_SUFFIX.test(norm)) return [1, norm.length];
    return [2, norm.length];
}

const SIMILARITY_THRESHOLD = 0.75;

export function groupAddresses(rawAddresses) {
    if (!rawAddresses || rawAddresses.length === 0) return [];

    const normalized = rawAddresses.map(a => ({ original: a, norm: normalize(a) }));
    const parent = normalized.map((_, i) => i);

    function find(i) {
        while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
        return i;
    }
    function union(i, j) {
        const pi = find(i), pj = find(j);
        if (pi !== pj) parent[pi] = pj;
    }

    for (let i = 0; i < normalized.length; i++) {
        for (let j = i + 1; j < normalized.length; j++) {
            const a = normalized[i].norm;
            const b = normalized[j].norm;
            if (hasDifferentUnitNumber(a, b)) continue;
            if (similarityForGrouping(a, b) >= SIMILARITY_THRESHOLD) union(i, j);
        }
    }

    const clusters = new Map();
    for (let i = 0; i < normalized.length; i++) {
        const root = find(i);
        if (!clusters.has(root)) clusters.set(root, []);
        clusters.get(root).push(i);
    }

    const groups = [];
    for (const [, members] of clusters) {
        const originals = members.map(i => normalized[i].original);
        const norms = members.map(i => normalized[i].norm);

        const label = norms.reduce((best, cur) => {
            const [sb, lb] = labelScore(best);
            const [sc, lc] = labelScore(cur);
            if (sc > sb) return cur;
            if (sc === sb && lc > lb) return cur;
            return best;
        });

        groups.push({ label, members: originals, normalizedMembers: norms });
    }

    groups.sort((a, b) => a.label.localeCompare(b.label));

    console.log('[address-grouper] Groups:\n  ' + groups.map(g =>
        `"${g.label}" ← [${g.members.join(', ')}]`
    ).join('\n  '));

    return groups;
}

export function buildAddressLookup(groups) {
    const lookup = new Map();
    for (const group of groups) {
        for (const member of group.members) lookup.set(member, group.label);
    }
    return lookup;
}

export function matchesByGroup(pelangganAlamat, selectedGroupLabel, lookup) {
    if (!selectedGroupLabel) return true;
    return lookup.get(pelangganAlamat) === selectedGroupLabel;
}