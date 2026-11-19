/**
 * Tool definitions (JSON Schema) and server-side tool handling.
 *
 * Client tools are executed by the plugin inside the editor:
 *   insert_staff, insert_empty_staves, replace_staff, get_document_outline
 * Server tools are executed directly by the proxy (no round trip):
 *   convert_german_notes, add_lyrics, search_images
 *
 * Arguments of client tools are validated here first. Invalid ABC never
 * reaches the plugin – the model gets the validation errors as tool result
 * and can correct itself.
 */
import { abcTools } from './abc.js';
import { ImageError, type ImageService, type ImageSource } from './images.js';
import { worksheet } from './worksheet.js';
import type { ToolCall, ToolDefinition } from './types.js';

const positionSchema = {
  description:
    'Where to insert. "cursor" = as a new paragraph after the paragraph containing the cursor (an empty paragraph at the cursor is used directly); {"after_heading": "<text>"} = directly after the paragraph/heading whose text matches; {"after_paragraph_index": n} = after the top-level element with index n from the document outline. Prefer after_paragraph_index when the outline is known.',
  anyOf: [
    { type: 'string', enum: ['cursor'] },
    {
      type: 'object',
      properties: { after_heading: { type: 'string', minLength: 1 } },
      required: ['after_heading'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: { after_paragraph_index: { type: 'integer', minimum: 0 } },
      required: ['after_paragraph_index'],
      additionalProperties: false,
    },
  ],
};

const blockPositionSchema = {
  ...positionSchema,
  description:
    positionSchema.description + ' Additionally "start" (top of the document) and "end" (end of the document, e.g. for a new worksheet).',
  anyOf: [{ type: 'string', enum: ['cursor', 'start', 'end'] }, ...positionSchema.anyOf.slice(1)],
};

const textSchema = (desc: string) => ({ type: 'string', maxLength: 4000, description: desc });

const strArray = (maxItems: number, maxLength = 500) => ({ type: 'array', items: { type: 'string', maxLength }, maxItems });
const numArray = (maxItems: number) => ({ type: 'array', items: { type: 'number' }, maxItems });

const PICTURE_DOC =
  'picture {image_id, width_cm? (default 5), align? left|center|right, caption?} = a picture (pictogram, photo, clipart or the user\'s own picture) – image_id ONLY from search_images; ';

const DIAGRAM_DOC =
  'Computer science diagrams: ' +
  'class_diagram {classes [{name, kind? class|abstract|interface|enum, attributes ["- name: String", "- static anzahl: int"], methods ["+ getName(): String", "+ abstract flaeche(): double"], values? (enum literals)}], ' +
  'relations [{from, to, kind inheritance (from = subclass)|implementation|association|aggregation|composition (from = the whole)|dependency, label?, from_mult?, to_mult?, directed? (navigable arrow)}], direction? vertical|horizontal} = UML class diagram; ' +
  'object_diagram {objects [{name, class, values ["kontostand = 100"]}], links [{from, to, label?}]} = UML object diagram; ' +
  'sequence_diagram {participants [":Automat" or {name, kind: "actor"}], messages [{from, to, text, kind? call|async|return|create} or a fragment {fragment alt|opt|loop|par|break, label (condition), messages [...], else? {label, messages [...]}}], activations? (default true)} = UML sequence diagram; ' +
  'state_diagram {states ["Bereit" or {name, activities ["entry / …", "do / …"]}], transitions [{from, to, label "event [guard] / action"}] ("[*]" as from = initial state, as to = final state), ' +
  'notation? uml|automaton (finite automaton DEA/NEA: circles, initial = start state, accepting [] = accepting states), direction?} = UML state diagram or automaton; ' +
  'activity_diagram {nodes [{id?, kind start|end|flow_end|action|decision|merge|fork|join|object, text}], edges [{from, to, label? "[guard]"}] (from/to = id, or the text of a node without id; ' +
  'without edges the nodes form a sequence), direction? vertical|horizontal} = UML activity diagram; ' +
  'use_case_diagram {system?, actors ["Kunde" or {name, side: "right"}], use_cases ["Geld abheben"], links [{from, to, kind? association (actor – use case)|include (from = base)|extend (from = extending use case)|generalization (from = child)}]} = UML use case diagram; ' +
  'structogram {title?, steps ["statement", {if, then [], else []}, {while, do []}, {for, do []}, {repeat [], until}, {loop []} (endless), {switch, cases [{label, do []}], default? []}, {call}, {exit}]} = Nassi-Shneiderman diagram (DIN 66261); ' +
  'flowchart {nodes [{id?, kind start|end|operation|decision|io (input/output)|subroutine|connector|merge, text}], edges [{from, to, label? "ja"/"nein"}], direction?} = Programmablaufplan (DIN 66001), start/end get "Start"/"Ende" without text; ' +
  'er_diagram {entities [{name, attributes ["__id__" (key, underlined), "name", "klasse_id (FK)"]}], relationships [{name, from, to, from_card, to_card, attributes?}], notation? chen|minmax|crowsfoot} = ER diagram; ' +
  'from_card is printed at the from entity, to_card at the to entity: 1, n, m, 0..1, 0..* or 1..* read across (to_card = how many "to" belong to one "from"), ' +
  '(min,max) pairs such as (0,*) or (1,1) describe their own entity (how often it takes part); crow\'s foot draws both kinds correctly. ' +
  'Diagrams to fill in: gaps [[answer]] in any diagram text (a text that is only "[[…]]" = a whole writing line, e.g. an attribute to add), ' +
  'blank: true on a relation/link/message/transition/edge/relationship leaves it out for students to draw, a number instead of attributes/methods/values = that many empty lines, ' +
  'an empty string in steps or as a node text = an empty box; "[[[x > 0]]]" = a guard in brackets to fill in; show_answers: true = the solution with the same layout. ';

const looseList = (maxItems: number, description: string) => ({
  type: 'array', maxItems, description, items: { anyOf: [{ type: 'string' }, { type: 'object' }] },
});
const linesOrCount = { anyOf: [strArray(15, 160), { type: 'integer', minimum: 0, maximum: 15 }] };

const BLOCK_TYPE_DOC =
  'title {text, subtitle?, subject?, grade?} = worksheet title (top of the sheet); ' +
  'name_line {fields?} = Name/Klasse/Datum fields; ' +
  'heading {text, level 1-3}; paragraph {text, align?, size? small|normal|large, syllables?}; ' +
  'task {number, title?, instruction, icons?, points?, level? 1-3 (difficulty stars), time_min?} = numbered task header (badge) – use it for every task, followed by the task material; ' +
  'list {items[], style? bullet|numbered|letters|checkbox}; ' +
  'table {rows[][], header? (default true), widths? (relative), row_height_cm?, answer_rows? (empty rows to fill in), header_column?, align? left|center}; ' +
  'lines {count, label?, style? plain|school1|school2|school3|school4 (German primary lineatures, grade 1-4)|grid5|grid10 (squared paper; count = height in cm), spacing_cm?}; ' +
  'box {text?, items?, title?, variant? info|rule (Merke)|tip|warning|example|solution|definition}; ' +
  'cloze {text with gaps [[answer]], word_bank? (default true), show_answers?, bank_title?}; word_bank {words[], title?}; ' +
  'multiple_choice {questions [{question, options[], correct[] (0-based)}], show_answers?}; ' +
  'true_false {statements [{text, correct}], labels? [true, false], show_answers?}; ' +
  'matching {pairs [{left, right}] (in correct order – the right column is shuffled), mode? lines|letters, show_answers?}; ' +
  'crossword {entries [{answer, clue}], show_answers?}; word_search {words[], difficulty? easy|medium|hard, show_answers?}; ' +
  'reading_text {text, title?, line_numbers? (default true), every? 5} = text with line numbers; ' +
  'formula {latex, align?} = equation (inline formulas: write \\( … \\) in any text); ' +
  'number_line {from, to, step, label_every?, minor_ticks?, marks[]?, blanks[]? (values students fill in), hide_labels?}; ' +
  'coordinate_system {x_min, x_max, y_min, y_max, step?, unit_mm?, grid?, points[{x,y,label}]?, segments[{from:[x,y], to:[x,y]}]?, polygons[{points:[[x,y]…], label}]?}; ' +
  'chart {chart_type column|bar|line|pie, title?, labels[], series[{name, values[]}], x_label?, y_label?, blank? (empty axes to draw in)}; ' +
  'mindmap {center, branches[{text, children[]}], blank? (empty bubbles)}; qr_code {url, caption?, size_cm?}; ' +
  PICTURE_DOC +
  'svg {svg, width_cm?, caption?} = your own simple drawing (SVG markup); cut_line {label?}; ' +
  'self_assessment {statements[], title?} = "Das kann ich" table with smileys; hint_cards {cards[{title?, text}], columns? 1-3} = cut-out tip cards; ' +
  'grade_key {total_points, thresholds?[5] (percent for grades 1-5), step? 0.5|1} = points-to-grade table; ' +
  'columns {columns [[blocks], [blocks]], widths?} = 2-3 columns side by side; ' +
  'staff {abc, width_cm?} = music staff from ABC; empty_staves {clef, count, measures?}; page_break; spacer {lines?}. ' +
  DIAGRAM_DOC +
  'Graphics (number_line, coordinate_system, chart, mindmap, svg and the diagrams) also take caption? and width_cm?.';

/** JSON Schema of one worksheet block (see packages/shared/worksheet-layout.js). Flat: the fields of all types. */
const blockSchema = {
  type: 'object',
  description:
    'One building block. Text fields support **bold**, *italic*, __underline__, "\\n" for a line break, [ ] / [x] for check boxes ' +
    'and \\(LaTeX\\) for formulas; plain gaps are written as "________".',
  properties: {
    type: { type: 'string', enum: worksheet.layout.BLOCK_TYPES, description: BLOCK_TYPE_DOC },
    text: textSchema('text of the block (title, paragraph, box, cloze with [[gaps]], reading text)'),
    level: { type: 'integer', minimum: 1, maximum: 3, description: 'heading level, or task difficulty (1-3 stars)' },
    align: { type: 'string', enum: ['left', 'center', 'right', 'justify'] },
    size: { type: 'string', enum: ['small', 'normal', 'large'] },
    syllables: { type: 'boolean', description: 'Silbenfärbung: colour the syllables alternately blue/red (German primary school). Mark unusual breaks with | (Mül|ler).' },
    subtitle: { type: 'string', maxLength: 300 },
    subject: { type: 'string', maxLength: 80 },
    grade: { type: 'string', maxLength: 40, description: 'e.g. "Klasse 5"' },
    fields: strArray(5, 40),
    number: { type: 'string', maxLength: 4, description: 'task number, e.g. "1", "2a"' },
    instruction: textSchema('task instruction in the imperative'),
    icons: { type: 'array', items: { type: 'string', enum: worksheet.themes.TASK_ICONS }, maxItems: 4, description: 'work form / activity symbols' },
    points: {
      description: 'task: points for the task (number); coordinate_system: points [{x, y, label}]',
      anyOf: [{ type: 'number', minimum: 0, maximum: 1000 }, { type: 'array', maxItems: 50, items: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' }, label: { type: 'string' } }, required: ['x', 'y'] } }],
    },
    time_min: { type: 'integer', minimum: 1, maximum: 300 },
    items: { type: 'array', items: { type: 'string', maxLength: 2000 }, maxItems: 50 },
    ordered: { type: 'boolean' },
    style: { type: 'string', description: 'list: bullet|numbered|letters|checkbox; lines: plain|school1-4|grid5|grid10' },
    rows: { type: 'array', items: { type: 'array', items: { type: 'string', maxLength: 1000 }, maxItems: 10 }, maxItems: 60 },
    header: { type: 'boolean' },
    header_column: { type: 'boolean' },
    widths: numArray(10),
    row_height_cm: { type: 'number', minimum: 0.5, maximum: 5 },
    answer_rows: { type: 'integer', minimum: 0, maximum: 30 },
    count: { type: 'integer', minimum: 1, maximum: 20 },
    spacing_cm: { type: 'number', minimum: 0.6, maximum: 2 },
    label: { type: 'string', maxLength: 500 },
    title: { type: 'string', maxLength: 200 },
    variant: { type: 'string', enum: worksheet.themes.BOX_VARIANTS },
    word_bank: { type: 'boolean' },
    bank_title: { type: 'string', maxLength: 80 },
    show_answers: { type: 'boolean', description: 'solution version (for the solution sheet)' },
    words: strArray(30, 40),
    questions: {
      type: 'array', maxItems: 20,
      items: { type: 'object', properties: { question: { type: 'string' }, options: strArray(8, 300), correct: { type: 'array', items: { type: 'integer' } } }, required: ['question', 'options'] },
    },
    statements: {
      type: 'array', maxItems: 20, description: 'true_false: [{text, correct}]; self_assessment: strings',
      items: { anyOf: [{ type: 'string' }, { type: 'object', properties: { text: { type: 'string' }, correct: { type: 'boolean' } }, required: ['text'] }] },
    },
    labels: strArray(40, 60),
    pairs: { type: 'array', maxItems: 12, items: { type: 'object', properties: { left: { type: 'string' }, right: { type: 'string' } }, required: ['left', 'right'] } },
    mode: { type: 'string', enum: ['lines', 'letters'] },
    entries: { type: 'array', maxItems: 30, items: { type: 'object', properties: { answer: { type: 'string' }, clue: { type: 'string' } }, required: ['answer', 'clue'] } },
    difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
    line_numbers: { type: 'boolean' },
    every: { type: 'integer', minimum: 1, maximum: 10 },
    latex: { type: 'string', maxLength: 2000 },
    from: { type: 'number' },
    to: { type: 'number' },
    step: { type: 'number' },
    label_every: { type: 'integer', minimum: 1 },
    minor_ticks: { type: 'integer', minimum: 0, maximum: 9 },
    marks: numArray(50),
    blanks: numArray(50),
    hide_labels: { type: 'boolean' },
    x_min: { type: 'number' }, x_max: { type: 'number' }, y_min: { type: 'number' }, y_max: { type: 'number' },
    unit_mm: { type: 'number', minimum: 3, maximum: 20 },
    grid: { type: 'boolean' },
    points_xy: { type: 'null', description: 'unused' },
    segments: { type: 'array', maxItems: 50, items: { type: 'object' } },
    polygons: { type: 'array', maxItems: 20, items: { type: 'object' } },
    chart_type: { type: 'string', enum: ['column', 'bar', 'line', 'pie'] },
    series: { type: 'array', maxItems: 6, items: { type: 'object', properties: { name: { type: 'string' }, values: numArray(30) }, required: ['values'] } },
    x_label: { type: 'string', maxLength: 80 },
    y_label: { type: 'string', maxLength: 80 },
    blank: { type: 'boolean' },
    center: { type: 'string', maxLength: 120 },
    branches: { type: 'array', maxItems: 8, items: { type: 'object', properties: { text: { type: 'string' }, children: strArray(6, 120) }, required: ['text'] } },
    url: { type: 'string', maxLength: 500 },
    caption: { type: 'string', maxLength: 300 },
    size_cm: { type: 'number', minimum: 1.5, maximum: 8 },
    svg: { type: 'string', maxLength: 200000 },
    height_cm: { type: 'number', minimum: 4, maximum: 24 },
    cards: { type: 'array', maxItems: 12, items: { type: 'object', properties: { title: { type: 'string' }, text: { type: 'string' } }, required: ['text'] } },
    columns: { description: 'columns block: array of 2-3 arrays of blocks; hint_cards: number of columns', anyOf: [{ type: 'integer', minimum: 1, maximum: 3 }, { type: 'array', maxItems: 3, items: { type: 'array', maxItems: 30, items: { type: 'object' } } }] },
    total_points: { type: 'number', minimum: 1, maximum: 1000 },
    thresholds: numArray(5),
    abc: { type: 'string' },
    width_cm: { type: 'number', minimum: 1, maximum: 19 },
    image_id: { type: 'string', maxLength: 600, description: 'picture: id from a search_images result' },
    clef: { type: 'string', enum: ['treble', 'bass'] },
    measures: { type: 'integer', minimum: 0, maximum: 8 },
    lines: { type: 'integer', minimum: 1, maximum: 10 },
    // computer science diagrams (packages/shared/worksheet-diagrams.js)
    classes: {
      type: 'array', maxItems: 16, description: 'class_diagram: the classes',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' }, kind: { type: 'string', enum: ['class', 'abstract', 'interface', 'enum'] },
          attributes: linesOrCount, methods: linesOrCount, values: linesOrCount,
        },
        required: ['name'],
      },
    },
    relations: {
      type: 'array', maxItems: 30, description: 'class_diagram: relations between classes',
      items: {
        type: 'object',
        properties: {
          from: { type: 'string' }, to: { type: 'string' },
          kind: { type: 'string', enum: ['inheritance', 'implementation', 'association', 'aggregation', 'composition', 'dependency'] },
          label: { type: 'string' }, from_mult: { type: 'string' }, to_mult: { type: 'string' }, directed: { type: 'boolean' }, blank: { type: 'boolean' },
        },
        required: ['from', 'to'],
      },
    },
    direction: { type: 'string', enum: ['vertical', 'horizontal'], description: 'class/object/state diagram layout (default: class diagrams with inheritance vertical, else horizontal)' },
    objects: {
      type: 'array', maxItems: 16, description: 'object_diagram: the objects',
      items: { type: 'object', properties: { name: { type: 'string' }, class: { type: 'string' }, values: linesOrCount }, required: ['class'] },
    },
    links: {
      type: 'array', maxItems: 40, description: 'object_diagram: links between objects; use_case_diagram: associations, include, extend, generalization',
      items: {
        type: 'object',
        properties: {
          from: { type: 'string' }, to: { type: 'string' }, label: { type: 'string' }, directed: { type: 'boolean' }, blank: { type: 'boolean' },
          kind: { type: 'string', enum: ['association', 'include', 'extend', 'generalization'] },
        },
        required: ['from', 'to'],
      },
    },
    nodes: looseList(40, 'activity_diagram / flowchart: nodes {id?, kind, text}'),
    edges: {
      type: 'array', maxItems: 60, description: 'activity_diagram / flowchart: control flow between nodes (by id or text)',
      items: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' }, label: { type: 'string' }, blank: { type: 'boolean' } }, required: ['from', 'to'] },
    },
    system: { type: 'string', maxLength: 80, description: 'use_case_diagram: name of the system (boundary)' },
    actors: looseList(10, 'use_case_diagram: actors, e.g. "Kunde" or {name, side: "right"}'),
    use_cases: looseList(16, 'use_case_diagram: use cases'),
    participants: looseList(10, 'sequence_diagram: lifelines, e.g. ":Kunde" or {name, kind: "actor"}'),
    messages: {
      type: 'array', maxItems: 60, description: 'sequence_diagram: {from, to, text, kind?, blank?} or a fragment {fragment, label, messages, else?}',
      items: { type: 'object' },
    },
    activations: { type: 'boolean', description: 'sequence_diagram: activation bars (default true)' },
    states: looseList(20, 'state_diagram: states, e.g. "Bereit" or {name, activities: ["entry / …"]}'),
    transitions: {
      type: 'array', maxItems: 40, description: 'state_diagram: transitions; "[*]" = initial/final state',
      items: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' }, label: { type: 'string' }, blank: { type: 'boolean' } }, required: ['from', 'to'] },
    },
    notation: { type: 'string', enum: ['uml', 'automaton', 'chen', 'minmax', 'crowsfoot'], description: 'state_diagram: uml|automaton; er_diagram: chen|minmax|crowsfoot' },
    initial: { type: 'string', description: 'state_diagram: the start state (instead of a transition from "[*]")' },
    accepting: strArray(20, 60),
    steps: looseList(80, 'structogram: statements (strings) and control structures'),
    entities: {
      type: 'array', maxItems: 12, description: 'er_diagram: entities (tables)',
      items: { type: 'object', properties: { name: { type: 'string' }, attributes: linesOrCount }, required: ['name'] },
    },
    relationships: {
      type: 'array', maxItems: 16, description: 'er_diagram: relationships between entities',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' }, from_card: { type: 'string' }, to_card: { type: 'string' },
          attributes: strArray(6, 120), blank: { type: 'boolean' },
        },
        required: ['from', 'to'],
      },
    },
  },
  required: ['type'],
};
delete (blockSchema.properties as Record<string, unknown>).points_xy;

const themeSchema = {
  type: 'string',
  enum: worksheet.themes.THEME_IDS,
  description:
    'Design of the worksheet: classic (black and white, toner-saving), modern (blue accent, secondary school), primary (primary school: large type, colourful), ' +
    'document (follow the existing document styles). Omit to keep the document\'s design (or the user\'s default for a new worksheet).',
};
const langSchema = {
  type: 'string',
  enum: worksheet.themes.LANGUAGES,
  description: 'Language of printed labels (Name/Klasse/Datum, Wortspeicher, richtig/falsch …). Default: the document\'s language or de.',
};

const widthSchema = {
  type: 'number',
  minimum: 3,
  maximum: 19,
  description: 'Image width in centimetres (A4 text width is about 16 cm). Omit to use the user\'s default width.',
};

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'insert_staff',
    description:
      'Render music given in ABC notation and insert it into the document as a printable image. The ABC source is stored as the image alt text. Always pass one complete tune with header lines X:, M:, L:, K: (with clef=treble or clef=bass).',
    parameters: {
      type: 'object',
      properties: {
        abc: {
          type: 'string',
          description: 'Complete ABC tune, e.g. "X:1\\nM:4/4\\nL:1/4\\nK:C clef=treble\\nC F G2 |]"',
        },
        width_cm: widthSchema,
        position: positionSchema,
      },
      required: ['abc', 'position'],
      additionalProperties: false,
    },
  },
  {
    name: 'insert_empty_staves',
    description:
      'Insert empty staves (only clef and staff lines, optionally bar lines) for students to write notes into.',
    parameters: {
      type: 'object',
      properties: {
        clef: { type: 'string', enum: ['treble', 'bass'] },
        count: { type: 'integer', minimum: 1, maximum: 12, description: 'Number of staves (systems).' },
        measures: {
          type: 'integer',
          minimum: 0,
          maximum: 8,
          description: 'Bars per staff (0 = no bar lines). Default 4.',
        },
        width_cm: widthSchema,
        position: positionSchema,
      },
      required: ['clef', 'count', 'position'],
      additionalProperties: false,
    },
  },
  {
    name: 'replace_staff',
    description:
      'Change an EXISTING staff: replaces the staff image in the given element with new ABC (keeps its width unless ' +
      'width_cm is given). Use this – not insert_staff – when the user wants to modify a staff that is already in the ' +
      'document ("ändere Zeile 2: statt bc #c"). Take the current ABC from the outline ("abc" of the element), change ' +
      'only what the user asked for and send the complete new tune.',
    parameters: {
      type: 'object',
      properties: {
        index: {
          type: 'integer',
          minimum: 0,
          description: 'Top-level element index of the staff (from the outline; staves are listed with staff_number = "Notenzeile N").',
        },
        abc: { type: 'string', description: 'Complete new ABC tune (X:, M:, L:, K: with clef=…).' },
        width_cm: widthSchema,
      },
      required: ['index', 'abc'],
      additionalProperties: false,
    },
  },
  {
    name: 'insert_blocks',
    description:
      'Insert worksheet content in a consistent design: title, name line, numbered tasks, texts, cloze texts with word bank, lists, tables, ' +
      'multiple choice, true/false, matching, crossword, word search, reading texts with line numbers, formulas, number lines, coordinate ' +
      'systems, charts, mind maps, QR codes, own SVG drawings, computer science diagrams (UML class, object, sequence, state, activity and ' +
      'use case diagrams, finite automata, structograms, flowcharts, ER diagrams – also to fill in), writing lines and lineatures, info boxes, hint cards, self-assessment, ' +
      'grade key, columns, music staves, page breaks. Use it to create a whole worksheet in one call (in reading order) or to add parts. ' +
      'Returns the index range of the new elements.',
    parameters: {
      type: 'object',
      properties: {
        position: blockPositionSchema,
        blocks: { type: 'array', items: blockSchema, minItems: 1, maxItems: 80 },
        theme: themeSchema,
        lang: langSchema,
      },
      required: ['position', 'blocks'],
      additionalProperties: false,
    },
  },
  {
    name: 'replace_elements',
    description:
      'Replace the top-level elements from..to (indices from the outline, inclusive) with new blocks – to rewrite a task, ' +
      'fix a text, change a table. Read the current content with get_elements first. Keep everything the user did not ask to change.',
    parameters: {
      type: 'object',
      properties: {
        from: { type: 'integer', minimum: 0 },
        to: { type: 'integer', minimum: 0 },
        blocks: { type: 'array', items: blockSchema, minItems: 1, maxItems: 80 },
        theme: themeSchema,
        lang: langSchema,
      },
      required: ['from', 'to', 'blocks'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_elements',
    description: 'Delete the top-level elements from..to (inclusive). The user is asked to confirm. Only delete what the user asked for.',
    parameters: {
      type: 'object',
      properties: { from: { type: 'integer', minimum: 0 }, to: { type: 'integer', minimum: 0 } },
      required: ['from', 'to'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_elements',
    description:
      'Return the full content of the top-level elements from..to (inclusive): complete paragraph texts, list flags, table cells, staff ABC. ' +
      'Use it before replace_elements and whenever the outline (texts are shortened) is not enough.',
    parameters: {
      type: 'object',
      properties: { from: { type: 'integer', minimum: 0 }, to: { type: 'integer', minimum: 0 } },
      required: ['from'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_document_outline',
    description:
      'Return the current document structure: top-level elements with index, text, style, whether they are headings, and the ABC source of inserted staves. Call it again after inserting, because indices shift.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'add_lyrics',
    description:
      'Put song text (lyrics) under the notes of a tune: distributes the syllables over the music lines as ABC "w:" ' +
      'lines (one syllable per note). Write the text with German syllable breaks marked by "-" ("Al-le mei-ne ' +
      'Ent-chen"); "_" holds the previous syllable for one more note (melisma), "*" leaves a note without text, "~" puts ' +
      'two words on one note. Returns the new tune in "abc" – then call insert_staff or replace_staff with it.',
    parameters: {
      type: 'object',
      properties: {
        abc: { type: 'string', description: 'The complete tune (e.g. the "abc" of a staff from the outline).' },
        lyrics: { type: 'string', description: 'The text with syllables separated by "-".' },
        mode: {
          type: 'string',
          enum: ['replace', 'verse'],
          description: '"replace" (default) replaces existing lyrics, "verse" adds another verse below.',
        },
      },
      required: ['abc', 'lyrics'],
      additionalProperties: false,
    },
  },
  {
    name: 'convert_german_notes',
    description:
      'Convert German note names into ABC. Understands c d e f g a h, b = B flat, -is/-es suffixes (fis, es, as), ' +
      'accidentals written in front ("bc"/"♭c" = ces, "#f" = fis), octave marks (c\' c\'\' C C,), bar lines | and a time ' +
      'signature token such as "4/4" (bar lines are then added automatically). Digits after a note are ambiguous: ' +
      'octave marks in German school notation (c1 = c\') or note values (c1 = whole, g2 = half, c4 = quarter). ' +
      'Use this whenever the user gives note names. Insert the returned "tune" (or build your own from "abc_notes"), ' +
      'and tell the user how digits were read ("digits") and about any "warnings" or "errors" – never drop notes silently.',
    parameters: {
      type: 'object',
      properties: {
        notes: { type: 'string', description: 'The user\'s note list verbatim, incl. a time signature, e.g. "4/4 bc1, f1, g2, be2, c1, C" or "c – f – g".' },
        clef: {
          type: 'string',
          enum: ['treble', 'bass'],
          description: 'Clef; decides the octave of note names without octave marks (treble: c = c\', bass: c = small c).',
        },
        digits: {
          type: 'string',
          enum: ['auto', 'octave', 'duration'],
          description:
            'Meaning of digits after note names: "octave" (c1 = c\', c2 = c\'\'), "duration" (1 = whole, 2 = half, 4 = quarter, 8 = eighth, "." = dotted; ' +
            'a note without value repeats the previous value) or "auto" (default: note values if the digits include 4/8/16, or a ' +
            'time signature is given and two or more different values fill whole bars; otherwise octave marks). If the user ' +
            'says what the digits mean, pass it explicitly.',
        },
      },
      required: ['notes'],
      additionalProperties: false,
    },
  },
  {
    name: 'search_images',
    description:
      'Find pictures for a worksheet: pictograms (ARASAAC – simple, clear drawings of objects, animals, actions and feelings, ' +
      'ideal for primary and special-needs schools; search in German), photos/drawings/historical pictures (Wikimedia Commons – ' +
      'real animals, plants, places, art, Roman or medieval pictures; English search terms often find more) and the user\'s own ' +
      'pictures (a picture folder the teacher fills, e.g. comic panels, scans, own photos; matched by file and folder names). ' +
      'Returns image_id, title, keywords/description and size; put a chosen picture on the sheet with a picture block {image_id}. ' +
      'The licence credit is printed automatically.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', minLength: 1, maxLength: 100, description: 'One or two words for what the picture shows, e.g. "Fuchs", "lesen", "Roman legionary". "*" lists the user\'s own pictures.' },
        source: {
          type: 'string',
          enum: ['all', 'pictograms', 'photos', 'own'],
          description: 'pictograms = ARASAAC, photos = Wikimedia Commons, own = the user\'s picture folder, all (default) = every available source.',
        },
        limit: { type: 'integer', minimum: 1, maximum: 12, description: 'Results per source (default 6).' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'setup_page',
    description:
      'Page setup of the document: paper size, orientation, margins, columns, a header (school name and logo from the user\'s settings, ' +
      'subject, class …) and a footer with page numbers, and the design (theme) for all later content. Placeholders {page} and {pages} ' +
      'in header/footer texts become page numbers.',
    parameters: {
      type: 'object',
      properties: {
        paper: { type: 'string', enum: ['A4', 'A5', 'letter'] },
        orientation: { type: 'string', enum: ['portrait', 'landscape'] },
        margins_cm: { type: 'number', minimum: 0.5, maximum: 4 },
        columns: { type: 'integer', minimum: 1, maximum: 3 },
        header: {
          type: 'object',
          description: 'Header texts left/center/right; left defaults to the school name from the settings (school: false to omit it).',
          properties: { left: { type: 'string', maxLength: 120 }, center: { type: 'string', maxLength: 120 }, right: { type: 'string', maxLength: 120 }, school: { type: 'boolean' }, line: { type: 'boolean' } },
          additionalProperties: false,
        },
        footer: {
          type: 'object',
          properties: { left: { type: 'string', maxLength: 120 }, center: { type: 'string', maxLength: 120 }, right: { type: 'string', maxLength: 120 } },
          additionalProperties: false,
        },
        page_numbers: { type: 'boolean', description: 'Add "Seite {page} von {pages}" to the footer.' },
        logo: { type: 'boolean', description: 'Put the school logo from the settings into the header.' },
        theme: themeSchema,
        lang: langSchema,
      },
      additionalProperties: false,
    },
  },
  {
    name: 'check_worksheet',
    description:
      'Check the worksheet in the document: task numbering, instructions, space for answers, points, solutions, leftover markup, ' +
      'readability for the grade and the page layout (tasks split across pages, nearly empty last page). Call it after creating or ' +
      'changing a worksheet and fix the errors and warnings it reports.',
    parameters: {
      type: 'object',
      properties: {
        grade: { type: 'integer', minimum: 1, maximum: 13, description: 'school grade (Klassenstufe) for the readability check' },
        max_pages: { type: 'integer', minimum: 1, maximum: 50 },
      },
      additionalProperties: false,
    },
  },
];

export const CLIENT_TOOLS = new Set([
  'insert_blocks',
  'setup_page',
  'check_worksheet',
  'replace_elements',
  'delete_elements',
  'get_elements',
  'insert_staff',
  'insert_empty_staves',
  'replace_staff',
  'get_document_outline',
]);

const BLOCK_TYPES = new Set(worksheet.layout.BLOCK_TYPES);
const ALLOWED_BLOCK_KEYS = new Set(Object.keys(blockSchema.properties));
/** Fields whose backslashes are meaningful (LaTeX, SVG, ABC) – never unescaped. */
const RAW_KEYS = new Set(['latex', 'svg', 'abc']);

/**
 * Some models escape line breaks twice in tool arguments ("Zeile 1\\nZeile 2" arrives as a literal backslash + n);
 * worksheet texts never need a literal "\n", so turn it into a real line break (and "\t" into a tab).
 * Inline formulas \\( … \\) are left alone (LaTeX such as \\neq or \\times).
 */
export function unescapeText(v: string): string {
  if (!v.includes('\\')) return v;
  return v
    .split(/(\\\([\s\S]*?\\\))/)
    .map((part, i) => (i % 2 === 1 ? part : part.replace(/\\r\\n|\\n/g, '\n').replace(/\\t/g, '\t')))
    .join('');
}

function str(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = unescapeText(v);
  return t.length > max ? t.slice(0, max) : t;
}

/** Nested structures that go deeper than other fields: structogram steps, sequence diagram fragments. */
const DEEP_KEYS = new Set(['steps', 'messages']);
/**
 * Diagram texts are often code ("printf(\"%d\\n\")"): their strings are taken verbatim, without unescapeText (a
 * line break would be collapsed to a space in a diagram anyway).
 */
const DIAGRAM_KEYS = new Set(['classes', 'relations', 'objects', 'links', 'participants', 'messages', 'states', 'transitions',
  'initial', 'accepting', 'steps', 'entities', 'relationships', 'nodes', 'edges', 'system', 'actors', 'use_cases']);

/** Copy a value from the model: strings unescaped and bounded, arrays/objects bounded in size and depth. */
function cleanValue(v: unknown, key: string, depth: number, maxDepth = 5, raw = false): unknown {
  if (typeof v === 'string') {
    if (RAW_KEYS.has(key)) return v.slice(0, key === 'svg' ? 200000 : 20000);
    return (raw ? v : unescapeText(v)).slice(0, 4000);
  }
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'boolean' || v == null) return v;
  if (depth > maxDepth) return undefined;
  if (Array.isArray(v)) return v.slice(0, 120).map((x) => cleanValue(x, key, depth + 1, maxDepth, raw));
  if (typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>).slice(0, 40)) {
      const c = cleanValue(x, k, depth + 1, maxDepth, raw);
      if (c !== undefined) o[k] = c;
    }
    return o;
  }
  return undefined;
}

/**
 * Validate and normalise worksheet blocks. Returns the cleaned blocks or a
 * message the model can act on (block number + problem). After the per-block
 * checks the blocks are laid out once (packages/shared/worksheet-layout.js) – this
 * catches e.g. crossword words that do not fit or chart data of the wrong length.
 */
export function checkBlocks(raw: unknown, opts: { nested?: boolean; layout?: boolean } = {}): { blocks?: Record<string, unknown>[]; error?: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { error: '"blocks" must be a non-empty array.' };
  if (raw.length > 80) return { error: 'At most 80 blocks per call – split the content into several calls.' };
  const out: Record<string, unknown>[] = [];
  for (let i = 0; i < raw.length; i++) {
    const b = raw[i] as Record<string, unknown>;
    const at = `blocks[${i}]`;
    if (!b || typeof b !== 'object' || !BLOCK_TYPES.has(String(b.type))) {
      return { error: `${at}: unknown type "${b && (b as { type?: unknown }).type}". Allowed: ${[...BLOCK_TYPES].join(', ')}.` };
    }
    const type = String(b.type);
    const base: Record<string, unknown> = {};
    for (const k of Object.keys(b)) {
      if (!ALLOWED_BLOCK_KEYS.has(k) || k === 'columns') continue;
      // structogram steps nest 2–4 levels per control structure (if/then, switch/cases/do)
      const c = cleanValue(b[k], k, 0, DEEP_KEYS.has(k) ? 30 : 5, DIAGRAM_KEYS.has(k));
      if (c !== undefined) base[k] = c;
    }
    switch (type) {
      case 'heading': {
        const text = str(b.text, 500);
        if (!text?.trim()) return { error: `${at}: heading needs "text".` };
        out.push({ ...base, type, text, level: Math.min(3, Math.max(1, Number(b.level) || 2)) });
        break;
      }
      case 'paragraph': {
        const text = str(b.text, 4000);
        if (text == null) return { error: `${at}: paragraph needs "text".` };
        const p: Record<string, unknown> = { ...base, type, text };
        if (!['left', 'center', 'right', 'justify'].includes(String(b.align))) delete p.align;
        out.push(p);
        break;
      }
      case 'list': {
        if (!Array.isArray(b.items) || !b.items.length) return { error: `${at}: list needs "items" (array of strings).` };
        out.push({ ...base, type, items: b.items.slice(0, 50).map((x) => unescapeText(String(x)).slice(0, 2000)), ordered: b.ordered === true });
        break;
      }
      case 'table': {
        if (!Array.isArray(b.rows) || !b.rows.length || !b.rows.every((r) => Array.isArray(r))) {
          return { error: `${at}: table needs "rows" (array of arrays of strings).` };
        }
        const rows = (b.rows as unknown[][]).slice(0, 60).map((r) => r.slice(0, 10).map((c) => (c == null ? '' : unescapeText(String(c)).slice(0, 1000))));
        out.push({ ...base, type, rows, header: b.header !== false });
        break;
      }
      case 'lines': {
        const count = Math.round(Number(b.count ?? 3));
        if (!(count >= 1 && count <= 20)) return { error: `${at}: lines "count" must be 1–20.` };
        const label = str(b.label, 500);
        const l: Record<string, unknown> = { ...base, type, count };
        if (label) l.label = label; else delete l.label;
        if (b.style != null && !worksheet.layout.LINE_STYLES.includes(String(b.style))) {
          return { error: `${at}: lines "style" must be one of ${worksheet.layout.LINE_STYLES.join(', ')}.` };
        }
        out.push(l);
        break;
      }
      case 'box': {
        const text = str(b.text, 4000);
        const items = Array.isArray(b.items) ? b.items : null;
        if (!text?.trim() && !(items && items.length)) return { error: `${at}: box needs "text" (or "items").` };
        const title = str(b.title, 200);
        const bx: Record<string, unknown> = { ...base, type };
        if (text) bx.text = text; else delete bx.text;
        if (title) bx.title = title; else delete bx.title;
        out.push(bx);
        break;
      }
      case 'staff': {
        const v = abcTools.validateAbc(b.abc, { requireClef: true });
        if (!v.valid) return { error: `${at}: invalid ABC – ${abcTools.formatValidationErrors(v)}` };
        const lyr = lyricsProblem(v);
        if (lyr) return { error: `${at}: lyrics do not fit the notes – ${lyr}` };
        const width = normalizeWidth(b.width_cm);
        if (width === null) return { error: `${at}: "width_cm" must be a number.` };
        out.push(withWidth({ type, abc: v.normalized }, width));
        break;
      }
      case 'empty_staves': {
        const clef = b.clef === 'bass' ? 'bass' : 'treble';
        const count = Math.round(Number(b.count ?? 1));
        if (!(count >= 1 && count <= 12)) return { error: `${at}: empty_staves "count" must be 1–12.` };
        const measures = b.measures == null ? 4 : Math.round(Number(b.measures));
        if (!(measures >= 0 && measures <= 8)) return { error: `${at}: "measures" must be 0–8.` };
        const width = normalizeWidth(b.width_cm);
        out.push(withWidth({ type, clef, count, measures }, width ?? undefined));
        break;
      }
      case 'page_break':
        out.push({ type });
        break;
      case 'spacer':
        out.push({ type, lines: Math.min(10, Math.max(1, Math.round(Number(b.lines) || 1))) });
        break;
      case 'task': {
        if (!str(b.instruction, 4000)?.trim() && !str(b.title, 200)?.trim()) return { error: `${at}: task needs "instruction" (and optionally "title").` };
        if (b.number != null) base.number = String(b.number).slice(0, 4);
        if (b.points != null && !(Number(b.points) >= 0)) return { error: `${at}: task "points" must be a number ≥ 0.` };
        out.push({ ...base, type });
        break;
      }
      case 'columns': {
        if (opts.nested) return { error: `${at}: columns cannot be nested.` };
        if (!Array.isArray(b.columns) || b.columns.length < 2 || b.columns.length > 3) return { error: `${at}: columns needs "columns": 2–3 arrays of blocks.` };
        const cols: Record<string, unknown>[][] = [];
        for (let c = 0; c < b.columns.length; c++) {
          const r = checkBlocks(b.columns[c], { nested: true, layout: false });
          if (r.error) return { error: `${at}.columns[${c}]: ${r.error}` };
          cols.push(r.blocks!);
        }
        out.push({ ...base, type, columns: cols });
        break;
      }
      case 'hint_cards': {
        const n = Number(b.columns ?? 2);
        out.push({ ...base, type, columns: Number.isInteger(n) && n >= 1 && n <= 3 ? n : 2 });
        break;
      }
      case 'picture': {
        const id = typeof b.image_id === 'string' ? b.image_id.trim() : '';
        if (!/^(arasaac|commons|own):./s.test(id)) {
          return { error: `${at}: picture needs "image_id" from a search_images result (e.g. "arasaac:2623") – call search_images first.` };
        }
        const p: Record<string, unknown> = { ...base, type, image_id: id };
        if (b.width_cm != null) {
          const w = Number(b.width_cm);
          if (!Number.isFinite(w)) return { error: `${at}: picture "width_cm" must be a number.` };
          p.width_cm = Math.min(19, Math.max(1.5, w));
        }
        if (!['left', 'center', 'right'].includes(String(b.align))) delete p.align;
        out.push(p);
        break;
      }
      case 'qr_code': {
        const url = str(b.url, 600);
        if (!url?.trim()) return { error: `${at}: qr_code needs "url".` };
        if (url.length > 500) return { error: `${at}: qr_code "url" is too long (max. 500 characters).` };
        out.push({ ...base, type, url: url.trim() });
        break;
      }
      default:
        out.push({ ...base, type });
    }
  }
  if (opts.layout !== false && !opts.nested) {
    try {
      worksheet.layout.compose(out, { theme: 'modern', lang: 'de', textWidthMm: 170 });
    } catch (e) {
      return { error: (e as Error).message };
    }
  }
  return { blocks: out };
}

/** theme / lang arguments of insert_blocks, replace_elements and setup_page. */
function themeArgs(a: Record<string, unknown>): { theme?: string; lang?: string } | string {
  const out: { theme?: string; lang?: string } = {};
  if (a.theme != null && a.theme !== '') {
    if (!worksheet.themes.isThemeId(String(a.theme))) return `"theme" must be one of ${worksheet.themes.THEME_IDS.join(', ')}.`;
    out.theme = String(a.theme);
  }
  if (a.lang != null && a.lang !== '') {
    const l = String(a.lang).toLowerCase().slice(0, 2);
    if (!worksheet.themes.LANGUAGES.includes(l)) return `"lang" must be one of ${worksheet.themes.LANGUAGES.join(', ')}.`;
    out.lang = l;
  }
  return out;
}

function checkRange(a: Record<string, unknown>, needTo: boolean): { from: number; to: number } | string {
  const from = Number(a.from);
  const to = a.to == null ? (needTo ? NaN : from) : Number(a.to);
  if (!Number.isInteger(from) || from < 0) return '"from" must be an element index (integer >= 0) from the outline.';
  if (!Number.isInteger(to) || to < from) return '"to" must be an integer >= "from".';
  if (to - from > 200) return 'At most 200 elements per call.';
  return { from, to };
}
export const SERVER_TOOLS = new Set(['convert_german_notes', 'add_lyrics', 'search_images']);

/** What async tool handling needs: the user (own pictures) and the picture service (null = pictures off). */
export interface ToolContext {
  userId: string;
  images?: ImageService | null;
}

/** The tools offered to the model (search_images only when pictures are available). */
export function toolDefinitions(ctx: { images?: ImageService | null }): ToolDefinition[] {
  return ctx.images ? TOOL_DEFINITIONS : TOOLS_WITHOUT_PICTURES;
}

/** Without pictures the model is not told about picture blocks either. */
const TOOLS_WITHOUT_PICTURES: ToolDefinition[] = TOOL_DEFINITIONS.filter((d) => d.name !== 'search_images').map((d) => {
  if (d.name !== 'insert_blocks' && d.name !== 'replace_elements') return d;
  const params = JSON.parse(JSON.stringify(d.parameters)) as { properties: { blocks: { items: { properties: Record<string, { description?: string; enum?: string[] }> } } } };
  const props = params.properties.blocks.items.properties;
  props.type.description = String(props.type.description).replace(PICTURE_DOC, '');
  props.type.enum = props.type.enum!.filter((t) => t !== 'picture');
  delete props.image_id;
  return { ...d, parameters: params };
});

function pictureBlocks(blocks: Record<string, unknown>[], out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  for (const b of blocks) {
    if (b.type === 'picture') out.push(b);
    else if (b.type === 'columns' && Array.isArray(b.columns)) for (const col of b.columns) if (Array.isArray(col)) pictureBlocks(col as Record<string, unknown>[], out);
  }
  return out;
}

/**
 * Validate a client tool call, including what needs the network: picture blocks must name a picture that exists.
 * Their metadata (title, credit, aspect ratio – a few bytes, no image data) is stored on the block as picture_meta.
 */
export async function checkToolCall(call: ToolCall, ctx: ToolContext): Promise<ToolCheck> {
  const check = checkClientToolCall(call);
  if (!check.ok || (call.name !== 'insert_blocks' && call.name !== 'replace_elements')) return check;
  const pics = pictureBlocks(check.args.blocks as Record<string, unknown>[]);
  if (!pics.length) return check;
  const verb = call.name === 'insert_blocks' ? 'Nothing was inserted.' : 'Nothing was changed.';
  if (!ctx.images) return { ok: false, args: call.arguments, error: `${verb} Pictures are switched off on this server – remove the picture blocks.` };
  try {
    await Promise.all(
      pics.map(async (b) => {
        const m = await ctx.images!.describe(String(b.image_id), ctx.userId);
        b.image_id = m.image_id; // canonical id (what the plugin fetches)
        b.picture_meta = { title: m.title, credit: m.credit, ...(m.width && m.height ? { width: m.width, height: m.height } : {}) };
      }),
    );
  } catch (err) {
    const msg = err instanceof ImageError ? err.message : `A picture could not be checked (${(err as Error).message}) – try again or leave it out.`;
    return { ok: false, args: call.arguments, error: `${verb} ${msg}` };
  }
  return check;
}

const SOURCE_ARG: Record<string, ImageSource[] | undefined> = { pictograms: ['arasaac'], photos: ['commons'], own: ['own'] };

/** Execute a server tool (async: search_images needs the network). */
export async function runServerTool(call: ToolCall, ctx: ToolContext): Promise<unknown> {
  if (call.name !== 'search_images') return executeServerTool(call);
  const a = call.arguments ?? {};
  const images = ctx.images;
  if (!images) return { ok: false, error: 'Pictures are switched off on this server.' };
  const query = typeof a.query === 'string' ? a.query.trim() : '';
  if (!query) return { ok: false, error: '"query" must be a non-empty string.' };
  const source = a.source == null || a.source === 'all' ? undefined : SOURCE_ARG[String(a.source)];
  if (a.source != null && a.source !== 'all' && !source) return { ok: false, error: '"source" must be all, pictograms, photos or own.' };
  if (source && !images.sources.has(source[0])) {
    return { ok: false, error: source[0] === 'own' ? 'Own pictures are not set up on this server.' : `The source "${a.source}" is switched off on this server.` };
  }
  const limit = Number.isInteger(a.limit) ? Number(a.limit) : undefined;
  const r = await images.search(query, { sources: source, limit, userId: ctx.userId });
  const results = r.results.map((m) => {
    const o: Record<string, unknown> = { image_id: m.image_id, source: m.source === 'arasaac' ? 'pictogram' : m.source === 'commons' ? 'photo/drawing' : 'own', title: m.title };
    if (m.description) o.description = m.description;
    if (m.keywords?.length) o.keywords = m.keywords;
    if (m.width && m.height) o.size = `${m.width}x${m.height}`;
    if (m.license) o.license = m.license;
    return o;
  });
  const out: Record<string, unknown> = { ok: true, query, results };
  if (r.notes.length) out.notes = r.notes;
  out.hint = results.length
    ? 'Choose pictures that clearly show what the task is about and add them as picture blocks {image_id} (beside text: columns). ' +
      'Prefer one picture style per worksheet. If nothing fits, try another word (singular, a synonym, English for photos) or leave it out.'
    : 'Nothing found. Try a simpler or more general word (singular), another source, or English terms for photos.' +
      (images.sources.has('own') ? ` Own pictures are searched by file and folder names in ${images.folderName}.` : '');
  return out;
}

/** Lyrics that do not fit the notes are rejected for the AI (the manual mode only warns). */
function lyricsProblem(v: { warnings: Array<{ code: string; line?: number; syllables?: number; notes?: number }> }): string | null {
  const bad = v.warnings.filter((w) => w.code === 'lyrics_mismatch');
  if (!bad.length) return null;
  return (
    bad.map((w) => `w: line ${w.line} has ${w.syllables} syllables for ${w.notes} notes`).join('; ') +
    '. Every note of the music line above needs exactly one slot: separate syllables with "-", hold a syllable with "_", ' +
    'skip a note with "*". Easiest: call add_lyrics with the plain hyphenated text.'
  );
}

export interface ToolCheck {
  ok: boolean;
  /** Arguments after normalisation (e.g. normalised ABC). */
  args: Record<string, unknown>;
  error?: string;
}

/** Accepts the documented position forms plus a few lenient variants models produce. */
export function normalizePosition(pos: unknown, allowStartEnd = false): ToolCheck['args']['position'] | null {
  if (pos == null || pos === '' || pos === 'cursor') return 'cursor';
  if (allowStartEnd && (pos === 'start' || pos === 'end')) return pos;
  if (typeof pos === 'string') {
    const idx = /^after_paragraph_index\s*[:=]\s*(\d+)$/.exec(pos.trim());
    if (idx) return { after_paragraph_index: Number(idx[1]) };
    const head = /^after_heading\s*[:=]\s*(.+)$/.exec(pos.trim());
    if (head) return { after_heading: head[1].replace(/^["']|["']$/g, '') };
    return null;
  }
  if (typeof pos === 'object') {
    const o = pos as Record<string, unknown>;
    if (o.type === 'cursor') return 'cursor';
    const index = o.after_paragraph_index ?? (o.type === 'after_paragraph_index' ? o.index ?? o.value : undefined);
    if (index !== undefined) {
      const n = Number(index);
      return Number.isInteger(n) && n >= 0 ? { after_paragraph_index: n } : null;
    }
    const heading = o.after_heading ?? (o.type === 'after_heading' ? o.heading ?? o.text ?? o.value : undefined);
    if (typeof heading === 'string' && heading.trim()) return { after_heading: heading.trim() };
  }
  return null;
}

/** undefined = not given (the plugin then uses the user's default width), null = invalid. */
function normalizeWidth(w: unknown): number | null | undefined {
  if (w == null || w === '') return undefined;
  const n = Number(w);
  if (!Number.isFinite(n)) return null;
  return Math.min(19, Math.max(3, n));
}

function withWidth(args: Record<string, unknown>, width: number | undefined): Record<string, unknown> {
  return width === undefined ? args : { ...args, width_cm: width };
}

/** Validate (and normalise) the arguments of a client tool call. */
export function checkClientToolCall(call: ToolCall): ToolCheck {
  const a = call.arguments ?? {};
  if ('__raw' in a) {
    return { ok: false, args: a, error: 'Arguments were not valid JSON. Send a JSON object.' };
  }
  switch (call.name) {
    case 'get_document_outline':
      return { ok: true, args: {} };

    case 'insert_blocks': {
      const position = normalizePosition(a.position, true);
      if (!position) return { ok: false, args: a, error: 'Invalid "position". Use "cursor", "start", "end", {"after_heading": "..."} or {"after_paragraph_index": n}.' };
      const th = themeArgs(a);
      if (typeof th === 'string') return { ok: false, args: a, error: `Nothing was inserted. ${th}` };
      const r = checkBlocks(a.blocks);
      if (r.error) return { ok: false, args: a, error: `Nothing was inserted. ${r.error}` };
      return { ok: true, args: { position, blocks: r.blocks, ...th } };
    }

    case 'replace_elements': {
      const range = checkRange(a, true);
      if (typeof range === 'string') return { ok: false, args: a, error: range };
      const th = themeArgs(a);
      if (typeof th === 'string') return { ok: false, args: a, error: `Nothing was changed. ${th}` };
      const r = checkBlocks(a.blocks);
      if (r.error) return { ok: false, args: a, error: `Nothing was changed. ${r.error}` };
      return { ok: true, args: { ...range, blocks: r.blocks, ...th } };
    }

    case 'setup_page': {
      const th = themeArgs(a);
      if (typeof th === 'string') return { ok: false, args: a, error: th };
      const out: Record<string, unknown> = { ...th };
      if (a.paper != null) {
        if (!['A4', 'A5', 'letter'].includes(String(a.paper))) return { ok: false, args: a, error: '"paper" must be A4, A5 or letter.' };
        out.paper = String(a.paper);
      }
      if (a.orientation != null) {
        if (!['portrait', 'landscape'].includes(String(a.orientation))) return { ok: false, args: a, error: '"orientation" must be portrait or landscape.' };
        out.orientation = String(a.orientation);
      }
      if (a.margins_cm != null) {
        const m = Number(a.margins_cm);
        if (!(m >= 0.5 && m <= 4)) return { ok: false, args: a, error: '"margins_cm" must be 0.5–4.' };
        out.margins_cm = m;
      }
      if (a.columns != null) {
        const c = Number(a.columns);
        if (!(Number.isInteger(c) && c >= 1 && c <= 3)) return { ok: false, args: a, error: '"columns" must be 1, 2 or 3.' };
        out.columns = c;
      }
      for (const k of ['header', 'footer'] as const) {
        const v = a[k];
        if (v == null) continue;
        if (typeof v !== 'object' || Array.isArray(v)) return { ok: false, args: a, error: `"${k}" must be an object {left, center, right}.` };
        const o: Record<string, unknown> = {};
        for (const part of ['left', 'center', 'right']) {
          const t = str((v as Record<string, unknown>)[part], 120);
          if (t) o[part] = t;
        }
        for (const flag of ['school', 'line']) {
          const f = (v as Record<string, unknown>)[flag];
          if (typeof f === 'boolean') o[flag] = f;
        }
        out[k] = o;
      }
      if (typeof a.page_numbers === 'boolean') out.page_numbers = a.page_numbers;
      if (typeof a.logo === 'boolean') out.logo = a.logo;
      if (!Object.keys(out).length) return { ok: false, args: a, error: 'Nothing to change – pass at least one setting.' };
      return { ok: true, args: out };
    }

    case 'check_worksheet': {
      const out: Record<string, unknown> = {};
      if (a.grade != null) {
        const g = Number(a.grade);
        if (!(Number.isInteger(g) && g >= 1 && g <= 13)) return { ok: false, args: a, error: '"grade" must be an integer 1–13.' };
        out.grade = g;
      }
      if (a.max_pages != null) {
        const m = Number(a.max_pages);
        if (!(Number.isInteger(m) && m >= 1 && m <= 50)) return { ok: false, args: a, error: '"max_pages" must be an integer 1–50.' };
        out.max_pages = m;
      }
      return { ok: true, args: out };
    }

    case 'delete_elements': {
      const range = checkRange(a, true);
      if (typeof range === 'string') return { ok: false, args: a, error: range };
      return { ok: true, args: range };
    }

    case 'get_elements': {
      const range = checkRange(a, false);
      if (typeof range === 'string') return { ok: false, args: a, error: range };
      if (range.to - range.from > 59) range.to = range.from + 59;
      return { ok: true, args: range };
    }

    case 'insert_staff': {
      const position = normalizePosition(a.position);
      if (!position) return { ok: false, args: a, error: 'Invalid "position". Use "cursor", {"after_heading": "..."} or {"after_paragraph_index": n}.' };
      const width = normalizeWidth(a.width_cm);
      if (width === null) return { ok: false, args: a, error: '"width_cm" must be a number.' };
      const v = abcTools.validateAbc(a.abc, { requireClef: true });
      if (!v.valid) {
        return {
          ok: false,
          args: a,
          error: `Invalid ABC notation – nothing was inserted. Fix these problems and call insert_staff again: ${abcTools.formatValidationErrors(v)}`,
        };
      }
      const lyr = lyricsProblem(v);
      if (lyr) return { ok: false, args: a, error: `Lyrics do not fit the notes – nothing was inserted. ${lyr}` };
      return { ok: true, args: withWidth({ abc: v.normalized, position }, width) };
    }

    case 'replace_staff': {
      const index = Number(a.index);
      if (!Number.isInteger(index) || index < 0) return { ok: false, args: a, error: '"index" must be the element index (integer >= 0) of the staff from the outline.' };
      const width = normalizeWidth(a.width_cm);
      if (width === null) return { ok: false, args: a, error: '"width_cm" must be a number.' };
      const v = abcTools.validateAbc(a.abc, { requireClef: true });
      if (!v.valid) {
        return {
          ok: false,
          args: a,
          error: `Invalid ABC notation – nothing was changed. Fix these problems and call replace_staff again: ${abcTools.formatValidationErrors(v)}`,
        };
      }
      const lyr = lyricsProblem(v);
      if (lyr) return { ok: false, args: a, error: `Lyrics do not fit the notes – nothing was changed. ${lyr}` };
      return { ok: true, args: withWidth({ index, abc: v.normalized }, width) };
    }

    case 'insert_empty_staves': {
      const position = normalizePosition(a.position);
      if (!position) return { ok: false, args: a, error: 'Invalid "position". Use "cursor", {"after_heading": "..."} or {"after_paragraph_index": n}.' };
      const width = normalizeWidth(a.width_cm);
      if (width === null) return { ok: false, args: a, error: '"width_cm" must be a number.' };
      const clef = a.clef === 'bass' ? 'bass' : a.clef === 'treble' || a.clef == null ? 'treble' : null;
      if (!clef) return { ok: false, args: a, error: '"clef" must be "treble" or "bass".' };
      const count = Math.round(Number(a.count ?? 1));
      if (!Number.isFinite(count) || count < 1 || count > 12) return { ok: false, args: a, error: '"count" must be an integer between 1 and 12.' };
      const measures = a.measures == null ? 4 : Math.round(Number(a.measures));
      if (!Number.isFinite(measures) || measures < 0 || measures > 8) return { ok: false, args: a, error: '"measures" must be between 0 and 8.' };
      return { ok: true, args: withWidth({ clef, count, measures, position }, width) };
    }

    default:
      return { ok: false, args: a, error: `Unknown tool "${call.name}".` };
  }
}

/** Execute a server-side tool and return its JSON-serialisable result. */
export function executeServerTool(call: ToolCall): unknown {
  const a = call.arguments ?? {};
  if (call.name === 'convert_german_notes') {
    if (typeof a.notes !== 'string' || !a.notes.trim()) {
      return { ok: false, error: '"notes" must be a non-empty string.' };
    }
    const clef = a.clef === 'bass' ? 'bass' : 'treble';
    const digits = a.digits === 'octave' || a.digits === 'duration' ? a.digits : 'auto';
    const r = abcTools.germanToAbc(a.notes.slice(0, 2000), { clef, digits });
    return {
      ok: r.ok,
      clef,
      meter: r.meter,
      digits: r.digits,
      digits_explanation:
        r.digits === 'duration'
          ? 'Digits were read as note values (1 = whole, 2 = half, 4 = quarter, 8 = eighth).'
          : 'Digits (if any) were read as Helmholtz octave marks (c1 = c\', c2 = c\'\').',
      bars: r.bars,
      abc_notes: r.abc,
      tune: r.tune,
      notes: r.notes.map((n) => ({ german: n.input, abc: n.abc })),
      errors: r.errors,
      warnings: r.warnings,
      hint: r.errors.length
        ? 'Some tokens could not be converted. Do not insert a staff without them – ask the user or correct them.'
        : 'Insert "tune" with insert_staff (adjust title/meter if needed).',
    };
  }
  if (call.name === 'add_lyrics') {
    if (typeof a.abc !== 'string' || typeof a.lyrics !== 'string' || !a.lyrics.trim()) {
      return { ok: false, error: '"abc" and "lyrics" must be non-empty strings.' };
    }
    const v = abcTools.validateAbc(a.abc);
    if (!v.valid) return { ok: false, error: 'The tune is not valid ABC: ' + abcTools.formatValidationErrors(v) };
    const r = abcTools.addLyrics(v.normalized, a.lyrics.slice(0, 5000), { mode: a.mode === 'verse' ? 'verse' : 'replace' });
    return {
      ok: r.ok,
      abc: r.ok ? r.abc : undefined,
      syllables: r.syllables,
      notes: r.notes,
      lines: r.lines,
      errors: r.errors,
      warnings: r.warnings,
      hint: r.ok
        ? 'Insert "abc" with insert_staff (new staff) or replace_staff (existing staff). Mention warnings to the user.'
        : 'Fix the lyrics (syllable breaks with "-", "_" to hold a syllable) and call add_lyrics again, or ask the user.',
    };
  }
  return { ok: false, error: `Unknown server tool "${call.name}".` };
}
