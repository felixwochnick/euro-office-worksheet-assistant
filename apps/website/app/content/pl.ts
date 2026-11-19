import type { SiteContent } from './types'

const pl: SiteContent = {
  meta: {
    title: 'Worksheet Assistant dla Euro-Office',
    description:
      'Twórz karty pracy z AI – do każdego przedmiotu, w Nextcloud, w aplikacji desktopowej lub z Claude i innymi asystentami przez MCP. Open source.'
  },
  nav: { features: 'Funkcje', ways: 'Zastosowania', mcp: 'MCP', demo: 'Demo na żywo', install: 'Instalacja', faq: 'FAQ', language: 'Język' },
  hero: {
    badge: 'Open source · MIT',
    headline: 'Wtyczka AI do Euro-Office – w Nextcloud i na komputerze',
    title: 'Twórz karty pracy z AI – do każdego przedmiotu',
    description:
      'Opisz, czego potrzebujesz: Worksheet Assistant (asystent kart pracy) układa zadania, teksty z lukami, krzyżówki, tabele, wykresy, wzory, linie do pisania, ramki informacyjne i pięciolinie w jednolitym projekcie graficznym prosto w twoim dokumencie – za pomocą wbudowanego czatu AI lub twojego własnego asystenta AI przez MCP.',
    install: 'Zainstaluj',
    more: 'Jak to działa',
    imageAlt:
      'Euro-Office z wtyczką Worksheet Assistant: karta pracy o obiegu wody w przyrodzie utworzona przez czat AI, po lewej czat z poleceniem'
  },
  features: {
    headline: 'Funkcje',
    title: 'Od pustej kartki do gotowej karty pracy',
    description: 'Dla nauczycieli i studentów kierunków nauczycielskich – karty pracy, sprawdziany i materiały dla uczniów z każdego przedmiotu.',
    items: [
      {
        title: 'Estetyczne karty pracy przez czat',
        description:
          '„Przygotuj kartę pracy o obiegu wody w przyrodzie dla klasy 3”: tytuł, numerowane zadania z ikonami i punktami, tekst z lukami i bankiem słów, krzyżówka, wykres i ramka informacyjna – w jednym projekcie (nowoczesny, szkoła podstawowa, klasyczny) i na koniec automatycznie sprawdzona.'
      },
      {
        title: 'Poprawiaj zamiast zaczynać od nowa',
        description:
          '„Przeformułuj zadanie 1 dla klasy 3”, „Zamień zadanie 2 na tekst z lukami”, „Dodaj stronę z rozwiązaniami” – AI zmienia tylko to, o co prosisz. Usuwanie wymaga twojego potwierdzenia.'
      },
      {
        title: 'Pięciolinie i teksty piosenek',
        description:
          'Melodie, puste pięciolinie i teksty piosenek jako obrazy gotowe do druku. Niemieckie nazwy dźwięków (h, fis, b) są niezawodnie konwertowane; każdą pięciolinię można dalej edytować.'
      },
      {
        title: 'Twój asystent AI przez MCP',
        description: 'Claude, ChatGPT, Le Chat i inni edytują otwarty dokument tymi samymi narzędziami – bez klucza AI we wtyczce.'
      },
      {
        title: 'Prywatność w twoich rękach',
        description: 'Mistral jako dostawca z UE, lokalny model przez Ollama albo w ogóle bez AI. Klucz zostaje na serwerze, logowanie kontem Nextcloud.'
      },
      {
        title: 'Nextcloud, serwer lub komputer',
        description:
          'Jedno polecenie dla Nextcloud AIO, plik Docker Compose dla własnego Document Server albo aplikacja Worksheet Assistant dla aplikacji desktopowej Euro-Office (Windows, macOS, Linux).'
      }
    ]
  },
  ways: {
    headline: 'Zastosowania',
    title: 'Trzy sposoby – jedna wtyczka',
    description: 'Wybierz, gdzie pracujesz i z jakiej AI chcesz korzystać. Wszystkie sposoby można łączyć.',
    items: [
      {
        title: 'W Nextcloud',
        badge: 'dla szkół',
        description: 'Wtyczka w Euro-Office w Nextcloud, a obok niej mały serwer. Każdy nauczyciel loguje się swoim kontem Nextcloud.',
        bullets: ['Instalacja jednym poleceniem (Nextcloud AIO)', 'Przetrwa aktualizacje AIO', 'Klucz AI tylko na serwerze'],
        link: 'Instalacja w Nextcloud'
      },
      {
        title: 'Na twoim komputerze',
        badge: 'Windows · macOS · Linux',
        description: 'Aplikacja desktopowa Euro-Office lub Nextcloud Office z aplikacją Worksheet Assistant – instalujesz ją jak każdą inną aplikację, bez własnego serwera.',
        bullets: ['Sama instaluje i aktualizuje wtyczkę', 'Własny klucz API albo lokalny model', 'Claude Desktop podłączony jednym kliknięciem'],
        link: 'Pobierz aplikację'
      },
      {
        title: 'Z twoim asystentem AI',
        badge: 'MCP',
        description: 'Claude, ChatGPT, Le Chat lub inny klient MCP pracuje bezpośrednio w otwartym dokumencie.',
        bullets: ['Te same narzędzia co czat', 'Logowanie przez Nextcloud (OAuth) lub hasłem aplikacji', 'Lokalnie bez logowania'],
        link: 'Skonfiguruj MCP'
      }
    ]
  },
  prompts: {
    headline: 'Przykłady',
    title: 'Jak rozmawiać z Worksheet Assistant',
    description: 'Wystarczą zwykłe zdania. AI zna strukturę twojego dokumentu i odpowiada w twoim języku.',
    worksheetLabel: 'Karty pracy',
    musicLabel: 'Muzyka',
    worksheet: [
      'Przygotuj kartę pracy o obiegu wody w przyrodzie dla klasy 5 z trzema zadaniami, tabelą i ramką informacyjną.',
      'Przeformułuj polecenie w zadaniu 1 tak, żeby zrozumieli je uczniowie klasy 3.',
      'Zamień zadanie 2 na tekst z 8 lukami.',
      'Dodaj na końcu stronę z rozwiązaniami.',
      'Usuń zadanie 3.'
    ],
    music: [
      'Pod zadaniem 2 wstaw pięciolinię z c – f – g, a pod nią pustą pięciolinię do przepisania nut.',
      'Potrzebuję pięciolinii: 4/4 bc1, f1, g2, be2, c1, c1',
      'Proszę, zmień pięciolinię 1: zamiast bc #c',
      'Dodaj tekst do pięciolinii 1: Wlazł kotek na płotek',
      'Po zadaniu 3 wstaw trzy puste pięciolinie z kluczem basowym.'
    ]
  },
  mcp: {
    headline: 'MCP',
    title: 'Twój asystent AI pisze razem z tobą',
    description:
      'Dzięki Model Context Protocol Claude, ChatGPT, Le Chat i inni asystenci AI pracują bezpośrednio w dokumencie, który masz otwarty w Euro-Office. Wtyczka wprowadza zmiany – widzisz je od razu i możesz je cofnąć skrótem Ctrl+Z.',
    imageAlt: 'Asystent AI dodał przez MCP dodatkowe zadanie z pięciolinią i tekstem piosenki; czat wtyczki pokazuje wywołania MCP',
    items: [
      { title: 'Te same narzędzia', description: 'Bloki kart pracy, edycja, usuwanie, pięciolinie i teksty piosenek – wszystko sprawdzane, zanim trafi do dokumentu.' },
      { title: 'Tylko twoje dokumenty', description: 'Przy logowaniu przez Nextcloud asystent ma dostęp tylko do dokumentów swojego użytkownika.' },
      { title: 'Kontrola pozostaje u ciebie', description: 'Dokument zostaje połączony dopiero po włączeniu „Allow MCP access” we wtyczce. Dostęp możesz cofnąć w Nextcloud.' }
    ],
    clientsTitle: 'Przetestowano',
    clientsText: 'Z MCP TypeScript SDK (protokół 2026-07-28) i zapytaniami w formacie z 2025 r., przez HTTP i stdio. Samych Claude, ChatGPT i Le Chat jeszcze nie podłączono.'
  },
  companion: {
    headline: 'Desktop',
    title: 'Aplikacja Worksheet Assistant na twój komputer',
    description:
      'Aplikacje desktopowe Euro-Office i Nextcloud Office nie mają menedżera wtyczek ani serwera. Aplikacja Worksheet Assistant zapewnia jedno i drugie: instalujesz ją jak każdą inną aplikację, uruchamiasz raz – a potem działa niewidocznie w tle. Bez terminala, bez przeglądarki.',
    imageAlt: 'Okno aplikacji Worksheet Assistant, strona „Übersicht” (przegląd): wszystkie trzy kroki wykonane – wtyczka w aplikacji desktopowej, czat AI we wtyczce, Claude podłączony',
    items: [
      { title: 'Wtyczka konfiguruje się sama', description: 'Instaluje wtyczkę w Euro-Office i Nextcloud Office, podłącza ją i dba o jej aktualizacje – bez żadnych ustawień w edytorze.' },
      { title: 'Twoja AI', description: 'Mistral, OpenAI, Anthropic, Ollama lub dowolne API zgodne z OpenAI – klucz zostaje na twoim komputerze.' },
      { title: 'Claude jednym kliknięciem', description: 'Podłącza Claude Desktop lub Claude Code jednym kliknięciem. Aplikacja sama informuje o nowych wersjach i, jeśli chcesz, uruchamia się razem z komputerem.' }
    ]
  },
  music: {
    headline: 'Muzyka',
    title: 'Muzyczne karty pracy – nawet całkiem bez AI',
    description:
      'Zakładka muzyczna działa bez serwera i bez klucza API: szablony, edytor ABC z podglądem na żywo, niemieckie nazwy dźwięków i teksty piosenek. Zaznaczoną pięciolinię można wczytać, zmienić i podmienić.',
    imageAlt: 'Zakładka muzyczna: szablon „Alle meine Entchen” z tekstem, notacją ABC i podglądem',
    items: [
      { title: 'Szablony', description: 'Puste pięciolinie z kluczem wiolinowym lub basowym, gamy, przykładowa melodia z tekstem.' },
      { title: 'Przeliczanie nazw dźwięków', description: 'c – f – g, fis′ g′ a′ h′, „bc” jako ces i oznaczenia metrum, np. 4/4 – cyfry jako oktawa lub wartość rytmiczna.' },
      { title: 'Gotowe do druku i edytowalne', description: 'Obrazy w 300 dpi; kod źródłowy ABC jest zapisany w tekście alternatywnym.' }
    ]
  },
  demo: {
    headline: 'Demo na żywo',
    title: 'Wypróbuj konwerter nazw dźwięków',
    description: 'Wpisz niemieckie nazwy dźwięków – pięciolinia pojawi się od razu. To ten sam konwerter, którego wtyczka używa w edytorze.',
    loading: 'Ładowanie demo…',
    notesLabel: 'Nazwy dźwięków (niemieckie)',
    notesHelp: 'np. c – f – g, fis′ g′ a′ h′, bc = ces, 4/4 = metrum',
    clefLabel: 'Klucz',
    treble: 'Klucz wiolinowy',
    bass: 'Klucz basowy',
    digitsLabel: 'Cyfry',
    digitsAuto: 'Cyfry: automatycznie',
    digitsOctave: 'Cyfry = oktawa (c1 = c′)',
    digitsDuration: 'Cyfry = wartość rytmiczna (c1 = cała nuta)',
    lyricsLabel: 'Tekst piosenki (opcjonalnie)',
    lyricsHelp: 'Oddziel sylaby znakiem -: Wlazł ko-tek na pło-tek',
    showAbc: 'Pokaż notację ABC',
    paperLoading: 'Ładowanie pięciolinii…',
    examples: ['c – f – g', 'Hänschen klein', 'Wartości rytmiczne', 'Klucz basowy'],
    noteCount: 'liczba nut: {n}',
    readAsDurations: 'cyfry odczytane jako wartości rytmiczne',
    readAsOctaves: 'cyfry odczytane jako oktawy',
    meterInfo: 'metrum {meter}, liczba taktów: {bars}',
    issues: {
      unknownName: '„{token}” to nieznana nazwa dźwięku.',
      doubleAccidental: '„{token}” ma dwa znaki chromatyczne.',
      farFromStaff: '„{token}” leży daleko poza pięciolinią ({octave}).',
      incompleteBar: 'Nuty nie wypełniają pełnych taktów w metrum {meter} (liczba taktów: {bars}).',
      tooManySyllables: 'Tekst ma więcej sylab, niż melodia ma nut.',
      tooFewSyllables: 'Tekst nie wystarcza na wszystkie nuty – pozostałe zostaną bez tekstu.'
    }
  },
  parts: {
    headline: 'Co działa gdzie',
    title: 'Jedna wtyczka, jeden mały serwer – i AI, którą wybierzesz',
    description: 'Wtyczka nie potrzebuje własnego serwera. Czat AI i MCP wymagają dodatkowo małej usługi – na serwerze albo w aplikacji Worksheet Assistant na twoim komputerze.',
    items: [
      {
        title: 'Wtyczka',
        badge: 'zawsze',
        description: 'Same pliki (≈ 1 MB) w folderze wtyczek Euro-Office. Działa w edytorze w przeglądarce lub w aplikacji desktopowej.',
        bullets: ['Wstawia i edytuje treści', 'Rysuje pięciolinie, pełna zakładka muzyczna', 'Wykonuje wywołania MCP w dokumencie']
      },
      {
        title: 'Serwer',
        badge: 'do czatu AI i MCP',
        description: 'Mała usługa (Docker, ≈ 30 MB RAM) obok Nextcloud – albo w tle aplikacji Worksheet Assistant na twoim komputerze.',
        bullets: ['Klucz API zostaje na serwerze', 'Logowanie przez Nextcloud, limit zapytań', 'Sprawdza treści, zanim trafią do dokumentu']
      },
      {
        title: 'Model językowy',
        badge: 'opcjonalnie',
        description: 'Mistral (domyślnie), OpenAI, Anthropic, dowolne API zgodne z OpenAI, np. Ollama – albo twój własny asystent AI przez MCP.',
        bullets: ['Wymienny bez zmian we wtyczce', 'Możliwy dostawca z UE lub model lokalny', 'Koszty po stronie dostawcy']
      }
    ]
  },
  install: {
    headline: 'Instalacja',
    title: 'Gotowe w trzech krokach',
    description: 'Wybierz swój sposób. Więcej wariantów i wszystkie ustawienia znajdziesz w README.',
    tabs: { nextcloud: 'Nextcloud AIO', desktop: 'Aplikacja desktopowa', docker: 'Własny serwer', mcp: 'Asystent AI (MCP)' },
    nextcloud: [
      {
        title: 'Zainstaluj wtyczkę',
        description: 'Uruchom na serwerze AIO. Skrypt kopiuje wtyczkę do kontenera Euro-Office; z opcją `--watch` po każdej aktualizacji AIO automatycznie instaluje ją ponownie.',
        codeLabel: 'Shell (serwer AIO)'
      },
      {
        title: 'Uruchom serwer',
        description: 'Serwer przechowuje klucz AI i udostępnia endpoint MCP. Zadbaj, by był dostępny przez HTTPS, np. pod adresem `https://worksheets.your-school.org`. Z `AUTH_MODE=nextcloud` każdy nauczyciel loguje się swoim kontem Nextcloud.',
        codeLabel: 'Shell'
      },
      {
        title: 'Zaloguj się w edytorze',
        description: 'Otwórz dokument → **Plugins** → **Worksheet Assistant** → **Settings**: wpisz adres serwera i kliknij **Sign in with Nextcloud**. Gotowe.'
      }
    ],
    desktop: [
      { title: 'Zainstaluj Euro-Office', description: 'Zainstaluj aplikację desktopową Euro-Office lub Nextcloud Office dla Windows, macOS lub Linux i uruchom ją jeden raz.' },
      {
        title: 'Zainstaluj aplikację Worksheet Assistant',
        description: 'Pobierz instalator dla swojego systemu i zainstaluj aplikację jak każdą inną (macOS: przeciągnij ją do folderu **Aplikacje**); nazywa się **Arbeitsblatt-Assistent**. Po uruchomieniu otwiera się jej okno: aplikacja konfiguruje wtyczkę i działa niewidocznie w tle. Na macOS aplikacja jest poświadczona notarialnie przez Apple. W systemie Windows nie jest jeszcze podpisana – jeśli SmartScreen wyświetli ostrzeżenie: **Więcej informacji → Uruchom mimo to**.'
      },
      {
        title: 'Wybierz AI',
        description: 'W aplikacji na stronie **KI-Chat** (czat AI) wpisz dostawcę i klucz API – albo wybierz lokalny model przez Ollama lub samo MCP. Potem otwórz dokument w Euro-Office: **Plugins → Worksheet Assistant**. Okno możesz zamknąć – aplikacja działa dalej w zasobniku systemowym (macOS: na pasku menu). Wskazówka: włącz autostart w **Einstellungen** (ustawienia).'
      }
    ],
    docker: [
      { title: 'Zbuduj wtyczkę', description: 'Pobierz archiwum z wydania albo zbuduj wtyczkę samodzielnie.', codeLabel: 'Shell' },
      {
        title: 'Uruchom Document Server i serwer',
        description: '`deploy/` uruchamia Euro-Office z wtyczką jako wolumenem oraz serwer. Nextcloud korzysta potem z Document Server jako serwera zewnętrznego.',
        codeLabel: 'Shell'
      },
      { title: 'Skonfiguruj edytor', description: 'We wtyczce w **Settings** wpisz adres serwera i token (albo zaloguj się przez Nextcloud) i kliknij „Test connection”.' }
    ],
    mcp: [
      {
        title: 'Połącz dokument',
        description: 'W otwartym dokumencie włącz **Plugins → Worksheet Assistant → Settings → Allow MCP access** (z aplikacją Worksheet Assistant jest już włączone). Panel pokazuje adres MCP.'
      },
      {
        title: 'Połącz asystenta AI',
        description: 'Dodaj adres MCP: w Claude, ChatGPT lub Le Chat jako własny konektor (logowanie przez Nextcloud), w Claude Code poleceniem. Aplikacja Worksheet Assistant podłącza Claude Desktop i Claude Code jednym kliknięciem (strona **Claude & MCP**).',
        codeLabel: 'Claude Code'
      },
      { title: 'Do dzieła', description: '„Przygotuj w otwartym dokumencie kartę pracy o ułamkach dla klasy 6” – zmiany od razu pojawią się w edytorze.' }
    ],
    readme: 'Wszystkie opcje w README'
  },
  faq: {
    headline: 'FAQ',
    title: 'Najczęściej zadawane pytania',
    items: [
      {
        label: 'Czy wtyczka potrzebuje własnego serwera?',
        content:
          'Sama wtyczka nie – to tylko pliki udostępniane przez Euro-Office. Czat AI i MCP wymagają małego serwera; na twoim komputerze jego rolę przejmuje aplikacja Worksheet Assistant. Zakładka muzyczna działa całkowicie bez serwera.'
      },
      {
        label: 'Z jakiej AI korzysta wtyczka?',
        content:
          'Z tej, którą skonfigurujesz: Mistral (dostawca z UE, domyślnie), OpenAI, Anthropic, dowolne API zgodne z OpenAI albo lokalny model przez Ollama. Albo z żadnej – wtedy korzystasz z własnego asystenta AI przez MCP.'
      },
      {
        label: 'Jakie dane trafiają do AI?',
        content:
          'Przy każdym zapytaniu w czacie: przebieg rozmowy i struktura dokumentu (teksty, pięciolinie jako ABC). Serwer nie zapisuje rozmów ani dokumentów. Przy MCP twój asystent AI odczytuje dokument za pomocą narzędzi. Jeśli nic nie ma opuszczać twojej sieci, użyj lokalnego modelu.'
      },
      {
        label: 'Czym jest MCP?',
        content:
          'Model Context Protocol to otwarty standard, dzięki któremu asystenci AI mogą korzystać z narzędzi. Serwer udostępnia narzędzia wtyczki – dzięki temu np. Claude edytuje twój otwarty dokument tak samo jak czat we wtyczce.'
      },
      {
        label: 'Jak logują się nauczyciele?',
        content:
          'Z `AUTH_MODE=nextcloud` swoim kontem Nextcloud: we wtyczce jednym kliknięciem (Nextcloud Login Flow), asystenci AI przez OAuth w Nextcloud lub hasłem aplikacji. Każdy ma dostęp tylko do własnych dokumentów; dostęp można cofnąć w Nextcloud w sekcji Urządzenia i sesje.'
      },
      {
        label: 'Czy to działa bez Nextcloud?',
        content: 'Tak: z aplikacją desktopową Euro-Office lub Nextcloud Office i aplikacją Worksheet Assistant albo z własnym Euro-Office Document Server i wspólnym tokenem dostępu.'
      },
      {
        label: 'Czy mogę później zmienić wstawione treści?',
        content:
          'Tak. AI odczytuje treść i zastępuje dokładnie te fragmenty, które wskażesz. Pięciolinie przechowują swój kod źródłowy ABC w tekście alternatywnym i można je zmieniać przez czat lub w zakładce muzycznej.'
      },
      {
        label: 'Co się dzieje przy aktualizacji Nextcloud AIO?',
        content:
          'AIO tworzy kontener Euro-Office od nowa, przez co znikają własne wtyczki. Z opcją `--watch` skrypt instalacyjny konfiguruje małą usługę, która po każdym restarcie automatycznie instaluje wtyczkę ponownie.'
      },
      {
        label: 'Jak aktualizuje się aplikacja?',
        content:
          'Aplikacja Worksheet Assistant regularnie sprawdza, czy jest nowa wersja, i pokazuje ją w swoim oknie oraz w zasobniku systemowym (macOS: na pasku menu). Jedno kliknięcie pobiera ją i instaluje – w przypadku pakietu .deb dostajesz zamiast tego link do strony pobierania. Nowa wersja automatycznie aktualizuje wtyczkę w Euro-Office.'
      },
      {
        label: 'Z czym to przetestowano?',
        content:
          'Z Euro-Office 9.3.8 (Document Server i aplikacja desktopowa w systemie Linux), Nextcloud 34 i Mistral – automatycznie w prawdziwym edytorze. Aplikacja Worksheet Assistant jest automatycznie budowana i sprawdzana dla Windows, macOS i Linux. Hostowani asystenci, tacy jak claude.ai, nie zostali jeszcze przetestowani z publiczną instalacją.'
      },
      {
        label: 'Czy to open source?',
        content:
          'Tak, na licencji MIT. W zestawie są abcjs (MIT) i pliki wtyczek ONLYOFFICE (AGPL-3.0); aplikacja Worksheet Assistant zawiera Node.js i pakiety npm – wszystko wraz z tekstami licencji.'
      }
    ]
  },
  cta: {
    title: 'Czas na kolejną kartę pracy?',
    description: 'Kod źródłowy, wydania i szczegółowa dokumentacja w serwisie GitHub.',
    repo: 'Przejdź do repozytorium',
    releases: 'Wydania'
  },
  footer: {
    license: 'Worksheet Assistant · licencja MIT',
    uses: 'korzysta z abcjs (MIT) i ONLYOFFICE Plugin SDK (AGPL-3.0)',
    copy: 'Kopiuj',
    copied: 'Skopiowano'
  }
}

export default pl
