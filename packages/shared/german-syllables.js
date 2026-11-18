/*
 * german-syllables.js – spoken German syllables ("Sprechsilben") for syllable
 * colouring (Silbenmethode) on worksheets (MIT License).
 *
 * Used by both the editor plugin (browser, global `GermanSyllables`) and the proxy
 * (Node.js, CommonJS `require`). Keep it dependency-free and ES2015-compatible.
 *
 * API:
 *  - syllabify(word)      -> string[]  (joined they give the word without markers, case preserved)
 *  - syllabifyText(text)  -> [{ text, word: true, syllables } | { text, word: false }]
 *  - stripMarkers(text)   -> text without manual break markers
 *
 * Manual override: "|" or "·" (U+00B7) between two letters marks a syllable break
 * ("Fahr|rad", "Ra·dies·chen"); such a word is split exactly there and nowhere else.
 * A "|" or "·" that is not between two letters (e.g. a word bank "Hund · Katze") is
 * ordinary text and is kept.
 *
 * Algorithm (rule based, no dictionary of whole words):
 *  1. Morphology: the word is cut into parts at
 *     - prefixes (be, ge, ver, zer, er, ent, emp, miss, un, ur, vor, aus, auf, ab, an, ein,
 *       mit, nach, weg, zu, über, unter, hin, her, um, durch) – only when the rest is a
 *       plausible stem (starts with a possible onset, keeps a vowel without its inflection
 *       ending, vowel-initial stems only from a small list: ver-ein, er-in-nern, her-aus …);
 *     - known first members of compounds (Haus, Schul, Fahr, Kinder, Geburts, Oster …)
 *       followed by a plausible second part (Haus-tür, Haus-auf-ga-be, Os-ter-ei);
 *     - known second members that start with st/sp/str/spr/schw/zw/kn/pfl or a vowel
 *       (Blei-stift, Früh-stück, Bei-spiel, Gar-ten-zwerg, Feu-er-wehr-au-to).
 *  2. Each part: vowel nuclei (a e i o u ä ö ü y; ei ai au äu eu ie ey ay ou oi aa ee oo
 *     as one nucleus) and consonant graphemes (sch ch ck ph qu gh, th before a vowel).
 *     Between two nuclei: no consonant -> break between the vowels (Bau-er, Mu-se-um);
 *     one consonant -> it starts the next syllable (O-ma, ge-hen, Zu-cker, Bü-cher);
 *     a cluster -> its last grapheme starts the next syllable (Kat-ze, Ap-fel, sin-gen,
 *     Fens-ter, fah-ren); obstruent + l/r stays together before a full vowel (Zi-tro-ne,
 *     Zen-trum, Spiel-platz) but not before schwa or -lig/-lich/-ling/-lein/-lung/-rig
 *     (Ad-ler, ek-lig, Lieb-ling); "sch" + l/m/n/r/w after a consonant stays together
 *     (Meer-schwein-chen).
 *  3. "ie" is two nuclei in -ien at the end (Fe-ri-en, I-ta-li-en), in a short list of
 *     -ie endings (Fa-mi-li-e, Li-ni-e, Stu-di-e, Kas-ta-ni-e …) and in -ient
 *     (Pa-ti-ent); "eu"/"äu" before a final "m" is two nuclei (Mu-se-um, Ju-bi-lä-um).
 *
 * Known limitations (the AI can always override with "|"):
 *  - Compounds whose members are not in the small built-in lists keep the plain rules,
 *    which usually works but fails when the second member starts with a vowel or with
 *    st/sp after a vowel (Ur-ur-en-kel -> "U-ru-ren-kel", In-stal-la-ti-on -> "Ins-tal-…").
 *  - Stress-dependent "-ie" (Me-lo-die vs. Fa-mi-li-e) is decided by the ending list only.
 *  - Loan words with unusual spelling (Ingenieur, Jeans, naiv, Bowling) are not handled.
 *  - "-schen" diminutives are only split as s-chen for a few listed words (Häs-chen).
 *  - Obstruent + l/r is kept together before full vowels (A-fri-ka, Pro-blem); native
 *    words like Schub-la-de only come out right when the member is listed.
 *  - Rare words: Kon-gress -> "Kong-ress", Marsch-mu-sik -> "Mar-schmu-sik",
 *    A-ber-glau-be -> "Ab-er-glau-be".
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GermanSyllables = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Characters
  // ---------------------------------------------------------------------------

  var MARKER_CHARS = '|·';
  var LETTER_RE = /[A-Za-zÀ-ÖØ-öø-ɏẞ]/;
  var ACCENTS = {
    'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'å': 'a', 'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
    'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i', 'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o',
    'ù': 'u', 'ú': 'u', 'û': 'u', 'ç': 'c', 'ñ': 'n', 'ÿ': 'y', 'ẞ': 'ß'
  };
  var VOWEL_CHARS = 'aeiouäöüy';
  var NUCLEI2 = ['ei', 'ai', 'au', 'äu', 'eu', 'ie', 'ey', 'ay', 'ou', 'oi', 'aa', 'ee', 'oo'];

  function isLetter(ch) {
    return !!ch && LETTER_RE.test(ch);
  }

  function isMarker(ch) {
    return !!ch && MARKER_CHARS.indexOf(ch) >= 0;
  }

  function isApostrophe(ch) {
    return ch === "'" || ch === '’';
  }

  /** Lower-case one character, keep the length (so indices stay aligned). */
  function lowerChar(ch) {
    var l = ch.toLowerCase();
    if (l.length !== 1) l = ch;
    return ACCENTS[l] || l;
  }

  function isVowelChar(ch) {
    return !!ch && VOWEL_CHARS.indexOf(ch) >= 0;
  }

  function hasVowel(s) {
    for (var i = 0; i < s.length; i++) {
      if (isVowelChar(s.charAt(i))) return true;
    }
    return false;
  }

  function startsWith(s, prefix, pos) {
    return s.substr(pos || 0, prefix.length) === prefix;
  }

  function endsWith(s, suffix) {
    return s.length >= suffix.length && s.substr(s.length - suffix.length) === suffix;
  }

  // ---------------------------------------------------------------------------
  // Word lists (all lower case)
  // ---------------------------------------------------------------------------

  /** Whole words (or word parts) the rules get wrong; hyphenated syllables. */
  var EXCEPTIONS = {};
  [
    'rat-haus', 'rat-häu-ser', 'häs-chen', 'rös-chen', 'mäus-chen', 'bläs-chen', 'gläs-chen',
    'näs-chen', 'hös-chen', 'häus-chen', 'se-ri-e', 'a-ri-e', 'trans-port', 'trans-por-te',
    'trans-por-ter', 'a-bend', 'a-ben-de', 'a-bends', 'a-ber', 'o-ber', 'o-ben',
    'häns-chen', 'ra-dies-chen', 'kni-en', 'di-no-sau-ri-er', 'sau-ri-er'
  ].forEach(function (h) {
    EXCEPTIONS[h.replace(/-/g, '')] = h;
  });

  /** Prefixes, longest first. */
  var PREFIXES = ['unter', 'durch', 'über', 'miss', 'nach', 'zer', 'ver', 'ent', 'emp',
    'vor', 'aus', 'auf', 'ein', 'mit', 'weg', 'hin', 'her', 'be', 'ge', 'er', 'un', 'ur',
    'ab', 'an', 'zu', 'um'];

  /** Vowel-initial stems allowed after a prefix (ver-ein, er-in-nern, her-aus …). */
  var VOWEL_STEMS = ['einander', 'abend', 'ein', 'eig', 'eil', 'ehr', 'erb', 'inn', 'irr', 'aus', 'auf',
    'arbeit', 'arm', 'art', 'acht', 'ord', 'öff', 'änder', 'ärger', 'antwort', 'abschied',
    'abred', 'urteil', 'ursach', 'unglück', 'unruh', 'unter', 'ober', 'all', 'alt', 'ahn',
    'ahm', 'ess', 'end', 'enkel', 'oma', 'opa', 'üb', 'an', 'ab', 'um'];

  /** First members of compounds (with linking -s/-n/-e where usual). */
  var FIRST_MEMBERS = ['weihnachts', 'frühlings', 'geburts', 'polizei', 'kinder', 'garten',
    'wasser', 'feuer', 'sommer', 'winter', 'herbst', 'sonnen', 'blumen', 'straßen', 'küchen',
    'wochen', 'bücher', 'beeren', 'katzen', 'hunde', 'tages', 'oster', 'abend', 'mittag',
    'morgen', 'spiegel', 'apfel', 'vogel', 'papier', 'schnee', 'schiff', 'schlaf', 'schul',
    'sport', 'musik', 'mathe', 'zimmer', 'haus', 'baum', 'wald', 'hand', 'fahr', 'ball',
    'bahn', 'buch', 'zeit', 'spiel', 'stadt', 'markt', 'nacht', 'milch', 'brot', 'berg',
    'erd', 'fuß', 'kopf', 'tisch', 'bett', 'wohn', 'tier', 'fisch', 'gras', 'holz', 'glas',
    'post', 'flug', 'dorf', 'land', 'auto', 'mond', 'stern', 'groß', 'klein', 'tür', 'tags',
    'tag', 'rad', 'hof', 'zug', 'bus', 'eis', 'see', 'ferien', 'familien', 'marien', 'halte', 'lieblings', 'martins', 'hühner', 'vanille'];
  /** First members that are only split off before a vowel-initial member (Erd-beer-eis). */
  var FIRST_BEFORE_VOWEL = ['beer'];

  /** Vowel-initial second members after a known first member. */
  var VOWEL_MEMBERS = ['unterricht', 'aufgabe', 'ausflug', 'anfang', 'eingang', 'ausgang',
    'arbeit', 'ameise', 'eltern', 'alarm', 'apfel', 'äpfel', 'insel', 'eimer', 'adler',
    'instrument', 'arzt', 'ärzt', 'ecke', 'eier', 'igel', 'affe', 'auto', 'auge', 'ampel',
    'amsel', 'ente', 'essen', 'abend', 'ofen', 'onkel', 'ufer', 'eule', 'obst', 'ohr', 'uhr',
    'amt', 'art', 'ort', 'oma', 'opa', 'öl', 'eis', 'ei', 'über', 'unter'];
  /** Short prefix-like members: only before a consonant-initial rest (Haus-auf-ga-be, not Zug-a-be). */
  var VOWEL_PREFIX_MEMBERS = ['auf', 'aus', 'ein', 'an', 'ab', 'um'];
  /** "ende" only after these first members (spielende Kinder ≠ Spiel-ende). */
  var ENDE_AFTER = ['wochen', 'schul', 'tages', 'jahres', 'ferien', 'monats'];

  /** Second members found anywhere (the plain rules would split them wrongly). */
  var SECOND_MEMBERS = ['straße', 'strand', 'strahl', 'strauch', 'strauß', 'streifen', 'strich',
    'strumpf', 'strecke', 'stadt', 'stamm', 'stall', 'stand', 'staub', 'stange', 'stein',
    'stelle', 'stiefel', 'stift', 'stock', 'stoff', 'stuhl', 'stunde', 'stück',
    'stempel', 'stich', 'stab', 'spiel', 'sport', 'spitze', 'spitzer', 'spur', 'sprung',
    'sprache', 'spiegel', 'speise', 'spinne', 'specht', 'spaß', 'spatz', 'spange',
    'schwein', 'schnecke', 'schlange', 'schrank', 'schwanz', 'zwerg', 'zweig', 'knopf',
    'knochen', 'pflanze', 'pflaster', 'land', 'lade',
    // vowel-initial members that are distinctive enough to be found anywhere
    'unterricht', 'aufgabe', 'ausflug', 'anfang', 'ausgang', 'eingang', 'arbeit', 'ameise',
    'eltern', 'alarm', 'apfel', 'äpfel', 'insel', 'eimer', 'adler', 'auto', 'ampel', 'amsel',
    'onkel', 'ofen', 'ufer', 'igel', 'abend'];

  /** Possible word onsets (consonant clusters a stem or member may start with). */
  var ONSETS = ['schl', 'schm', 'schn', 'schr', 'schw', 'sch', 'spr', 'str', 'pfl', 'pfr',
    'bl', 'br', 'ch', 'dr', 'fl', 'fr', 'gl', 'gr', 'kl', 'kn', 'kr', 'pf', 'ph', 'pl', 'pr',
    'qu', 'sk', 'sp', 'st', 'th', 'tr', 'zw', 'wr', 'gn', 'ps', 'sl', 'sm', 'sn', 'sw'];

  /** Inflection endings stripped when testing whether a stem keeps a vowel. */
  var ENDINGS = ['eln', 'ern', 'ens', 'est', 'em', 'en', 'er', 'es', 'et', 'el', 'st', 'e',
    'n', 's', 't'];

  /** Word endings in which "ie" is two syllables (Fa-mi-li-e, Li-ni-e). */
  var IE_TWO_ENDINGS = ['ilie', 'inie', 'udie', 'ödie', 'anie', 'elie', 'hlie', 'olie', 'ämie',
    'azie', 'nsie', 'umie'];

  function byLengthDesc(list) {
    return list.slice().sort(function (x, y) { return y.length - x.length; });
  }
  FIRST_MEMBERS = byLengthDesc(FIRST_MEMBERS);
  VOWEL_MEMBERS = byLengthDesc(VOWEL_MEMBERS);
  VOWEL_STEMS = byLengthDesc(VOWEL_STEMS);
  SECOND_MEMBERS = byLengthDesc(SECOND_MEMBERS);
  ONSETS = byLengthDesc(ONSETS);

  // ---------------------------------------------------------------------------
  // Core rules for one part (no morpheme boundary inside)
  // ---------------------------------------------------------------------------

  var MUTA = { b: 1, d: 1, g: 1, k: 1, p: 1, t: 1, f: 1, ph: 1, c: 1 };
  var LIQUID_SUFFIX_RE = /^(ig|ich|ing|ein|ung)/;
  /** What may follow an unstressed final "e" (Ad-ler, Ad-lern, Ed-le; not Pro-blem). */
  var SCHWA_TAIL_RE = /^(r|l|n|rn|ln|rs|ls|ns|nd|rt|lt|nt|s|t|st|)$/;

  /** "ie" at s[i] is two nuclei (Fa-mi-li-e, Fe-ri-en, Pa-ti-ent)? */
  function ieIsTwo(s, i, a, b) {
    var prev = s.charAt(i - 1);
    if (i <= a || isVowelChar(prev)) return false;
    if (i + 2 === b) {
      var part = s.substring(a, b);
      for (var k = 0; k < IE_TWO_ENDINGS.length; k++) {
        if (endsWith(part, IE_TWO_ENDINGS[k])) return true;
      }
      return false;
    }
    if (s.charAt(i + 2) === 'n' && (i + 3 === b || (i + 4 === b && s.charAt(i + 3) === 's')) &&
        hasVowel(s.substring(a, i))) {
      return true;
    }
    return s.substr(i, 4) === 'ient' && 'tlrz'.indexOf(prev) >= 0;
  }

  /** "eu"/"äu" before a final "m" is two nuclei (Mu-se-um, Ju-bi-lä-um). */
  function euIsTwo(s, i, a, b) {
    return i > a && !isVowelChar(s.charAt(i - 1)) && s.charAt(i + 2) === 'm' &&
      (i + 3 === b || (i + 4 === b && s.charAt(i + 3) === 's'));
  }

  function isNucleusAt(s, i, a, b) {
    var ch = s.charAt(i);
    if (!isVowelChar(ch)) return false;
    if (ch === 'y' && i + 1 < b && isVowelChar(s.charAt(i + 1)) &&
        (i === a || isVowelChar(s.charAt(i - 1)))) {
      return false; // Yo-ga, Ma-yo: consonant y
    }
    return true;
  }

  /** Split s[a,b) into vowel nuclei and consonant graphemes. */
  function parseUnits(s, a, b) {
    var units = [];
    var i = a;
    while (i < b) {
      var two = i + 2 <= b ? s.substr(i, 2) : '';
      var len = 1;
      if (isNucleusAt(s, i, a, b)) {
        if (two && NUCLEI2.indexOf(two) >= 0) {
          len = 2;
          if (two === 'ie' && ieIsTwo(s, i, a, b)) len = 1;
          if ((two === 'eu' || two === 'äu') && euIsTwo(s, i, a, b)) len = 1;
        }
        units.push({ v: true, start: i, text: s.substr(i, len) });
      } else {
        if (i + 3 <= b && s.substr(i, 3) === 'sch') len = 3;
        else if (two === 'ch' || two === 'ck' || two === 'ph' || two === 'qu' || two === 'gh') len = 2;
        else if (two === 'th' && (i === a || isVowelChar(s.charAt(i - 1))) &&
                 isVowelChar(s.charAt(i + 2))) len = 2;
        units.push({ v: false, start: i, text: s.substr(i, len) });
      }
      i += len;
    }
    return units;
  }

  function boundariesFromHyphenated(h, offset) {
    var out = [];
    var pos = offset;
    var parts = h.split('-');
    for (var k = 0; k < parts.length - 1; k++) {
      pos += parts[k].length;
      out.push(pos);
    }
    return out;
  }

  /** Syllable boundaries (absolute indices) inside the part s[a,b). */
  function partBoundaries(s, a, b) {
    var key = s.substring(a, b);
    if (Object.prototype.hasOwnProperty.call(EXCEPTIONS, key)) {
      return boundariesFromHyphenated(EXCEPTIONS[key], a);
    }
    var units = parseUnits(s, a, b);
    var nuc = [];
    var k;
    for (k = 0; k < units.length; k++) {
      if (units[k].v) nuc.push(k);
    }
    var out = [];
    for (var n = 0; n + 1 < nuc.length; n++) {
      var cons = units.slice(nuc[n] + 1, nuc[n + 1]);
      if (cons.length === 0) {
        out.push(units[nuc[n + 1]].start);
        continue;
      }
      var take = 1;
      if (cons.length >= 2) {
        var c1 = cons[cons.length - 2].text;
        var c2 = cons[cons.length - 1].text;
        var next = units[nuc[n + 1]];
        var schwa = next.text === 'e' && n + 1 === nuc.length - 1 &&
          SCHWA_TAIL_RE.test(s.substring(next.start + 1, b));
        var afterLiquid = s.substring(cons[cons.length - 1].start + 1, b);
        if (!schwa) {
          var ng = c1 === 'g' && cons.length >= 3 && cons[cons.length - 3].text === 'n';
          if (MUTA[c1] && (c2 === 'l' || c2 === 'r') && c1 + c2 !== 'dl' && c1 + c2 !== 'tl' &&
              !ng && !LIQUID_SUFFIX_RE.test(afterLiquid)) {
            take = 2; // Zi-tro-ne, Zen-trum, Spiel-platz
          } else if (c1 === 'sch' && 'lmnrw'.indexOf(c2) >= 0 && cons.length >= 3 &&
                     cons[cons.length - 3].text !== 't') {
            take = 2; // Meer-schwein-chen
          }
        }
      }
      out.push(cons[cons.length - take].start);
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Morphology: prefixes and compounds
  // ---------------------------------------------------------------------------

  function stripEnding(s) {
    for (var k = 0; k < ENDINGS.length; k++) {
      var e = ENDINGS[k];
      if (s.length > e.length && endsWith(s, e)) return s.substr(0, s.length - e.length);
    }
    return s;
  }

  function isEnding(s) {
    return s === '' || ENDINGS.indexOf(s) >= 0;
  }

  /** s starts with a possible syllable onset followed by a vowel (Tür, Stift, Schrank). */
  function startsWithOnset(s) {
    if (!s || isVowelChar(s.charAt(0))) return false;
    if (isVowelChar(s.charAt(1))) return s.charAt(0) !== 'ß';
    for (var k = 0; k < ONSETS.length; k++) {
      var o = ONSETS[k];
      if (startsWith(s, o) && isVowelChar(s.charAt(o.length))) return true;
    }
    return false;
  }

  /** A consonant-initial stem that can stand after a prefix or first member. */
  function stemPlausible(stem) {
    return stem.length >= 2 && startsWithOnset(stem) && hasVowel(stripEnding(stem));
  }

  /** Vowel-initial stem after a prefix: from the stem list, or itself prefix + stem (an-er-ken-nen). */
  function vowelStemOk(stem) {
    var k;
    for (k = 0; k < VOWEL_STEMS.length; k++) {
      var v = VOWEL_STEMS[k];
      if (startsWith(stem, v)) {
        var rest = stem.substr(v.length);
        if (isEnding(rest) || startsWithOnset(rest)) return true;
      }
    }
    for (k = 0; k < PREFIXES.length; k++) {
      var p = PREFIXES[k];
      if (isVowelChar(p.charAt(0)) && startsWith(stem, p) && stemPlausible(stem.substr(p.length))) {
        return true;
      }
    }
    return false;
  }

  function prefixStemOk(stem) {
    if (stem.length < 2) return false;
    if (isVowelChar(stem.charAt(0))) return vowelStemOk(stem);
    return stemPlausible(stem);
  }

  /** Rest after a known first member (Haus|tür, Haus|aufgabe, Wochen|ende). */
  function firstRestOk(member, rest) {
    var k;
    if (!rest) return false;
    if (!isVowelChar(rest.charAt(0))) return rest.length >= 3 && stemPlausible(rest);
    for (k = 0; k < VOWEL_MEMBERS.length; k++) {
      var v = VOWEL_MEMBERS[k];
      if (startsWith(rest, v)) {
        var after = rest.substr(v.length);
        if (isEnding(after) || stemPlausible(after)) return true;
      }
    }
    for (k = 0; k < VOWEL_PREFIX_MEMBERS.length; k++) {
      if (startsWith(rest, VOWEL_PREFIX_MEMBERS[k]) &&
          stemPlausible(rest.substr(VOWEL_PREFIX_MEMBERS[k].length))) {
        return true;
      }
    }
    return startsWith(rest, 'ende') && isEnding(rest.substr(4)) && ENDE_AFTER.indexOf(member) >= 0;
  }

  function countNuclei(s) {
    return parseUnits(s, 0, s.length).filter(function (u) { return u.v; }).length;
  }

  /** Left part before a second member found inside the word (Blei|stift, Früh|stück). */
  function leftOk(left) {
    if (left.length < 3 || !hasVowel(left)) return false;
    var last = left.charAt(left.length - 1);
    if (!isVowelChar(last)) return true;
    if (NUCLEI2.indexOf(left.substr(left.length - 2)) >= 0) return true;
    return 'aou'.indexOf(last) >= 0 && countNuclei(left) >= 2;
  }

  /** Rest after a second member: nothing, an ending, or a further part (Stunden|plan). */
  function memberRestOk(rest) {
    if (isEnding(rest) || stemPlausible(rest)) return true;
    var fugen = ['en', 'es', 'er', 'n', 's'];
    for (var k = 0; k < fugen.length; k++) {
      if (startsWith(rest, fugen[k]) && stemPlausible(rest.substr(fugen[k].length))) return true;
    }
    return false;
  }

  /** Collect morpheme boundaries of s[a,b) into `cuts`. */
  function splitMorphemes(s, a, b, cuts, depth) {
    var k, m;
    if (depth > 8 || b - a < 4) return;
    if (Object.prototype.hasOwnProperty.call(EXCEPTIONS, s.substring(a, b))) return;
    // 1. known first member of a compound
    for (k = 0; k < FIRST_MEMBERS.length; k++) {
      m = FIRST_MEMBERS[k];
      if (a + m.length < b && startsWith(s, m, a) && firstRestOk(m, s.substring(a + m.length, b))) {
        cuts.push(a + m.length);
        splitMorphemes(s, a + m.length, b, cuts, depth + 1);
        return;
      }
    }
    for (k = 0; k < FIRST_BEFORE_VOWEL.length; k++) {
      m = FIRST_BEFORE_VOWEL[k];
      if (a + m.length < b && startsWith(s, m, a) && isVowelChar(s.charAt(a + m.length)) &&
          firstRestOk(m, s.substring(a + m.length, b))) {
        cuts.push(a + m.length);
        splitMorphemes(s, a + m.length, b, cuts, depth + 1);
        return;
      }
    }
    // 2. prefix
    for (k = 0; k < PREFIXES.length; k++) {
      m = PREFIXES[k];
      if (a + m.length < b && startsWith(s, m, a) && prefixStemOk(s.substring(a + m.length, b))) {
        cuts.push(a + m.length);
        splitMorphemes(s, a + m.length, b, cuts, depth + 1);
        return;
      }
    }
    // 3. known second member inside the word
    for (var p = a + 3; p < b - 2; p++) {
      for (k = 0; k < SECOND_MEMBERS.length; k++) {
        m = SECOND_MEMBERS[k];
        if (startsWith(s, m, p) && leftOk(s.substring(a, p)) &&
            memberRestOk(s.substring(p + m.length, b))) {
          cuts.push(p);
          splitMorphemes(s, a, p, cuts, depth + 1);
          splitMorphemes(s, p, b, cuts, depth + 1);
          return;
        }
      }
    }
  }

  /** All syllable boundaries of a lower-case letter string. */
  function boundariesOf(lower) {
    var cuts = [];
    splitMorphemes(lower, 0, lower.length, cuts, 0);
    cuts.sort(function (x, y) { return x - y; });
    var parts = [0].concat(cuts, [lower.length]);
    var out = [];
    for (var k = 0; k + 1 < parts.length; k++) {
      if (k > 0) out.push(parts[k]);
      out = out.concat(partBoundaries(lower, parts[k], parts[k + 1]));
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Character i of text belongs to a word (letters; markers/apostrophes between letters). */
  function isWordCharAt(text, i) {
    var ch = text.charAt(i);
    if (isLetter(ch)) return true;
    return (isMarker(ch) || isApostrophe(ch)) && isLetter(text.charAt(i - 1)) &&
      isLetter(text.charAt(i + 1));
  }

  /** Remove manual break markers ("|" or "·" between two letters). */
  function stripMarkers(text) {
    if (typeof text !== 'string') return '';
    var out = '';
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (isMarker(ch) && isWordCharAt(text, i)) continue;
      out += ch;
    }
    return out;
  }

  /** Syllables of one word run (letters, possibly apostrophes; no markers). */
  function syllabifyRun(raw) {
    var lower = '';
    var map = [];
    for (var i = 0; i < raw.length; i++) {
      var ch = raw.charAt(i);
      if (isLetter(ch)) {
        lower += lowerChar(ch);
        map.push(i);
      }
    }
    var cuts = boundariesOf(lower);
    var out = [];
    var start = 0;
    for (var k = 0; k < cuts.length; k++) {
      var pos = map[cuts[k]];
      if (pos > start) {
        out.push(raw.substring(start, pos));
        start = pos;
      }
    }
    out.push(raw.substring(start));
    return out;
  }

  /** Syllables of a word token as written (with markers): split at markers or by the rules. */
  function syllablesOfWord(raw) {
    var hasMarker = false;
    for (var i = 0; i < raw.length; i++) {
      if (isMarker(raw.charAt(i))) hasMarker = true;
    }
    if (!hasMarker) return syllabifyRun(raw);
    return raw.split(/[|·]/).filter(function (p) { return p.length > 0; });
  }

  /**
   * Split a text into word and non-word tokens. Words are runs of letters (with markers
   * and apostrophes between letters); everything else (spaces, punctuation, digits, the
   * hyphen in "E-Mail") is a non-word token. Token texts have the markers removed.
   */
  function syllabifyText(text) {
    var tokens = [];
    if (typeof text !== 'string' || !text) return tokens;
    var i = 0;
    while (i < text.length) {
      var j = i;
      var word = isWordCharAt(text, i);
      while (j < text.length && isWordCharAt(text, j) === word) j++;
      var raw = text.substring(i, j);
      if (word) {
        tokens.push({ text: stripMarkers(raw), word: true, syllables: syllablesOfWord(raw) });
      } else {
        tokens.push({ text: raw, word: false });
      }
      i = j;
    }
    return tokens;
  }

  /**
   * Spoken syllables of one word: ["Fa", "mi", "li", "e"]. Joined they give the word
   * (markers removed, case preserved). Text without letters is returned as [word];
   * non-letters inside (E-Mail) stay attached to the syllable before them.
   */
  function syllabify(word) {
    if (typeof word !== 'string' || !word) return [];
    var tokens = syllabifyText(word);
    var out = [];
    var pending = '';
    for (var k = 0; k < tokens.length; k++) {
      var t = tokens[k];
      if (t.word) {
        var syl = t.syllables.slice();
        syl[0] = pending + syl[0];
        pending = '';
        out = out.concat(syl);
      } else if (out.length) {
        out[out.length - 1] += t.text;
      } else {
        pending += t.text;
      }
    }
    if (!out.length) return [pending || word];
    return out;
  }

  return {
    MARKERS: MARKER_CHARS.split(''),
    syllabify: syllabify,
    syllabifyText: syllabifyText,
    stripMarkers: stripMarkers
  };
});
