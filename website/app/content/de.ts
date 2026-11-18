import type { SiteContent } from './types'

const de: SiteContent = {
  meta: {
    title: 'Arbeitsblatt-Assistent für Euro-Office',
    description:
      'Arbeitsblätter mit KI erstellen – für jedes Fach, in Nextcloud, in der Desktop-App oder mit Claude & Co. über MCP. Open Source.'
  },
  nav: { features: 'Funktionen', ways: 'Einsatz', mcp: 'MCP', demo: 'Live-Demo', install: 'Installation', faq: 'FAQ', language: 'Sprache' },
  hero: {
    badge: 'Open Source · MIT',
    headline: 'KI-Plugin für Euro-Office – in Nextcloud und auf dem Desktop',
    title: 'Arbeitsblätter mit KI erstellen – für jedes Fach',
    description:
      'Beschreibe, was du brauchst: Der Arbeitsblatt-Assistent schreibt Aufgaben, Lückentexte, Tabellen, Schreiblinien, Merkkästen und Notenzeilen direkt in dein Dokument – mit dem eingebauten KI-Chat oder mit deinem eigenen KI-Assistenten über MCP.',
    install: 'Installieren',
    more: 'So funktioniert’s',
    imageAlt:
      'Euro-Office mit dem Arbeitsblatt-Assistenten: ein per KI-Chat erstelltes Arbeitsblatt zum Wasserkreislauf, links der Chat mit der Anfrage'
  },
  features: {
    headline: 'Funktionen',
    title: 'Vom leeren Blatt zum fertigen Arbeitsblatt',
    description: 'Gebaut für Lehrkräfte und Lehramtsstudierende – für Arbeitsblätter, Tests und Handouts in jedem Fach.',
    items: [
      {
        title: 'Ganze Arbeitsblätter per Chat',
        description:
          '„Erstelle ein Arbeitsblatt zum Wasserkreislauf für Klasse 5“: Überschrift, Aufgaben, Tabelle, Schreiblinien und Merkkasten in einem Schritt – auf Wunsch erst als Vorschau.'
      },
      {
        title: 'Ändern statt neu anfangen',
        description:
          '„Formuliere Aufgabe 1 für Klasse 3“, „Mach aus Aufgabe 2 einen Lückentext“, „Füge eine Lösungsseite hinzu“ – die KI ändert nur, was du sagst. Löschen nur nach Bestätigung.'
      },
      {
        title: 'Notenzeilen und Liedtexte',
        description:
          'Melodien, leere Notenzeilen und Liedtext als druckfertige Bilder. Deutsche Tonnamen (h, fis, b) werden zuverlässig umgerechnet; jede Zeile bleibt bearbeitbar.'
      },
      {
        title: 'Dein KI-Assistent über MCP',
        description:
          'Claude, ChatGPT, Le Chat und andere bearbeiten das geöffnete Dokument mit denselben Werkzeugen – ohne KI-Schlüssel im Plugin.'
      },
      {
        title: 'Datenschutz in deiner Hand',
        description:
          'Mistral als EU-Anbieter, ein lokales Modell über Ollama oder gar keine KI. Der Schlüssel bleibt auf dem Server, Anmeldung mit dem Nextcloud-Konto.'
      },
      {
        title: 'Nextcloud, Server oder Desktop',
        description:
          'Ein Befehl für Nextcloud AIO, ein Docker-Compose für den eigenen Document Server oder das Begleitprogramm für die Desktop-App (Windows, macOS, Linux).'
      }
    ]
  },
  ways: {
    headline: 'Einsatz',
    title: 'Drei Wege – ein Plugin',
    description: 'Wähle, wo du arbeitest und welche KI du nutzen möchtest. Alle Wege lassen sich kombinieren.',
    items: [
      {
        title: 'In Nextcloud',
        badge: 'für Schulen',
        description: 'Das Plugin im Euro-Office von Nextcloud, der kleine Server daneben. Jede Lehrkraft meldet sich mit ihrem Nextcloud-Konto an.',
        bullets: ['Installation mit einem Befehl (Nextcloud AIO)', 'Bleibt nach AIO-Updates erhalten', 'KI-Schlüssel nur auf dem Server'],
        link: 'Installation in Nextcloud'
      },
      {
        title: 'Auf dem Computer',
        badge: 'Windows · macOS · Linux',
        description: 'Die Desktop-App von Euro-Office bzw. Nextcloud Office mit dem Begleitprogramm – ohne eigenen Server.',
        bullets: ['Installiert das Plugin selbst', 'Eigener API-Schlüssel oder lokales Modell', 'MCP für Claude Desktop inklusive'],
        link: 'Begleitprogramm laden'
      },
      {
        title: 'Mit deinem KI-Assistenten',
        badge: 'MCP',
        description: 'Claude, ChatGPT, Le Chat oder ein anderer MCP-Client arbeitet direkt im geöffneten Dokument.',
        bullets: ['Gleiche Werkzeuge wie der Chat', 'Anmeldung über Nextcloud (OAuth) oder App-Passwort', 'Lokal ohne Anmeldung'],
        link: 'MCP einrichten'
      }
    ]
  },
  prompts: {
    headline: 'Beispiele',
    title: 'So sprichst du mit dem Arbeitsblatt-Assistenten',
    description: 'Normale Sätze genügen. Die KI kennt die Gliederung deines Dokuments und antwortet in deiner Sprache.',
    worksheetLabel: 'Arbeitsblätter',
    musicLabel: 'Musik',
    worksheet: [
      'Erstelle ein Arbeitsblatt zum Wasserkreislauf für Klasse 5 mit drei Aufgaben, einer Tabelle und einem Merkkasten.',
      'Ändere in Aufgabe 1 die Anweisung so, dass sie für Klasse 3 verständlich ist.',
      'Mach aus Aufgabe 2 einen Lückentext mit 8 Lücken.',
      'Füge am Ende eine Lösungsseite hinzu.',
      'Lösche Aufgabe 3.'
    ],
    music: [
      'Füge unter Aufgabe 2 eine Notenzeile mit c – f – g ein und darunter eine leere Zeile zum Nachschreiben.',
      'Ich brauche eine Notenzeile: 4/4 bc1, f1, g2, be2, c1, c1',
      'Bitte ändere Zeile 1: statt bc #c',
      'Füge zu Zeile 1 den Text hinzu: Hänschen klein ging allein',
      'Füge nach Aufgabe 3 drei leere Notenzeilen im Bassschlüssel ein.'
    ]
  },
  mcp: {
    headline: 'MCP',
    title: 'Dein KI-Assistent schreibt mit',
    description:
      'Über das Model Context Protocol arbeiten Claude, ChatGPT, Le Chat und andere KI-Assistenten direkt im Dokument, das du in Euro-Office geöffnet hast. Das Plugin führt die Änderungen aus – du siehst sie sofort und kannst sie mit Strg+Z rückgängig machen.',
    imageAlt: 'Ein KI-Assistent hat per MCP eine Zusatzaufgabe mit Notenzeile und Liedtext eingefügt; der Chat des Plugins zeigt die MCP-Aufrufe',
    items: [
      { title: 'Dieselben Werkzeuge', description: 'Arbeitsblatt-Blöcke, Bearbeiten, Löschen, Notenzeilen und Liedtexte – geprüft, bevor etwas ins Dokument kommt.' },
      { title: 'Nur deine Dokumente', description: 'Mit der Nextcloud-Anmeldung erreicht jeder Assistent nur die Dokumente seiner Nutzerin oder seines Nutzers.' },
      { title: 'Du behältst die Kontrolle', description: 'Erst „MCP-Zugriff erlauben“ im Plugin verbindet das Dokument. Den Zugriff widerrufst du in Nextcloud.' }
    ],
    clientsTitle: 'Getestet',
    clientsText: 'Mit dem MCP-TypeScript-SDK (Protokoll 2026-07-28) und 2025er-Anfragen, über HTTP und stdio. Claude, ChatGPT und Le Chat selbst wurden noch nicht angebunden.'
  },
  companion: {
    headline: 'Desktop',
    title: 'Das Begleitprogramm für die Desktop-App',
    description:
      'Die Desktop-Apps von Euro-Office und Nextcloud Office haben keinen Plugin-Manager und keinen Server. Das Begleitprogramm erledigt beides auf deinem Computer – ein Programm, keine Installation.',
    imageAlt: 'Einstellungsseite des Begleitprogramms: Plugin installiert, KI-Anbieter Mistral, Konfiguration für Claude Desktop',
    items: [
      { title: 'Plugin automatisch', description: 'Installiert und aktualisiert das Plugin und verbindet es – keine Einstellungen im Editor.' },
      { title: 'Deine KI', description: 'Mistral, OpenAI, Anthropic, Ollama oder jede OpenAI-kompatible API – der Schlüssel bleibt auf deinem Computer.' },
      { title: 'MCP inklusive', description: 'Fertige Einträge für Claude Desktop und Claude Code; startet auf Wunsch mit dem Computer.' }
    ]
  },
  music: {
    headline: 'Noten',
    title: 'Musik-Arbeitsblätter – auch ganz ohne KI',
    description:
      'Der Noten-Tab funktioniert ohne Server und ohne API-Schlüssel: Vorlagen, ABC-Editor mit Live-Vorschau, deutsche Tonnamen und Liedtext. Ein markiertes Notenbild lässt sich laden, ändern und ersetzen.',
    imageAlt: 'Noten-Tab: Vorlage „Alle meine Entchen“ mit Liedtext, ABC-Notation und Vorschau',
    items: [
      { title: 'Vorlagen', description: 'Leere Zeilen im Violin- oder Bassschlüssel, Tonleitern, Beispielmelodie mit Text.' },
      { title: 'Tonnamen umrechnen', description: 'c – f – g, fis′ g′ a′ h′, „bc“ für ces und Taktangaben wie 4/4 – Ziffern als Oktave oder Notenwert.' },
      { title: 'Druckfertig und bearbeitbar', description: 'Bilder mit 300 dpi; der ABC-Quelltext steckt im Alt-Text.' }
    ]
  },
  demo: {
    headline: 'Live-Demo',
    title: 'Probier den Tonnamen-Umrechner aus',
    description: 'Deutsche Tonnamen eintippen – die Notenzeile erscheint sofort. Derselbe Umrechner, den das Plugin im Editor verwendet.',
    loading: 'Die Demo wird geladen …',
    notesLabel: 'Tonnamen (deutsch)',
    notesHelp: 'z. B. c – f – g, fis′ g′ a′ h′, bc = ces, 4/4 = Takt',
    clefLabel: 'Schlüssel',
    treble: 'Violinschlüssel',
    bass: 'Bassschlüssel',
    digitsLabel: 'Ziffern',
    digitsAuto: 'Ziffern: automatisch',
    digitsOctave: 'Ziffern = Oktave (c1 = c′)',
    digitsDuration: 'Ziffern = Notenwert (c1 = Ganze)',
    lyricsLabel: 'Liedtext (optional)',
    lyricsHelp: 'Silben mit - trennen: Al-le mei-ne Ent-chen',
    showAbc: 'ABC-Notation anzeigen',
    paperLoading: 'Notenzeile wird geladen …',
    examples: ['c – f – g', 'Hänschen klein', 'Notenwerte', 'Bassschlüssel'],
    noteCount: '{n} Töne',
    readAsDurations: 'Ziffern als Notenwerte gelesen',
    readAsOctaves: 'Ziffern als Oktaven gelesen',
    meterInfo: '{meter}-Takt, {bars} Takte',
    issues: {
      unknownName: '„{token}“ ist kein bekannter Tonname.',
      doubleAccidental: '„{token}“ hat zwei Vorzeichen-Angaben.',
      farFromStaff: '„{token}“ liegt in der {octave} – weit außerhalb des Notensystems.',
      incompleteBar: 'Die Noten füllen keine vollen {meter}-Takte ({bars} Takte).',
      tooManySyllables: 'Der Text hat mehr Silben als die Melodie Noten.',
      tooFewSyllables: 'Der Text reicht nicht für alle Noten – die übrigen bleiben ohne Text.'
    }
  },
  parts: {
    headline: 'Was läuft wo',
    title: 'Ein Plugin, ein kleiner Server – und die KI deiner Wahl',
    description: 'Das Plugin braucht keinen eigenen Server. Für KI-Chat und MCP kommt ein kleiner Dienst dazu – auf dem Server oder als Begleitprogramm.',
    items: [
      {
        title: 'Plugin',
        badge: 'immer',
        description: 'Nur Dateien (≈ 1 MB) im Plugin-Ordner von Euro-Office. Läuft im Editor im Browser bzw. in der Desktop-App.',
        bullets: ['Inhalte einfügen und bearbeiten', 'Noten zeichnen, Noten-Tab komplett', 'Führt MCP-Aufrufe im Dokument aus']
      },
      {
        title: 'Server',
        badge: 'für KI-Chat und MCP',
        description: 'Kleiner Dienst (Docker, ≈ 30 MB RAM) neben Nextcloud – oder das Begleitprogramm auf dem eigenen Computer.',
        bullets: ['API-Schlüssel bleibt auf dem Server', 'Anmeldung über Nextcloud, Anfragelimit', 'Prüft Inhalte, bevor sie ins Dokument kommen']
      },
      {
        title: 'Sprachmodell',
        badge: 'optional',
        description: 'Mistral (Standard), OpenAI, Anthropic, jede OpenAI-kompatible API wie Ollama – oder dein eigener KI-Assistent über MCP.',
        bullets: ['Austauschbar ohne Plugin-Änderung', 'EU-Anbieter oder lokal möglich', 'Kosten beim Anbieter']
      }
    ]
  },
  install: {
    headline: 'Installation',
    title: 'In drei Schritten startklar',
    description: 'Wähle deinen Weg. Weitere Varianten und alle Einstellungen stehen in der README.',
    tabs: { nextcloud: 'Nextcloud AIO', desktop: 'Desktop-App', docker: 'Eigener Server', mcp: 'KI-Assistent (MCP)' },
    nextcloud: [
      {
        title: 'Plugin installieren',
        description: 'Auf dem AIO-Server ausführen. Das Skript kopiert das Plugin in den Euro-Office-Container; mit `--watch` spielt es das Plugin nach jedem AIO-Update automatisch wieder ein.',
        codeLabel: 'Shell (AIO-Server)'
      },
      {
        title: 'Server starten',
        description: 'Er hält den KI-Schlüssel und bietet den MCP-Endpunkt. Per HTTPS erreichbar machen, z. B. als `https://arbeitsblatt.deine-schule.de`. Mit `AUTH_MODE=nextcloud` meldet sich jede Lehrkraft mit ihrem Nextcloud-Konto an.',
        codeLabel: 'Shell'
      },
      {
        title: 'Im Editor anmelden',
        description: 'Dokument öffnen → **Plugins** → **Arbeitsblatt-Assistent** → **Einstellungen**: Server-Adresse eintragen und **Mit Nextcloud anmelden**. Fertig.'
      }
    ],
    desktop: [
      { title: 'Desktop-App installieren', description: 'Euro-Office oder Nextcloud Office (Desktop) für Windows, macOS oder Linux installieren und einmal starten.' },
      {
        title: 'Begleitprogramm starten',
        description: '`arbeitsblatt-assistent` für dein System aus den Releases laden, entpacken und starten. Es installiert das Plugin und öffnet seine Einstellungen im Browser. macOS: beim ersten Start Rechtsklick → **Öffnen**; Windows: **Weitere Informationen → Trotzdem ausführen**.',
        codeLabel: 'Linux / macOS'
      },
      {
        title: 'KI wählen',
        description: 'In den Einstellungen (`http://127.0.0.1:8787`) Anbieter und API-Schlüssel eintragen – oder ein lokales Modell über Ollama, oder nur MCP. Dann in der Desktop-App ein Dokument öffnen: **Plugins → Arbeitsblatt-Assistent**.'
      }
    ],
    docker: [
      { title: 'Plugin bauen', description: 'Release-Archiv laden oder das Plugin selbst bauen.', codeLabel: 'Shell' },
      {
        title: 'Document Server und Server starten',
        description: '`deploy/` startet Euro-Office mit dem Plugin als Volume und den Server dazu. Nextcloud nutzt den Document Server dann als externen Server.',
        codeLabel: 'Shell'
      },
      { title: 'Im Editor einrichten', description: 'Im Plugin unter **Einstellungen** die Server-Adresse und das Token eintragen (oder mit Nextcloud anmelden) und „Verbindung testen“.' }
    ],
    mcp: [
      {
        title: 'Dokument verbinden',
        description: 'Im geöffneten Dokument **Plugins → Arbeitsblatt-Assistent → Einstellungen → MCP-Zugriff erlauben** einschalten (beim Begleitprogramm schon an). Das Panel zeigt die MCP-Adresse.'
      },
      {
        title: 'KI-Assistent verbinden',
        description: 'Die MCP-Adresse eintragen: bei Claude, ChatGPT oder Le Chat als eigenen Connector (Anmeldung über Nextcloud), in Claude Code per Befehl, in Claude Desktop über das Begleitprogramm (`mcp-stdio`).',
        codeLabel: 'Claude Code'
      },
      { title: 'Loslegen', description: '„Erstelle im geöffneten Dokument ein Arbeitsblatt zu Brüchen für Klasse 6“ – die Änderungen erscheinen sofort im Editor.' }
    ],
    readme: 'Alle Optionen in der README'
  },
  faq: {
    headline: 'FAQ',
    title: 'Häufige Fragen',
    items: [
      {
        label: 'Braucht das Plugin einen eigenen Server?',
        content:
          'Das Plugin selbst nicht – es besteht nur aus Dateien, die Euro-Office ausliefert. KI-Chat und MCP brauchen den kleinen Server; in der Desktop-App übernimmt das Begleitprogramm diese Rolle. Der Noten-Tab funktioniert ganz ohne Server.'
      },
      {
        label: 'Welche KI wird verwendet?',
        content:
          'Die, die du einstellst: Mistral (EU-Anbieter, Standard), OpenAI, Anthropic, jede OpenAI-kompatible API oder ein lokales Modell über Ollama. Oder gar keine – dann nutzt du deinen eigenen KI-Assistenten über MCP.'
      },
      {
        label: 'Welche Daten gehen an die KI?',
        content:
          'Mit jeder Chat-Anfrage der Gesprächsverlauf und die Gliederung des Dokuments (Texte, Notenzeilen als ABC). Der Server speichert keine Gespräche oder Dokumente. Bei MCP liest dein KI-Assistent das Dokument über die Werkzeuge. Wer nichts nach außen geben will, nutzt ein lokales Modell.'
      },
      {
        label: 'Was ist MCP?',
        content:
          'Das Model Context Protocol ist ein offener Standard, mit dem KI-Assistenten Werkzeuge nutzen. Der Server bietet die Werkzeuge des Plugins an – so bearbeitet etwa Claude dein geöffnetes Dokument, als hättest du den Chat im Plugin benutzt.'
      },
      {
        label: 'Wie melden sich Lehrkräfte an?',
        content:
          'Mit `AUTH_MODE=nextcloud` mit ihrem Nextcloud-Konto: im Plugin mit einem Klick (Nextcloud Login Flow), KI-Assistenten per OAuth über Nextcloud oder mit einem App-Passwort. Jede Person erreicht nur ihre eigenen Dokumente; der Zugriff lässt sich in Nextcloud unter Geräte & Sitzungen widerrufen.'
      },
      {
        label: 'Geht das auch ohne Nextcloud?',
        content:
          'Ja: mit der Desktop-App und dem Begleitprogramm, oder mit einem eigenen Euro-Office Document Server und einem gemeinsamen Zugangs-Token.'
      },
      {
        label: 'Kann ich eingefügte Inhalte später ändern?',
        content:
          'Ja. Die KI liest die Inhalte und ersetzt genau die Teile, die du nennst. Notenzeilen tragen ihren ABC-Quelltext als Alt-Text und lassen sich per Chat oder im Noten-Tab ändern.'
      },
      {
        label: 'Was passiert bei einem Update von Nextcloud AIO?',
        content:
          'AIO erzeugt den Euro-Office-Container neu, dabei verschwinden eigene Plugins. Mit `--watch` richtet das Installationsskript einen kleinen Dienst ein, der das Plugin nach jedem Neustart automatisch wieder einspielt.'
      },
      {
        label: 'Womit ist das getestet?',
        content:
          'Mit Euro-Office 9.3.8 (Document Server und Desktop-App unter Linux), Nextcloud 34 und Mistral – automatisiert im echten Editor. Das Begleitprogramm wird für Windows und macOS automatisch gebaut und geprüft. Gehostete Assistenten wie claude.ai wurden noch nicht gegen eine öffentliche Installation getestet.'
      },
      {
        label: 'Ist das Open Source?',
        content:
          'Ja, unter MIT-Lizenz. Mitgeliefert werden abcjs (MIT) und die ONLYOFFICE-Plugin-Dateien (AGPL-3.0); das Begleitprogramm enthält Node.js und npm-Pakete – alle mit ihren Lizenztexten.'
      }
    ]
  },
  cta: {
    title: 'Bereit für das nächste Arbeitsblatt?',
    description: 'Quelltext, Releases und ausführliche Dokumentation auf GitHub.',
    repo: 'Zum Repository',
    releases: 'Releases'
  },
  footer: {
    license: 'Arbeitsblatt-Assistent · MIT-Lizenz',
    uses: 'nutzt abcjs (MIT) und das ONLYOFFICE-Plugin-SDK (AGPL-3.0)',
    copy: 'Kopieren',
    copied: 'Kopiert'
  }
}

export default de
