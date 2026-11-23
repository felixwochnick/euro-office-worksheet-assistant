import type { SiteContent } from './types'

const pl: SiteContent = {
  meta: {
    title: 'Worksheet Assistant dla Euro-Office',
    description:
      'Twórz karty pracy z AI – do każdego przedmiotu: estetyczne zadania, łamigłówki, grafiki, obrazy, diagramy informatyczne i pięciolinie. W Nextcloud, w aplikacji desktopowej lub z Claude i innymi asystentami przez MCP. Open source.'
  },
  nav: { features: 'Funkcje', informatics: 'Informatyka', ways: 'Zastosowania', mcp: 'MCP', install: 'Instalacja', faq: 'FAQ', language: 'Język' },
  hero: {
    badge: 'Nowość w {version}: sceny 3D z brył geometrycznych',
    headline: 'Wtyczka AI do Euro-Office – w Nextcloud i na komputerze',
    title: 'Twórz karty pracy z AI – do każdego przedmiotu',
    description:
      'Opisz, czego potrzebujesz: Worksheet Assistant (asystent kart pracy) układa zadania, teksty z lukami, łamigłówki, grafiki, wzory, obrazy, diagramy UML i pięciolinie w jednolitym projekcie graficznym prosto w twoim dokumencie – za pomocą wbudowanego czatu AI lub twojego własnego asystenta AI przez MCP.',
    install: 'Zainstaluj',
    more: 'Wszystkie funkcje',
    imageAlt:
      'Euro-Office z wtyczką Worksheet Assistant: karta pracy o obiegu wody w przyrodzie w projekcie „Nowoczesny” z nagłówkiem, tytułem, polem na imię i numerowanymi zadaniami z ikonami, gwiazdkami i punktami; po lewej panel z czatem AI'
  },
  features: {
    headline: 'Funkcje',
    title: 'Wszystko na twoją następną kartę pracy',
    description: 'Dla nauczycieli i studentów kierunków nauczycielskich – karty pracy, sprawdziany i materiały dla uczniów z każdego przedmiotu. AI wybiera elementy, a wtyczka czysto umieszcza je w dokumencie.',
    items: [
      {
        title: 'Całe karty pracy przez czat',
        description: '„Przygotuj kartę pracy o obiegu wody w przyrodzie dla klasy 5” – z tytułem, polem na imię, zadaniami, materiałem i ramką informacyjną. Najpierw podgląd, potem wstawienie.'
      },
      {
        title: 'Trzy projekty',
        description: 'Klasyczny (czarno-biały, oszczędza toner), Nowoczesny lub Szkoła podstawowa (duża czcionka, kolorowy). Czcionki, kolory i odstępy pochodzą z projektu.'
      },
      {
        title: 'Zadania i łamigłówki',
        description: 'Tekst z lukami z bankiem słów, wielokrotny wybór, prawda/fałsz, łączenie w pary, krzyżówki i wykreślanki, tekst do czytania z numerami wierszy i więcej.'
      },
      {
        title: 'Grafiki i wzory',
        description: 'Oś liczbowa, układ współrzędnych, wykresy, mapa myśli, linie do pisania i papier w kratkę. Wzory z LaTeX stają się prawdziwymi, edytowalnymi równaniami.'
      },
      {
        title: 'Bryły geometryczne w 3D',
        description: 'Sześciany, prostopadłościany, walce, stożki i ostrosłupy – także ułożone w domy i wieże. Z poprawnie obliczoną perspektywą: jako kolorowanka albo w kolorze.'
      },
      {
        title: 'Obrazy',
        description: 'Piktogramy ARASAAC, zdjęcia z Wikimedia Commons albo twoje własne obrazy – informacja o licencji pojawia się automatycznie pod spodem.'
      },
      {
        title: 'Diagramy informatyczne',
        description: 'Diagramy klas, sekwencji, stanów, aktywności i przypadków użycia w UML, automaty skończone, schematy Nassi-Shneidermana, schematy blokowe i diagramy ER.'
      },
      {
        title: 'Pięciolinie i teksty piosenek',
        description: 'Melodie, puste pięciolinie i teksty piosenek jako obrazy gotowe do druku. Niemieckie nazwy dźwięków (h, fis, b) są niezawodnie konwertowane.'
      },
      {
        title: 'Strona i styl szkoły',
        description: 'A4, A5 lub Letter, układ pionowy lub poziomy, marginesy, kolumny, nagłówek z nazwą szkoły i logo, stopka z numerami stron.'
      },
      {
        title: 'Sprawdzone, z kartą rozwiązań',
        description: 'Po utworzeniu AI sprawdza numerację, polecenia, miejsce na odpowiedzi, punkty i czytelność dla danego poziomu klasy. Na życzenie dostajesz rozwiązanie w tym samym układzie.'
      },
      {
        title: 'Poprawiaj zamiast zaczynać od nowa',
        description: '„Przeformułuj zadanie 1 dla klasy 3”, „Zamień zadanie 2 na tekst z lukami” – AI zmienia tylko to, o co prosisz. Usuwanie wymaga twojego potwierdzenia.'
      },
      {
        title: 'Twój asystent AI przez MCP',
        description: 'Claude, ChatGPT, Le Chat i inni edytują otwarty dokument tymi samymi narzędziami – bez klucza AI we wtyczce.'
      },
      {
        title: 'Prywatność w twoich rękach',
        description: 'Mistral jako dostawca z UE, lokalny model przez Ollama albo w ogóle bez AI. Klucz zostaje na serwerze, logowanie kontem Nextcloud.'
      }
    ],
    more: 'Więcej'
  },
  designs: {
    headline: 'Projekty',
    title: 'Jeden projekt dla całej karty',
    description:
      'AI wybiera tylko projekt – czcionki, rozmiary, kolory i odstępy wszystkiego, co wstawia asystent, pochodzą właśnie z niego. Dzięki temu każda karta wygląda spójnie, także gdy później dodasz kolejne zadania.',
    themes: [
      { title: 'Klasyczny', description: 'Czarno-biały i oszczędzający toner – do kopii i sprawdzianów.' },
      { title: 'Nowoczesny', description: 'Wyraźna czcionka z niebieskim akcentem – dla starszych klas.' },
      { title: 'Szkoła podstawowa', description: 'Duża czcionka, interlinia 1,5, przyjazne kolory.' }
    ],
    imageAlt: 'Ta sama karta pracy „Der Igel im Herbst” (Jeż jesienią) w projekcie „{theme}”',
    items: [
      { title: 'Nagłówki zadań', description: 'Numer, ikony formy pracy i rodzaju czynności, gwiazdki trudności, punkty i czas pracy.' },
      { title: 'Ramki informacyjne', description: 'Zapamiętaj, wskazówka, uwaga, przykład, definicja, rozwiązanie i informacja – każda z ikoną.' },
      { title: 'W twoim języku', description: 'Opisy takie jak imię, klasa, bank słów czy prawda/fałsz w siedmiu językach.' }
    ]
  },
  tasks: {
    headline: 'Zadania',
    title: 'Zadania, które wyglądają jak trzeba',
    description:
      'Ponad 40 elementów, które AI dowolnie łączy. Łamigłówki są obliczane, a nie zgadywane – krzyżówki i wykreślanki zawsze da się rozwiązać.',
    imageAlt: 'Strona z zadaniami w projekcie „Nowoczesny”: obliczona krzyżówka z hasłami poziomo i pionowo oraz wykreślanka z listą słów',
    items: [
      { title: 'Teksty z lukami i quizy', description: 'Tekst z lukami z automatycznym bankiem słów, wielokrotny wybór, tabela prawda/fałsz, łączenie liniami lub literami.' },
      { title: 'Łamigłówki', description: 'Krzyżówki i wykreślanki w trzech poziomach trudności – na życzenie z rozwiązaniem.' },
      { title: 'Czytanie i pisanie', description: 'Teksty do czytania z numerami wierszy, **kolorowanie sylab** (sylaby na przemian na niebiesko i czerwono), niemieckie linie do pisania dla szkoły podstawowej (Lineatur 1–4) i papier w kratkę.' },
      { title: 'Wokół zadania', description: 'Samoocena z buźkami, karty z podpowiedziami do wycinania, tabela punkty–oceny, kody QR i układ dwu- lub trzykolumnowy.' }
    ]
  },
  graphics: {
    headline: 'Grafiki i wzory',
    title: 'Matematyka i przyroda, czysto narysowane',
    description:
      'Grafiki są rysowane na podstawie danych, a nie wymyślane jako obraz: osie, skale i opisy się zgadzają. Każda grafika ma swoje źródło w tekście alternatywnym – AI może ją później zmienić.',
    imageAlt: 'Karta pracy z matematyki: oś liczbowa z lukami, wykres słupkowy, układ współrzędnych z trójkątem i wzór na pole powierzchni',
    items: [
      { title: 'Oś liczbowa i układ współrzędnych', description: 'Z lukami do uzupełnienia, punktami, odcinkami i wielokątami.' },
      { title: 'Wykresy', description: 'Kolumnowe, słupkowe, liniowe i kołowe – także puste do samodzielnego narysowania.' },
      { title: 'Wzory', description: 'LaTeX staje się prawdziwym równaniem w dokumencie, także w środku zdania.' },
      { title: 'Mapy myśli i rysunki', description: 'Mapy myśli (także z pustymi dymkami) i proste rysunki, które AI sama projektuje.' },
      { title: 'Sceny 3D', description: 'Sceny z sześcianów, walców, stożków i innych brył, obliczane zamiast rysowane: kolorowanka bez linii niewidocznych, ta sama scena w kolorze jako rozwiązanie albo rzut ukośny z krawędziami niewidocznymi narysowanymi linią przerywaną.' }
    ]
  },
  pictures: {
    headline: 'Obrazy',
    title: 'Obrazy, które pasują do karty',
    description:
      'Zwłaszcza w szkole podstawowej i specjalnej obrazy pomagają w rozumieniu. AI wyszukuje pasujące obrazy i umieszcza je na karcie – obok słów, na początek zadania albo w kolumnach obok tekstu. Informację o licencji drukuje automatycznie pod spodem.',
    imageAlt: 'Karta pracy „Tiere im Wald” (Zwierzęta w lesie) w projekcie „Szkoła podstawowa”: piktogramy ARASAAC przedstawiające jeża, sowę, zająca, wiewiórkę, lisa i kruka z informacją o licencji, pod nimi nazwy zwierząt z kolorowaniem sylab i linia do pisania dla szkoły podstawowej',
    items: [
      { title: 'Piktogramy', description: 'ARASAAC – proste, jednolite rysunki rzeczy, zwierząt, czynności i uczuć, stworzone z myślą o szkole specjalnej.' },
      { title: 'Zdjęcia i obrazy historyczne', description: 'Wikimedia Commons – zwierzęta, rośliny, miejsca, sztuka, Rzymianie i średniowiecze.' },
      { title: 'Twoje własne obrazy', description: 'Folder w twoim Nextcloud lub na twoim komputerze, np. z obrazami komiksowymi do nauki łaciny. AI znajduje je po nazwach plików i folderów.' }
    ]
  },
  informatics: {
    badge: 'Nowość',
    headline: 'Informatyka',
    title: 'UML, schematy Nassi-Shneidermana i diagramy ER',
    description:
      'AI opisuje tylko model, a układ jest obliczany: ramki i strzałki stoją równo i czytelnie, w notacji szkolnej jak w podręczniku. Dziesięć rodzajów diagramów – każdy także jako diagram z lukami z kartą rozwiązań.',
    diagrams: [
      { title: 'Diagram klas do uzupełnienia', description: 'Atrybut jako linia do pisania, metoda jako pusty wiersz, dziedziczenie dla klasy Sparkonto do samodzielnego narysowania.' },
      { title: 'Diagram sekwencji', description: 'Aktor i obiekty, wywołania, odpowiedź, paski aktywacji i fragment alt.' },
      { title: 'Automat skończony', description: 'Strzałka startowa, stan akceptujący jako podwójne kółko, przejścia ze znakami.' },
      { title: 'Schemat Nassi-Shneidermana', description: 'Według DIN 66261: rozgałęzienie i pętla (NWD metodą Euklidesa).' },
      { title: 'Schemat blokowy', description: 'Według DIN 66001: start, wejście i wyjście, rozgałęzienie z odpowiedziami ja/nein (tak/nie), koniec.' },
      { title: 'Diagram ER', description: 'Notacja Chena z atrybutami kluczowymi i kardynalnościami 1:n i n:m.' }
    ],
    items: [
      { title: 'Dziesięć rodzajów diagramów', description: 'Diagramy klas, obiektów, sekwencji, stanów, aktywności i przypadków użycia, automaty skończone, schematy Nassi-Shneidermana, schematy blokowe i diagramy ER (Chen, (min,max), „kurza stopka”).' },
      { title: 'Do uzupełnienia', description: 'Luki w każdym tekście, brakujące strzałki i związki, puste wiersze i ramki – a jednym zdaniem także rozwiązanie w tym samym układzie.' },
      { title: 'Pasuje na kartę', description: 'Układ jest obliczany i dopasowywany do szerokości tekstu. Jak wszystkie grafiki, każdy diagram można zmienić przez czat.' }
    ]
  },
  music: {
    headline: 'Muzyka',
    title: 'Muzyczne karty pracy – nawet całkiem bez AI',
    description:
      'Zakładka muzyczna działa bez serwera i bez klucza API: szablony, edytor ABC z podglądem na żywo, niemieckie nazwy dźwięków i teksty piosenek. Zaznaczoną pięciolinię można wczytać, zmienić i podmienić.',
    imageAlt: 'Zakładka muzyczna: szablon „Alle meine Entchen” z tekstem, notacją ABC i podglądem, wstawiony pod zadaniem w projekcie „Nowoczesny”',
    items: [
      { title: 'Szablony', description: 'Puste pięciolinie z kluczem wiolinowym lub basowym, gamy, przykładowa melodia z tekstem.' },
      { title: 'Przeliczanie nazw dźwięków', description: 'c – f – g, fis′ g′ a′ h′, „bc” jako ces i oznaczenia metrum, np. 4/4 – cyfry jako oktawa lub wartość rytmiczna.' },
      { title: 'Gotowe do druku i edytowalne', description: 'Obrazy w 300 dpi; kod źródłowy ABC jest zapisany w tekście alternatywnym. Przez czat: „Zmień pięciolinię 1: zamiast bc #c”.' }
    ]
  },
  mcp: {
    headline: 'MCP',
    title: 'Twój asystent AI pisze razem z tobą',
    description:
      'Dzięki Model Context Protocol Claude, ChatGPT, Le Chat i inni asystenci AI pracują bezpośrednio w dokumencie, który masz otwarty w Euro-Office. Wtyczka wprowadza zmiany – widzisz je od razu i możesz je cofnąć skrótem Ctrl+Z.',
    imageAlt: 'Asystent AI dodał przez MCP trzecie zadanie z piosenką „Es regnet” jako pięciolinią; panel pokazuje wywołania MCP',
    items: [
      { title: 'Te same narzędzia', description: 'Wszystkie elementy, obrazy, diagramy, układ strony, sprawdzanie, edycja i pięciolinie – sprawdzane, zanim cokolwiek trafi do dokumentu.' },
      { title: 'Tylko twoje dokumenty', description: 'Przy logowaniu przez Nextcloud asystent ma dostęp tylko do dokumentów swojego użytkownika.' },
      { title: 'Kontrola pozostaje u ciebie', description: 'Dokument zostaje połączony dopiero po włączeniu „MCP-Zugriff erlauben” (zezwól na dostęp MCP) we wtyczce. Dostęp możesz cofnąć w Nextcloud.' }
    ],
    clientsTitle: 'Przetestowano',
    clientsText: 'Z MCP TypeScript SDK (protokół 2026-07-28) i zapytaniami w formacie z 2025 r., przez HTTP i stdio. Hostowani asystenci, tacy jak claude.ai, ChatGPT i Le Chat, nie zostali jeszcze przetestowani z publiczną instalacją.'
  },
  companion: {
    headline: 'Desktop',
    title: 'Aplikacja Worksheet Assistant na twój komputer',
    description:
      'Aplikacje desktopowe Euro-Office i Nextcloud Office nie mają menedżera wtyczek ani serwera. Aplikacja Worksheet Assistant zapewnia jedno i drugie: instalujesz ją jak każdą inną aplikację, uruchamiasz raz – a potem działa niewidocznie w tle. Bez terminala, bez przeglądarki.',
    imageAlt: 'Okno aplikacji Worksheet Assistant, strona „Übersicht” (przegląd): wszystkie trzy kroki wykonane – wtyczka w aplikacji desktopowej, czat AI we wtyczce, Claude podłączony',
    items: [
      { title: 'Wtyczka konfiguruje się sama', description: 'Instaluje wtyczkę w Euro-Office i Nextcloud Office, podłącza ją i dba o jej aktualizacje – bez żadnych ustawień w edytorze.' },
      { title: 'Twoja AI, twoje obrazy', description: 'Mistral, OpenAI, Anthropic, Ollama lub dowolne API zgodne z OpenAI – klucz zostaje na twoim komputerze. Do tego własny folder z obrazami.' },
      { title: 'Claude jednym kliknięciem', description: 'Podłącza Claude Desktop lub Claude Code. Nowe wersje aplikacja instaluje jednym kliknięciem; na życzenie uruchamia się razem z komputerem. Na macOS poświadczona notarialnie przez Apple.' }
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
        bullets: ['Instalacja jednym poleceniem (Nextcloud AIO)', 'Przetrwa aktualizacje AIO', 'Własne obrazy w folderze Nextcloud'],
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
    groups: [
      {
        label: 'Karty pracy',
        items: [
          'Przygotuj kartę pracy o obiegu wody w przyrodzie dla klasy 5 z trzema zadaniami, tekstem z lukami i ramką informacyjną.',
          'Zrób z tego krzyżówkę z dziesięcioma hasłami i dodaj na końcu stronę z rozwiązaniami.',
          'Przeformułuj polecenie w zadaniu 1 tak, żeby zrozumieli je uczniowie klasy 3.',
          'Użyj projektu Klasyczny i wpisz nazwę naszej szkoły w nagłówku, a numery stron w stopce.',
          'Kolorowanka dla klasy 2: miasto zbudowane z brył geometrycznych z poleceniem, aby pokolorować wszystkie sześciany na czerwono, a wszystkie walce na zielono – a na stronie z rozwiązaniami to samo miasto w kolorze.',
          'Sprawdź kartę i usuń zadanie 3.'
        ]
      },
      {
        label: 'Obrazy i diagramy',
        items: [
          'Karta do czytania dla klasy 1 o zwierzętach w lesie – z piktogramem obok każdego słowa i kolorowaniem sylab.',
          'Wstaw zdjęcie rzymskiego legionisty obok tekstu.',
          'Narysuj sześcian, prostopadłościan i walec w rzucie ukośnym, z krawędziami niewidocznymi zaznaczonymi linią przerywaną.',
          'Narysuj diagram klas UML dla klas Konto, KontoBieżące i KontoOszczędnościowe, w którym uczniowie uzupełnią dziedziczenie.',
          'Zrób schemat Nassi-Shneidermana dla algorytmu Euklidesa, a pod nim pusty schemat blokowy do uzupełnienia.',
          'Diagram ER dla uczniów, kursów i nauczycieli w notacji Chena.'
        ]
      },
      {
        label: 'Muzyka',
        items: [
          'Pod zadaniem 2 wstaw pięciolinię z c – f – g, a pod nią pustą pięciolinię do przepisania nut.',
          'Potrzebuję pięciolinii: 4/4 bc1, f1, g2, be2, c1, c1',
          'Proszę, zmień pięciolinię 1: zamiast bc #c',
          'Dodaj tekst do pięciolinii 1: Wlazł kotek na płotek',
          'Po zadaniu 3 wstaw trzy puste pięciolinie z kluczem basowym.'
        ]
      }
    ]
  },
  parts: {
    headline: 'Co działa gdzie',
    title: 'Jedna wtyczka, jeden mały serwer – i AI, którą wybierzesz',
    description: 'Wtyczka nie potrzebuje własnego serwera. Czat AI, obrazy i MCP wymagają dodatkowo małej usługi – na serwerze albo w aplikacji Worksheet Assistant na twoim komputerze.',
    items: [
      {
        title: 'Wtyczka',
        badge: 'zawsze',
        description: 'Same pliki (≈ 2 MB) w folderze wtyczek Euro-Office. Działa w edytorze w przeglądarce lub w aplikacji desktopowej.',
        bullets: ['Układa karty pracy, grafiki i diagramy', 'Rysuje pięciolinie, pełna zakładka muzyczna', 'Wykonuje wywołania MCP w dokumencie']
      },
      {
        title: 'Serwer',
        badge: 'do czatu AI, obrazów i MCP',
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
        description: 'Serwer przechowuje klucz AI, wyszukuje obrazy i udostępnia endpoint MCP. Zadbaj, by był dostępny przez HTTPS, np. pod adresem `https://worksheets.your-school.org`. Z `AUTH_MODE=nextcloud` każdy nauczyciel loguje się swoim kontem Nextcloud.',
        codeLabel: 'Shell'
      },
      {
        title: 'Zaloguj się w edytorze',
        description: 'Otwórz dokument → **Plugins** → **Asystent kart pracy** → **Einstellungen** (ustawienia): wpisz adres serwera i kliknij **Mit Nextcloud anmelden** (zaloguj przez Nextcloud). Gotowe. Własne obrazy umieszczasz w folderze `Arbeitsblatt-Bilder` w swoim Nextcloud.'
      }
    ],
    desktop: [
      { title: 'Zainstaluj Euro-Office', description: 'Zainstaluj aplikację desktopową Euro-Office lub Nextcloud Office dla Windows, macOS lub Linux i uruchom ją jeden raz.' },
      {
        title: 'Zainstaluj aplikację Worksheet Assistant',
        description: 'Pobierz instalator dla swojego systemu i zainstaluj aplikację jak każdą inną (macOS: przeciągnij ją do folderu **Aplikacje**); nazywa się **Worksheet Assistant**. Po uruchomieniu otwiera się jej okno: aplikacja konfiguruje wtyczkę i działa niewidocznie w tle. Na macOS aplikacja jest poświadczona notarialnie przez Apple. W systemie Windows nie jest jeszcze podpisana – jeśli SmartScreen wyświetli ostrzeżenie: **Więcej informacji → Uruchom mimo to**.'
      },
      {
        title: 'Wybierz AI',
        description: 'W aplikacji na stronie **KI-Chat** (czat AI) wpisz dostawcę i klucz API – albo wybierz lokalny model przez Ollama lub samo MCP. Na stronie **Bilder** (obrazy) wybierasz własny folder z obrazami. Potem otwórz dokument w Euro-Office: **Plugins → Asystent kart pracy**. Okno możesz zamknąć – aplikacja działa dalej w zasobniku systemowym (macOS: na pasku menu).'
      }
    ],
    docker: [
      { title: 'Zbuduj wtyczkę', description: 'Pobierz archiwum z wydania albo zbuduj wtyczkę samodzielnie.', codeLabel: 'Shell' },
      {
        title: 'Uruchom Document Server i serwer',
        description: '`deploy/` uruchamia Euro-Office z wtyczką jako wolumenem oraz serwer. Nextcloud korzysta potem z Document Server jako serwera zewnętrznego.',
        codeLabel: 'Shell'
      },
      { title: 'Skonfiguruj edytor', description: 'We wtyczce w **Einstellungen** (ustawienia) wpisz adres serwera i token (albo zaloguj się przez Nextcloud) i kliknij „Verbindung testen” (testuj połączenie).' }
    ],
    mcp: [
      {
        title: 'Połącz dokument',
        description: 'W otwartym dokumencie włącz **Plugins → Asystent kart pracy → Einstellungen → MCP-Zugriff erlauben** (ustawienia → zezwól na dostęp MCP) – z aplikacją Worksheet Assistant jest już włączone. Panel pokazuje adres MCP.'
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
          'Sama wtyczka nie – to tylko pliki udostępniane przez Euro-Office. Czat AI, wyszukiwanie obrazów i MCP wymagają małego serwera; na twoim komputerze jego rolę przejmuje aplikacja Worksheet Assistant. Zakładka muzyczna działa całkowicie bez serwera.'
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
        label: 'Skąd pochodzą obrazy – i czy mogę z nich korzystać?',
        content:
          'Z trzech źródeł: piktogramy ARASAAC (CC BY-NC-SA, swobodnie do użytku w szkole), Wikimedia Commons (wolne licencje) i twój własny folder z obrazami. Autor i licencja obrazów na wolnych licencjach pojawiają się automatycznie pod obrazem. Serwer odpytuje tylko stałe adresy ARASAAC i Wikimedia oraz twój folder – AI nigdy sama nie podaje adresów. Za pomocą `IMAGE_SOURCES` lub w aplikacji wyłączysz obrazy z internetu.'
      },
      {
        label: 'Jakie diagramy informatyczne są dostępne?',
        content:
          'Diagramy klas, obiektów, sekwencji, stanów, aktywności i przypadków użycia w UML, automaty skończone (deterministyczne i niedeterministyczne), schematy Nassi-Shneidermana według DIN 66261, schematy blokowe według DIN 66001 oraz diagramy ER w notacji Chena, (min,max) lub „kurzej stopki”. Każdy diagram jest dostępny także do uzupełnienia i z rozwiązaniem.'
      },
      {
        label: 'Czym jest MCP?',
        content:
          'Model Context Protocol to otwarty standard, dzięki któremu asystenci AI mogą korzystać z narzędzi. Serwer udostępnia narzędzia wtyczki – dzięki temu np. Claude edytuje twój otwarty dokument tak samo jak czat we wtyczce.'
      },
      {
        label: 'Jak logują się nauczyciele?',
        content:
          'Z `AUTH_MODE=nextcloud` swoim kontem Nextcloud: we wtyczce jednym kliknięciem (Nextcloud Login Flow), asystenci AI przez OAuth w Nextcloud lub hasłem aplikacji. Każdy ma dostęp tylko do własnych dokumentów i obrazów; dostęp można cofnąć w Nextcloud w sekcji Urządzenia i sesje.'
      },
      {
        label: 'Czy to działa bez Nextcloud?',
        content: 'Tak: z aplikacją desktopową Euro-Office lub Nextcloud Office i aplikacją Worksheet Assistant albo z własnym Euro-Office Document Server i wspólnym tokenem dostępu.'
      },
      {
        label: 'Czy mogę później zmienić wstawione treści?',
        content:
          'Tak. AI odczytuje treść i zastępuje dokładnie te fragmenty, które wskażesz. Grafiki, diagramy, obrazy i pięciolinie przechowują swoje źródło w tekście alternatywnym i można je zmieniać przez czat; pięciolinie także w zakładce muzycznej.'
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
          'Tak, na licencji MIT. W zestawie są abcjs, dagre, qrcode-generator i three.js (wszystkie MIT) oraz pliki wtyczek ONLYOFFICE (AGPL-3.0); aplikacja Worksheet Assistant zawiera Node.js i pakiety npm – wszystko wraz z tekstami licencji.'
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
    uses: 'korzysta z abcjs, dagre, qrcode-generator i three.js (MIT) oraz ONLYOFFICE Plugin SDK (AGPL-3.0) · Piktogramy: Sergio Palao, ARASAAC (CC BY-NC-SA)',
    copy: 'Kopiuj',
    copied: 'Skopiowano',
    zoom: 'Otwórz obraz w pełnym rozmiarze'
  }
}

export default pl
