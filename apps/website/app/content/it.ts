import type { SiteContent } from './types'

const it: SiteContent = {
  meta: {
    title: 'Worksheet Assistant per Euro-Office',
    description:
      'Crea schede didattiche con l’IA – per ogni materia, in Nextcloud, nell’app desktop o con Claude & co. tramite MCP. Open source.'
  },
  nav: { features: 'Funzionalità', ways: 'Casi d’uso', mcp: 'MCP', demo: 'Demo dal vivo', install: 'Installazione', faq: 'FAQ', language: 'Lingua' },
  hero: {
    badge: 'Open source · MIT',
    headline: 'Plugin IA per Euro-Office – in Nextcloud e sul desktop',
    title: 'Crea schede didattiche con l’IA – per ogni materia',
    description:
      'Descrivi ciò che ti serve: Worksheet Assistant (l’assistente per le schede didattiche) impagina esercizi, testi da completare, cruciverba, tabelle, grafici, formule, righe per scrivere, riquadri informativi e pentagrammi con un design uniforme, direttamente nel tuo documento – con la chat IA integrata o con il tuo assistente IA tramite MCP.',
    install: 'Installa',
    more: 'Come funziona',
    imageAlt:
      'Euro-Office con Worksheet Assistant: una scheda sul ciclo dell’acqua creata con la chat IA, a sinistra la chat con la richiesta'
  },
  features: {
    headline: 'Funzionalità',
    title: 'Dal foglio bianco alla scheda finita',
    description: 'Pensato per insegnanti e futuri insegnanti – per schede, verifiche e dispense in ogni materia.',
    items: [
      {
        title: 'Schede curate nel design via chat',
        description:
          '«Crea una scheda sul ciclo dell’acqua per la classe terza»: titolo, esercizi numerati con icone e punti, testo da completare con banca di parole, cruciverba, grafico e riquadro informativo – in un design (moderno, scuola primaria, classico) e poi verificata automaticamente.'
      },
      {
        title: 'Modifica invece di ricominciare',
        description:
          '«Riformula l’esercizio 1 per la classe terza», «Trasforma l’esercizio 2 in un testo da completare», «Aggiungi una pagina con le soluzioni» – l’IA cambia solo ciò che chiedi. Per eliminare serve la tua conferma.'
      },
      {
        title: 'Pentagrammi e testi delle canzoni',
        description:
          'Melodie, pentagrammi vuoti e testi come immagini pronte per la stampa. I nomi tedeschi delle note (h, fis, b) vengono convertiti in modo affidabile; ogni pentagramma resta modificabile.'
      },
      {
        title: 'Il tuo assistente IA tramite MCP',
        description: 'Claude, ChatGPT, Le Chat e altri modificano il documento aperto con gli stessi strumenti – senza chiave IA nel plugin.'
      },
      {
        title: 'La privacy nelle tue mani',
        description: 'Mistral come fornitore europeo, un modello locale tramite Ollama o nessuna IA. La chiave resta sul server e l’accesso avviene con l’account Nextcloud.'
      },
      {
        title: 'Nextcloud, server o desktop',
        description:
          'Un solo comando per Nextcloud AIO, un file Docker Compose per il tuo Document Server oppure l’app Worksheet Assistant per l’app desktop di Euro-Office (Windows, macOS, Linux).'
      }
    ]
  },
  ways: {
    headline: 'Casi d’uso',
    title: 'Tre modi – un solo plugin',
    description: 'Scegli dove lavori e quale IA vuoi usare. Puoi combinare tutti i modi.',
    items: [
      {
        title: 'In Nextcloud',
        badge: 'per le scuole',
        description: 'Il plugin nell’Euro-Office di Nextcloud, con il piccolo server accanto. Ogni insegnante accede con il proprio account Nextcloud.',
        bullets: ['Installazione con un solo comando (Nextcloud AIO)', 'Resta installato dopo gli aggiornamenti di AIO', 'Chiave IA solo sul server'],
        link: 'Installa in Nextcloud'
      },
      {
        title: 'Sul tuo computer',
        badge: 'Windows · macOS · Linux',
        description: 'L’app desktop di Euro-Office o Nextcloud Office con l’app Worksheet Assistant – si installa come qualsiasi altra app, senza un server tuo.',
        bullets: ['Installa e aggiorna il plugin da sola', 'La tua chiave API o un modello locale', 'Collega Claude Desktop con un clic'],
        link: 'Scarica l’app'
      },
      {
        title: 'Con il tuo assistente IA',
        badge: 'MCP',
        description: 'Claude, ChatGPT, Le Chat o un altro client MCP lavora direttamente nel documento aperto.',
        bullets: ['Gli stessi strumenti della chat', 'Accesso tramite Nextcloud (OAuth) o password per le app', 'In locale senza accesso'],
        link: 'Configura MCP'
      }
    ]
  },
  prompts: {
    headline: 'Esempi',
    title: 'Come parlare con Worksheet Assistant',
    description: 'Bastano frasi normali. L’IA conosce la struttura del tuo documento e risponde nella tua lingua.',
    worksheetLabel: 'Schede didattiche',
    musicLabel: 'Musica',
    worksheet: [
      'Crea una scheda sul ciclo dell’acqua per la classe quinta con tre esercizi, una tabella e un riquadro informativo.',
      'Riformula la consegna dell’esercizio 1 in modo che la capiscano gli alunni di terza.',
      'Trasforma l’esercizio 2 in un testo da completare con 8 spazi vuoti.',
      'Aggiungi alla fine una pagina con le soluzioni.',
      'Elimina l’esercizio 3.'
    ],
    music: [
      'Sotto l’esercizio 2 inserisci un pentagramma con c – f – g e, sotto, un pentagramma vuoto per ricopiare.',
      'Mi serve un pentagramma: 4/4 bc1, f1, g2, be2, c1, c1',
      'Modifica il pentagramma 1, per favore: al posto di bc #c',
      'Aggiungi il testo al pentagramma 1: Fra Martino campanaro',
      'Dopo l’esercizio 3 inserisci tre pentagrammi vuoti in chiave di basso.'
    ]
  },
  mcp: {
    headline: 'MCP',
    title: 'Il tuo assistente IA scrive con te',
    description:
      'Con il Model Context Protocol, Claude, ChatGPT, Le Chat e altri assistenti IA lavorano direttamente nel documento che hai aperto in Euro-Office. Il plugin applica le modifiche – le vedi subito e puoi annullarle con Ctrl+Z.',
    imageAlt: 'Un assistente IA ha aggiunto tramite MCP un esercizio extra con pentagramma e testo; la chat del plugin mostra le chiamate MCP',
    items: [
      { title: 'Gli stessi strumenti', description: 'Blocchi della scheda, modifica, eliminazione, pentagrammi e testi – tutto viene controllato prima di arrivare nel documento.' },
      { title: 'Solo i tuoi documenti', description: 'Con l’accesso tramite Nextcloud, un assistente raggiunge solo i documenti del proprio utente.' },
      { title: 'Il controllo resta a te', description: 'Il documento si collega solo se attivi «Allow MCP access» nel plugin. L’accesso lo revochi in Nextcloud.' }
    ],
    clientsTitle: 'Testato',
    clientsText: 'Con l’SDK TypeScript di MCP (protocollo 2026-07-28) e richieste in formato 2025, via HTTP e stdio. Claude, ChatGPT e Le Chat non sono ancora stati collegati.'
  },
  companion: {
    headline: 'Desktop',
    title: 'L’app Worksheet Assistant per il tuo computer',
    description:
      'Le app desktop di Euro-Office e Nextcloud Office non hanno né un gestore di plugin né un server. L’app Worksheet Assistant si occupa di entrambe le cose: si installa come qualsiasi altra app, la avvii una volta – e poi lavora in modo invisibile in background. Niente terminale, niente browser.',
    imageAlt: 'Finestra dell’app Worksheet Assistant, pagina «Übersicht» (panoramica): tutti e tre i passaggi completati – plugin nell’app desktop, chat IA nel plugin, Claude collegato',
    items: [
      { title: 'Plugin configurato in automatico', description: 'Installa il plugin in Euro-Office e Nextcloud Office, lo collega e lo mantiene aggiornato – nessuna impostazione nell’editor.' },
      { title: 'La tua IA', description: 'Mistral, OpenAI, Anthropic, Ollama o qualsiasi API compatibile con OpenAI – la chiave resta sul tuo computer.' },
      { title: 'Claude con un clic', description: 'Collega Claude Desktop o Claude Code con un clic. L’app segnala da sola le nuove versioni e, se vuoi, si avvia insieme al computer.' }
    ]
  },
  music: {
    headline: 'Musica',
    title: 'Schede di musica – anche senza IA',
    description:
      'La sezione musica funziona senza server e senza chiave API: modelli, editor ABC con anteprima dal vivo, nomi tedeschi delle note e testi. Un pentagramma selezionato si può caricare, modificare e sostituire.',
    imageAlt: 'Sezione musica: modello «Alle meine Entchen» con testo, notazione ABC e anteprima',
    items: [
      { title: 'Modelli', description: 'Pentagrammi vuoti in chiave di violino o di basso, scale, una melodia di esempio con testo.' },
      { title: 'Conversione dei nomi delle note', description: 'c – f – g, fis′ g′ a′ h′, «bc» per do bemolle e indicazioni di tempo come 4/4 – i numeri come ottava o come valore della nota.' },
      { title: 'Pronti per la stampa e modificabili', description: 'Immagini a 300 dpi; il sorgente ABC è salvato nel testo alternativo.' }
    ]
  },
  demo: {
    headline: 'Demo dal vivo',
    title: 'Prova il convertitore dei nomi delle note',
    description: 'Scrivi i nomi delle note in tedesco – il pentagramma appare subito. È lo stesso convertitore che il plugin usa nell’editor.',
    loading: 'Caricamento della demo…',
    notesLabel: 'Nomi delle note (tedeschi)',
    notesHelp: 'es. c – f – g, fis′ g′ a′ h′, bc = do bemolle, 4/4 = tempo',
    clefLabel: 'Chiave',
    treble: 'Chiave di violino',
    bass: 'Chiave di basso',
    digitsLabel: 'Numeri',
    digitsAuto: 'Numeri: automatico',
    digitsOctave: 'Numeri = ottava (c1 = c′)',
    digitsDuration: 'Numeri = valore della nota (c1 = semibreve)',
    lyricsLabel: 'Testo (facoltativo)',
    lyricsHelp: 'Separa le sillabe con -: Fra Mar-ti-no cam-pa-na-ro',
    showAbc: 'Mostra la notazione ABC',
    paperLoading: 'Caricamento del pentagramma…',
    examples: ['c – f – g', 'Hänschen klein', 'Valori delle note', 'Chiave di basso'],
    noteCount: '{n} note',
    readAsDurations: 'numeri letti come valori delle note',
    readAsOctaves: 'numeri letti come ottave',
    meterInfo: 'Tempo {meter}, {bars} battute',
    issues: {
      unknownName: '«{token}» non è un nome di nota conosciuto.',
      doubleAccidental: '«{token}» ha due alterazioni.',
      farFromStaff: '«{token}» ({octave}) è molto al di fuori del pentagramma.',
      incompleteBar: 'Le note non riempiono battute complete in {meter} ({bars} battute).',
      tooManySyllables: 'Il testo ha più sillabe di quante note abbia la melodia.',
      tooFewSyllables: 'Il testo non basta per tutte le note – le restanti rimangono senza testo.'
    }
  },
  parts: {
    headline: 'Cosa gira e dove',
    title: 'Un plugin, un piccolo server – e l’IA che preferisci',
    description: 'Il plugin non ha bisogno di un proprio server. Per la chat IA e MCP si aggiunge un piccolo servizio – sul server o nell’app Worksheet Assistant sul tuo computer.',
    items: [
      {
        title: 'Plugin',
        badge: 'sempre',
        description: 'Solo file (≈ 1 MB) nella cartella dei plugin di Euro-Office. Funziona nell’editor nel browser o nell’app desktop.',
        bullets: ['Inserisce e modifica contenuti', 'Disegna pentagrammi, sezione musica completa', 'Esegue le chiamate MCP nel documento']
      },
      {
        title: 'Server',
        badge: 'per chat IA e MCP',
        description: 'Un piccolo servizio (Docker, ≈ 30 MB di RAM) accanto a Nextcloud – oppure in background nell’app Worksheet Assistant sul tuo computer.',
        bullets: ['La chiave API resta sul server', 'Accesso tramite Nextcloud, limite di richieste', 'Controlla i contenuti prima che arrivino nel documento']
      },
      {
        title: 'Modello linguistico',
        badge: 'opzionale',
        description: 'Mistral (predefinito), OpenAI, Anthropic, qualsiasi API compatibile con OpenAI come Ollama – oppure il tuo assistente IA tramite MCP.',
        bullets: ['Sostituibile senza modificare il plugin', 'Possibile con fornitore europeo o in locale', 'I costi li paghi al fornitore']
      }
    ]
  },
  install: {
    headline: 'Installazione',
    title: 'Pronto in tre passaggi',
    description: 'Scegli la tua strada. Altre opzioni e tutte le impostazioni sono nel README.',
    tabs: { nextcloud: 'Nextcloud AIO', desktop: 'App desktop', docker: 'Server proprio', mcp: 'Assistente IA (MCP)' },
    nextcloud: [
      {
        title: 'Installa il plugin',
        description: 'Da eseguire sul server AIO. Lo script copia il plugin nel container di Euro-Office; con `--watch` lo reinstalla automaticamente dopo ogni aggiornamento di AIO.',
        codeLabel: 'Shell (server AIO)'
      },
      {
        title: 'Avvia il server',
        description: 'Custodisce la chiave IA e fornisce l’endpoint MCP. Rendilo raggiungibile via HTTPS, ad es. come `https://worksheets.your-school.org`. Con `AUTH_MODE=nextcloud` ogni insegnante accede con il proprio account Nextcloud.',
        codeLabel: 'Shell'
      },
      {
        title: 'Accedi nell’editor',
        description: 'Apri un documento → **Plugins** → **Worksheet Assistant** → **Settings**: inserisci l’indirizzo del server e clicca su **Sign in with Nextcloud**. Fatto.'
      }
    ],
    desktop: [
      { title: 'Installa Euro-Office', description: 'Installa l’app desktop di Euro-Office o Nextcloud Office per Windows, macOS o Linux e avviala una volta.' },
      {
        title: 'Installa l’app Worksheet Assistant',
        description: 'Scarica il programma di installazione per il tuo sistema e installa l’app come qualsiasi altra (macOS: trascinala in **Applicazioni**); si chiama **Arbeitsblatt-Assistent**. All’avvio si apre la sua finestra: configura il plugin e lavora in modo invisibile in background. Su macOS l’app è notarizzata da Apple. Su Windows non è ancora firmata – se SmartScreen mostra un avviso: **Ulteriori informazioni → Esegui comunque**.'
      },
      {
        title: 'Scegli la tua IA',
        description: 'Nell’app, alla pagina **KI-Chat** (chat IA), inserisci il fornitore e la chiave API – oppure un modello locale tramite Ollama, o solo MCP. Poi apri un documento in Euro-Office: **Plugins → Worksheet Assistant**. Puoi chiudere la finestra – l’app continua a funzionare nell’area di notifica (macOS: barra dei menu). Consiglio: attiva l’avvio automatico in **Einstellungen** (impostazioni).'
      }
    ],
    docker: [
      { title: 'Compila il plugin', description: 'Scarica l’archivio della release o compila il plugin da te.', codeLabel: 'Shell' },
      {
        title: 'Avvia il Document Server e il server',
        description: '`deploy/` avvia Euro-Office con il plugin come volume, insieme al server. Nextcloud usa poi il Document Server come server esterno.',
        codeLabel: 'Shell'
      },
      { title: 'Configura l’editor', description: 'Nelle **Settings** del plugin inserisci l’indirizzo del server e il token (o accedi con Nextcloud), poi clicca su «Test connection».' }
    ],
    mcp: [
      {
        title: 'Collega il documento',
        description: 'Nel documento aperto attiva **Plugins → Worksheet Assistant → Settings → Allow MCP access** (con l’app Worksheet Assistant è già attivo). Il pannello mostra l’indirizzo MCP.'
      },
      {
        title: 'Collega il tuo assistente IA',
        description: 'Aggiungi l’indirizzo MCP: in Claude, ChatGPT o Le Chat come connettore personalizzato (accesso tramite Nextcloud), in Claude Code con un comando. L’app Worksheet Assistant collega Claude Desktop e Claude Code con un clic (pagina **Claude & MCP**).',
        codeLabel: 'Claude Code'
      },
      { title: 'Inizia subito', description: '«Crea nel documento aperto una scheda sulle frazioni per la prima media» – le modifiche compaiono subito nell’editor.' }
    ],
    readme: 'Tutte le opzioni nel README'
  },
  faq: {
    headline: 'FAQ',
    title: 'Domande frequenti',
    items: [
      {
        label: 'Il plugin ha bisogno di un proprio server?',
        content:
          'Il plugin in sé no – sono solo file serviti da Euro-Office. La chat IA e MCP hanno bisogno del piccolo server; sul tuo computer questo ruolo lo svolge l’app Worksheet Assistant. La sezione musica funziona senza alcun server.'
      },
      {
        label: 'Quale IA viene usata?',
        content:
          'Quella che configuri tu: Mistral (fornitore europeo, predefinito), OpenAI, Anthropic, qualsiasi API compatibile con OpenAI o un modello locale tramite Ollama. Oppure nessuna – in quel caso usi il tuo assistente IA tramite MCP.'
      },
      {
        label: 'Quali dati vengono inviati all’IA?',
        content:
          'A ogni richiesta in chat, la conversazione e la struttura del documento (testi, pentagrammi in ABC). Il server non salva conversazioni né documenti. Con MCP il tuo assistente IA legge il documento attraverso gli strumenti. Se non vuoi che nulla esca dalla tua rete, usa un modello locale.'
      },
      {
        label: 'Che cos’è MCP?',
        content:
          'Il Model Context Protocol è uno standard aperto che permette agli assistenti IA di usare strumenti. Il server mette a disposizione gli strumenti del plugin – così, ad esempio, Claude modifica il tuo documento aperto come se avessi usato la chat del plugin.'
      },
      {
        label: 'Come accedono gli insegnanti?',
        content:
          'Con `AUTH_MODE=nextcloud`, con il proprio account Nextcloud: nel plugin con un clic (Nextcloud Login Flow), gli assistenti IA tramite OAuth con Nextcloud o con una password per le app. Ognuno raggiunge solo i propri documenti; l’accesso si può revocare in Nextcloud, in Dispositivi e sessioni.'
      },
      {
        label: 'Funziona anche senza Nextcloud?',
        content: 'Sì: con l’app desktop di Euro-Office o Nextcloud Office e l’app Worksheet Assistant, oppure con un tuo Document Server Euro-Office e un token di accesso condiviso.'
      },
      {
        label: 'Posso modificare in seguito i contenuti inseriti?',
        content:
          'Sì. L’IA legge i contenuti e sostituisce esattamente le parti che indichi. I pentagrammi conservano il loro sorgente ABC nel testo alternativo e si possono modificare via chat o nella sezione musica.'
      },
      {
        label: 'Cosa succede quando Nextcloud AIO si aggiorna?',
        content:
          'AIO ricrea il container di Euro-Office e così i plugin aggiunti vengono rimossi. Con `--watch` lo script di installazione configura un piccolo servizio che reinstalla automaticamente il plugin dopo ogni riavvio.'
      },
      {
        label: 'Come si aggiorna l’app?',
        content:
          'L’app Worksheet Assistant controlla regolarmente se c’è una nuova versione e la segnala nella sua finestra e nell’area di notifica (macOS: barra dei menu). Un clic la scarica e la installa – con il pacchetto .deb ricevi invece un link alla pagina di download. La nuova versione aggiorna automaticamente il plugin in Euro-Office.'
      },
      {
        label: 'Con cosa è stato testato?',
        content:
          'Con Euro-Office 9.3.8 (Document Server e app desktop su Linux), Nextcloud 34 e Mistral – in modo automatizzato nell’editor reale. L’app Worksheet Assistant viene compilata e verificata automaticamente per Windows, macOS e Linux. Gli assistenti ospitati come claude.ai non sono ancora stati testati con un’installazione pubblica.'
      },
      {
        label: 'È open source?',
        content:
          'Sì, con licenza MIT. Include abcjs (MIT) e i file del plugin ONLYOFFICE (AGPL-3.0); l’app Worksheet Assistant contiene Node.js e pacchetti npm – tutti con i rispettivi testi di licenza.'
      }
    ]
  },
  cta: {
    title: 'Tutto pronto per la tua prossima scheda?',
    description: 'Codice sorgente, release e documentazione dettagliata su GitHub.',
    repo: 'Vai al repository',
    releases: 'Releases'
  },
  footer: {
    license: 'Worksheet Assistant · licenza MIT',
    uses: 'usa abcjs (MIT) e l’SDK per plugin di ONLYOFFICE (AGPL-3.0)',
    copy: 'Copia',
    copied: 'Copiato'
  }
}

export default it
