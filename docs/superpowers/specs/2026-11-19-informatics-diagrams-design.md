# Informatics diagrams (UML and more) – design

Date: 2026-11-19 · Status: approved by the owner as a direction ("UML for Informatik, class diagrams etc., like Klonk;
also sequence and state diagrams; finished diagrams and diagrams to fill in – please implement"). The owner was then
unavailable; every further decision below is marked *(my call)*.

## Intent

Informatik teachers should be able to ask the AI for worksheets with diagrams – "Erstelle ein Arbeitsblatt zur
Vererbung mit einem Klassendiagramm, in dem die Schüler die Attribute ergänzen" – and get diagrams that look like
the ones in their textbooks and in Klonk (the owner's programming-learning app, which already draws structograms,
class, object and ER diagrams from code). Drawing them with the free `svg` block gives crooked boxes and arrows.

## Goals

- New worksheet blocks for the diagrams of the Informatik curriculum:
  1. **class diagram** (UML) – classes, interfaces, abstract classes, enumerations; attributes and methods with
     visibility, static (underlined), abstract (italic); inheritance, implementation, association (label,
     multiplicities, navigability), aggregation, composition, dependency;
  2. **object diagram** (UML) – objects `name : Klasse` with attribute values, links;
  3. **sequence diagram** (UML) – participants (objects, actors), synchronous/asynchronous calls, replies,
     object creation, self calls, activation bars, combined fragments `alt`/`opt`/`loop`;
  4. **state diagram** (UML) – states with entry/do/exit, initial and final state, transitions
     `event [guard] / action`; also as a **finite automaton** (circles, accepting states as double circles, start
     arrow) for theoretical computer science;
  5. **structogram** (Nassi-Shneiderman, DIN 66261) – actions, branches, case selection, pre-/post-test and endless
     loops, calls, exits;
  6. **ER diagram** – Chen notation (1:n), (min,max) and crow's foot.
- Every diagram exists **finished** and **to fill in**, with a matching **solution version** (`show_answers`):
  - any text in a diagram can contain gaps `[[answer]]` (the cloze syntax): an empty writing line on the sheet, the
    answer in the accent colour in the solution; a text that is only a gap becomes a full-width writing line;
  - elements with `blank: true` (relations, links, messages, transitions) are left out for students to draw and
    appear in the solution;
  - attributes/methods/values given as a number are that many empty lines (open task, no solution);
  - the student and the solution version have exactly the same layout.
- The AI only fills a data model; the layout is computed (like the mind maps). The source is kept in the alt text so
  the AI can change a diagram later (existing mechanism).
- Works in the built-in chat and for MCP clients (same block schema).

## Non-goals

- Parsing program code into diagrams (Klonk does this; here the AI writes the model directly).
- Use case, activity, component and deployment diagrams, Programmablaufpläne *(my call: not asked for; activity
  diagrams / PAP can follow with the same infrastructure)*.
- Weak entities, ISA hierarchies and the relational schema in ER diagrams *(my call: the relational schema is plain
  text and can already be written with `__underline__`)*.
- Editing diagrams by hand in the editor (they are images, like every graphic of the plugin).

## Anti-goals

- No external rendering service (Kroki, PlantUML server): worksheets of minors' schools must not leave the
  teacher's infrastructure, and the plugin must work offline.
- No text smaller than about 2.6 mm (7.5 pt) on paper: rather an error that tells the AI to split the diagram.
- No layout that differs between the student and the solution version.

## Approaches considered

- **A. Port Klonk's renderers into a new shared module, layout with dagre (chosen, my call).** Klonk's
  `@klonk/diagrams` already solves class/object/structogram/ER rendering with dagre's layered layout. Ported to the
  conventions of `packages/shared` (plain ES5-style JavaScript, UMD, millimetres, theme fonts and colours), extended
  by sequence and state diagrams and the fill-in features. The owner is the sole author of Klonk, so the code can be
  relicensed from ELv2 to MIT for this repository *(my call; the owner can object in the PR)*.
- B. Text DSL (PlantUML/Mermaid) rendered by a library in the browser. Mermaid is several MB and needs a DOM – the
  proxy could no longer validate blocks; no fill-in versions; looks different from Klonk.
- C. An own layout algorithm without dagre. Smaller, but crossing minimisation and edge routing are a project of
  their own; dagre (MIT, ~49 KB minified) is proven and what Klonk uses.

## Design

### Module

`packages/shared/worksheet-diagrams.js` (UMD, browser global `WorksheetDiagrams`, CommonJS in Node), depends on
`worksheet-svg.js` (text measuring, SVG helpers – exported as `util`) and dagre:

- browser: `vendor/dagre/dagre.min.js` (npm `@dagrejs/dagre` 3.1.2, MIT, checksum in `vendor/SHA256SUMS`), loaded by
  `index.html` before the shared modules, global `dagre`;
- Node (proxy, companion bundle, tests): `require('@dagrejs/dagre')`, an exact dependency of `@worksheet-assistant/shared`.
  A unit test checks that the vendored file and the npm package have the same version.

Functions `classDiagram`, `objectDiagram`, `sequenceDiagram`, `stateDiagram`, `structogram`, `erDiagram`; each takes
options and returns `{ svg, widthMm, heightMm }` like the other graphics, and throws `<fn>: <message>` errors that tell
the AI what to fix. Text 3.4 mm by default; a diagram wider than the available width is scaled down to at most
`76 %` (text ≥ 2.6 mm), otherwise an error. `width_cm` sets the width explicitly (same limit).

### Blocks (worksheet-layout.js)

`class_diagram`, `object_diagram`, `sequence_diagram`, `state_diagram`, `structogram`, `er_diagram` – graphics with
`caption?`, `width_cm?`, `show_answers?`. Their fields (documented in the tool schema):

| block | fields |
|---|---|
| class_diagram | `classes[{name, kind? class/abstract/interface/enum, attributes[] or n, methods[] or n, values[] (enum)}]`, `relations[{from, to, kind inheritance/implementation/association/aggregation/composition/dependency, label?, from_mult?, to_mult?, directed?, blank?}]`, `direction? vertical/horizontal` |
| object_diagram | `objects[{name?, class, values[] ("attr = value") or n}]`, `links[{from, to, label?, directed?, blank?}]`, `direction?` |
| sequence_diagram | `participants[{name, kind? object/actor}]` (or strings), `messages[]` of `{from, to, text, kind? call/async/return/create, blank?}` or fragments `{fragment alt/opt/loop, label, messages[], else?{label, messages[]}}`, `activations? (default true)` |
| state_diagram | `states[{name, activities?[] ("entry / …")} or string]`, `transitions[{from, to, label?, blank?}]` with `[*]` for the initial/final state, `notation? uml/automaton`, `accepting?[]` (automaton), `direction?` |
| structogram | `title?`, `blocks[]`: a string (action) or `{if, then[], else[]}`, `{while, do[]}`, `{for, do[]}`, `{repeat[], until}`, `{loop[]}`, `{switch, cases[{label, do[]}], default?[]}`, `{call}`, `{exit}` |
| er_diagram | `entities[{name, attributes[] (key: "__id__")}]`, `relationships[{name, from, to, from_card, to_card, attributes?[]}]`, `notation? chen/minmax/crowsfoot` |

Conventions *(my calls)*: `from` of an inheritance/implementation is the subclass; of an aggregation/composition the
whole (diamond end). In member texts `static`/`abstract` (or `{static}`/`{abstract}`) become underline/italic; `__x__`
underlines (ER keys), `*x*` italic. UML keywords stay English («interface», «abstract», «enumeration»).
Direction: class diagrams vertical (superclasses on top) when there is inheritance, else horizontal; state diagrams
and object diagrams horizontal.

### Look

Thin black/ink lines, headers of classes/objects/entities in the theme's light accent colour (light grey in
*Klassisch*), theme font; answers in the theme's accent colour (bold), gaps as dotted writing lines in the muted
colour, empty writing lines 7 mm high for handwriting.

### Quality check, prompt, docs

`check_worksheet` counts a diagram with gaps, blank elements or empty lines as space to answer. The system prompt and
the tool description get the new blocks and a rule for Informatik (which diagram for which topic, fill-in version +
solution). README, CHANGELOG, website feature list; version 0.8.0.

## Left to the builder

Exact spacing, arrow sizes and the error wording; the mock provider gets one class diagram example for demos.
