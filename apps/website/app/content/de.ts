import type { SiteContent } from './types'

const de: SiteContent = {
  meta: {
    title: 'Arbeitsblatt-Assistent für Euro-Office',
    description:
      'Arbeitsblätter mit KI erstellen – für jedes Fach: gestaltete Aufgaben, Rätsel, Grafiken, Bilder, Informatik-Diagramme und Notenzeilen. In Nextcloud, in der Desktop-App oder mit Claude & Co. über MCP. Open Source.'
  },
  nav: { features: 'Funktionen', informatics: 'Informatik', ways: 'Einsatz', mcp: 'MCP', install: 'Installation', faq: 'FAQ', language: 'Sprache' },
  hero: {
    badge: 'Neu in {version}: Informatik-Diagramme',
    headline: 'KI-Plugin für Euro-Office – in Nextcloud und auf dem Desktop',
    title: 'Arbeitsblätter mit KI erstellen – für jedes Fach',
    description:
      'Beschreibe, was du brauchst: Der Arbeitsblatt-Assistent gestaltet Aufgaben, Lückentexte, Rätsel, Grafiken, Formeln, Bilder, UML-Diagramme und Notenzeilen in einem einheitlichen Design direkt in deinem Dokument – mit dem eingebauten KI-Chat oder mit deinem eigenen KI-Assistenten über MCP.',
    install: 'Installieren',
    more: 'Alle Funktionen',
    imageAlt:
      'Euro-Office mit dem Arbeitsblatt-Assistenten: ein Arbeitsblatt zum Wasserkreislauf im Design „Modern“ mit Kopfzeile, Titel, Namenszeile und nummerierten Aufgaben mit Symbolen, Sternen und Punkten; links das Panel mit dem KI-Chat'
  },
  features: {
    headline: 'Funktionen',
    title: 'Alles für dein nächstes Arbeitsblatt',
    description: 'Gebaut für Lehrkräfte und Lehramtsstudierende – für Arbeitsblätter, Tests und Handouts in jedem Fach. Die KI wählt die Bausteine, das Plugin setzt sie sauber ins Dokument.',
    items: [
      {
        title: 'Ganze Arbeitsblätter per Chat',
        description: '„Erstelle ein Arbeitsblatt zum Wasserkreislauf für Klasse 5“ – mit Titel, Namenszeile, Aufgaben, Material und Merkkasten. Erst Vorschau, dann einfügen.'
      },
      {
        title: 'Drei Designs',
        description: 'Klassisch (schwarz-weiß, tonersparend), Modern oder Grundschule (große Schrift, bunt). Schriften, Farben und Abstände kommen aus dem Design.'
      },
      {
        title: 'Aufgaben und Rätsel',
        description: 'Lückentext mit Wortspeicher, Multiple Choice, Richtig/Falsch, Zuordnen, Kreuzworträtsel und Suchsel, Lesetext mit Zeilennummern und mehr.'
      },
      {
        title: 'Grafiken und Formeln',
        description: 'Zahlenstrahl, Koordinatensystem, Diagramme, Mindmap, Lineaturen und Karopapier. Formeln aus LaTeX werden zu echten, bearbeitbaren Gleichungen.'
      },
      {
        title: 'Bilder',
        description: 'ARASAAC-Piktogramme, Fotos von Wikimedia Commons oder deine eigenen Bilder – die Lizenzangabe steht automatisch darunter.'
      },
      {
        title: 'Informatik-Diagramme',
        description: 'UML-Klassen-, Sequenz-, Zustands-, Aktivitäts- und Anwendungsfalldiagramme, Automaten, Struktogramme, Programmablaufpläne und ER-Diagramme.'
      },
      {
        title: 'Noten und Liedtexte',
        description: 'Melodien, leere Notenzeilen und Liedtext als druckfertige Bilder. Deutsche Tonnamen (h, fis, b) werden zuverlässig umgerechnet.'
      },
      {
        title: 'Seite und Hausstil',
        description: 'A4, A5 oder Letter, Hoch- oder Querformat, Ränder, Spalten, Kopfzeile mit Schulname und Logo, Fußzeile mit Seitenzahlen.'
      },
      {
        title: 'Geprüft, mit Lösungsblatt',
        description: 'Nach dem Erstellen prüft die KI Nummerierung, Anweisungen, Platz für Antworten, Punkte und Lesbarkeit für die Klassenstufe. Auf Wunsch gibt es die Lösung im selben Layout.'
      },
      {
        title: 'Ändern statt neu anfangen',
        description: '„Formuliere Aufgabe 1 für Klasse 3“, „Mach aus Aufgabe 2 einen Lückentext“ – die KI ändert nur, was du sagst. Löschen nur nach Bestätigung.'
      },
      {
        title: 'Dein KI-Assistent über MCP',
        description: 'Claude, ChatGPT, Le Chat und andere bearbeiten das geöffnete Dokument mit denselben Werkzeugen – ohne KI-Schlüssel im Plugin.'
      },
      {
        title: 'Datenschutz in deiner Hand',
        description: 'Mistral als EU-Anbieter, ein lokales Modell über Ollama oder gar keine KI. Der Schlüssel bleibt auf dem Server, Anmeldung mit dem Nextcloud-Konto.'
      }
    ],
    more: 'Mehr dazu'
  },
  designs: {
    headline: 'Designs',
    title: 'Ein Design für das ganze Blatt',
    description:
      'Die KI wählt nur das Design – Schriften, Größen, Farben und Abstände von allem, was der Assistent einfügt, kommen daraus. So sieht jedes Blatt aus wie aus einem Guss, auch wenn du später Aufgaben ergänzt.',
    themes: [
      { title: 'Klassisch', description: 'Schwarz-weiß und tonersparend – für Kopien und Tests.' },
      { title: 'Modern', description: 'Klare Schrift mit blauem Akzent – für die weiterführende Schule.' },
      { title: 'Grundschule', description: 'Große Schrift, 1,5-facher Zeilenabstand, freundliche Farben.' }
    ],
    imageAlt: 'Dasselbe Arbeitsblatt „Der Igel im Herbst“ im Design {theme}',
    items: [
      { title: 'Aufgabenköpfe', description: 'Nummer, Symbole für Sozialform und Tätigkeit, Schwierigkeitssterne, Punkte und Bearbeitungszeit.' },
      { title: 'Merkkästen', description: 'Merke, Tipp, Achtung, Beispiel, Definition, Lösung und Info – jeweils mit Symbol.' },
      { title: 'In deiner Sprache', description: 'Beschriftungen wie Name, Klasse, Wortspeicher oder richtig/falsch in sieben Sprachen.' }
    ]
  },
  tasks: {
    headline: 'Aufgaben',
    title: 'Aufgaben, die richtig aussehen',
    description:
      'Über 40 Bausteine, die die KI frei kombiniert. Rätsel werden berechnet statt erraten – Kreuzworträtsel und Suchsel sind immer lösbar.',
    imageAlt: 'Aufgabenseite im Design „Modern“: ein berechnetes Kreuzworträtsel mit Hinweisen waagerecht und senkrecht und ein Suchsel mit Wortliste',
    items: [
      { title: 'Lückentexte und Quiz', description: 'Lückentext mit automatischem Wortspeicher, Multiple Choice, Richtig/Falsch-Tabelle, Zuordnen mit Linien oder Buchstaben.' },
      { title: 'Rätsel', description: 'Kreuzworträtsel und Suchsel in drei Schwierigkeitsstufen – auf Wunsch mit Lösung.' },
      { title: 'Lesen und Schreiben', description: 'Lesetexte mit Zeilennummern, **Silbenfärbung** (Silben abwechselnd blau und rot), Grundschul-Lineaturen 1–4 und Karopapier.' },
      { title: 'Rund um die Aufgabe', description: 'Selbsteinschätzung mit Smileys, Tippkarten zum Ausschneiden, Punkte-Noten-Tabelle, QR-Codes und zwei- oder dreispaltiges Layout.' }
    ]
  },
  graphics: {
    headline: 'Grafiken & Formeln',
    title: 'Mathe und Naturwissenschaften, sauber gezeichnet',
    description:
      'Grafiken werden aus Daten gezeichnet, nicht als Bild erfunden: Achsen, Skalen und Beschriftungen stimmen. Jede Grafik trägt ihre Quelle im Alt-Text – die KI kann sie später ändern.',
    imageAlt: 'Mathe-Arbeitsblatt: Zahlenstrahl mit Lücken, Säulendiagramm, Koordinatensystem mit Dreieck und eine Formel für den Flächeninhalt',
    items: [
      { title: 'Zahlenstrahl und Koordinatensystem', description: 'Mit Lücken zum Eintragen, Punkten, Strecken und Vielecken.' },
      { title: 'Diagramme', description: 'Säulen, Balken, Linien und Kreis – auch leer zum Selberzeichnen.' },
      { title: 'Formeln', description: 'LaTeX wird zur echten Gleichung im Dokument, auch mitten im Satz.' },
      { title: 'Mindmaps und Zeichnungen', description: 'Mindmaps (auch mit leeren Blasen) und einfache Zeichnungen, die die KI selbst entwirft.' }
    ]
  },
  pictures: {
    headline: 'Bilder',
    title: 'Bilder, die zum Blatt passen',
    description:
      'Gerade in der Grundschule und Förderschule helfen Bilder beim Verstehen. Die KI sucht passende Bilder und setzt sie aufs Blatt – neben Wörter, als Einstieg oder in Spalten neben den Text. Die Lizenzangabe druckt sie automatisch darunter.',
    imageAlt: 'Arbeitsblatt „Tiere im Wald“ im Design „Grundschule“: ARASAAC-Piktogramme von Igel, Eule, Hase, Eichhörnchen, Fuchs und Rabe mit Lizenzangabe, darunter die Tiernamen in Silbenfärbung und eine Grundschul-Lineatur',
    items: [
      { title: 'Piktogramme', description: 'ARASAAC – einfache, einheitliche Zeichnungen von Dingen, Tieren, Tätigkeiten und Gefühlen, gemacht für die Förderschule.' },
      { title: 'Fotos und historische Bilder', description: 'Wikimedia Commons – Tiere, Pflanzen, Orte, Kunst, Römer und Mittelalter.' },
      { title: 'Deine eigenen Bilder', description: 'Ein Ordner in deiner Nextcloud oder auf deinem Computer, z. B. mit Comic-Bildern für Latein. Die KI findet sie über Datei- und Ordnernamen.' }
    ]
  },
  informatics: {
    badge: 'Neu',
    headline: 'Informatik',
    title: 'UML, Struktogramme und ER-Diagramme',
    description:
      'Die KI beschreibt nur das Modell, das Layout wird berechnet: Kästen und Pfeile stehen gerade und lesbar, in der Schulnotation wie im Lehrbuch. Zehn Diagrammarten – jede auch als Lückendiagramm mit Lösungsblatt.',
    diagrams: [
      { title: 'Klassendiagramm zum Ausfüllen', description: 'Ein Attribut als Schreiblinie, eine Methode als leere Zeile, die Vererbung von Sparkonto zum Selberzeichnen.' },
      { title: 'Sequenzdiagramm', description: 'Akteur und Objekte, Aufrufe, Antwort, Aktivierungsbalken und ein alt-Fragment.' },
      { title: 'Endlicher Automat', description: 'Startpfeil, akzeptierender Zustand als Doppelkreis, Übergänge mit Zeichen.' },
      { title: 'Struktogramm', description: 'Nassi-Shneiderman nach DIN 66261: Verzweigung und Schleife (ggT nach Euklid).' },
      { title: 'Programmablaufplan', description: 'Nach DIN 66001: Start, Ein- und Ausgabe, Verzweigung mit ja/nein, Ende.' },
      { title: 'ER-Diagramm', description: 'Chen-Notation mit Schlüsselattributen und Kardinalitäten 1:n und n:m.' }
    ],
    items: [
      { title: 'Zehn Diagrammarten', description: 'Klassen-, Objekt-, Sequenz-, Zustands-, Aktivitäts- und Anwendungsfalldiagramme, endliche Automaten, Struktogramme, Programmablaufpläne und ER-Diagramme (Chen, (min,max), Krähenfuß).' },
      { title: 'Zum Ausfüllen', description: 'Lücken in jedem Text, fehlende Pfeile und Beziehungen, leere Zeilen und Kästen – und mit einem Satz die Lösung im selben Layout.' },
      { title: 'Passt aufs Blatt', description: 'Das Layout wird berechnet und auf die Textbreite gebracht. Wie alle Grafiken bleibt jedes Diagramm per Chat änderbar.' }
    ]
  },
  music: {
    headline: 'Noten',
    title: 'Musik-Arbeitsblätter – auch ganz ohne KI',
    description:
      'Der Noten-Tab funktioniert ohne Server und ohne API-Schlüssel: Vorlagen, ABC-Editor mit Live-Vorschau, deutsche Tonnamen und Liedtext. Ein markiertes Notenbild lässt sich laden, ändern und ersetzen.',
    imageAlt: 'Noten-Tab: die Vorlage „Alle meine Entchen“ mit Liedtext, ABC-Notation und Vorschau, eingefügt unter eine Aufgabe im Design „Modern“',
    items: [
      { title: 'Vorlagen', description: 'Leere Zeilen im Violin- oder Bassschlüssel, Tonleitern, Beispielmelodie mit Text.' },
      { title: 'Tonnamen umrechnen', description: 'c – f – g, fis′ g′ a′ h′, „bc“ für ces und Taktangaben wie 4/4 – Ziffern als Oktave oder Notenwert.' },
      { title: 'Druckfertig und bearbeitbar', description: 'Bilder mit 300 dpi; der ABC-Quelltext steckt im Alt-Text. Per Chat: „Ändere Zeile 1: statt bc #c“.' }
    ]
  },
  mcp: {
    headline: 'MCP',
    title: 'Dein KI-Assistent schreibt mit',
    description:
      'Über das Model Context Protocol arbeiten Claude, ChatGPT, Le Chat und andere KI-Assistenten direkt im Dokument, das du in Euro-Office geöffnet hast. Das Plugin führt die Änderungen aus – du siehst sie sofort und kannst sie mit Strg+Z rückgängig machen.',
    imageAlt: 'Ein KI-Assistent hat per MCP eine dritte Aufgabe mit dem Lied „Es regnet“ als Notenzeile eingefügt; das Panel zeigt die MCP-Aufrufe',
    items: [
      { title: 'Dieselben Werkzeuge', description: 'Alle Bausteine, Bilder, Diagramme, Seitenlayout, Prüfung, Bearbeiten und Notenzeilen – geprüft, bevor etwas ins Dokument kommt.' },
      { title: 'Nur deine Dokumente', description: 'Mit der Nextcloud-Anmeldung erreicht jeder Assistent nur die Dokumente seiner Nutzerin oder seines Nutzers.' },
      { title: 'Du behältst die Kontrolle', description: 'Erst „MCP-Zugriff erlauben“ im Plugin verbindet das Dokument. Den Zugriff widerrufst du in Nextcloud.' }
    ],
    clientsTitle: 'Getestet',
    clientsText: 'Mit dem MCP-TypeScript-SDK (Protokoll 2026-07-28) und 2025er-Anfragen, über HTTP und stdio. Gehostete Assistenten wie claude.ai, ChatGPT und Le Chat wurden noch nicht gegen eine öffentliche Installation getestet.'
  },
  companion: {
    headline: 'Desktop',
    title: 'Die App Arbeitsblatt-Assistent für deinen Computer',
    description:
      'Die Desktop-Apps von Euro-Office und Nextcloud Office haben keinen Plugin-Manager und keinen Server. Die App Arbeitsblatt-Assistent erledigt beides: installieren wie jede andere App, einmal starten – danach arbeitet sie unsichtbar im Hintergrund. Kein Terminal, kein Browser.',
    imageAlt: 'Fenster der App Arbeitsblatt-Assistent, Seite „Übersicht“: alle drei Schritte erledigt – Plugin in der Desktop-App, KI-Chat im Plugin, Claude verbunden',
    items: [
      { title: 'Plugin automatisch', description: 'Installiert das Plugin in Euro-Office und Nextcloud Office, verbindet es und hält es aktuell – keine Einstellungen im Editor.' },
      { title: 'Deine KI, deine Bilder', description: 'Mistral, OpenAI, Anthropic, Ollama oder jede OpenAI-kompatible API – der Schlüssel bleibt auf deinem Computer. Dazu ein eigener Bilderordner.' },
      { title: 'Claude mit einem Klick', description: 'Verbindet Claude Desktop oder Claude Code. Neue Versionen installiert die App mit einem Klick; auf Wunsch startet sie mit dem Computer. Unter macOS von Apple beglaubigt.' }
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
        bullets: ['Installation mit einem Befehl (Nextcloud AIO)', 'Bleibt nach AIO-Updates erhalten', 'Eigene Bilder im Nextcloud-Ordner'],
        link: 'Installation in Nextcloud'
      },
      {
        title: 'Auf dem Computer',
        badge: 'Windows · macOS · Linux',
        description: 'Die Desktop-App von Euro-Office bzw. Nextcloud Office mit der App Arbeitsblatt-Assistent – installieren wie jede andere App, ohne eigenen Server.',
        bullets: ['Installiert und aktualisiert das Plugin selbst', 'Eigener API-Schlüssel oder lokales Modell', 'Claude Desktop mit einem Klick verbinden'],
        link: 'App herunterladen'
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
    groups: [
      {
        label: 'Arbeitsblätter',
        items: [
          'Erstelle ein Arbeitsblatt zum Wasserkreislauf für Klasse 5 mit drei Aufgaben, einem Lückentext und einem Merkkasten.',
          'Mach daraus ein Kreuzworträtsel mit zehn Begriffen und füge am Ende eine Lösungsseite hinzu.',
          'Ändere in Aufgabe 1 die Anweisung so, dass sie für Klasse 3 verständlich ist.',
          'Nimm das Design Klassisch und schreibe unsere Schule und Seitenzahlen in Kopf- und Fußzeile.',
          'Prüfe das Blatt und lösche Aufgabe 3.'
        ]
      },
      {
        label: 'Bilder & Diagramme',
        items: [
          'Ein Leseblatt für Klasse 1 zu Tieren im Wald – mit einem Piktogramm neben jedem Wort und Silbenfärbung.',
          'Setze ein Foto eines römischen Legionärs neben den Text.',
          'Zeichne ein UML-Klassendiagramm zu Konto, Girokonto und Sparkonto, bei dem die Schülerinnen und Schüler die Vererbung ergänzen.',
          'Erstelle ein Struktogramm zum Euklidischen Algorithmus und darunter einen leeren Programmablaufplan zum Ausfüllen.',
          'Ein ER-Diagramm für Schüler, Kurse und Lehrkräfte in Chen-Notation.'
        ]
      },
      {
        label: 'Musik',
        items: [
          'Füge unter Aufgabe 2 eine Notenzeile mit c – f – g ein und darunter eine leere Zeile zum Nachschreiben.',
          'Ich brauche eine Notenzeile: 4/4 bc1, f1, g2, be2, c1, c1',
          'Bitte ändere Zeile 1: statt bc #c',
          'Füge zu Zeile 1 den Text hinzu: Hänschen klein ging allein',
          'Füge nach Aufgabe 3 drei leere Notenzeilen im Bassschlüssel ein.'
        ]
      }
    ]
  },
  parts: {
    headline: 'Was läuft wo',
    title: 'Ein Plugin, ein kleiner Server – und die KI deiner Wahl',
    description: 'Das Plugin braucht keinen eigenen Server. Für KI-Chat, Bilder und MCP kommt ein kleiner Dienst dazu – auf dem Server oder in der App Arbeitsblatt-Assistent auf deinem Computer.',
    items: [
      {
        title: 'Plugin',
        badge: 'immer',
        description: 'Nur Dateien (≈ 1,4 MB) im Plugin-Ordner von Euro-Office. Läuft im Editor im Browser bzw. in der Desktop-App.',
        bullets: ['Gestaltet Blätter, Grafiken und Diagramme', 'Noten zeichnen, Noten-Tab komplett', 'Führt MCP-Aufrufe im Dokument aus']
      },
      {
        title: 'Server',
        badge: 'für KI-Chat, Bilder und MCP',
        description: 'Kleiner Dienst (Docker, ≈ 30 MB RAM) neben Nextcloud – oder im Hintergrund der App Arbeitsblatt-Assistent auf dem eigenen Computer.',
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
        description: 'Er hält den KI-Schlüssel, sucht Bilder und bietet den MCP-Endpunkt. Per HTTPS erreichbar machen, z. B. als `https://arbeitsblatt.deine-schule.de`. Mit `AUTH_MODE=nextcloud` meldet sich jede Lehrkraft mit ihrem Nextcloud-Konto an.',
        codeLabel: 'Shell'
      },
      {
        title: 'Im Editor anmelden',
        description: 'Dokument öffnen → **Plugins** → **Arbeitsblatt-Assistent** → **Einstellungen**: Server-Adresse eintragen und **Mit Nextcloud anmelden**. Fertig. Eigene Bilder legst du im Ordner `Arbeitsblatt-Bilder` deiner Nextcloud ab.'
      }
    ],
    desktop: [
      { title: 'Euro-Office installieren', description: 'Die Desktop-App von Euro-Office oder Nextcloud Office für Windows, macOS oder Linux installieren und einmal starten.' },
      {
        title: 'App Arbeitsblatt-Assistent installieren',
        description: 'Installationsdatei für dein System laden und wie jede andere App installieren (macOS: in **Programme** ziehen). Beim Start öffnet sich ihr Fenster: Sie richtet das Plugin ein und arbeitet unsichtbar im Hintergrund. Unter macOS ist die App von Apple beglaubigt (notarisiert). Unter Windows ist sie noch nicht signiert – falls SmartScreen warnt: **Weitere Informationen → Trotzdem ausführen**.'
      },
      {
        title: 'KI wählen',
        description: 'In der App auf der Seite **KI-Chat** Anbieter und API-Schlüssel eintragen – oder ein lokales Modell über Ollama, oder nur MCP. Auf der Seite **Bilder** wählst du einen eigenen Bilderordner. Dann in Euro-Office ein Dokument öffnen: **Plugins → Arbeitsblatt-Assistent**. Das Fenster darfst du schließen – die App läuft im Infobereich (macOS: in der Menüleiste) weiter.'
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
        description: 'Im geöffneten Dokument **Plugins → Arbeitsblatt-Assistent → Einstellungen → MCP-Zugriff erlauben** einschalten (mit der App Arbeitsblatt-Assistent schon an). Das Panel zeigt die MCP-Adresse.'
      },
      {
        title: 'KI-Assistent verbinden',
        description: 'Die MCP-Adresse eintragen: bei Claude, ChatGPT oder Le Chat als eigenen Connector (Anmeldung über Nextcloud), in Claude Code per Befehl. Mit der App Arbeitsblatt-Assistent verbindest du Claude Desktop und Claude Code mit einem Klick (Seite **Claude & MCP**).',
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
          'Das Plugin selbst nicht – es besteht nur aus Dateien, die Euro-Office ausliefert. KI-Chat, Bildersuche und MCP brauchen den kleinen Server; auf dem eigenen Computer übernimmt die App Arbeitsblatt-Assistent diese Rolle. Der Noten-Tab funktioniert ganz ohne Server.'
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
        label: 'Woher kommen die Bilder – und darf ich sie verwenden?',
        content:
          'Aus drei Quellen: ARASAAC-Piktogramme (CC BY-NC-SA, frei für die Schule), Wikimedia Commons (freie Lizenzen) und dein eigener Bilderordner. Urheber und Lizenz freier Bilder stehen automatisch unter dem Bild. Der Server fragt nur die festen Adressen von ARASAAC und Wikimedia und deinen Ordner ab – die KI gibt nie selbst Adressen vor. Mit `IMAGE_SOURCES` bzw. in der App schaltest du die Bilder aus dem Internet ab.'
      },
      {
        label: 'Welche Informatik-Diagramme gibt es?',
        content:
          'UML-Klassen-, Objekt-, Sequenz-, Zustands-, Aktivitäts- und Anwendungsfalldiagramme, endliche Automaten (DEA/NEA), Struktogramme nach DIN 66261, Programmablaufpläne nach DIN 66001 und ER-Diagramme in Chen-, (min,max)- oder Krähenfuß-Notation. Jedes Diagramm gibt es auch zum Ausfüllen und mit Lösung.'
      },
      {
        label: 'Was ist MCP?',
        content:
          'Das Model Context Protocol ist ein offener Standard, mit dem KI-Assistenten Werkzeuge nutzen. Der Server bietet die Werkzeuge des Plugins an – so bearbeitet etwa Claude dein geöffnetes Dokument, als hättest du den Chat im Plugin benutzt.'
      },
      {
        label: 'Wie melden sich Lehrkräfte an?',
        content:
          'Mit `AUTH_MODE=nextcloud` mit ihrem Nextcloud-Konto: im Plugin mit einem Klick (Nextcloud Login Flow), KI-Assistenten per OAuth über Nextcloud oder mit einem App-Passwort. Jede Person erreicht nur ihre eigenen Dokumente und Bilder; der Zugriff lässt sich in Nextcloud unter Geräte & Sitzungen widerrufen.'
      },
      {
        label: 'Geht das auch ohne Nextcloud?',
        content:
          'Ja: mit der Desktop-App von Euro-Office bzw. Nextcloud Office und der App Arbeitsblatt-Assistent, oder mit einem eigenen Euro-Office Document Server und einem gemeinsamen Zugangs-Token.'
      },
      {
        label: 'Kann ich eingefügte Inhalte später ändern?',
        content:
          'Ja. Die KI liest die Inhalte und ersetzt genau die Teile, die du nennst. Grafiken, Diagramme, Bilder und Notenzeilen tragen ihre Quelle im Alt-Text und lassen sich per Chat ändern; Notenzeilen auch im Noten-Tab.'
      },
      {
        label: 'Was passiert bei einem Update von Nextcloud AIO?',
        content:
          'AIO erzeugt den Euro-Office-Container neu, dabei verschwinden eigene Plugins. Mit `--watch` richtet das Installationsskript einen kleinen Dienst ein, der das Plugin nach jedem Neustart automatisch wieder einspielt.'
      },
      {
        label: 'Wie wird die App aktualisiert?',
        content:
          'Die App Arbeitsblatt-Assistent prüft regelmäßig, ob es eine neue Version gibt, und zeigt sie im Fenster und im Infobereich (macOS: in der Menüleiste) an. Ein Klick lädt und installiert sie – beim .deb-Paket gibt es stattdessen einen Link zur Download-Seite. Das Plugin in Euro-Office aktualisiert die neue Version automatisch.'
      },
      {
        label: 'Womit ist das getestet?',
        content:
          'Mit Euro-Office 9.3.8 (Document Server und Desktop-App unter Linux), Nextcloud 34 und Mistral – automatisiert im echten Editor. Die App Arbeitsblatt-Assistent wird für Windows, macOS und Linux automatisch gebaut und geprüft. Gehostete Assistenten wie claude.ai wurden noch nicht gegen eine öffentliche Installation getestet.'
      },
      {
        label: 'Ist das Open Source?',
        content:
          'Ja, unter MIT-Lizenz. Mitgeliefert werden abcjs, dagre und qrcode-generator (alle MIT) und die ONLYOFFICE-Plugin-Dateien (AGPL-3.0); die App Arbeitsblatt-Assistent enthält Node.js und npm-Pakete – alle mit ihren Lizenztexten.'
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
    uses: 'nutzt abcjs, dagre und qrcode-generator (MIT) und das ONLYOFFICE-Plugin-SDK (AGPL-3.0) · Piktogramme: Sergio Palao, ARASAAC (CC BY-NC-SA)',
    copy: 'Kopieren',
    copied: 'Kopiert',
    zoom: 'Bild in voller Größe öffnen'
  }
}

export default de
