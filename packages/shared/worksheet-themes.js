/*
 * worksheet-themes.js – designs ("themes") and labels for worksheets (MIT License).
 *
 * Used by the editor plugin (browser, global `WorksheetThemes`) and the proxy
 * (Node.js, CommonJS). Dependency-free, ES2015-compatible.
 *
 * A theme decides fonts, sizes, spacing and colours of everything the
 * assistant inserts. The AI only picks a theme id; it never passes colours.
 * Fonts are ones the Euro-Office Document Server ships (Open Sans, Liberation
 * Sans, …), so printing from the editor looks like the preview.
 *
 *   classic  – black and white, thin lines, no fills: saves toner, photocopies well
 *   modern   – calm, one blue accent colour, Open Sans 11 pt (secondary school)
 *   primary  – primary school: larger type (13 pt), 1.5 line spacing, friendly colours
 *   document – no fonts/sizes of its own: content follows the document's styles
 *              (used when adding to an existing document that was not made with a theme)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.WorksheetThemes = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var BOX_VARIANTS = ['info', 'rule', 'tip', 'warning', 'example', 'solution', 'definition'];

  /** Icon (WorksheetSvg.icon name) shown in a box of each variant. */
  var BOX_ICONS = {
    info: 'info',
    rule: 'important',
    tip: 'tip',
    warning: 'warning',
    example: 'example',
    solution: 'solution',
    definition: 'definition'
  };

  /** Work forms and activities that can be shown as symbols next to a task. */
  var TASK_ICONS = ['single', 'partner', 'group', 'class', 'read', 'write', 'listen', 'speak', 'draw', 'calculate',
    'research', 'cut', 'glue', 'experiment', 'computer', 'music', 'clock', 'homework', 'target'];

  function boxes(colors) {
    // colors: variant -> [border, fill, title]
    var out = {};
    BOX_VARIANTS.forEach(function (v) {
      var c = colors[v];
      out[v] = { border: c[0], fill: c[1], title: c[2], icon: BOX_ICONS[v] };
    });
    return out;
  }

  var THEMES = {
    classic: {
      id: 'classic',
      label: { de: 'Klassisch (schwarz-weiß)', en: 'Classic (black and white)' },
      description: 'black and white, thin lines, no coloured fills – toner-saving, ideal for copying',
      font: 'Liberation Sans',
      headingFont: 'Liberation Sans',
      size: 11,
      sizes: { h1: 18, h2: 13, h3: 11.5, small: 9, title: 20 },
      lineSpacing: 1.15,
      spaceAfter: 6,
      writingLineMm: 9,
      colors: {
        text: '#000000', heading: '#000000', accent: '#000000', accentLight: '#f2f2f2', muted: '#555555',
        tableHeader: '#e6e6e6', tableHeaderText: '#000000', border: '#000000', line: '#777777', titleRule: '#000000',
        badgeFill: '#000000', badgeText: '#ffffff', icon: '#000000', syllable1: '#1d4ed8', syllable2: '#dc2626'
      },
      badgeShape: 'circle',
      titleStyle: 'rule',
      boxStyle: 'frame',
      boxes: boxes({
        info: ['#000000', null, '#000000'],
        rule: ['#000000', null, '#000000'],
        tip: ['#000000', null, '#000000'],
        warning: ['#000000', null, '#000000'],
        example: ['#000000', null, '#000000'],
        solution: ['#000000', null, '#000000'],
        definition: ['#000000', null, '#000000']
      })
    },
    modern: {
      id: 'modern',
      label: { de: 'Modern (blau)', en: 'Modern (blue)' },
      description: 'calm and clear, one blue accent colour, Open Sans – secondary school and adults',
      font: 'Open Sans',
      headingFont: 'Open Sans',
      size: 11,
      sizes: { h1: 18, h2: 13, h3: 11.5, small: 9, title: 22 },
      lineSpacing: 1.15,
      spaceAfter: 6,
      writingLineMm: 9,
      colors: {
        text: '#1f2937', heading: '#1e3a8a', accent: '#2563eb', accentLight: '#eff6ff', muted: '#6b7280',
        tableHeader: '#dbeafe', tableHeaderText: '#1e3a8a', border: '#94a3b8', line: '#9ca3af', titleRule: '#2563eb',
        badgeFill: '#2563eb', badgeText: '#ffffff', icon: '#1e3a8a', syllable1: '#1d4ed8', syllable2: '#dc2626'
      },
      badgeShape: 'circle',
      titleStyle: 'rule',
      boxStyle: 'bar',
      boxes: boxes({
        info: ['#2563eb', '#eff6ff', '#1e40af'],
        rule: ['#dc2626', '#fef2f2', '#991b1b'],
        tip: ['#d97706', '#fffbeb', '#92400e'],
        warning: ['#ea580c', '#fff7ed', '#9a3412'],
        example: ['#0d9488', '#f0fdfa', '#115e59'],
        solution: ['#16a34a', '#f0fdf4', '#166534'],
        definition: ['#7c3aed', '#f5f3ff', '#5b21b6']
      })
    },
    primary: {
      id: 'primary',
      label: { de: 'Grundschule (farbig, groß)', en: 'Primary school (colourful, large)' },
      description: 'primary school: larger type, 1.5 line spacing, friendly colours, big task numbers',
      font: 'Open Sans',
      headingFont: 'Open Sans',
      size: 13,
      sizes: { h1: 20, h2: 14, h3: 13, small: 10.5, title: 24 },
      lineSpacing: 1.5,
      spaceAfter: 6,
      writingLineMm: 11,
      colors: {
        text: '#1f2937', heading: '#0f766e', accent: '#0d9488', accentLight: '#f0fdfa', muted: '#6b7280',
        tableHeader: '#ccfbf1', tableHeaderText: '#134e4a', border: '#5eead4', line: '#94a3b8', titleRule: '#f59e0b',
        badgeFill: '#f59e0b', badgeText: '#ffffff', icon: '#0f766e', syllable1: '#1d4ed8', syllable2: '#dc2626'
      },
      badgeShape: 'circle',
      titleStyle: 'band',
      boxStyle: 'filled',
      boxes: boxes({
        info: ['#38bdf8', '#e0f2fe', '#075985'],
        rule: ['#f87171', '#fee2e2', '#991b1b'],
        tip: ['#fbbf24', '#fef9c3', '#854d0e'],
        warning: ['#fb923c', '#ffedd5', '#9a3412'],
        example: ['#34d399', '#d1fae5', '#065f46'],
        solution: ['#4ade80', '#dcfce7', '#166534'],
        definition: ['#a78bfa', '#ede9fe', '#5b21b6']
      })
    },
    document: {
      id: 'document',
      label: { de: 'Wie das Dokument', en: 'Like the document' },
      description: 'keeps the fonts and sizes of the existing document; only boxes and tables get colours',
      font: null,
      headingFont: null,
      size: null,
      sizes: { h1: null, h2: null, h3: null, small: null, title: null },
      lineSpacing: null,
      spaceAfter: null,
      writingLineMm: 9,
      colors: {
        text: null, heading: null, accent: '#4f46e5', accentLight: '#eef2ff', muted: '#6b7280',
        tableHeader: '#ebedf5', tableHeaderText: null, border: '#000000', line: '#000000', titleRule: '#4f46e5',
        badgeFill: '#4f46e5', badgeText: '#ffffff', icon: '#3730a3', syllable1: '#1d4ed8', syllable2: '#dc2626'
      },
      badgeShape: 'circle',
      titleStyle: 'plain',
      boxStyle: 'frame',
      boxes: boxes({
        info: ['#4f46e5', '#eef2ff', '#3730a3'],
        rule: ['#4f46e5', '#eef2ff', '#3730a3'],
        tip: ['#4f46e5', '#eef2ff', '#3730a3'],
        warning: ['#4f46e5', '#eef2ff', '#3730a3'],
        example: ['#4f46e5', '#eef2ff', '#3730a3'],
        solution: ['#4f46e5', '#eef2ff', '#3730a3'],
        definition: ['#4f46e5', '#eef2ff', '#3730a3']
      })
    }
  };

  var THEME_IDS = ['classic', 'modern', 'primary', 'document'];

  /** Labels the assistant prints on worksheets, per document language. */
  var LABELS = {
    de: {
      name: 'Name', class: 'Klasse', date: 'Datum', points: 'P.', pointsLong: 'Punkte', task: 'Aufgabe',
      wordBank: 'Wortspeicher', true: 'richtig', false: 'falsch', across: 'Waagerecht', down: 'Senkrecht',
      words: 'Diese Wörter sind versteckt:', grade: 'Note', range: 'Punkte', total: 'Gesamt', cut: 'hier abschneiden',
      selfCan: 'Das kann ich', selfGood: 'gut', selfOk: 'teilweise', selfBad: 'noch nicht', hint: 'Tipp', solution: 'Lösung',
      minutes: 'Min.', page: 'Seite', of: 'von', statement: 'Aussage',
      structYes: 'wahr', structNo: 'falsch', structOtherwise: 'sonst', flowStart: 'Start', flowEnd: 'Ende'
    },
    en: {
      name: 'Name', class: 'Class', date: 'Date', points: 'pts', pointsLong: 'points', task: 'Task',
      wordBank: 'Word bank', true: 'true', false: 'false', across: 'Across', down: 'Down',
      words: 'Find these words:', grade: 'Grade', range: 'Points', total: 'Total', cut: 'cut here',
      selfCan: 'I can …', selfGood: 'well', selfOk: 'partly', selfBad: 'not yet', hint: 'Hint', solution: 'Solution',
      minutes: 'min', page: 'Page', of: 'of', statement: 'Statement',
      structYes: 'true', structNo: 'false', structOtherwise: 'else', flowStart: 'Start', flowEnd: 'End'
    },
    fr: {
      name: 'Nom', class: 'Classe', date: 'Date', points: 'pts', pointsLong: 'points', task: 'Exercice',
      wordBank: 'Banque de mots', true: 'vrai', false: 'faux', across: 'Horizontalement', down: 'Verticalement',
      words: 'Trouve ces mots :', grade: 'Note', range: 'Points', total: 'Total', cut: 'découper ici',
      selfCan: 'Je sais …', selfGood: 'bien', selfOk: 'en partie', selfBad: 'pas encore', hint: 'Astuce', solution: 'Solution',
      minutes: 'min', page: 'Page', of: 'sur', statement: 'Affirmation',
      structYes: 'vrai', structNo: 'faux', structOtherwise: 'sinon', flowStart: 'Début', flowEnd: 'Fin'
    },
    es: {
      name: 'Nombre', class: 'Clase', date: 'Fecha', points: 'p.', pointsLong: 'puntos', task: 'Ejercicio',
      wordBank: 'Banco de palabras', true: 'verdadero', false: 'falso', across: 'Horizontales', down: 'Verticales',
      words: 'Busca estas palabras:', grade: 'Nota', range: 'Puntos', total: 'Total', cut: 'cortar aquí',
      selfCan: 'Sé …', selfGood: 'bien', selfOk: 'en parte', selfBad: 'todavía no', hint: 'Pista', solution: 'Solución',
      minutes: 'min', page: 'Página', of: 'de', statement: 'Afirmación',
      structYes: 'verdadero', structNo: 'falso', structOtherwise: 'si no', flowStart: 'Inicio', flowEnd: 'Fin'
    },
    it: {
      name: 'Nome', class: 'Classe', date: 'Data', points: 'p.', pointsLong: 'punti', task: 'Esercizio',
      wordBank: 'Banca delle parole', true: 'vero', false: 'falso', across: 'Orizzontali', down: 'Verticali',
      words: 'Trova queste parole:', grade: 'Voto', range: 'Punti', total: 'Totale', cut: 'tagliare qui',
      selfCan: 'So …', selfGood: 'bene', selfOk: 'in parte', selfBad: 'non ancora', hint: 'Suggerimento', solution: 'Soluzione',
      minutes: 'min', page: 'Pagina', of: 'di', statement: 'Affermazione',
      structYes: 'vero', structNo: 'falso', structOtherwise: 'altrimenti', flowStart: 'Inizio', flowEnd: 'Fine'
    },
    nl: {
      name: 'Naam', class: 'Klas', date: 'Datum', points: 'p.', pointsLong: 'punten', task: 'Opdracht',
      wordBank: 'Woordenbank', true: 'juist', false: 'onjuist', across: 'Horizontaal', down: 'Verticaal',
      words: 'Zoek deze woorden:', grade: 'Cijfer', range: 'Punten', total: 'Totaal', cut: 'hier knippen',
      selfCan: 'Ik kan …', selfGood: 'goed', selfOk: 'een beetje', selfBad: 'nog niet', hint: 'Tip', solution: 'Oplossing',
      minutes: 'min', page: 'Pagina', of: 'van', statement: 'Stelling',
      structYes: 'waar', structNo: 'onwaar', structOtherwise: 'anders', flowStart: 'Start', flowEnd: 'Einde'
    },
    pl: {
      name: 'Imię i nazwisko', class: 'Klasa', date: 'Data', points: 'pkt', pointsLong: 'punktów', task: 'Zadanie',
      wordBank: 'Bank słów', true: 'prawda', false: 'fałsz', across: 'Poziomo', down: 'Pionowo',
      words: 'Znajdź te słowa:', grade: 'Ocena', range: 'Punkty', total: 'Razem', cut: 'tu odciąć',
      selfCan: 'Umiem …', selfGood: 'dobrze', selfOk: 'częściowo', selfBad: 'jeszcze nie', hint: 'Wskazówka', solution: 'Rozwiązanie',
      minutes: 'min', page: 'Strona', of: 'z', statement: 'Zdanie',
      structYes: 'prawda', structNo: 'fałsz', structOtherwise: 'w przeciwnym razie', flowStart: 'Start', flowEnd: 'Koniec'
    }
  };

  var LANGUAGES = Object.keys(LABELS);

  function getTheme(id) {
    return THEMES[id] || THEMES.modern;
  }

  function isThemeId(id) {
    return THEME_IDS.indexOf(id) !== -1;
  }

  function labels(lang) {
    var l = String(lang || 'de').toLowerCase().slice(0, 2);
    return LABELS[l] || LABELS.en;
  }

  /** "#1d4ed8" -> [29, 78, 216] (null for anything else). */
  function hexToRgb(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!m) return null;
    var n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  return {
    THEMES: THEMES,
    THEME_IDS: THEME_IDS,
    BOX_VARIANTS: BOX_VARIANTS,
    BOX_ICONS: BOX_ICONS,
    TASK_ICONS: TASK_ICONS,
    LABELS: LABELS,
    LANGUAGES: LANGUAGES,
    getTheme: getTheme,
    isThemeId: isThemeId,
    labels: labels,
    hexToRgb: hexToRgb
  };
});
