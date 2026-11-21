# Pictures inside tasks, picture credits on a sources page – design

Date: 2026-11-22 · Status: owner asked to implement right away (no further review); calls marked *(our call)*

## Intent

Children who cannot read well yet should work with pictures *inside* the task: connect the picture of an eye with the
word "Sehen", tick the picture that fits, sort pictures into a table. Until now a picture was only a block of its own
(`picture`, beside text with `columns`); the design of 2026-11-19 listed picture-based task types as a non-goal. This is
that step.

The owner also decided where the licence credits go: **always on the last page**, a sources page of its own that does
**not count in the page numbering** ("6 pages of worksheet ⇒ page 7 is the sources page", the footer says "Seite 1 von
6"). No credit line under the pictures any more – the screenshot showed two lines of "Piktogramm: Sergio Palao, …"
under every pictogram.

## Goals

- Picture items inside task blocks *(our call: the task types that matter most for primary and special-needs
  schools)*:
  - `matching` – `pairs[].left` / `pairs[].right` may be a picture item (picture ↔ word, picture ↔ picture).
  - `multiple_choice` – `questions[].options[]` may be picture items (tick the right picture);
    `questions[].image_id` puts a picture with the question ("Was ist das?").
  - `true_false` – `statements[].image_id` shows a picture with the statement.
  - `table` – a cell of `rows` may be a picture item (sorting tables, picture + word columns).
  - `list` – an item of `items` may be a picture item (word list with pictograms).
  - `crossword` – `entries[].image_id` = picture clue (Bilderrätsel); `clue` becomes optional then.
- A **picture item** is `{image_id, text?, width_cm?}`; `image_id` only from `search_images`. `text` is printed under
  (or beside) the picture; without `text` only the picture is shown (so "Was ist das?" does not give the answer away).
- All credits of the document are collected on one **sources page** ("Bildquellen") at the end, grouped by credit
  (all ARASAAC pictograms share one line), with the page numbers where the pictures are.
- The sources page is created, updated and removed automatically whenever the plugin changes the document (insert,
  replace, delete, page setup) and before the worksheet check. The AI never writes credits itself.
- The page count in the footer ("von N") counts only the worksheet pages.

## Non-goals

- Pictures in cloze texts (rebus), word searches, hint cards, mind maps.
- Updating the sources page while the teacher edits by hand without the plugin (see "Limits").
- Converting page-count fields that came from Word (`{NUMPAGES}` complex fields); only the editor's own page count
  element (what `setup_page` and the editor insert) is switched.

## Anti-goals

- A free picture printed without its credit somewhere in the document.
- Credit lines between task rows (the reason for the sources page).
- A sources page that eats a page number or shows a page number of its own.

## Approaches considered

### Picture items

- **A. Structured picture items in the task fields (chosen).** Every builder knows where a picture can be and lays it
  out properly (cell sizes, row heights, dots of `matching` centred on the picture). One generic walker finds every
  object with an `image_id` in a block tree, so the proxy (validation, `picture_meta`) and the plugin (loading,
  `picture_data`) handle picture blocks and picture items the same way.
- B. Inline markup in any text (`{{bild:arasaac:2623}}`). Works everywhere at once, but the sizes are guesswork, it
  clashes with the `[[gap]]` syntax and the model would mix it into prose.
- C. New block types (`picture_matching`, …). Duplicates the builders and the prompt.

### Sources page without a page number

The editor (sdkjs in Euro-Office) has no `SECTIONPAGES` field; its page-count element (`CRunPagesCount`) always shows
the total number of pages. Tried in the real editor (spike, 2026-11-22):

- **Chosen:** the sources page is a section of its own (section break "next page" in front of it) with its own empty
  footer. The worksheet footer shows `PAGE` and, instead of the page count, a **`PAGEREF` field to a bookmark at the
  end of the worksheet** (`Arbeitsblatt_Ende`), i.e. the number of the last worksheet page. `PAGEREF` is a field
  with a stored result; the plugin updates it after every change (it recalculates the layout first).
- Rejected: `{= {NUMPAGES} - 1}` – also a stored field result and depends on formula support; a fixed number written
  by the plugin – breaks with the first manual edit and cannot be updated by the editor ("Feld aktualisieren").

## Design

### Picture items (packages/shared/worksheet-layout.js)

- `pictureRefs(blocks)` (exported): every plain object at any depth of the blocks that has a string `image_id`
  (picture blocks, picture items, statements/entries/questions with `image_id`), including inside `columns`.
- The proxy stores `picture_meta {title, credit, width?, height?}` on each of them, the plugin `picture_data
  {dataUrl, width, height, title, credit}` (unchanged formats).
- A picture run gets the alt text `Bild: <title>` + (credit ? `\nQuelle: <credit>`) + `\n\n` + marker:
  - picture block: `WSGRAPHIC {"type":"picture","image_id":…, width_cm?, align?, caption?}` (as before),
  - picture item: `WSPICTURE {"image_id":…, "text"?, "width_cm"?}`.
  The `Quelle: ` line is what the sources page is built from; pictures inserted by older versions have no such line
  and keep their printed credit.
- Picture block: no credit line under the picture any more (caption stays).
- Sizes *(our call)*: an item fits a box – matching 2.5 cm high, multiple-choice options 2.5 cm, question picture
  3 cm, true/false 1.8 cm, table cells the cell width (max. 3 cm high unless `width_cm`), list 1.5 cm inline before
  the text, crossword clues 2 cm. `width_cm` (1–8) overrides the default width, the box still limits it.
- Without `picture_data` (proxy-side layout check) a picture item lays out an image run of the right size without
  `dataUrl` (like the picture block).
- Solution key of `matching` (lines mode) uses `text`, else the title, else "Bild".

### Proxy (apps/server)

- Schema: the item fields accept `anyOf [string, picture item]`; `statements[]`, `entries[]`, `questions[]` get
  `image_id`. `checkBlocks` validates every `image_id` found by `pictureRefs` (format), `checkToolCall` resolves them
  (`describe`) and stores `picture_meta` – for picture blocks and items alike. Without picture support the item forms
  are removed from the schema like the picture block.
- Prompt: when pictures help a task, put them into the task (matching picture ↔ word, tick the picture, sort pictures
  in a table, picture crossword) instead of a picture column beside it; credits go to the sources page automatically.

### Sources page (apps/plugin/src/js/blocks.js)

Document structure at the end:

```
… worksheet …
P_end      empty paragraph (1 pt), carries the section break of the worksheet section, bookmark Arbeitsblatt_Ende
T_sources  one-cell borderless table, description "WSSOURCES {…}": heading "Bildquellen" + one paragraph per credit
P_last     the final paragraph; the final section (= sources page) has type nextPage and its own empty footer
```

- `refreshSources()` runs after `editBlocks` and `setupPage` and before `checkData`:
  1. collect (editor command, layout recalculated): every drawing in the main text with a `Quelle: ` line → credit,
     title, page; whether a sources page exists; the worksheet theme/language.
  2. build the elements in the plugin (theme fonts/colours, labels in the document language): heading, then per credit
     `S. 1, 3: „Auge“, „Ohr“ – Piktogramm: Sergio Palao, …` (titles of pictograms are listed up to 8).
  3. write (editor command): create, replace or remove `P_end` + `T_sources`; keep the bookmark on `P_end`; switch the
     page-count elements of the worksheet footers/headers to `PAGEREF Arbeitsblatt_Ende` (sources page exists) or back
     to the page count (removed); update those fields.
- Inserting at `end` (and at a cursor or index inside the sources page) inserts before `P_end`; `replace`/`delete`
  ranges that touch `P_end` or the sources page are refused with a clear message.
- `setup_page` puts header/footer on the worksheet section (not on the sources section); with a sources page `{pages}`
  becomes the `PAGEREF`.
- Outline/`get_elements` mark the sources elements (`sources: true`) so the AI leaves them alone; the worksheet check
  ignores them and counts only the worksheet pages. `get_elements` shows pictures in table cells as
  `[Bild arasaac:2623 „Auge“]`, so the AI can keep them when it rebuilds a table.

## Limits

- Edits by hand without the plugin do not update the sources page or the "von N" field until the next change by the
  plugin; the editor's "Feld aktualisieren" updates the field. Word updates it when printing.
- Older pictures (inserted before this version) keep their credit under the picture and are not listed.

## Left to the builder

Exact sizes and spacing, label wording, tests.
