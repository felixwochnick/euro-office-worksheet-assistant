import type { SiteContent } from './types'

const nl: SiteContent = {
  meta: {
    title: 'Worksheet Assistant voor Euro-Office',
    description:
      'Werkbladen maken met AI – voor elk vak, in Nextcloud, in de desktopapp of met Claude & co. via MCP. Open source.'
  },
  nav: { features: 'Functies', ways: 'Toepassingen', mcp: 'MCP', demo: 'Livedemo', install: 'Installatie', faq: 'FAQ', language: 'Taal' },
  hero: {
    badge: 'Open source · MIT',
    headline: 'AI-plugin voor Euro-Office – in Nextcloud en op de desktop',
    title: 'Werkbladen maken met AI – voor elk vak',
    description:
      'Beschrijf wat je nodig hebt: de Worksheet Assistant, je assistent voor werkbladen, zet opdrachten, invuloefeningen, tabellen, schrijflijnen, infokaders en notenbalken direct in je document – met de ingebouwde AI-chat of met je eigen AI-assistent via MCP.',
    install: 'Installeren',
    more: 'Zo werkt het',
    imageAlt:
      'Euro-Office met de Worksheet Assistant: een werkblad over de waterkringloop, gemaakt met de AI-chat, links de chat met de vraag'
  },
  features: {
    headline: 'Functies',
    title: 'Van leeg blad tot kant-en-klaar werkblad',
    description: 'Gemaakt voor leraren en leraren in opleiding – voor werkbladen, toetsen en hand-outs in elk vak.',
    items: [
      {
        title: 'Complete werkbladen via de chat',
        description:
          '“Maak een werkblad over de waterkringloop voor groep 7”: titel, opdrachten, tabel, schrijflijnen en infokader in één stap – als je wilt eerst als voorvertoning.'
      },
      {
        title: 'Aanpassen in plaats van opnieuw beginnen',
        description:
          '“Herschrijf opdracht 1 voor groep 5”, “Maak van opdracht 2 een invuloefening”, “Voeg een antwoordenblad toe” – de AI verandert alleen wat jij vraagt. Voor verwijderen is jouw bevestiging nodig.'
      },
      {
        title: 'Notenbalken en liedteksten',
        description:
          'Melodieën, lege notenbalken en liedteksten als afdrukklare afbeeldingen. Duitse nootnamen (h, fis, b) worden betrouwbaar omgezet; elke notenbalk blijft bewerkbaar.'
      },
      {
        title: 'Je eigen AI-assistent via MCP',
        description: 'Claude, ChatGPT, Le Chat en andere bewerken het geopende document met dezelfde tools – zonder AI-sleutel in de plugin.'
      },
      {
        title: 'Privacy in eigen hand',
        description: 'Mistral als EU-aanbieder, een lokaal model via Ollama of helemaal geen AI. De sleutel blijft op de server, inloggen met je Nextcloud-account.'
      },
      {
        title: 'Nextcloud, server of desktop',
        description:
          'Eén commando voor Nextcloud AIO, een Docker Compose-bestand voor je eigen Document Server, of de companion-app voor de desktopapp (Windows, macOS, Linux).'
      }
    ]
  },
  ways: {
    headline: 'Toepassingen',
    title: 'Drie manieren – één plugin',
    description: 'Kies waar je werkt en welke AI je wilt gebruiken. Alle manieren zijn te combineren.',
    items: [
      {
        title: 'In Nextcloud',
        badge: 'voor scholen',
        description: 'De plugin in Euro-Office binnen Nextcloud, met de kleine server ernaast. Elke leraar logt in met het eigen Nextcloud-account.',
        bullets: ['Installatie met één commando (Nextcloud AIO)', 'Blijft behouden na AIO-updates', 'AI-sleutel alleen op de server'],
        link: 'Installeren in Nextcloud'
      },
      {
        title: 'Op je computer',
        badge: 'Windows · macOS · Linux',
        description: 'De desktopapp van Euro-Office of Nextcloud Office met de companion-app – zonder eigen server.',
        bullets: ['Installeert de plugin zelf', 'Eigen API-sleutel of een lokaal model', 'MCP voor Claude Desktop inbegrepen'],
        link: 'Download de companion-app'
      },
      {
        title: 'Met je AI-assistent',
        badge: 'MCP',
        description: 'Claude, ChatGPT, Le Chat of een andere MCP-client werkt direct in het geopende document.',
        bullets: ['Dezelfde tools als de chat', 'Inloggen via Nextcloud (OAuth) of met een app-wachtwoord', 'Lokaal zonder inloggen'],
        link: 'MCP instellen'
      }
    ]
  },
  prompts: {
    headline: 'Voorbeelden',
    title: 'Zo praat je met de Worksheet Assistant',
    description: 'Gewone zinnen zijn genoeg. De AI kent de opbouw van je document en antwoordt in jouw taal.',
    worksheetLabel: 'Werkbladen',
    musicLabel: 'Muziek',
    worksheet: [
      'Maak een werkblad over de waterkringloop voor groep 7 met drie opdrachten, een tabel en een infokader.',
      'Herschrijf de instructie van opdracht 1 zodat leerlingen van groep 5 die begrijpen.',
      'Maak van opdracht 2 een invuloefening met 8 open plekken.',
      'Voeg aan het eind een antwoordenblad toe.',
      'Verwijder opdracht 3.'
    ],
    music: [
      'Voeg onder opdracht 2 een notenbalk met c – f – g in, met daaronder een lege notenbalk om na te schrijven.',
      'Ik heb een notenbalk nodig: 4/4 bc1, f1, g2, be2, c1, c1',
      'Pas notenbalk 1 aan: in plaats van bc #c',
      'Zet deze tekst onder notenbalk 1: Altijd is Kortjakje ziek',
      'Voeg na opdracht 3 drie lege notenbalken met bassleutel in.'
    ]
  },
  mcp: {
    headline: 'MCP',
    title: 'Je AI-assistent schrijft mee',
    description:
      'Met het Model Context Protocol werken Claude, ChatGPT, Le Chat en andere AI-assistenten direct in het document dat je in Euro-Office open hebt. De plugin voert de wijzigingen uit – je ziet ze meteen en kunt ze met Ctrl+Z ongedaan maken.',
    imageAlt: 'Een AI-assistent heeft via MCP een extra opdracht met notenbalk en liedtekst toegevoegd; de chat van de plugin toont de MCP-aanroepen',
    items: [
      { title: 'Dezelfde tools', description: 'Werkbladblokken, bewerken, verwijderen, notenbalken en liedteksten – gecontroleerd voordat er iets in het document komt.' },
      { title: 'Alleen je eigen documenten', description: 'Met inloggen via Nextcloud bereikt een assistent alleen de documenten van zijn eigen gebruiker.' },
      { title: 'Jij houdt de regie', description: 'Het document wordt pas gekoppeld als je “Allow MCP access” in de plugin aanzet. De toegang trek je in via Nextcloud.' }
    ],
    clientsTitle: 'Getest',
    clientsText: 'Met de MCP TypeScript SDK (protocol 2026-07-28) en verzoeken in 2025-formaat, via HTTP en stdio. Claude, ChatGPT en Le Chat zelf zijn nog niet gekoppeld.'
  },
  companion: {
    headline: 'Desktop',
    title: 'De companion-app voor de desktopeditors',
    description:
      'De desktopapps van Euro-Office en Nextcloud Office hebben geen pluginbeheer en geen server. De companion-app regelt allebei op je computer – één programma, geen installatie.',
    imageAlt: 'Instellingenpagina van de companion-app: plugin geïnstalleerd, AI-aanbieder Mistral, configuratie voor Claude Desktop',
    items: [
      { title: 'Plugin automatisch ingesteld', description: 'Installeert, werkt bij en koppelt de plugin – geen instellingen in de editor.' },
      { title: 'Jouw AI', description: 'Mistral, OpenAI, Anthropic, Ollama of elke OpenAI-compatibele API – de sleutel blijft op je computer.' },
      { title: 'MCP inbegrepen', description: 'Kant-en-klare instellingen voor Claude Desktop en Claude Code; start als je wilt automatisch mee met je computer.' }
    ]
  },
  music: {
    headline: 'Muziek',
    title: 'Muziekwerkbladen – ook helemaal zonder AI',
    description:
      'Het muziektabblad werkt zonder server en zonder API-sleutel: sjablonen, ABC-editor met live voorbeeld, Duitse nootnamen en liedteksten. Een geselecteerde notenbalk kun je laden, aanpassen en vervangen.',
    imageAlt: 'Muziektabblad: sjabloon “Alle meine Entchen” met liedtekst, ABC-notatie en voorbeeld',
    items: [
      { title: 'Sjablonen', description: 'Lege notenbalken met sol- of bassleutel, toonladders, een voorbeeldmelodie met tekst.' },
      { title: 'Nootnamen omzetten', description: 'c – f – g, fis′ g′ a′ h′, “bc” voor ces en maatsoorten zoals 4/4 – cijfers als octaaf of nootwaarde.' },
      { title: 'Afdrukklaar en bewerkbaar', description: 'Afbeeldingen van 300 dpi; de ABC-broncode staat in de alt-tekst.' }
    ]
  },
  demo: {
    headline: 'Livedemo',
    title: 'Probeer de nootnamen-omzetter',
    description: 'Typ Duitse nootnamen – de notenbalk verschijnt meteen. Het is dezelfde omzetter die de plugin in de editor gebruikt.',
    loading: 'Demo wordt geladen …',
    notesLabel: 'Nootnamen (Duits)',
    notesHelp: 'bijv. c – f – g, fis′ g′ a′ h′, bc = ces, 4/4 = maatsoort',
    clefLabel: 'Sleutel',
    treble: 'Solsleutel',
    bass: 'Bassleutel',
    digitsLabel: 'Cijfers',
    digitsAuto: 'Cijfers: automatisch',
    digitsOctave: 'Cijfers = octaaf (c1 = c′)',
    digitsDuration: 'Cijfers = nootwaarde (c1 = hele noot)',
    lyricsLabel: 'Liedtekst (optioneel)',
    lyricsHelp: 'Scheid lettergrepen met -: Al-tijd is Kort-jak-je ziek',
    showAbc: 'ABC-notatie tonen',
    paperLoading: 'Notenbalk wordt geladen …',
    examples: ['c – f – g', 'Hänschen klein', 'Nootwaarden', 'Bassleutel'],
    noteCount: '{n} noten',
    readAsDurations: 'cijfers gelezen als nootwaarden',
    readAsOctaves: 'cijfers gelezen als octaven',
    meterInfo: '{meter}-maat, {bars} maten',
    issues: {
      unknownName: '“{token}” is geen bekende nootnaam.',
      doubleAccidental: '“{token}” heeft twee voortekens.',
      farFromStaff: '“{token}” ligt in de {octave} – ver buiten de notenbalk.',
      incompleteBar: 'De noten vullen geen hele {meter}-maten ({bars} maten).',
      tooManySyllables: 'De tekst heeft meer lettergrepen dan de melodie noten heeft.',
      tooFewSyllables: 'De tekst is te kort voor alle noten – de rest blijft zonder tekst.'
    }
  },
  parts: {
    headline: 'Wat draait waar',
    title: 'Eén plugin, één kleine server – en de AI van jouw keuze',
    description: 'De plugin heeft geen eigen server nodig. Voor de AI-chat en MCP komt er een kleine dienst bij – op de server of als companion-app.',
    items: [
      {
        title: 'Plugin',
        badge: 'altijd',
        description: 'Alleen bestanden (≈ 1 MB) in de pluginmap van Euro-Office. Draait in de editor in de browser of in de desktopapp.',
        bullets: ['Voegt inhoud in en bewerkt die', 'Tekent notenbalken, compleet muziektabblad', 'Voert MCP-aanroepen uit in het document']
      },
      {
        title: 'Server',
        badge: 'voor AI-chat en MCP',
        description: 'Een kleine dienst (Docker, ≈ 30 MB RAM) naast Nextcloud – of de companion-app op je eigen computer.',
        bullets: ['API-sleutel blijft op de server', 'Inloggen via Nextcloud, limiet op verzoeken', 'Controleert inhoud voordat die in het document komt']
      },
      {
        title: 'Taalmodel',
        badge: 'optioneel',
        description: 'Mistral (standaard), OpenAI, Anthropic, elke OpenAI-compatibele API zoals Ollama – of je eigen AI-assistent via MCP.',
        bullets: ['Wisselen zonder de plugin aan te passen', 'EU-aanbieder of lokaal mogelijk', 'Kosten bij de aanbieder']
      }
    ]
  },
  install: {
    headline: 'Installatie',
    title: 'In drie stappen klaar',
    description: 'Kies je manier. Meer opties en alle instellingen staan in de README.',
    tabs: { nextcloud: 'Nextcloud AIO', desktop: 'Desktopapp', docker: 'Eigen server', mcp: 'AI-assistent (MCP)' },
    nextcloud: [
      {
        title: 'Plugin installeren',
        description: 'Voer dit uit op de AIO-server. Het script kopieert de plugin naar de Euro-Office-container; met `--watch` installeert het de plugin na elke AIO-update automatisch opnieuw.',
        codeLabel: 'Shell (AIO-server)'
      },
      {
        title: 'Server starten',
        description: 'De server bewaart de AI-sleutel en biedt het MCP-endpoint. Maak hem bereikbaar via HTTPS, bijv. als `https://worksheets.your-school.org`. Met `AUTH_MODE=nextcloud` logt elke leraar in met het eigen Nextcloud-account.',
        codeLabel: 'Shell'
      },
      {
        title: 'Inloggen in de editor',
        description: 'Open een document → **Plugins** → **Worksheet Assistant** → **Settings**: vul het serveradres in en klik op **Sign in with Nextcloud**. Klaar.'
      }
    ],
    desktop: [
      { title: 'Desktopapp installeren', description: 'Installeer Euro-Office of Nextcloud Office (desktop) voor Windows, macOS of Linux en start de app één keer.' },
      {
        title: 'Companion-app starten',
        description: 'Download `arbeitsblatt-assistent` voor je systeem bij de releases, pak het uit en start het. Het programma installeert de plugin en opent de instellingen in de browser. macOS: de eerste keer met rechts klikken → **Open**; Windows: **Meer informatie → Toch uitvoeren**.',
        codeLabel: 'Linux / macOS'
      },
      {
        title: 'Kies je AI',
        description: 'Vul in de instellingen (`http://127.0.0.1:8787`) de aanbieder en de API-sleutel in – of kies een lokaal model via Ollama, of alleen MCP. Open daarna een document in de desktopapp: **Plugins → Worksheet Assistant**.'
      }
    ],
    docker: [
      { title: 'Plugin bouwen', description: 'Download het release-archief of bouw de plugin zelf.', codeLabel: 'Shell' },
      {
        title: 'Document Server en server starten',
        description: '`deploy/` start Euro-Office met de plugin als volume, plus de server. Nextcloud gebruikt de Document Server daarna als externe server.',
        codeLabel: 'Shell'
      },
      { title: 'Editor instellen', description: 'Vul in de plugin onder **Settings** het serveradres en het token in (of log in met Nextcloud) en klik op “Test connection”.' }
    ],
    mcp: [
      {
        title: 'Document koppelen',
        description: 'Zet in het geopende document **Plugins → Worksheet Assistant → Settings → Allow MCP access** aan (met de companion-app staat dit al aan). Het paneel toont het MCP-adres.'
      },
      {
        title: 'AI-assistent koppelen',
        description: 'Voeg het MCP-adres toe: in Claude, ChatGPT of Le Chat als aangepaste connector (inloggen via Nextcloud), in Claude Code met een commando, in Claude Desktop via de companion-app (`mcp-stdio`).',
        codeLabel: 'Claude Code'
      },
      { title: 'Aan de slag', description: '“Maak in het geopende document een werkblad over breuken voor groep 8” – de wijzigingen verschijnen meteen in de editor.' }
    ],
    readme: 'Alle opties in de README'
  },
  faq: {
    headline: 'FAQ',
    title: 'Veelgestelde vragen',
    items: [
      {
        label: 'Heeft de plugin een eigen server nodig?',
        content:
          'De plugin zelf niet – dat zijn alleen bestanden die Euro-Office aanbiedt. De AI-chat en MCP hebben de kleine server nodig; in de desktopapp neemt de companion-app die rol over. Het muziektabblad werkt helemaal zonder server.'
      },
      {
        label: 'Welke AI wordt er gebruikt?',
        content:
          'Die je zelf instelt: Mistral (EU-aanbieder, standaard), OpenAI, Anthropic, elke OpenAI-compatibele API of een lokaal model via Ollama. Of helemaal geen – dan gebruik je je eigen AI-assistent via MCP.'
      },
      {
        label: 'Welke gegevens gaan naar de AI?',
        content:
          'Bij elke chatvraag het gesprek en de opbouw van het document (teksten, notenbalken als ABC). De server slaat geen gesprekken of documenten op. Bij MCP leest je AI-assistent het document via de tools. Wil je dat er niets je netwerk verlaat, gebruik dan een lokaal model.'
      },
      {
        label: 'Wat is MCP?',
        content:
          'Het Model Context Protocol is een open standaard waarmee AI-assistenten tools kunnen gebruiken. De server biedt de tools van de plugin aan – zo bewerkt bijvoorbeeld Claude je geopende document alsof je de chat in de plugin had gebruikt.'
      },
      {
        label: 'Hoe loggen leraren in?',
        content:
          'Met `AUTH_MODE=nextcloud` met hun Nextcloud-account: in de plugin met één klik (Nextcloud Login Flow), AI-assistenten via OAuth met Nextcloud of met een app-wachtwoord. Iedereen bereikt alleen de eigen documenten; de toegang kun je in Nextcloud intrekken onder Apparaten & sessies.'
      },
      {
        label: 'Werkt het ook zonder Nextcloud?',
        content: 'Ja: met de desktopapp en de companion-app, of met je eigen Euro-Office Document Server en een gedeeld toegangstoken.'
      },
      {
        label: 'Kan ik ingevoegde inhoud later nog aanpassen?',
        content:
          'Ja. De AI leest de inhoud en vervangt precies de delen die je noemt. Notenbalken bewaren hun ABC-broncode in de alt-tekst en zijn aan te passen via de chat of in het muziektabblad.'
      },
      {
        label: 'Wat gebeurt er bij een update van Nextcloud AIO?',
        content:
          'AIO maakt de Euro-Office-container opnieuw aan, waardoor eigen plugins verdwijnen. Met `--watch` richt het installatiescript een kleine dienst in die de plugin na elke herstart automatisch opnieuw installeert.'
      },
      {
        label: 'Waarmee is het getest?',
        content:
          'Met Euro-Office 9.3.8 (Document Server en desktopapp op Linux), Nextcloud 34 en Mistral – geautomatiseerd in de echte editor. De companion-app wordt voor Windows en macOS automatisch gebouwd en gecontroleerd. Gehoste assistenten zoals claude.ai zijn nog niet getest met een openbare installatie.'
      },
      {
        label: 'Is het open source?',
        content:
          'Ja, onder de MIT-licentie. Meegeleverd worden abcjs (MIT) en de ONLYOFFICE-pluginbestanden (AGPL-3.0); de companion-app bevat Node.js en npm-pakketten – allemaal met hun licentieteksten.'
      }
    ]
  },
  cta: {
    title: 'Klaar voor je volgende werkblad?',
    description: 'Broncode, releases en uitgebreide documentatie op GitHub.',
    repo: 'Naar de repository',
    releases: 'Releases'
  },
  footer: {
    license: 'Worksheet Assistant · MIT-licentie',
    uses: 'gebruikt abcjs (MIT) en de ONLYOFFICE-plugin-SDK (AGPL-3.0)',
    copy: 'Kopiëren',
    copied: 'Gekopieerd'
  }
}

export default nl
