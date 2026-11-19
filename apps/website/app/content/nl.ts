import type { SiteContent } from './types'

const nl: SiteContent = {
  meta: {
    title: 'Worksheet Assistant voor Euro-Office',
    description:
      'Werkbladen maken met AI – voor elk vak: opdrachten, puzzels, grafieken, afbeeldingen, diagrammen voor informatica en notenbalken. In Nextcloud, in de desktopapp of met Claude & co. via MCP. Open source.'
  },
  nav: { features: 'Functies', informatics: 'Informatica', ways: 'Toepassingen', mcp: 'MCP', install: 'Installatie', faq: 'FAQ', language: 'Taal' },
  hero: {
    badge: 'Nieuw in {version}: diagrammen voor informatica',
    headline: 'AI-plugin voor Euro-Office – in Nextcloud en op de desktop',
    title: 'Werkbladen maken met AI – voor elk vak',
    description:
      'Beschrijf wat je nodig hebt: de Worksheet Assistant, je assistent voor werkbladen, zet opdrachten, invulteksten, puzzels, grafieken, formules, afbeeldingen, UML-diagrammen en notenbalken in één consistente vormgeving direct in je document – met de ingebouwde AI-chat of met je eigen AI-assistent via MCP.',
    install: 'Installeren',
    more: 'Alle functies',
    imageAlt:
      'Euro-Office met de Worksheet Assistant: een werkblad over de waterkringloop in de vormgeving “Modern” met koptekst, titel, naamregel en genummerde opdrachten met pictogrammen, sterren en punten; links het paneel met de AI-chat'
  },
  features: {
    headline: 'Functies',
    title: 'Alles voor je volgende werkblad',
    description: 'Gemaakt voor leraren en leraren in opleiding – voor werkbladen, toetsen en hand-outs in elk vak. De AI kiest de bouwstenen, de plugin zet ze netjes in het document.',
    items: [
      {
        title: 'Hele werkbladen via de chat',
        description: '“Maak een werkblad over de waterkringloop voor groep 7” – met titel, naamregel, opdrachten, materiaal en infokader. Eerst een voorbeeld, daarna invoegen.'
      },
      {
        title: 'Drie vormgevingen',
        description: 'Klassiek (zwart-wit, bespaart toner), Modern of Basisschool (grote letters, kleurrijk). Lettertypen, kleuren en afstanden komen uit de vormgeving.'
      },
      {
        title: 'Opdrachten en puzzels',
        description: 'Invultekst met woordenbank, meerkeuze, juist/onjuist, koppelen, kruiswoordpuzzel en woordzoeker, leestekst met regelnummers en meer.'
      },
      {
        title: 'Grafieken en formules',
        description: 'Getallenlijn, coördinatenstelsel, diagrammen, mindmap, schrijflijnen en ruitjespapier. LaTeX-formules worden echte, bewerkbare vergelijkingen.'
      },
      {
        title: 'Afbeeldingen',
        description: 'ARASAAC-pictogrammen, foto’s van Wikimedia Commons of je eigen afbeeldingen – de licentievermelding staat automatisch eronder.'
      },
      {
        title: 'Diagrammen voor informatica',
        description: 'UML-klassen-, sequentie-, toestands-, activiteiten- en use-casediagrammen, automaten, Nassi-Shneiderman-diagrammen (structogrammen), stroomdiagrammen en ER-diagrammen.'
      },
      {
        title: 'Notenbalken en liedteksten',
        description: 'Melodieën, lege notenbalken en liedteksten als afdrukklare afbeeldingen. Duitse nootnamen (h, fis, b) worden betrouwbaar omgezet.'
      },
      {
        title: 'Pagina en huisstijl',
        description: 'A4, A5 of Letter, staand of liggend, marges, kolommen, koptekst met schoolnaam en logo, voettekst met paginanummers.'
      },
      {
        title: 'Gecontroleerd, met antwoordenblad',
        description: 'Na het maken controleert de AI nummering, instructies, ruimte voor antwoorden, punten en leesbaarheid voor het leerjaar. Op verzoek volgt de oplossing in dezelfde opmaak.'
      },
      {
        title: 'Aanpassen in plaats van opnieuw beginnen',
        description: '“Herschrijf opdracht 1 voor groep 5”, “Maak van opdracht 2 een invultekst” – de AI verandert alleen wat jij vraagt. Voor verwijderen is jouw bevestiging nodig.'
      },
      {
        title: 'Je eigen AI-assistent via MCP',
        description: 'Claude, ChatGPT, Le Chat en andere bewerken het geopende document met dezelfde tools – zonder AI-sleutel in de plugin.'
      },
      {
        title: 'Privacy in eigen hand',
        description: 'Mistral als EU-aanbieder, een lokaal model via Ollama of helemaal geen AI. De sleutel blijft op de server, inloggen met je Nextcloud-account.'
      }
    ],
    more: 'Meer hierover'
  },
  designs: {
    headline: 'Vormgeving',
    title: 'Eén vormgeving voor het hele blad',
    description:
      'De AI kiest alleen de vormgeving – lettertypen, groottes, kleuren en afstanden van alles wat de assistent invoegt komen daaruit. Zo ziet elk blad er samenhangend uit, ook als je later opdrachten toevoegt.',
    themes: [
      { title: 'Klassiek', description: 'Zwart-wit en tonerbesparend – voor kopieën en toetsen.' },
      { title: 'Modern', description: 'Heldere letters met een blauw accent – voor het voortgezet onderwijs.' },
      { title: 'Basisschool', description: 'Grote letters, regelafstand 1,5, vriendelijke kleuren.' }
    ],
    imageAlt: 'Hetzelfde werkblad “Der Igel im Herbst” (de egel in de herfst) in de vormgeving {theme}',
    items: [
      { title: 'Opdrachtkoppen', description: 'Nummer, pictogrammen voor werkvorm en activiteit, moeilijkheidssterren, punten en tijdsduur.' },
      { title: 'Infokaders', description: 'Onthoud, Tip, Let op, Voorbeeld, Definitie, Oplossing en Info – elk met een pictogram.' },
      { title: 'In jouw taal', description: 'Labels zoals Naam, Klas, Woordenbank of juist/onjuist in zeven talen.' }
    ]
  },
  tasks: {
    headline: 'Opdrachten',
    title: 'Opdrachten die er goed uitzien',
    description:
      'Meer dan 40 bouwstenen die de AI vrij combineert. Puzzels worden berekend in plaats van geraden – kruiswoordpuzzels en woordzoekers zijn altijd oplosbaar.',
    imageAlt: 'Opdrachtenpagina in de vormgeving “Modern”: een berekende kruiswoordpuzzel met aanwijzingen horizontaal en verticaal en een woordzoeker met woordenlijst',
    items: [
      { title: 'Invulteksten en quiz', description: 'Invultekst met automatische woordenbank, meerkeuze, juist/onjuist-tabel, koppelen met lijnen of letters.' },
      { title: 'Puzzels', description: 'Kruiswoordpuzzel en woordzoeker in drie moeilijkheidsgraden – op verzoek met oplossing.' },
      { title: 'Lezen en schrijven', description: 'Leesteksten met regelnummers, **lettergreepkleuring** (lettergrepen afwisselend blauw en rood), schrijflijnen voor de basisschool (Duitse Lineatur 1–4) en ruitjespapier.' },
      { title: 'Rond de opdracht', description: 'Zelfevaluatie met smileys, tipkaartjes om uit te knippen, punten-cijfertabel, QR-codes en een lay-out met twee of drie kolommen.' }
    ]
  },
  graphics: {
    headline: 'Grafieken & formules',
    title: 'Wiskunde en natuurwetenschappen, netjes getekend',
    description:
      'Grafieken worden getekend uit gegevens, niet als afbeelding verzonnen: assen, schalen en labels kloppen. Elke grafiek bewaart haar bron in de alt-tekst – de AI kan haar later aanpassen.',
    imageAlt: 'Wiskundewerkblad: getallenlijn met open plekken, staafdiagram, coördinatenstelsel met een driehoek en een formule voor de oppervlakte',
    items: [
      { title: 'Getallenlijn en coördinatenstelsel', description: 'Met open plekken om in te vullen, punten, lijnstukken en veelhoeken.' },
      { title: 'Diagrammen', description: 'Staaf-, balk-, lijn- en cirkeldiagrammen – ook leeg om zelf te tekenen.' },
      { title: 'Formules', description: 'LaTeX wordt een echte vergelijking in het document, ook midden in een zin.' },
      { title: 'Mindmaps en tekeningen', description: 'Mindmaps (ook met lege bubbels) en eenvoudige tekeningen die de AI zelf ontwerpt.' }
    ]
  },
  pictures: {
    headline: 'Afbeeldingen',
    title: 'Afbeeldingen die bij het blad passen',
    description:
      'Vooral op de basisschool en in het speciaal onderwijs helpen afbeeldingen bij het begrijpen. De AI zoekt passende afbeeldingen en zet ze op het blad – naast woorden, als inleiding of in kolommen naast de tekst. De licentievermelding drukt ze automatisch eronder af.',
    imageAlt: 'Werkblad “Tiere im Wald” (dieren in het bos) in de vormgeving “Basisschool”: ARASAAC-pictogrammen van egel, uil, haas, eekhoorn, vos en raaf met licentievermelding, daaronder de dierennamen met lettergrepen afwisselend blauw en rood en schrijflijnen voor de basisschool',
    items: [
      { title: 'Pictogrammen', description: 'ARASAAC – eenvoudige, uniforme tekeningen van dingen, dieren, activiteiten en gevoelens, gemaakt voor het speciaal onderwijs.' },
      { title: 'Foto’s en historische afbeeldingen', description: 'Wikimedia Commons – dieren, planten, plaatsen, kunst, Romeinen en middeleeuwen.' },
      { title: 'Je eigen afbeeldingen', description: 'Een map in je Nextcloud of op je computer, bijv. met stripplaatjes voor Latijn. De AI vindt ze via bestands- en mapnamen.' }
    ]
  },
  informatics: {
    badge: 'Nieuw',
    headline: 'Informatica',
    title: 'UML, Nassi-Shneiderman- en ER-diagrammen',
    description:
      'De AI beschrijft alleen het model, de lay-out wordt berekend: vakken en pijlen staan recht en leesbaar, in de schoolnotatie zoals in het leerboek. Tien soorten diagrammen – elk ook als invuldiagram met antwoordenblad.',
    diagrams: [
      { title: 'Klassendiagram om in te vullen', description: 'Een attribuut als schrijflijn, een methode als lege regel, de overerving van Sparkonto (spaarrekening) om zelf te tekenen.' },
      { title: 'Sequentiediagram', description: 'Actor en objecten, aanroepen, antwoord, activeringsbalk en een alt-fragment.' },
      { title: 'Eindige automaat', description: 'Startpijl, accepterende toestand als dubbele cirkel, overgangen met tekens.' },
      { title: 'Nassi-Shneiderman-diagram (structogram)', description: 'Volgens DIN 66261: keuze en lus (ggT, grootste gemene deler, volgens Euclides).' },
      { title: 'Stroomdiagram', description: 'Volgens DIN 66001: start, invoer en uitvoer, keuze met ja/nee, einde.' },
      { title: 'ER-diagram', description: 'Chen-notatie met sleutelattributen en kardinaliteiten 1:n en n:m.' }
    ],
    items: [
      { title: 'Tien soorten diagrammen', description: 'Klassen-, object-, sequentie-, toestands-, activiteiten- en use-casediagrammen, eindige automaten, Nassi-Shneiderman-diagrammen, stroomdiagrammen en ER-diagrammen (Chen, (min,max), kraaienpoot).' },
      { title: 'Om in te vullen', description: 'Open plekken in elke tekst, ontbrekende pijlen en relaties, lege regels en vakken – en met één zin de oplossing in dezelfde lay-out.' },
      { title: 'Past op het blad', description: 'De lay-out wordt berekend en op de tekstbreedte gebracht. Zoals alle grafieken blijft elk diagram via de chat aan te passen.' }
    ]
  },
  music: {
    headline: 'Muziek',
    title: 'Muziekwerkbladen – ook helemaal zonder AI',
    description:
      'Het muziektabblad werkt zonder server en zonder API-sleutel: sjablonen, ABC-editor met live voorbeeld, Duitse nootnamen en liedteksten. Een geselecteerde notenbalk kun je laden, aanpassen en vervangen.',
    imageAlt: 'Muziektabblad: sjabloon “Alle meine Entchen” met liedtekst, ABC-notatie en voorbeeld, ingevoegd onder een opdracht in de vormgeving “Modern”',
    items: [
      { title: 'Sjablonen', description: 'Lege notenbalken met sol- of bassleutel, toonladders, een voorbeeldmelodie met tekst.' },
      { title: 'Nootnamen omzetten', description: 'c – f – g, fis′ g′ a′ h′, “bc” voor ces en maatsoorten zoals 4/4 – cijfers als octaaf of nootwaarde.' },
      { title: 'Afdrukklaar en bewerkbaar', description: 'Afbeeldingen van 300 dpi; de ABC-broncode staat in de alt-tekst. Via de chat: “Pas notenbalk 1 aan: in plaats van bc #c”.' }
    ]
  },
  mcp: {
    headline: 'MCP',
    title: 'Je AI-assistent schrijft mee',
    description:
      'Met het Model Context Protocol werken Claude, ChatGPT, Le Chat en andere AI-assistenten direct in het document dat je in Euro-Office open hebt. De plugin voert de wijzigingen uit – je ziet ze meteen en kunt ze met Ctrl+Z ongedaan maken.',
    imageAlt: 'Een AI-assistent heeft via MCP een derde opdracht met het lied “Es regnet” als notenbalk toegevoegd; het paneel toont de MCP-aanroepen',
    items: [
      { title: 'Dezelfde tools', description: 'Alle bouwstenen, afbeeldingen, diagrammen, paginalay-out, controle, bewerken en notenbalken – gecontroleerd voordat er iets in het document komt.' },
      { title: 'Alleen je eigen documenten', description: 'Met inloggen via Nextcloud bereikt een assistent alleen de documenten van zijn eigen gebruiker.' },
      { title: 'Jij houdt de regie', description: 'Het document wordt pas gekoppeld als je “MCP-Zugriff erlauben” (MCP-toegang toestaan) in de plugin aanzet. De toegang trek je in via Nextcloud.' }
    ],
    clientsTitle: 'Getest',
    clientsText: 'Met de MCP TypeScript SDK (protocol 2026-07-28) en verzoeken in 2025-formaat, via HTTP en stdio. Gehoste assistenten zoals claude.ai, ChatGPT en Le Chat zijn nog niet getest met een openbare installatie.'
  },
  companion: {
    headline: 'Desktop',
    title: 'De Worksheet Assistant-app voor je computer',
    description:
      'De desktopapps van Euro-Office en Nextcloud Office hebben geen pluginbeheer en geen server. De Worksheet Assistant-app regelt allebei: installeer hem zoals elke andere app, start hem één keer – daarna werkt hij onzichtbaar op de achtergrond. Geen terminal, geen browser.',
    imageAlt: 'Venster van de Worksheet Assistant-app, pagina “Übersicht” (overzicht): alle drie de stappen afgerond – plugin in de desktopapp, AI-chat in de plugin, Claude gekoppeld',
    items: [
      { title: 'Plugin automatisch ingesteld', description: 'Installeert de plugin in Euro-Office en Nextcloud Office, koppelt hem en houdt hem up-to-date – geen instellingen in de editor.' },
      { title: 'Jouw AI, jouw afbeeldingen', description: 'Mistral, OpenAI, Anthropic, Ollama of elke OpenAI-compatibele API – de sleutel blijft op je computer. Daarbij een eigen afbeeldingenmap.' },
      { title: 'Claude met één klik', description: 'Koppelt Claude Desktop of Claude Code. Nieuwe versies installeert de app met één klik; als je wilt start hij automatisch mee met je computer. Op macOS genotariseerd door Apple.' }
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
        bullets: ['Installatie met één commando (Nextcloud AIO)', 'Blijft behouden na AIO-updates', 'Eigen afbeeldingen in de Nextcloud-map'],
        link: 'Installeren in Nextcloud'
      },
      {
        title: 'Op je computer',
        badge: 'Windows · macOS · Linux',
        description: 'De desktopapp van Euro-Office of Nextcloud Office met de Worksheet Assistant-app – te installeren zoals elke andere app, zonder eigen server.',
        bullets: ['Installeert en werkt de plugin zelf bij', 'Eigen API-sleutel of een lokaal model', 'Claude Desktop met één klik koppelen'],
        link: 'Download de app'
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
    groups: [
      {
        label: 'Werkbladen',
        items: [
          'Maak een werkblad over de waterkringloop voor groep 7 met drie opdrachten, een invultekst en een infokader.',
          'Maak hier een kruiswoordpuzzel van met tien begrippen en voeg aan het eind een antwoordenblad toe.',
          'Pas de instructie van opdracht 1 aan, zodat leerlingen van groep 5 die begrijpen.',
          'Kies de vormgeving Klassiek en zet de naam van onze school en paginanummers in de koptekst en voettekst.',
          'Controleer het blad en verwijder opdracht 3.'
        ]
      },
      {
        label: 'Afbeeldingen & diagrammen',
        items: [
          'Een leesblad voor groep 3 over dieren in het bos – met een pictogram naast elk woord en lettergrepen afwisselend blauw en rood.',
          'Zet een foto van een Romeinse legionair naast de tekst.',
          'Teken een UML-klassendiagram voor Rekening, Betaalrekening en Spaarrekening, waarbij de leerlingen de overerving aanvullen.',
          'Maak een Nassi-Shneiderman-diagram voor het algoritme van Euclides en daaronder een leeg stroomdiagram om in te vullen.',
          'Een ER-diagram voor leerlingen, cursussen en leraren in Chen-notatie.'
        ]
      },
      {
        label: 'Muziek',
        items: [
          'Voeg onder opdracht 2 een notenbalk met c – f – g in, met daaronder een lege notenbalk om na te schrijven.',
          'Ik heb een notenbalk nodig: 4/4 bc1, f1, g2, be2, c1, c1',
          'Pas notenbalk 1 aan: in plaats van bc #c',
          'Zet deze tekst onder notenbalk 1: Altijd is Kortjakje ziek',
          'Voeg na opdracht 3 drie lege notenbalken met bassleutel in.'
        ]
      }
    ]
  },
  parts: {
    headline: 'Wat draait waar',
    title: 'Eén plugin, één kleine server – en de AI van jouw keuze',
    description: 'De plugin heeft geen eigen server nodig. Voor de AI-chat, afbeeldingen en MCP komt er een kleine dienst bij – op de server of in de Worksheet Assistant-app op je computer.',
    items: [
      {
        title: 'Plugin',
        badge: 'altijd',
        description: 'Alleen bestanden (≈ 1,4 MB) in de pluginmap van Euro-Office. Draait in de editor in de browser of in de desktopapp.',
        bullets: ['Maakt werkbladen, grafieken en diagrammen op', 'Tekent notenbalken, compleet muziektabblad', 'Voert MCP-aanroepen uit in het document']
      },
      {
        title: 'Server',
        badge: 'voor AI-chat, afbeeldingen en MCP',
        description: 'Een kleine dienst (Docker, ≈ 30 MB RAM) naast Nextcloud – of op de achtergrond in de Worksheet Assistant-app op je eigen computer.',
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
        description: 'De server bewaart de AI-sleutel, zoekt afbeeldingen en biedt het MCP-endpoint. Maak hem bereikbaar via HTTPS, bijv. als `https://arbeitsblatt.deine-schule.de`. Met `AUTH_MODE=nextcloud` logt elke leraar in met het eigen Nextcloud-account.',
        codeLabel: 'Shell'
      },
      {
        title: 'Inloggen in de editor',
        description: 'Open een document → **Plugins** → **Werkblad-assistent** → **Einstellungen** (instellingen): vul het serveradres in en klik op **Mit Nextcloud anmelden** (inloggen met Nextcloud). Klaar. Eigen afbeeldingen zet je in de map `Arbeitsblatt-Bilder` in je Nextcloud.'
      }
    ],
    desktop: [
      { title: 'Euro-Office installeren', description: 'Installeer de desktopapp van Euro-Office of Nextcloud Office voor Windows, macOS of Linux en start hem één keer.' },
      {
        title: 'Worksheet Assistant-app installeren',
        description: 'Download het installatiebestand voor je systeem en installeer de app zoals elke andere app (macOS: sleep hem naar **Programma’s**); de app heet **Arbeitsblatt-Assistent**. Bij het starten opent zijn venster: de app richt de plugin in en werkt onzichtbaar op de achtergrond. Op macOS is de app genotariseerd door Apple. Op Windows is hij nog niet ondertekend – als SmartScreen waarschuwt: **Meer informatie → Toch uitvoeren**.'
      },
      {
        title: 'Kies je AI',
        description: 'Vul in de app op de pagina **KI-Chat** (AI-chat) de aanbieder en de API-sleutel in – of kies een lokaal model via Ollama, of alleen MCP. Op de pagina **Bilder** (afbeeldingen) kies je een eigen afbeeldingenmap. Open daarna een document in Euro-Office: **Plugins → Werkblad-assistent**. Je kunt het venster sluiten – de app blijft actief in het systeemvak (macOS: menubalk).'
      }
    ],
    docker: [
      { title: 'Plugin bouwen', description: 'Download het release-archief of bouw de plugin zelf.', codeLabel: 'Shell' },
      {
        title: 'Document Server en server starten',
        description: '`deploy/` start Euro-Office met de plugin als volume, plus de server. Nextcloud gebruikt de Document Server daarna als externe server.',
        codeLabel: 'Shell'
      },
      { title: 'Editor instellen', description: 'Vul in de plugin onder **Einstellungen** (instellingen) het serveradres en het token in (of log in met Nextcloud) en klik op “Verbindung testen” (verbinding testen).' }
    ],
    mcp: [
      {
        title: 'Document koppelen',
        description: 'Zet in het geopende document **Plugins → Werkblad-assistent → Einstellungen → MCP-Zugriff erlauben** (instellingen → MCP-toegang toestaan) aan; met de Worksheet Assistant-app staat dit al aan. Het paneel toont het MCP-adres.'
      },
      {
        title: 'AI-assistent koppelen',
        description: 'Voeg het MCP-adres toe: in Claude, ChatGPT of Le Chat als aangepaste connector (inloggen via Nextcloud), in Claude Code met een commando. De Worksheet Assistant-app koppelt Claude Desktop en Claude Code met één klik (pagina **Claude & MCP**).',
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
          'De plugin zelf niet – dat zijn alleen bestanden die Euro-Office aanbiedt. De AI-chat, het zoeken van afbeeldingen en MCP hebben de kleine server nodig; op je eigen computer neemt de Worksheet Assistant-app die rol over. Het muziektabblad werkt helemaal zonder server.'
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
        label: 'Waar komen de afbeeldingen vandaan – en mag ik ze gebruiken?',
        content:
          'Uit drie bronnen: ARASAAC-pictogrammen (CC BY-NC-SA, vrij voor school), Wikimedia Commons (vrije licenties) en je eigen afbeeldingenmap. Maker en licentie van vrije afbeeldingen staan automatisch onder de afbeelding. De server raadpleegt alleen de vaste adressen van ARASAAC en Wikimedia en je map – de AI geeft nooit zelf adressen op. Met `IMAGE_SOURCES` of in de app schakel je de afbeeldingen van internet uit.'
      },
      {
        label: 'Welke diagrammen voor informatica zijn er?',
        content:
          'UML-klassen-, object-, sequentie-, toestands-, activiteiten- en use-casediagrammen, eindige automaten (DFA/NFA), Nassi-Shneiderman-diagrammen (structogrammen) volgens DIN 66261, stroomdiagrammen volgens DIN 66001 en ER-diagrammen in Chen-, (min,max)- of kraaienpootnotatie. Elk diagram is er ook om in te vullen en met oplossing.'
      },
      {
        label: 'Wat is MCP?',
        content:
          'Het Model Context Protocol is een open standaard waarmee AI-assistenten tools kunnen gebruiken. De server biedt de tools van de plugin aan – zo bewerkt bijvoorbeeld Claude je geopende document alsof je de chat in de plugin had gebruikt.'
      },
      {
        label: 'Hoe loggen leraren in?',
        content:
          'Met `AUTH_MODE=nextcloud` met hun Nextcloud-account: in de plugin met één klik (Nextcloud Login Flow), AI-assistenten via OAuth met Nextcloud of met een app-wachtwoord. Iedereen bereikt alleen de eigen documenten en afbeeldingen; de toegang kun je in Nextcloud intrekken onder Apparaten & sessies.'
      },
      {
        label: 'Werkt het ook zonder Nextcloud?',
        content: 'Ja: met de desktopapp van Euro-Office of Nextcloud Office en de Worksheet Assistant-app, of met je eigen Euro-Office Document Server en een gedeeld toegangstoken.'
      },
      {
        label: 'Kan ik ingevoegde inhoud later nog aanpassen?',
        content:
          'Ja. De AI leest de inhoud en vervangt precies de delen die je noemt. Grafieken, diagrammen, afbeeldingen en notenbalken bewaren hun bron in de alt-tekst en zijn aan te passen via de chat; notenbalken ook in het muziektabblad.'
      },
      {
        label: 'Wat gebeurt er bij een update van Nextcloud AIO?',
        content:
          'AIO maakt de Euro-Office-container opnieuw aan, waardoor eigen plugins verdwijnen. Met `--watch` richt het installatiescript een kleine dienst in die de plugin na elke herstart automatisch opnieuw installeert.'
      },
      {
        label: 'Hoe wordt de app bijgewerkt?',
        content:
          'De Worksheet Assistant-app controleert regelmatig of er een nieuwe versie is en toont die in zijn venster en in het systeemvak (macOS: menubalk). Eén klik downloadt en installeert de update – bij het .deb-pakket krijg je in plaats daarvan een link naar de downloadpagina. De nieuwe versie werkt de plugin in Euro-Office automatisch bij.'
      },
      {
        label: 'Waarmee is het getest?',
        content:
          'Met Euro-Office 9.3.8 (Document Server en desktopapp op Linux), Nextcloud 34 en Mistral – geautomatiseerd in de echte editor. De Worksheet Assistant-app wordt voor Windows, macOS en Linux automatisch gebouwd en gecontroleerd. Gehoste assistenten zoals claude.ai zijn nog niet getest met een openbare installatie.'
      },
      {
        label: 'Is het open source?',
        content:
          'Ja, onder de MIT-licentie. Meegeleverd worden abcjs, dagre en qrcode-generator (allemaal MIT) en de ONLYOFFICE-pluginbestanden (AGPL-3.0); de Worksheet Assistant-app bevat Node.js en npm-pakketten – allemaal met hun licentieteksten.'
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
    uses: 'gebruikt abcjs, dagre en qrcode-generator (MIT) en de ONLYOFFICE-plugin-SDK (AGPL-3.0) · Pictogrammen: Sergio Palao, ARASAAC (CC BY-NC-SA)',
    copy: 'Kopiëren',
    copied: 'Gekopieerd',
    zoom: 'Afbeelding op volledige grootte openen'
  }
}

export default nl
