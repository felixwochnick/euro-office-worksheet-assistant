/*
 * Minimal i18n for the panel. German is the default UI language.
 * Add a language by adding a dictionary with the same keys.
 * Elements use data-i18n (text), data-i18n-placeholder, data-i18n-title.
 */
(function (window) {
  'use strict';

  var DICTS = {
    de: {
      'tab.chat': 'KI-Chat',
      'tab.manual': 'Manuell',
      'tab.settings': 'Einstellungen',
      'chat.placeholder': 'Was soll ich einfügen? z. B. „Füge unter Aufgabe 2 eine Notenzeile mit c – f – g im Violinschlüssel ein“',
      'chat.send': 'Senden',
      'chat.new': 'Neuer Chat',
      'chat.thinking': 'Denke nach …',
      'chat.welcome': 'Hallo! Beschreibe, welche Noten ich in dein Arbeitsblatt einfügen soll. Ich sehe die Gliederung deines Dokuments und die Cursorposition.',
      'chat.notConfigured': 'Bitte zuerst unter „Einstellungen“ die Proxy-URL und das Token eintragen – oder den manuellen Modus verwenden.',
      'chat.autoInsert': 'Automatisch einfügen',
      'chat.stopped': 'Abgebrochen.',
      'chat.stop': 'Stopp',
      'tool.insert_staff': 'Notenzeile',
      'tool.insert_empty_staves': 'Leere Notenzeile(n)',
      'tool.get_document_outline': 'Dokumentgliederung gelesen',
      'tool.convert_german_notes': 'Tonnamen umgerechnet',
      'tool.inserted': 'eingefügt',
      'tool.insertedAt': 'eingefügt als Element {index}',
      'tool.failed': 'fehlgeschlagen: {error}',
      'tool.rejected': 'verworfen',
      'preview.title': 'Vorschau – einfügen?',
      'preview.insert': 'Einfügen',
      'preview.discard': 'Verwerfen',
      'manual.template': 'Vorlage',
      'manual.template.none': '– Vorlage wählen –',
      'manual.template.emptyTreble': 'Leere Zeile, Violinschlüssel',
      'manual.template.emptyBass': 'Leere Zeile, Bassschlüssel',
      'manual.template.melody': 'Beispielmelodie (Alle meine Entchen)',
      'manual.template.scale': 'C-Dur-Tonleiter',
      'manual.template.bassScale': 'C-Dur-Tonleiter, Bassschlüssel',
      'manual.german': 'Tonnamen (deutsch) → ABC',
      'manual.germanPlaceholder': "z. B. c – f – g oder fis' g' a' h'",
      'manual.convert': 'Umrechnen',
      'manual.clef': 'Schlüssel',
      'manual.clef.treble': 'Violinschlüssel',
      'manual.clef.bass': 'Bassschlüssel',
      'manual.abc': 'ABC-Notation',
      'manual.width': 'Breite (cm)',
      'manual.position': 'Position',
      'manual.position.cursor': 'An der Cursorposition',
      'manual.position.after': 'Nach Element …',
      'manual.reloadOutline': 'Gliederung neu laden',
      'manual.insert': 'Einfügen',
      'manual.loadSelected': 'Markiertes Notenbild laden',
      'manual.replaceSelected': 'Markiertes Bild ersetzen',
      'manual.preview': 'Vorschau',
      'manual.noSelection': 'Kein Notenbild markiert (oder es enthält keinen ABC-Alt-Text).',
      'manual.loaded': 'ABC aus dem markierten Bild geladen.',
      'manual.replaced': 'Bild ersetzt.',
      'manual.inserted': 'Eingefügt.',
      'manual.converted': '{count} Töne umgerechnet.',
      'settings.proxyUrl': 'Proxy-URL',
      'settings.token': 'Zugangs-Token',
      'settings.autoInsert': 'KI-Vorschläge automatisch einfügen (ohne Vorschau)',
      'settings.width': 'Standardbreite (cm)',
      'settings.dpi': 'Auflösung (dpi)',
      'settings.method': 'Einfügemethode',
      'settings.method.auto': 'Automatisch (Builder-API, dann Fallbacks)',
      'settings.method.api': 'Nur Builder-API (Api.CreateImage)',
      'settings.method.imageData': 'Bilddaten an Cursor (PutImageDataToSelection)',
      'settings.method.html': 'HTML einfügen (PasteHtml)',
      'settings.language': 'Sprache',
      'settings.save': 'Speichern',
      'settings.test': 'Verbindung testen',
      'settings.saved': 'Gespeichert.',
      'settings.storageWarning': 'Hinweis: Einstellungen können in diesem Browser nicht dauerhaft gespeichert werden.',
      'settings.testOk': 'Verbindung ok – Modell: {model} ({provider})',
      'settings.methodHint': 'Falls eingefügte Bilder leer bleiben, eine andere Methode wählen.',
      'error.network': 'Proxy nicht erreichbar ({detail}). Stimmen URL und CORS-Einstellung?',
      'error.auth': 'Zugriff verweigert – bitte das Token prüfen.',
      'error.rateLimit': 'Zu viele Anfragen – bitte kurz warten.',
      'error.server': 'Fehler vom Proxy: {detail}',
      'error.render': 'Die Noten konnten nicht dargestellt werden: {detail}',
      'error.invalidAbc': 'Ungültige ABC-Notation: {detail}',
      'error.editor': 'Der Editor hat die Aktion nicht ausgeführt: {detail}',
      'error.maxRounds': 'Abbruch: zu viele Arbeitsschritte.',
      'warning.fallback': 'Hinweis: eingefügt mit Ersatzmethode „{method}“{extra}.',
      'warning.noAlt': ' – Alt-Text (ABC) konnte nicht gesetzt werden',
      'warning.cursorInstead': ' – an der Cursorposition statt an der gewünschten Stelle'
    },
    en: {
      'tab.chat': 'AI chat',
      'tab.manual': 'Manual',
      'tab.settings': 'Settings',
      'chat.placeholder': 'What should I insert? e.g. "Insert a staff with C – F – G in treble clef below task 2"',
      'chat.send': 'Send',
      'chat.new': 'New chat',
      'chat.thinking': 'Thinking …',
      'chat.welcome': 'Hi! Describe which music I should insert into your worksheet. I can see the outline of your document and the cursor position.',
      'chat.notConfigured': 'Please enter the proxy URL and token under "Settings" first – or use the manual mode.',
      'chat.autoInsert': 'Insert automatically',
      'chat.stopped': 'Stopped.',
      'chat.stop': 'Stop',
      'tool.insert_staff': 'Staff',
      'tool.insert_empty_staves': 'Empty staves',
      'tool.get_document_outline': 'Read document outline',
      'tool.convert_german_notes': 'Converted note names',
      'tool.inserted': 'inserted',
      'tool.insertedAt': 'inserted as element {index}',
      'tool.failed': 'failed: {error}',
      'tool.rejected': 'discarded',
      'preview.title': 'Preview – insert?',
      'preview.insert': 'Insert',
      'preview.discard': 'Discard',
      'manual.template': 'Template',
      'manual.template.none': '– choose a template –',
      'manual.template.emptyTreble': 'Empty staff, treble clef',
      'manual.template.emptyBass': 'Empty staff, bass clef',
      'manual.template.melody': 'Example melody',
      'manual.template.scale': 'C major scale',
      'manual.template.bassScale': 'C major scale, bass clef',
      'manual.german': 'German note names → ABC',
      'manual.germanPlaceholder': "e.g. c – f – g or fis' g' a' h'",
      'manual.convert': 'Convert',
      'manual.clef': 'Clef',
      'manual.clef.treble': 'Treble clef',
      'manual.clef.bass': 'Bass clef',
      'manual.abc': 'ABC notation',
      'manual.width': 'Width (cm)',
      'manual.position': 'Position',
      'manual.position.cursor': 'At the cursor',
      'manual.position.after': 'After element …',
      'manual.reloadOutline': 'Reload outline',
      'manual.insert': 'Insert',
      'manual.loadSelected': 'Load selected staff image',
      'manual.replaceSelected': 'Replace selected image',
      'manual.preview': 'Preview',
      'manual.noSelection': 'No staff image selected (or it has no ABC alt text).',
      'manual.loaded': 'Loaded ABC from the selected image.',
      'manual.replaced': 'Image replaced.',
      'manual.inserted': 'Inserted.',
      'manual.converted': 'Converted {count} notes.',
      'settings.proxyUrl': 'Proxy URL',
      'settings.token': 'Access token',
      'settings.autoInsert': 'Insert AI suggestions automatically (no preview)',
      'settings.width': 'Default width (cm)',
      'settings.dpi': 'Resolution (dpi)',
      'settings.method': 'Insert method',
      'settings.method.auto': 'Automatic (builder API, then fallbacks)',
      'settings.method.api': 'Builder API only (Api.CreateImage)',
      'settings.method.imageData': 'Image data at cursor (PutImageDataToSelection)',
      'settings.method.html': 'Paste HTML (PasteHtml)',
      'settings.language': 'Language',
      'settings.save': 'Save',
      'settings.test': 'Test connection',
      'settings.saved': 'Saved.',
      'settings.storageWarning': 'Note: settings cannot be stored permanently in this browser.',
      'settings.testOk': 'Connection ok – model: {model} ({provider})',
      'settings.methodHint': 'If inserted images stay empty, choose another method.',
      'error.network': 'Proxy not reachable ({detail}). Check URL and CORS settings.',
      'error.auth': 'Access denied – check the token.',
      'error.rateLimit': 'Too many requests – please wait a moment.',
      'error.server': 'Proxy error: {detail}',
      'error.render': 'Could not render the music: {detail}',
      'error.invalidAbc': 'Invalid ABC notation: {detail}',
      'error.editor': 'The editor did not perform the action: {detail}',
      'error.maxRounds': 'Stopped: too many steps.',
      'warning.fallback': 'Note: inserted using fallback method "{method}"{extra}.',
      'warning.noAlt': ' – alt text (ABC) could not be set',
      'warning.cursorInstead': ' – at the cursor instead of the requested position'
    }
  };

  var current = 'de';

  function resolveLang(pref) {
    var lang = pref;
    if (!lang || lang === 'auto') {
      var info = window.Asc && window.Asc.plugin && window.Asc.plugin.info;
      lang = (info && info.lang) || navigator.language || 'de';
    }
    lang = String(lang).slice(0, 2).toLowerCase();
    return DICTS[lang] ? lang : 'de';
  }

  function t(key, params) {
    var s = (DICTS[current] && DICTS[current][key]) || DICTS.de[key] || key;
    if (params) {
      s = s.replace(/\{(\w+)\}/g, function (m, k) { return params[k] != null ? String(params[k]) : m; });
    }
    return s;
  }

  function apply(root) {
    root = root || document;
    root.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    root.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) { el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder'))); });
    root.querySelectorAll('[data-i18n-title]').forEach(function (el) { el.setAttribute('title', t(el.getAttribute('data-i18n-title'))); });
    document.documentElement.lang = current;
  }

  window.MusicI18n = {
    languages: Object.keys(DICTS),
    setLanguage: function (pref) { current = resolveLang(pref); return current; },
    getLanguage: function () { return current; },
    t: t,
    apply: apply
  };
})(window);
