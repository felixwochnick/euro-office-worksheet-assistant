/*
 * worksheet-check.js – deterministic quality check of a worksheet (MIT License).
 *
 * Used by both the editor plugin (browser, global `WorksheetCheck`) and the proxy
 * (Node.js, CommonJS `require`). Keep it dependency-free and ES2015-compatible.
 *
 * check(doc, opts) inspects a document description produced by the editor plugin
 * (doc.elements[] with index, type, text, style, is_heading, heading_level, empty, line,
 * has_image, abc, graphic, task, block, rows, page_start, page_end; doc.layout) and
 * returns { ok, summary, stats, tasks, issues }. Messages are English (they are read by
 * the AI model), short, actionable and name the element index.
 *
 * Severities: 'error' (must fix), 'warning' (should fix), 'hint' (optional).
 *
 * Decisions worth knowing:
 *  - Tasks: an element with `task`, a heading "Aufgabe 3", "Übung 2b", "Task 1", "Exercise 4",
 *    "A1", "Nr. 3", or a paragraph that starts with "Aufgabe 3:" / "Task 3." (colon, period or
 *    parenthesis required). A task ends at the next task, the next heading of the same or a
 *    higher level (any heading for a paragraph task header) or a solutions heading.
 *  - Everything after a solutions heading ("Lösungen", "Erwartungshorizont", "Answer key" …)
 *    is the solutions section: no tasks, no readability statistics.
 *  - Readability (words, sentences, LIX) is computed over paragraphs that are not headings,
 *    not in the solutions section, not tables and not word banks / name lines / grade keys /
 *    self-assessments; gaps, list markers and the "Aufgabe N:" prefix are removed first.
 *    The LIX warning needs at least 20 words; grades 11–13 get no LIX warning.
 *  - A workspace is only required when an instruction (task header or the first two
 *    instruction paragraphs) asks for written work with an imperative verb.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.WorksheetCheck = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SEVERITY_ORDER = { error: 0, warning: 1, hint: 2 };

  var TASK_HEADING_RE = /^\s*(?:(?:Aufgabe|Übung|Task|Exercise|Nr\.?)\s*(\d+[a-z]?)|A\s?(\d+[a-z]?))(?![0-9A-Za-zÄÖÜäöüß])/i;
  var TASK_PARAGRAPH_RE = /^\s*(?:Aufgabe|Übung|Task|Exercise)\s*(\d+[a-z]?)\s*[:.)]/i;
  var SOLUTIONS_RE = /^\s*(?:Lösungen|Lösungsblatt|Lösungsteil|Lösungsschlüssel|Lösung|Erwartungshorizont|Solutions?|Answer key|Answers)(?![A-Za-zÄÖÜäöüß])/i;
  var POINTS_UNIT = '(?:P\\.?|Pkt\\.?|Punkte?|points?|pts?\\.?|BE)(?![A-Za-zÄÖÜäöüß])';
  var NUM = '(\\d+(?:[.,]\\d+)?)';
  var POINTS_RE = new RegExp(NUM + '\\s*' + POINTS_UNIT, 'i');
  var POINTS_BOX_RE = new RegExp('\\/\\s*' + NUM + '\\s*' + POINTS_UNIT, 'i');
  var TOTAL_RES = [
    /\bGesamtpunkt(?:zahl|e)?\s*:?\s*(?:_+\s*)?(?:\/|von)?\s*(\d+(?:[.,]\d+)?)/i,
    new RegExp('\\b(?:Gesamt|Summe|Insgesamt|Total)\\s*:?\\s*(?:_+\\s*)?(?:\\/|von|of)?\\s*' + NUM + '\\s*' + POINTS_UNIT, 'i'),
    /\b(?:von|out of)\s+(\d+(?:[.,]\d+)?)\s+(?:möglichen\s+|possible\s+)?(?:Punkten|points)\b/i,
    /\bPunkte\s*:?\s*_*\s*\/\s*(\d+(?:[.,]\d+)?)/i
  ];
  /** "__ / 20 Punkte" – only a total when it is outside every task. */
  var TOTAL_OUTSIDE_RE = new RegExp('_+\\s*\\/\\s*' + NUM + '\\s*' + POINTS_UNIT, 'i');

  var GAP_RE = /_{3,}|…|\.{3,}/;
  var CLOZE_GAP_RE = /_{4,}/g;
  var CHECKBOX_RE = /[☐□○◯]/;
  var WORD_BANK_RE = /^\s*(?:Wortspeicher|Wörterkasten|Wortkasten|Wörter|Word bank|Words)\s*:?/i;
  var NAME_RE = /\bName\b/i;
  /** Form lines ("Name: ____ Datum: ____") are not text for readability. */
  var FORM_FIELD_RE = /^\s*(?:Name|Vorname|Datum|Klasse|Class|Date)\s*:/i;

  var WRITE_VERB_RE = new RegExp('(?:^|[^A-Za-zÄÖÜäöüß])(?:' + [
    'schreib(?:e|t)?', 'notier(?:e|t)', 'beantworte(?:t)?', 'ergänz(?:e|t)', 'erklär(?:e|t)',
    'begründe(?:t)?', 'beschreib(?:e|t)', 'berechne(?:t)?', 'rechne(?:t)?', 'lös(?:e|t)',
    'vervollständig(?:e|t)', 'formulier(?:e|t)', 'übersetz(?:e|t)', 'nenn(?:e|t)',
    'trag(?:e|t)?\\b[^.!?]*\\bein', 'füll(?:e|t)?\\b[^.!?]*\\baus', 'setz(?:e|t)?\\b[^.!?]*\\bein',
    '(?:schreiben|beantworten|ergänzen|erklären|begründen|beschreiben|berechnen|lösen|notieren|' +
      'vervollständigen) Sie',
    'write', 'answer', 'complete', 'explain', 'calculate', 'fill in', 'solve', 'describe',
    'translate', 'label', 'note down'
  ].join('|') + ')(?![A-Za-zÄÖÜäöüß])', 'i');
  var TICK_VERB_RE = /(?:^|[^A-Za-zÄÖÜäöüß])(?:kreuz(?:e|t)?|tick)(?![A-Za-zÄÖÜäöüß])/i;
  var MATCH_VERB_RE = /(?:^|[^A-Za-zÄÖÜäöüß])(?:ordne(?:t)?|verbinde(?:t)?|match|connect)(?![A-Za-zÄÖÜäöüß])/i;
  var DRAW_VERB_RE = /(?:^|[^A-Za-zÄÖÜäöüß])(?:zeichne(?:t)?|mal(?:e|t)|male[n]? Sie|zeichnen Sie|draw|colou?r in)(?![A-Za-zÄÖÜäöüß])/i;
  var INSTRUCTION_VERB_RE = /(?:^|[^A-Za-zÄÖÜäöüß])(?:lies|lest|schau|seht|sieh|hör|betrachte|finde|suche|markiere|unterstreiche|umkreise|male|zeichne|kreuze|ordne|verbinde|read|look|listen|find|mark|underline|circle)(?![A-Za-zÄÖÜäöüß])/i;

  var WORK_BLOCKS = ['multiple_choice', 'true_false', 'matching', 'cloze', 'crossword',
    'word_search', 'writing_lines', 'answer_lines', 'lines', 'grid', 'answer_box'];
  var SPACE_GRAPHICS = ['lineature', 'crossword', 'word_search', 'coordinate_system', 'grid',
    'writing_lines', 'squared_paper', 'dot_grid'];
  /** Blocks that follow the last task but do not belong to it (no workspace, no instruction). */
  var OUTSIDE_TASK_BLOCKS = ['self_assessment', 'grade_key', 'name_line', 'title'];
  var NON_TEXT_BLOCKS = ['word_bank', 'name_line', 'grade_key', 'self_assessment', 'title'];

  // ---------------------------------------------------------------------------
  // Element helpers
  // ---------------------------------------------------------------------------

  function textOf(el) {
    return el && typeof el.text === 'string' ? el.text : '';
  }

  function trimmed(el) {
    return textOf(el).replace(/^\s+|\s+$/g, '');
  }

  function isTable(el) {
    return el.type === 'table';
  }

  function isHeading(el) {
    if (isTable(el)) return false;
    if (el.is_heading) return true;
    if (typeof el.heading_level === 'number' && el.heading_level > 0) return true;
    return typeof el.style === 'string' && /^(heading|überschrift|title|titel)\b/i.test(el.style);
  }

  function headingLevel(el) {
    if (typeof el.heading_level === 'number' && el.heading_level > 0) return el.heading_level;
    var m = typeof el.style === 'string' ? el.style.match(/(\d+)/) : null;
    if (m) return parseInt(m[1], 10);
    if (el.block === 'title' || (typeof el.style === 'string' && /^(title|titel)/i.test(el.style))) return 0;
    return 1;
  }

  function isEmptyEl(el) {
    return !!el.empty || (!isTable(el) && !trimmed(el) && !el.has_image && !el.abc && !el.graphic);
  }

  function parseNumber(s) {
    return parseFloat(String(s).replace(',', '.'));
  }

  function plural(n, word) {
    return n + ' ' + word + (n === 1 ? '' : 's');
  }

  function quote(s, maxWords) {
    var words = s.replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '').split(' ');
    var cut = words.length > maxWords;
    return '"' + words.slice(0, maxWords).join(' ') + (cut ? ' …' : '') + '"';
  }

  /** Is this element a solutions heading? */
  function isSolutionsHeading(el) {
    if (el.block === 'solutions' || el.block === 'answer_key') return true;
    return isHeading(el) && SOLUTIONS_RE.test(trimmed(el));
  }

  /** Task header info of an element, or null. */
  function taskHeaderOf(el) {
    var text = trimmed(el);
    var m;
    if (el.task && typeof el.task === 'object') {
      var num = el.task.number !== undefined && el.task.number !== null ? String(el.task.number) : null;
      if (!num) {
        m = text.match(TASK_HEADING_RE);
        num = m ? (m[1] || m[2]) : null;
      }
      return {
        number: num,
        title: typeof el.task.title === 'string' && el.task.title ? el.task.title : null,
        points: typeof el.task.points === 'number' ? el.task.points :
          (el.task.points ? parseNumber(el.task.points) : null),
        level: isHeading(el) ? headingLevel(el) : 99
      };
    }
    if (isTable(el)) return null;
    if (isHeading(el)) {
      m = text.match(TASK_HEADING_RE);
      if (m) return { number: m[1] || m[2], title: null, points: null, level: headingLevel(el) };
      return null;
    }
    m = text.match(TASK_PARAGRAPH_RE);
    if (m) return { number: m[1], title: null, points: null, level: 99 };
    return null;
  }

  /** Header text without "Aufgabe 3:", the points and the title. */
  function headerRest(el, info) {
    var t = trimmed(el).replace(TASK_HEADING_RE, '');
    t = t.replace(new RegExp('[(\\[]?\\s*(?:_+\\s*\\/\\s*)?' + NUM + '\\s*' + POINTS_UNIT + '\\s*[)\\]]?', 'ig'), ' ');
    if (info.title) t = t.split(info.title).join(' ');
    return t.replace(/^[\s:.)\-–—·|]+|[\s\-–—·|]+$/g, '').replace(/\s+/g, ' ');
  }

  /** Remove a points box ("___ / 4 P.") so it is not mistaken for an answer gap. */
  function stripPointsBox(text) {
    return text.replace(new RegExp('_*\\s*\\/\\s*' + NUM + '\\s*' + POINTS_UNIT + '\\.?', 'ig'), ' ');
  }

  function wordCount(s) {
    var m = s.match(/[A-Za-zÄÖÜäöüß]+/g);
    return m ? m.length : 0;
  }

  // ---------------------------------------------------------------------------
  // Structure: tasks and solutions
  // ---------------------------------------------------------------------------

  function elementsOf(doc) {
    var list = doc && Array.isArray(doc.elements) ? doc.elements : [];
    return list.filter(function (el) { return el && typeof el === 'object'; });
  }

  /** Position (array index) of the solutions heading, or -1. */
  function solutionsStart(els) {
    for (var i = 0; i < els.length; i++) {
      if (isSolutionsHeading(els[i])) return i;
    }
    return -1;
  }

  /** Tasks with their element ranges (positions `start`..`end` inclusive in doc.elements). */
  function findTasks(els) {
    var sol = solutionsStart(els);
    var limit = sol >= 0 ? sol : els.length;
    var tasks = [];
    var current = null;
    for (var i = 0; i < limit; i++) {
      var el = els[i];
      var info = taskHeaderOf(el);
      if (current && (info || (isHeading(el) && headingLevel(el) <= current.level))) {
        current.end = i - 1;
        current = null;
      }
      if (info) {
        current = {
          number: info.number,
          numeric: info.number && /\d+/.test(info.number) ? parseInt(info.number.match(/\d+/)[0], 10) : null,
          title: info.title,
          points: info.points,
          level: info.level,
          info: info,
          start: i,
          end: limit - 1
        };
        tasks.push(current);
      }
    }
    tasks.forEach(function (t) {
      var header = els[t.start];
      if (!t.title) {
        var rest = headerRest(header, t.info);
        t.title = rest || null;
      }
      if (t.points === null || t.points === undefined || isNaN(t.points)) {
        t.points = null;
        var m = trimmed(header).match(POINTS_RE);
        if (m) t.points = parseNumber(m[1]);
        for (var k = t.start + 1; k <= t.end && t.points === null; k++) {
          var box = trimmed(els[k]);
          var bm = box.length <= 40 ? box.match(POINTS_BOX_RE) : null;
          if (bm) t.points = parseNumber(bm[1]);
        }
      }
    });
    return tasks;
  }

  /**
   * Detect the tasks of a worksheet: [{ number, title, element_index, end_index, points }].
   * element_index is the `index` of the task header, end_index that of its last element.
   */
  function detectTasks(doc) {
    var els = elementsOf(doc);
    return findTasks(els).map(function (t) {
      return {
        number: t.number,
        title: t.title,
        element_index: els[t.start].index,
        end_index: els[t.end].index,
        points: t.points
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Readability
  // ---------------------------------------------------------------------------

  var ABBREVIATIONS_RE = /\b(z\.\s?B|d\.\s?h|u\.\s?a|usw|bzw|Nr|S|ca|evtl|ggf|vgl|etc|Dr|Hr|Fr|e\.\s?g|i\.\s?e)\./g;

  /** Text of a paragraph prepared for readability: no gaps, list markers or "Aufgabe N:". */
  function readableText(text) {
    return text
      .replace(TASK_PARAGRAPH_RE, '')
      .replace(new RegExp('(?:_+\\s*\\/\\s*)?' + NUM + '\\s*' + POINTS_UNIT, 'ig'), ' ')
      .replace(/_{2,}|…|\.{3,}|[☐□○◯]/g, ' ')
      .replace(/^\s*(?:\d+[a-z]?|[a-z])[.)]\s+/gm, '')
      .replace(ABBREVIATIONS_RE, function (m) { return m.replace(/\./g, ''); });
  }

  /** Sentences of a text: [{ text, words }]. */
  function sentencesOf(text) {
    var out = [];
    readableText(text).split(/\n+/).forEach(function (line) {
      line.split(/[.!?:;]+(?=\s|$)/).forEach(function (s) {
        var n = wordCount(s);
        if (n > 0) out.push({ text: s.replace(/^\s+|\s+$/g, ''), words: n });
      });
    });
    return out;
  }

  /** LIX readability index: words/sentences + 100 * long words (> 6 letters) / words. */
  function lix(text) {
    if (typeof text !== 'string') return 0;
    var sentences = sentencesOf(text);
    var words = readableText(text).match(/[A-Za-zÄÖÜäöüß]+/g) || [];
    if (!words.length || !sentences.length) return 0;
    var long = words.filter(function (w) { return w.length > 6; }).length;
    var value = words.length / sentences.length + 100 * long / words.length;
    return Math.round(value * 10) / 10;
  }

  function gradeLimits(grade) {
    if (typeof grade !== 'number' || !(grade >= 1)) return { lix: null, sentence: 30 };
    if (grade <= 4) return { lix: 40, sentence: 15 };
    if (grade <= 7) return { lix: 50, sentence: 22 };
    if (grade <= 10) return { lix: 60, sentence: 30 };
    return { lix: null, sentence: 30 };
  }

  // ---------------------------------------------------------------------------
  // Task content: instruction and workspace
  // ---------------------------------------------------------------------------

  function tableCells(el) {
    if (Array.isArray(el.rows)) {
      var cells = [];
      el.rows.forEach(function (r) {
        (Array.isArray(r) ? r : [r]).forEach(function (c) { cells.push(typeof c === 'string' ? c : ''); });
      });
      return cells;
    }
    return textOf(el).split('|');
  }

  function hasEmptyCell(el) {
    return tableCells(el).some(function (c) {
      return /^[\s_.…]*$/.test(c);
    });
  }

  var DIAGRAM_GRAPHICS = ['class_diagram', 'object_diagram', 'sequence_diagram', 'state_diagram', 'structogram', 'er_diagram'];
  var STEP_KEYS = ['steps', 'then', 'else', 'do', 'repeat', 'loop', 'forever', 'default'];

  /** A diagram to fill in: gaps [[…]], elements with blank: true, empty lines (a number) or empty statements. */
  function diagramHasSpace(g) {
    var found = false;
    (function walk(v, key) {
      if (found) return;
      if (typeof v === 'string') {
        if (v.indexOf('[[') >= 0 || (key === 'step' && !v.trim())) found = true;
      } else if (typeof v === 'number') {
        if (v > 0 && /^(attributes|methods|operations|values)$/.test(key)) found = true;
      } else if (Array.isArray(v)) {
        v.forEach(function (x) { walk(x, STEP_KEYS.indexOf(key) >= 0 ? 'step' : key); });
      } else if (v && typeof v === 'object') {
        Object.keys(v).forEach(function (k) {
          if ((k === 'blank' || k === 'hidden') && v[k] === true) found = true;
          else walk(v[k], k);
        });
      }
    })(g, '');
    return found;
  }

  function graphicHasSpace(g) {
    if (!g || typeof g !== 'object') return false;
    if (DIAGRAM_GRAPHICS.indexOf(g.type) >= 0) return diagramHasSpace(g);
    if (g.blank === true) return true;
    if (Array.isArray(g.blanks) && g.blanks.length) return true;
    return SPACE_GRAPHICS.indexOf(g.type) >= 0;
  }

  function abcHasEmptyStaff(abc) {
    if (typeof abc !== 'string') return false;
    var body = abc.split('\n').filter(function (l) { return !/^\s*[A-Za-z]:/.test(l); }).join(' ');
    return /(^|[\s|\]])x\d*(?=[\s|]|$)/.test(body);
  }

  function isWordBank(el) {
    return el.block === 'word_bank' ||
      ((isTable(el) || el.block === 'box' || el.type === 'paragraph') && WORD_BANK_RE.test(trimmed(el)));
  }

  /** Analyse the elements of one task. */
  function analyseTask(els, t) {
    var header = els[t.start];
    var f = { space: false, table: false, image: false, graphic: false, instructions: [], gaps: 0,
      bank: null, bankEl: null };
    var rest = headerRest(header, t.info);
    if (rest && (header.task ? true : (wordCount(rest) >= 3 || INSTRUCTION_VERB_RE.test(rest) ||
        WRITE_VERB_RE.test(rest)))) {
      f.instructions.push(rest);
    }
    if (GAP_RE.test(stripPointsBox(trimmed(header))) || CHECKBOX_RE.test(textOf(header))) f.space = true;
    for (var i = t.start + 1; i <= t.end; i++) {
      var el = els[i];
      var text = stripPointsBox(trimmed(el));
      if (el.block && OUTSIDE_TASK_BLOCKS.indexOf(el.block) >= 0) continue;
      if (isWordBank(el)) {
        f.bank = el;
        continue;
      }
      if (el.block && WORK_BLOCKS.indexOf(el.block) >= 0) f.space = true;
      if (el.line || el.empty) f.space = true;
      if (el.has_image) f.image = true;
      if (el.graphic) {
        f.graphic = true;
        if (graphicHasSpace(el.graphic)) f.space = true;
      }
      if (abcHasEmptyStaff(el.abc)) f.space = true;
      if (isTable(el)) {
        f.table = true;
        if (hasEmptyCell(el)) f.space = true;
      }
      if (GAP_RE.test(text) || CHECKBOX_RE.test(text)) f.space = true;
      var gaps = text.match(CLOZE_GAP_RE);
      if (gaps) f.gaps += gaps.length;
      if (!isTable(el) && !isHeading(el) && text && wordCount(text) >= 2 &&
          (!GAP_RE.test(text) || INSTRUCTION_VERB_RE.test(text) || WRITE_VERB_RE.test(text))) {
        f.instructions.push(text);
      }
    }
    return f;
  }

  /** What kind of answer the instruction asks for, or null. */
  function workKind(instructions) {
    var text = instructions.slice(0, 2).join(' \n ');
    if (TICK_VERB_RE.test(text)) return 'tick';
    if (MATCH_VERB_RE.test(text)) return 'match';
    if (WRITE_VERB_RE.test(text)) return 'write';
    if (DRAW_VERB_RE.test(text)) return 'draw';
    return null;
  }

  function workspaceOk(kind, f) {
    if (f.space) return true;
    if (kind === 'match') return f.table || f.image || f.graphic;
    if (kind === 'draw') return f.image || f.graphic;
    return false;
  }

  var WORKSPACE_ADVICE = {
    write: 'has no space for answers – add writing lines, a table or a spacer after the instruction.',
    tick: 'asks to tick answers but has no boxes – add "☐" before each option or use a multiple-choice/true-false table.',
    match: 'asks to match items but has nothing to match – add a two-column table or pictures to connect.',
    draw: 'asks to draw but has no free space – add an empty area (spacers) or a framed box.'
  };

  function bankEntries(el) {
    var cells;
    if (isTable(el) && Array.isArray(el.rows)) {
      // a word bank box is one cell with a title line and the words separated by spaces or dots
      cells = [];
      tableCells(el).forEach(function (c) {
        String(c).split(/\s*[·|,;•\/\n]\s*|\s{2,}/).forEach(function (x) { cells.push(x); });
      });
    } else {
      cells = textOf(el).replace(WORD_BANK_RE, '').split(/\s*[·|,;•\/\n]\s*|\s{2,}/);
    }
    return cells.map(function (c) { return c.replace(WORD_BANK_RE, '').replace(/^\s+|\s+$/g, ''); })
      .filter(function (c) { return c.length > 0; });
  }

  // ---------------------------------------------------------------------------
  // Checks
  // ---------------------------------------------------------------------------

  var MARKUP_CHECKS = [
    { re: /\*\*/, what: '"**"' },
    { re: /(^|[^_])__[^_\s](?:[^_]*[^_\s])?__(?!_)/, what: '"__…__"' },
    { re: /(^|\n)\s*#{1,6}\s/, what: '"#" heading marks' },
    { re: /`/, what: 'backticks' },
    { re: /\\n/, what: 'a literal "\\n"' },
    { re: /\[\[|\]\]/, what: '"[[" / "]]"' },
    { re: /\\\(|\\\)|\\\[|\\\]|\$\$/, what: 'LaTeX delimiters' },
    { re: /\|\s*:?-{3,}/, what: 'a Markdown table' },
    { re: /<\/?(?:b|i|u|s|strong|em|br|p|div|span|h[1-6]|ul|ol|li|table|tr|td|th|sup|sub|img|a|font)\b[^>]*>/i, what: 'HTML tags' }
  ];

  function checkMarkup(els, add) {
    els.forEach(function (el) {
      var text = textOf(el);
      for (var k = 0; k < MARKUP_CHECKS.length; k++) {
        if (MARKUP_CHECKS[k].re.test(text)) {
          add('error', 'leftover_markup', 'Element ' + el.index + ' contains unconverted markup (' +
            MARKUP_CHECKS[k].what + ') – remove it and use real formatting.', el.index);
          return;
        }
      }
    });
  }

  function checkNumbering(tasks, els, add) {
    var seen = {};
    var prev = null;
    tasks.forEach(function (t) {
      var idx = els[t.start].index;
      if (t.number) {
        var key = String(t.number).toLowerCase();
        if (seen[key] !== undefined) {
          add('warning', 'task_numbering', 'Task ' + t.number + ' appears twice (elements ' + seen[key] +
            ' and ' + idx + ') – renumber the tasks 1, 2, 3 …', idx);
        } else {
          seen[key] = idx;
        }
      }
      if (t.numeric === null) return;
      var subtask = /[a-z]$/i.test(t.number);
      var expected = prev === null ? 1 : prev + 1;
      if (t.numeric !== expected && !(subtask && t.numeric === prev)) {
        add('warning', 'task_numbering', 'Task ' + t.number + ' (element ' + idx + ') should be task ' +
          expected + (prev === null ? ' (numbering starts at 1)' : ' (after task ' + prev + ')') +
          ' – renumber the tasks 1, 2, 3 …', idx);
      }
      prev = t.numeric;
    });
  }

  function checkPoints(tasks, els, sol, add, stats) {
    var withPoints = tasks.filter(function (t) { return t.points !== null; });
    stats.points_total = withPoints.length ? Math.round(withPoints.reduce(function (s, t) {
      return s + t.points;
    }, 0) * 100) / 100 : null;
    if (withPoints.length && withPoints.length < tasks.length) {
      var missing = tasks.filter(function (t) { return t.points === null; });
      add('warning', 'points_incomplete', (missing.length === 1 ? 'Task ' : 'Tasks ') +
        missing.map(function (t) { return t.number; }).join(', ') + ' (element ' + els[missing[0].start].index +
        ') ' + (missing.length === 1 ? 'has' : 'have') + ' no points while the other tasks do – add points ' +
        'to every task or remove them everywhere.', els[missing[0].start].index);
    }
    // declared totals outside the task headers
    var inTask = [];
    var headers = [];
    tasks.forEach(function (t) {
      headers.push(t.start);
      for (var i = t.start; i <= t.end; i++) inTask[i] = true;
    });
    var declared = [];
    els.forEach(function (el, i) {
      if (headers.indexOf(i) >= 0) return;
      var text = textOf(el);
      var m = null;
      for (var k = 0; k < TOTAL_RES.length && !m; k++) m = text.match(TOTAL_RES[k]);
      if (!m && !inTask[i] && (sol < 0 || i < sol)) m = text.match(TOTAL_OUTSIDE_RE);
      if (m) declared.push({ value: parseNumber(m[1]), index: el.index });
    });
    stats.points_declared = declared.length ? declared[0].value : null;
    if (stats.points_total === null || withPoints.length < tasks.length) return;
    var reported = {};
    declared.forEach(function (d) {
      if (d.value !== stats.points_total && !reported[d.value]) {
        reported[d.value] = true;
        add('error', 'points_mismatch', 'The total of ' + d.value + ' points (element ' + d.index +
          ') does not match the sum of the task points (' + stats.points_total +
          ') – correct the total or the task points.', d.index);
      }
    });
  }

  function checkSolutions(tasks, els, sol, add) {
    if (sol < 0 || !tasks.length) return;
    var lines = [];
    var headerNumbers = [];
    for (var i = sol + 1; i < els.length; i++) {
      var el = els[i];
      var info = taskHeaderOf(el);
      if (info && info.number) headerNumbers.push(String(info.number).toLowerCase());
      var parts = isTable(el) ? tableCells(el) : textOf(el).split('\n');
      parts.forEach(function (p) { lines.push(p.replace(/^\s+/, '')); });
    }
    var missing = tasks.filter(function (t) {
      if (!t.number) return false;
      var num = String(t.number).toLowerCase();
      var numeric = t.numeric !== null ? String(t.numeric) : num;
      if (headerNumbers.indexOf(num) >= 0 || headerNumbers.indexOf(numeric) >= 0) return false;
      var re = new RegExp('^(?:(?:Aufgabe|Übung|Task|Exercise|Nr\\.?|A)\\s*(?:' + num + '|' + numeric +
        ')(?![0-9])|(?:' + num + '|' + numeric + ')\\s*[).:])', 'i');
      return !lines.some(function (l) { return re.test(l); });
    });
    if (missing.length) {
      add('hint', 'solutions_incomplete', 'The solutions (element ' + els[sol].index + ') do not cover ' +
        (missing.length === 1 ? 'task ' : 'tasks ') + missing.map(function (t) { return t.number; }).join(', ') +
        ' – add ' + (missing.length === 1 ? 'its solution' : 'their solutions') + '.', els[sol].index);
    }
  }

  function checkLayout(els, tasks, layout, opts, add, stats) {
    var pages = layout && typeof layout.pages === 'number' ? layout.pages : null;
    if (pages === null) {
      els.forEach(function (el) {
        if (typeof el.page_end === 'number') pages = Math.max(pages || 0, el.page_end);
      });
    }
    stats.pages = pages;
    if (pages === null) return;
    if (typeof opts.max_pages === 'number' && pages > opts.max_pages) {
      add('warning', 'too_many_pages', 'The worksheet has ' + pages + ' pages but should have at most ' +
        opts.max_pages + ' – shorten texts, reduce empty space or remove a task.', null);
    }
    tasks.forEach(function (t) {
      var header = els[t.start];
      if (typeof header.page_start !== 'number') return;
      var hp = typeof header.page_end === 'number' ? header.page_end : header.page_start;
      var first = null;
      var last = hp;
      for (var i = t.start + 1; i <= t.end; i++) {
        if (typeof els[i].page_start === 'number' && first === null) first = els[i].page_start;
        if (typeof els[i].page_end === 'number') last = Math.max(last, els[i].page_end);
      }
      if (first !== null && first > hp) {
        add('warning', 'task_split', 'The heading of task ' + t.number + ' (element ' + header.index +
          ') is alone at the bottom of page ' + hp + ' – insert a page break before it so the task starts on page ' +
          first + '.', header.index);
      } else if (last > header.page_start && t.end - t.start + 1 <= 12) {
        add('warning', 'task_split', 'Task ' + t.number + ' (element ' + header.index + ') is split across pages ' +
          header.page_start + '–' + last + ' – keep it on one page (page break before the task) if it fits.',
          header.index);
      }
    });
    els.forEach(function (el) {
      if (!isTable(el) || typeof el.page_start !== 'number' || typeof el.page_end !== 'number') return;
      var rows = Array.isArray(el.rows) ? el.rows.length : null;
      if (el.page_end > el.page_start && (rows === null || rows < 15)) {
        add('hint', 'table_split', 'The table in element ' + el.index + (rows ? ' (' + plural(rows, 'row') + ')' : '') +
          ' is split across pages ' + el.page_start + '–' + el.page_end + ' – keep it on one page.', el.index);
      }
    });
    if (pages > 1 && layout && typeof layout.last_page_fill === 'number' && layout.last_page_fill < 0.2) {
      add('hint', 'last_page_nearly_empty', 'Only ' + Math.round(layout.last_page_fill * 100) + ' % of page ' +
        pages + ' is used – shorten or move content, or add a task.', null);
    }
  }

  function checkReadability(els, tasks, sol, opts, add, stats) {
    var limits = gradeLimits(opts.grade);
    var headerOf = {};
    tasks.forEach(function (t) { headerOf[t.start] = t; });
    var all = [];
    var end = sol >= 0 ? sol : els.length;
    for (var i = 0; i < end; i++) {
      var el = els[i];
      var text;
      if (headerOf[i]) {
        text = headerRest(el, headerOf[i].info);
        if (wordCount(text) < 3) continue;
      } else {
        if (isHeading(el) || isTable(el) || isEmptyEl(el) || isWordBank(el)) continue;
        if (el.block && NON_TEXT_BLOCKS.indexOf(el.block) >= 0) continue;
        text = textOf(el);
        if (FORM_FIELD_RE.test(text)) continue;
      }
      sentencesOf(text).forEach(function (s) {
        s.index = el.index;
        all.push(s);
      });
      stats.words += (readableText(text).match(/[A-Za-zÄÖÜäöüß]+/g) || []).length;
    }
    stats.sentences = all.length;
    stats.avg_sentence_words = all.length ? Math.round(stats.words / all.length * 10) / 10 : 0;
    stats.lix = lix(all.map(function (s) { return s.text + '.'; }).join('\n'));
    var gradeNote = typeof opts.grade === 'number' ? 'grade ' + opts.grade + ': ' : '';
    if (limits.lix !== null && stats.words >= 20 && stats.lix > limits.lix) {
      add('warning', 'readability', 'The texts are hard to read for this grade (LIX ' + stats.lix + ', ' + gradeNote +
        'target at most ' + limits.lix + ') – use shorter sentences and shorter words.', null);
    }
    all.filter(function (s) { return s.words > limits.sentence; })
      .sort(function (x, y) { return y.words - x.words; })
      .slice(0, 5)
      .forEach(function (s) {
        add('hint', 'long_sentence', 'A sentence in element ' + s.index + ' has ' + s.words + ' words (' + gradeNote +
          'at most ' + limits.sentence + ') – split it: ' + quote(s.text, 8) + '.', s.index);
      });
  }

  // ---------------------------------------------------------------------------
  // Main entry point
  // ---------------------------------------------------------------------------

  /**
   * Check a worksheet. Returns { ok, summary, stats, tasks, issues }.
   * ok is true when there are no errors (warnings and hints are allowed).
   */
  function check(doc, opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    var els = elementsOf(doc);
    var layout = doc && doc.layout && typeof doc.layout === 'object' ? doc.layout : null;
    var issues = [];
    function add(severity, code, message, index) {
      issues.push({ severity: severity, code: code, message: message,
        element_index: index === undefined || index === null ? null : index });
    }
    var sol = solutionsStart(els);
    var tasks = findTasks(els);
    var stats = { tasks: tasks.length, points_total: null, points_declared: null, pages: null,
      words: 0, sentences: 0, avg_sentence_words: 0, lix: 0 };

    checkMarkup(els, add);
    els.forEach(function (el) {
      if (isHeading(el) && !trimmed(el) && !el.has_image) {
        add('warning', 'empty_heading', 'Element ' + el.index + ' is an empty heading – delete it or give it a text.', el.index);
      }
    });
    // the title may follow a short line such as "SACHUNTERRICHT · KLASSE 3": look at the first three elements
    var first = null;
    var titled = false;
    for (var i = 0, seen = 0; i < els.length && seen < 3; i++) {
      if (isEmptyEl(els[i])) continue;
      if (!first) first = els[i];
      // a task header is not a title
      if (els[i].block === 'title' || (isHeading(els[i]) && !els[i].task && !/^(aufgabe|übung|task|exercise)\s*\d/i.test(trimmed(els[i])))) titled = true;
      seen++;
    }
    if (first && !titled) {
      add('hint', 'missing_title', 'The worksheet does not start with a title (element ' + first.index +
        ') – add a heading with the topic.', first.index);
    }
    var hasName = els.some(function (el) { return el.block === 'name_line'; }) ||
      els.slice(0, 5).some(function (el) { return NAME_RE.test(textOf(el)); });
    if (els.length && !hasName) {
      add('hint', 'missing_name_line', 'There is no name field at the top – add a line like ' +
        '"Name: ____________  Datum: ________".', null);
    }

    checkNumbering(tasks, els, add);
    var taskOut = tasks.map(function (t) {
      var f = analyseTask(els, t);
      var header = els[t.start];
      var label = 'Task ' + (t.number || '?') + ' (element ' + header.index + ')';
      if (!f.instructions.length) {
        add('warning', 'task_without_instruction', label + ' has no instruction – add a short sentence ' +
          'that says what to do.', header.index);
      }
      var kind = workKind(f.instructions);
      if (kind && !workspaceOk(kind, f)) {
        add('warning', 'no_workspace', label + ' ' + WORKSPACE_ADVICE[kind], header.index);
      }
      if (f.bank && f.gaps > 0) {
        var entries = bankEntries(f.bank).length;
        if (entries !== f.gaps) {
          add('hint', 'cloze_bank_mismatch', label + ' has ' + plural(f.gaps, 'gap') + ' but the word bank (element ' +
            f.bank.index + ') has ' + plural(entries, 'word') + ' – make them match or say that words are left over.',
            header.index);
        }
      }
      var pageEnd = null;
      for (var k = t.start; k <= t.end; k++) {
        if (typeof els[k].page_end === 'number') pageEnd = Math.max(pageEnd || 0, els[k].page_end);
      }
      return {
        number: t.number,
        title: t.title,
        element_index: header.index,
        points: t.points,
        has_instruction: f.instructions.length > 0,
        has_workspace: workspaceOk(kind || 'write', f),
        page_start: typeof header.page_start === 'number' ? header.page_start : null,
        page_end: pageEnd
      };
    });
    checkPoints(tasks, els, sol, add, stats);
    checkSolutions(tasks, els, sol, add);
    checkReadability(els, tasks, sol, opts, add, stats);
    checkLayout(els, tasks, layout, opts, add, stats);

    issues = issues.map(function (x, n) { x.n = n; return x; }).sort(function (x, y) {
      return SEVERITY_ORDER[x.severity] - SEVERITY_ORDER[y.severity] || x.n - y.n;
    }).map(function (x) {
      return { severity: x.severity, code: x.code, message: x.message, element_index: x.element_index };
    });
    return {
      ok: !issues.some(function (x) { return x.severity === 'error'; }),
      summary: summarize(issues, stats),
      stats: stats,
      tasks: taskOut,
      issues: issues
    };
  }

  function summarize(issues, stats) {
    if (!issues.length) {
      return 'No issues found (' + plural(stats.tasks, 'task') +
        (stats.points_total !== null ? ', ' + stats.points_total + ' points' : '') + ').';
    }
    var counts = [];
    ['error', 'warning', 'hint'].forEach(function (sev) {
      var n = issues.filter(function (x) { return x.severity === sev; }).length;
      if (n) counts.push(plural(n, sev));
    });
    var codes = [];
    issues.forEach(function (x) {
      var c = x.code.replace(/_/g, ' ');
      if (codes.indexOf(c) < 0) codes.push(c);
    });
    return counts.join(', ') + ': ' + codes.join(', ') + '.';
  }

  return {
    check: check,
    detectTasks: detectTasks,
    lix: lix
  };
});
