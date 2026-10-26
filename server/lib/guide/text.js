// Text helpers for the built-in guide (P4-03): normalise, tokenise, typo-tolerant phrase matching and
// language detection (English / French / Pidgin).

/** Lowercase, no accents, tech names joined ("Next.js" → "nextjs", "C++" → "cplusplus"), single spaces. */
export const normalize = (text) => String(text ?? '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/c\+\+/g, 'cplusplus').replace(/c#/g, 'csharp')
    .replace(/([a-z0-9])\.(?=[a-z])/g, '$1')
    .replace(/\b(node|react|vue)\s?js\b/g, '$1')
    .replace(/['’]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const tokens = (text) => {
    const n = normalize(text);
    return n ? n.split(' ') : [];
};

const editDistanceAtMost1 = (a, b) => {
    if (a === b) return true;
    if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0;
    let j = 0;
    let edits = 0;
    while (i < a.length && j < b.length) {
        if (a[i] === b[j]) {
            i += 1;
            j += 1;
            continue;
        }
        edits += 1;
        if (edits > 1) return false;
        if (a.length > b.length) i += 1;
        else if (b.length > a.length) j += 1;
        else {
            i += 1;
            j += 1;
        }
    }
    return edits + (a.length - i) + (b.length - j) <= 1;
};

/**
 * Same word, allowing a plural "s" and, when fuzzy, one typo in words of 6+ letters (5 would turn "react" into
 * "reach"). Names (projects, services, tech) are fuzzy; question keywords are not ("harvest" isn't "hardest").
 */
export const sameWord = (a, b, fuzzy = false) => {
    if (a === b) return true;
    if (a === `${b}s` || b === `${a}s`) return true;
    return fuzzy && a.length >= 6 && b.length >= 6 && editDistanceAtMost1(a, b);
};

/**
 * Does the token list contain the phrase (its words in a row)? Also matches the phrase written as one
 * word ("nova transport" in "novatransport"), for phrases of 6+ letters.
 */
export const hasPhrase = (words, phrase, { fuzzy = false } = {}) => {
    const p = typeof phrase === 'string' ? tokens(phrase) : phrase;
    if (!p.length) return false;
    for (let i = 0; i + p.length <= words.length; i += 1) {
        if (p.every((w, k) => sameWord(words[i + k], w, fuzzy))) return true;
    }
    const joined = p.join('');
    return p.length > 1 && joined.length >= 6 && words.some((w) => w === joined || (fuzzy && w.length >= 7 && editDistanceAtMost1(w, joined)));
};

// Words that point to a language. Pidgin markers count double: they rarely appear in English.
const FRENCH = new Set(['le', 'la', 'les', 'est', 'que', 'qui', 'quoi', 'comment', 'pourquoi', 'il', 'elle', 'vous', 'tu', 'je', 'des', 'une', 'avec', 'pour', 'sur', 'dans', 'combien', 'quel', 'quels', 'quelle', 'quelles', 'bonjour', 'bonsoir', 'salut', 'merci', 'travaille', 'projets', 'parle', 'ou', 'son', 'ses', 'du', 'au', 'et', 'ce', 'cette', 'sont', 'fait', 'peut', 'disponible', 'prix', 'tarif', 'langues', 'pouvez', 'votre', 'mes', 'moi', 'un', 'coute', 'connait', 'sait', 'qu', 'avez', 'ton', 'ta', 'tes', 'nous', 'faire', 'peux', 'aussi', 'travail', 'de', 'parlez', 'dites', 'montrez', 'accord']);
const PIDGIN = new Set(['wetin', 'weti', 'dey', 'abeg', 'una', 'oga', 'sabi', 'pikin', 'wahala', 'comot', 'chop', 'dem', 'wuna', 'fit', 'don', 'na', 'sef', 'ehn', 'shey', 'tok', 'helep', 'massa', 'tchop', 'mbok', 'ashia']);
// Pidgin words that are also English words: they only count next to a clear Pidgin marker.
const PIDGIN_WEAK = new Set(['fit', 'don', 'na']);

/** 'en' | 'fr' | 'pcm' (Cameroonian Pidgin) from the words used; English when unclear. */
export const detectLanguage = (text) => {
    const words = tokens(text);
    let fr = 0;
    let pcm = 0;
    let strongPidgin = false;
    for (const w of words) {
        if (FRENCH.has(w)) fr += 1;
        if (PIDGIN.has(w) && !PIDGIN_WEAK.has(w)) {
            pcm += 2;
            strongPidgin = true;
        }
    }
    if (strongPidgin) pcm += words.filter((w) => PIDGIN_WEAK.has(w)).length;
    // Pidgin patterns made of English-looking words.
    if (['how far', 'how body', 'e go', 'e don', 'e dey', 'e sabi', 'na how'].some((p) => hasPhrase(words, p))) pcm += 2;
    if (pcm >= 2 && pcm >= fr) return 'pcm';
    if (fr >= 2 || (fr === 1 && words.length <= 3)) return 'fr';
    return 'en';
};
