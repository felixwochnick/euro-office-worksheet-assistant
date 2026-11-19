import type { SiteContent } from './types'

const it: SiteContent = {
  meta: {
    title: 'Worksheet Assistant per Euro-Office',
    description:
      'Crea schede didattiche con l’IA – per ogni materia: esercizi impaginati, giochi enigmistici, grafici, immagini, diagrammi di informatica e pentagrammi. In Nextcloud, nell’app desktop o con Claude & co. tramite MCP. Open source.'
  },
  nav: { features: 'Funzionalità', informatics: 'Informatica', ways: 'Casi d’uso', mcp: 'MCP', install: 'Installazione', faq: 'FAQ', language: 'Lingua' },
  hero: {
    badge: 'Novità in {version}: diagrammi di informatica',
    headline: 'Plugin IA per Euro-Office – in Nextcloud e sul desktop',
    title: 'Crea schede didattiche con l’IA – per ogni materia',
    description:
      'Descrivi ciò che ti serve: Worksheet Assistant (l’assistente per le schede didattiche) impagina esercizi, testi da completare, giochi enigmistici, grafici, formule, immagini, diagrammi UML e pentagrammi con un design uniforme, direttamente nel tuo documento – con la chat IA integrata o con il tuo assistente IA tramite MCP.',
    install: 'Installa',
    more: 'Tutte le funzionalità',
    imageAlt:
      'Euro-Office con Worksheet Assistant: una scheda sul ciclo dell’acqua nel design «Moderno», con intestazione, titolo, riga per il nome ed esercizi numerati con icone, stelle e punti; a sinistra il pannello con la chat IA'
  },
  features: {
    headline: 'Funzionalità',
    title: 'Tutto per la tua prossima scheda',
    description: 'Pensato per insegnanti e futuri insegnanti – per schede, verifiche e dispense in ogni materia. L’IA sceglie i blocchi, il plugin li inserisce in modo pulito nel documento.',
    items: [
      {
        title: 'Schede intere via chat',
        description: '«Crea una scheda sul ciclo dell’acqua per la classe quinta» – con titolo, riga per il nome, esercizi, materiale e riquadro informativo. Prima l’anteprima, poi l’inserimento.'
      },
      {
        title: 'Tre design',
        description: 'Classico (bianco e nero, risparmia toner), Moderno o Scuola primaria (caratteri grandi, colorato). Caratteri, colori e spaziature derivano dal design.'
      },
      {
        title: 'Esercizi e giochi enigmistici',
        description: 'Testo da completare con banca di parole, scelta multipla, vero/falso, abbinamenti, cruciverba e crucipuzzle, testo di lettura con numeri di riga e altro ancora.'
      },
      {
        title: 'Grafici e formule',
        description: 'Retta numerica, piano cartesiano, diagrammi, mappa mentale, righe per scrivere e carta quadrettata. Le formule in LaTeX diventano vere equazioni modificabili.'
      },
      {
        title: 'Immagini',
        description: 'Pittogrammi ARASAAC, foto di Wikimedia Commons o le tue immagini – l’indicazione della licenza compare automaticamente sotto.'
      },
      {
        title: 'Diagrammi di informatica',
        description: 'Diagrammi UML delle classi, di sequenza, di stato, di attività e dei casi d’uso, automi, diagrammi di Nassi-Shneiderman, diagrammi di flusso e diagrammi ER.'
      },
      {
        title: 'Pentagrammi e testi delle canzoni',
        description: 'Melodie, pentagrammi vuoti e testi come immagini pronte per la stampa. I nomi tedeschi delle note (h, fis, b) vengono convertiti in modo affidabile.'
      },
      {
        title: 'Pagina e stile della scuola',
        description: 'A4, A5 o Letter, verticale o orizzontale, margini, colonne, intestazione con nome della scuola e logo, piè di pagina con numeri di pagina.'
      },
      {
        title: 'Verificata, con scheda delle soluzioni',
        description: 'Dopo la creazione l’IA controlla numerazione, consegne, spazio per le risposte, punteggi e leggibilità per la classe. Su richiesta c’è la soluzione nello stesso layout.'
      },
      {
        title: 'Modifica invece di ricominciare',
        description: '«Riformula l’esercizio 1 per la classe terza», «Trasforma l’esercizio 2 in un testo da completare» – l’IA cambia solo ciò che chiedi. Per eliminare serve la tua conferma.'
      },
      {
        title: 'Il tuo assistente IA tramite MCP',
        description: 'Claude, ChatGPT, Le Chat e altri modificano il documento aperto con gli stessi strumenti – senza chiave IA nel plugin.'
      },
      {
        title: 'La privacy nelle tue mani',
        description: 'Mistral come fornitore europeo, un modello locale tramite Ollama o nessuna IA. La chiave resta sul server e l’accesso avviene con l’account Nextcloud.'
      }
    ],
    more: 'Scopri di più'
  },
  designs: {
    headline: 'Design',
    title: 'Un design per tutta la scheda',
    description:
      'L’IA sceglie solo il design – caratteri, dimensioni, colori e spaziature di tutto ciò che l’assistente inserisce ne derivano. Così ogni scheda appare coerente e uniforme, anche se in seguito aggiungi esercizi.',
    themes: [
      { title: 'Classico', description: 'Bianco e nero, a basso consumo di toner – per fotocopie e verifiche.' },
      { title: 'Moderno', description: 'Carattere pulito con accento blu – per la scuola secondaria.' },
      { title: 'Scuola primaria', description: 'Caratteri grandi, interlinea 1,5, colori allegri.' }
    ],
    imageAlt: 'La stessa scheda «Der Igel im Herbst» (il riccio in autunno) nel design {theme}',
    items: [
      { title: 'Intestazioni degli esercizi', description: 'Numero, simboli per la modalità di lavoro e per l’attività, stelle di difficoltà, punti e tempo di svolgimento.' },
      { title: 'Riquadri informativi', description: 'Ricorda, Suggerimento, Attenzione, Esempio, Definizione, Soluzione e Info – ciascuno con la sua icona.' },
      { title: 'Nella tua lingua', description: 'Diciture come nome, classe, banca di parole o vero/falso in sette lingue.' }
    ]
  },
  tasks: {
    headline: 'Esercizi',
    title: 'Esercizi dall’aspetto professionale',
    description:
      'Oltre 40 blocchi che l’IA combina liberamente. I giochi enigmistici vengono calcolati, non indovinati – cruciverba e crucipuzzle sono sempre risolvibili.',
    imageAlt: 'Pagina di esercizi nel design «Moderno»: un cruciverba calcolato con definizioni orizzontali e verticali e un crucipuzzle con elenco di parole',
    items: [
      { title: 'Testi da completare e quiz', description: 'Testo da completare con banca di parole automatica, scelta multipla, tabella vero/falso, abbinamenti con linee o lettere.' },
      { title: 'Giochi enigmistici', description: 'Cruciverba e crucipuzzle in tre livelli di difficoltà – su richiesta con soluzione.' },
      { title: 'Leggere e scrivere', description: 'Testi di lettura con numeri di riga, **Silbenfärbung** (sillabe colorate alternativamente di blu e di rosso), Lineatur 1–4 (le righe di scrittura della scuola primaria tedesca) e carta quadrettata.' },
      { title: 'Intorno all’esercizio', description: 'Autovalutazione con smiley, schede di suggerimenti da ritagliare, tabella punteggio-voto, codici QR e layout a due o tre colonne.' }
    ]
  },
  graphics: {
    headline: 'Grafici e formule',
    title: 'Matematica e scienze, disegnate con precisione',
    description:
      'I grafici vengono disegnati a partire dai dati, non inventati come immagine: assi, scale e didascalie sono corretti. Ogni grafico porta la sua fonte nel testo alternativo – così l’IA può modificarlo in seguito.',
    imageAlt: 'Scheda di matematica: retta numerica con spazi vuoti, diagramma a colonne, piano cartesiano con un triangolo e una formula per l’area',
    items: [
      { title: 'Retta numerica e piano cartesiano', description: 'Con spazi da compilare, punti, segmenti e poligoni.' },
      { title: 'Diagrammi', description: 'A colonne, a barre, a linee e a torta – anche vuoti, da disegnare da sé.' },
      { title: 'Formule', description: 'LaTeX diventa una vera equazione nel documento, anche in mezzo a una frase.' },
      { title: 'Mappe mentali e disegni', description: 'Mappe mentali (anche con bolle vuote) e semplici disegni che l’IA progetta da sola.' }
    ]
  },
  pictures: {
    headline: 'Immagini',
    title: 'Immagini che si adattano alla scheda',
    description:
      'Soprattutto nella scuola primaria e nella didattica di sostegno le immagini aiutano a capire. L’IA cerca le immagini adatte e le inserisce nella scheda – accanto alle parole, come introduzione o in colonne accanto al testo. L’indicazione della licenza viene stampata automaticamente sotto.',
    imageAlt: 'Scheda «Tiere im Wald» (animali del bosco) nel design «Scuola primaria»: pittogrammi ARASAAC di riccio, gufo, lepre, scoiattolo, volpe e corvo con l’indicazione della licenza, sotto i nomi degli animali a sillabe colorate e una Lineatur della scuola primaria',
    items: [
      { title: 'Pittogrammi', description: 'ARASAAC – disegni semplici e uniformi di oggetti, animali, azioni ed emozioni, pensati per la didattica di sostegno.' },
      { title: 'Foto e immagini storiche', description: 'Wikimedia Commons – animali, piante, luoghi, arte, Romani e Medioevo.' },
      { title: 'Le tue immagini', description: 'Una cartella nel tuo Nextcloud o sul tuo computer, ad es. con immagini a fumetti per il latino. L’IA le trova tramite i nomi dei file e delle cartelle.' }
    ]
  },
  informatics: {
    badge: 'Novità',
    headline: 'Informatica',
    title: 'UML, diagrammi di Nassi-Shneiderman e diagrammi ER',
    description:
      'L’IA descrive solo il modello, il layout viene calcolato: riquadri e frecce sono dritti e leggibili, nella notazione scolastica come sul libro di testo. Dieci tipi di diagramma – ciascuno anche da completare, con la scheda delle soluzioni.',
    diagrams: [
      { title: 'Diagramma delle classi da completare', description: 'Un attributo come riga su cui scrivere, un metodo come riga vuota, l’ereditarietà di Sparkonto (conto di risparmio) da disegnare da sé.' },
      { title: 'Diagramma di sequenza', description: 'Attore e oggetti, chiamate, risposta, barre di attivazione e un frammento alt.' },
      { title: 'Automa a stati finiti', description: 'Freccia iniziale, stato accettante come doppio cerchio, transizioni con simboli.' },
      { title: 'Diagramma di Nassi-Shneiderman (Struktogramm)', description: 'Secondo DIN 66261: selezione e ciclo (MCD di Euclide).' },
      { title: 'Diagramma di flusso', description: 'Secondo DIN 66001: inizio, input e output, decisione con ja/nein (sì/no), fine.' },
      { title: 'Diagramma ER', description: 'Notazione di Chen con attributi chiave e cardinalità 1:n e n:m.' }
    ],
    items: [
      { title: 'Dieci tipi di diagramma', description: 'Diagrammi delle classi, degli oggetti, di sequenza, di stato, di attività e dei casi d’uso, automi a stati finiti, diagrammi di Nassi-Shneiderman, diagrammi di flusso e diagrammi ER (Chen, (min,max), zampa di gallina).' },
      { title: 'Da completare', description: 'Lacune in ogni testo, frecce e relazioni mancanti, righe e riquadri vuoti – e con una frase la soluzione nello stesso layout.' },
      { title: 'Si adatta alla pagina', description: 'Il layout viene calcolato e adattato alla larghezza del testo. Come tutti i grafici, ogni diagramma resta modificabile via chat.' }
    ]
  },
  music: {
    headline: 'Musica',
    title: 'Schede di musica – anche senza IA',
    description:
      'La sezione musica funziona senza server e senza chiave API: modelli, editor ABC con anteprima dal vivo, nomi tedeschi delle note e testi. Un pentagramma selezionato si può caricare, modificare e sostituire.',
    imageAlt: 'Sezione musica: il modello «Alle meine Entchen» con testo, notazione ABC e anteprima, inserito sotto un esercizio nel design «Moderno»',
    items: [
      { title: 'Modelli', description: 'Pentagrammi vuoti in chiave di violino o di basso, scale, una melodia di esempio con testo.' },
      { title: 'Conversione dei nomi delle note', description: 'c – f – g, fis′ g′ a′ h′, «bc» per do bemolle e indicazioni di tempo come 4/4 – i numeri come ottava o come valore della nota.' },
      { title: 'Pronti per la stampa e modificabili', description: 'Immagini a 300 dpi; il sorgente ABC è salvato nel testo alternativo. Via chat: «Modifica il pentagramma 1: al posto di bc #c».' }
    ]
  },
  mcp: {
    headline: 'MCP',
    title: 'Il tuo assistente IA scrive con te',
    description:
      'Con il Model Context Protocol, Claude, ChatGPT, Le Chat e altri assistenti IA lavorano direttamente nel documento che hai aperto in Euro-Office. Il plugin applica le modifiche – le vedi subito e puoi annullarle con Ctrl+Z.',
    imageAlt: 'Un assistente IA ha aggiunto tramite MCP un terzo esercizio con la canzone «Es regnet» come pentagramma; il pannello mostra le chiamate MCP',
    items: [
      { title: 'Gli stessi strumenti', description: 'Tutti i blocchi, immagini, diagrammi, layout della pagina, verifica, modifica e pentagrammi – tutto viene controllato prima di arrivare nel documento.' },
      { title: 'Solo i tuoi documenti', description: 'Con l’accesso tramite Nextcloud, un assistente raggiunge solo i documenti del proprio utente.' },
      { title: 'Il controllo resta a te', description: 'Il documento si collega solo se attivi «MCP-Zugriff erlauben» (consenti l’accesso MCP) nel plugin. L’accesso lo revochi in Nextcloud.' }
    ],
    clientsTitle: 'Testato',
    clientsText: 'Con l’SDK TypeScript di MCP (protocollo 2026-07-28) e richieste in formato 2025, via HTTP e stdio. Gli assistenti ospitati come claude.ai, ChatGPT e Le Chat non sono ancora stati testati con un’installazione pubblica.'
  },
  companion: {
    headline: 'Desktop',
    title: 'L’app Worksheet Assistant per il tuo computer',
    description:
      'Le app desktop di Euro-Office e Nextcloud Office non hanno né un gestore di plugin né un server. L’app Worksheet Assistant si occupa di entrambe le cose: si installa come qualsiasi altra app, la avvii una volta – e poi lavora in modo invisibile in background. Niente terminale, niente browser.',
    imageAlt: 'Finestra dell’app Worksheet Assistant, pagina «Übersicht» (panoramica): tutti e tre i passaggi completati – plugin nell’app desktop, chat IA nel plugin, Claude collegato',
    items: [
      { title: 'Plugin configurato in automatico', description: 'Installa il plugin in Euro-Office e Nextcloud Office, lo collega e lo mantiene aggiornato – nessuna impostazione nell’editor.' },
      { title: 'La tua IA, le tue immagini', description: 'Mistral, OpenAI, Anthropic, Ollama o qualsiasi API compatibile con OpenAI – la chiave resta sul tuo computer. In più una cartella di immagini tutta tua.' },
      { title: 'Claude con un clic', description: 'Collega Claude Desktop o Claude Code. La nuova versione si installa con un clic e, se vuoi, l’app si avvia insieme al computer. Su macOS è notarizzata da Apple.' }
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
        bullets: ['Installazione con un solo comando (Nextcloud AIO)', 'Resta installato dopo gli aggiornamenti di AIO', 'Immagini personali nella cartella di Nextcloud'],
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
    groups: [
      {
        label: 'Schede didattiche',
        items: [
          'Crea una scheda sul ciclo dell’acqua per la classe quinta con tre esercizi, un testo da completare e un riquadro informativo.',
          'Fanne un cruciverba con dieci parole e aggiungi in fondo una pagina con le soluzioni.',
          'Riformula la consegna dell’esercizio 1 in modo che la capiscano gli alunni di terza.',
          'Usa il design Classico e scrivi il nome della nostra scuola e i numeri di pagina nell’intestazione e nel piè di pagina.',
          'Controlla la scheda ed elimina l’esercizio 3.'
        ]
      },
      {
        label: 'Immagini e diagrammi',
        items: [
          'Una scheda di lettura per la classe prima sugli animali del bosco – con un pittogramma accanto a ogni parola e le sillabe colorate.',
          'Metti accanto al testo la foto di un legionario romano.',
          'Disegna un diagramma delle classi UML con Conto, ContoCorrente e ContoRisparmio, in cui gli studenti completano l’ereditarietà.',
          'Crea un diagramma di Nassi-Shneiderman per l’algoritmo di Euclide e, sotto, un diagramma di flusso vuoto da completare.',
          'Un diagramma ER per studenti, corsi e insegnanti nella notazione di Chen.'
        ]
      },
      {
        label: 'Musica',
        items: [
          'Sotto l’esercizio 2 inserisci un pentagramma con c – f – g e, sotto, un pentagramma vuoto per ricopiare.',
          'Mi serve un pentagramma: 4/4 bc1, f1, g2, be2, c1, c1',
          'Modifica il pentagramma 1, per favore: al posto di bc #c',
          'Aggiungi il testo al pentagramma 1: Fra Martino campanaro',
          'Dopo l’esercizio 3 inserisci tre pentagrammi vuoti in chiave di basso.'
        ]
      }
    ]
  },
  parts: {
    headline: 'Cosa gira e dove',
    title: 'Un plugin, un piccolo server – e l’IA che preferisci',
    description: 'Il plugin non ha bisogno di un proprio server. Per la chat IA, le immagini e MCP si aggiunge un piccolo servizio – sul server o nell’app Worksheet Assistant sul tuo computer.',
    items: [
      {
        title: 'Plugin',
        badge: 'sempre',
        description: 'Solo file (≈ 1,4 MB) nella cartella dei plugin di Euro-Office. Funziona nell’editor nel browser o nell’app desktop.',
        bullets: ['Impagina schede, grafici e diagrammi', 'Disegna pentagrammi, sezione musica completa', 'Esegue le chiamate MCP nel documento']
      },
      {
        title: 'Server',
        badge: 'per chat IA, immagini e MCP',
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
        description: 'Custodisce la chiave IA, cerca le immagini e fornisce l’endpoint MCP. Rendilo raggiungibile via HTTPS, ad es. come `https://arbeitsblatt.deine-schule.de`. Con `AUTH_MODE=nextcloud` ogni insegnante accede con il proprio account Nextcloud.',
        codeLabel: 'Shell'
      },
      {
        title: 'Accedi nell’editor',
        description: 'Apri un documento → **Plugins** → **Assistente schede** → **Einstellungen** (impostazioni): inserisci l’indirizzo del server e clicca su **Mit Nextcloud anmelden** (accedi con Nextcloud). Fatto. Le immagini personali le metti nella cartella `Arbeitsblatt-Bilder` del tuo Nextcloud.'
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
        description: 'Nell’app, alla pagina **KI-Chat** (chat IA), inserisci il fornitore e la chiave API – oppure un modello locale tramite Ollama, o solo MCP. Nella pagina **Bilder** (immagini) scegli una cartella di immagini tutta tua. Poi apri un documento in Euro-Office: **Plugins → Assistente schede**. Puoi chiudere la finestra – l’app continua a funzionare nell’area di notifica (macOS: barra dei menu).'
      }
    ],
    docker: [
      { title: 'Compila il plugin', description: 'Scarica l’archivio della release o compila il plugin da te.', codeLabel: 'Shell' },
      {
        title: 'Avvia il Document Server e il server',
        description: '`deploy/` avvia Euro-Office con il plugin come volume, insieme al server. Nextcloud usa poi il Document Server come server esterno.',
        codeLabel: 'Shell'
      },
      { title: 'Configura l’editor', description: 'Nelle **Einstellungen** (impostazioni) del plugin inserisci l’indirizzo del server e il token (o accedi con Nextcloud), poi clicca su «Verbindung testen» (verifica la connessione).' }
    ],
    mcp: [
      {
        title: 'Collega il documento',
        description: 'Nel documento aperto attiva **Plugins → Assistente schede → Einstellungen → MCP-Zugriff erlauben** (consenti l’accesso MCP; con l’app Worksheet Assistant è già attivo). Il pannello mostra l’indirizzo MCP.'
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
          'Il plugin in sé no – sono solo file serviti da Euro-Office. Chat IA, ricerca di immagini e MCP hanno bisogno del piccolo server; sul tuo computer questo ruolo lo svolge l’app Worksheet Assistant. La sezione musica funziona senza alcun server.'
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
        label: 'Da dove arrivano le immagini – e posso usarle?',
        content:
          'Da tre fonti: pittogrammi ARASAAC (CC BY-NC-SA, utilizzabili liberamente a scuola), Wikimedia Commons (licenze libere) e la tua cartella di immagini. Autore e licenza delle immagini libere compaiono automaticamente sotto l’immagine. Il server interroga solo gli indirizzi fissi di ARASAAC e Wikimedia e la tua cartella – l’IA non indica mai indirizzi da sé. Con `IMAGE_SOURCES` o nell’app disattivi le immagini da internet.'
      },
      {
        label: 'Quali diagrammi di informatica esistono?',
        content:
          'Diagrammi UML delle classi, degli oggetti, di sequenza, di stato, di attività e dei casi d’uso, automi a stati finiti (deterministici e non deterministici), diagrammi di Nassi-Shneiderman secondo DIN 66261, diagrammi di flusso secondo DIN 66001 e diagrammi ER in notazione di Chen, (min,max) o a zampa di gallina. Ogni diagramma esiste anche da completare e con la soluzione.'
      },
      {
        label: 'Che cos’è MCP?',
        content:
          'Il Model Context Protocol è uno standard aperto che permette agli assistenti IA di usare strumenti. Il server mette a disposizione gli strumenti del plugin – così, ad esempio, Claude modifica il tuo documento aperto come se avessi usato la chat del plugin.'
      },
      {
        label: 'Come accedono gli insegnanti?',
        content:
          'Con `AUTH_MODE=nextcloud`, con il proprio account Nextcloud: nel plugin con un clic (Nextcloud Login Flow), gli assistenti IA tramite OAuth con Nextcloud o con una password per le app. Ognuno raggiunge solo i propri documenti e le proprie immagini; l’accesso si può revocare in Nextcloud, in Dispositivi e sessioni.'
      },
      {
        label: 'Funziona anche senza Nextcloud?',
        content: 'Sì: con l’app desktop di Euro-Office o Nextcloud Office e l’app Worksheet Assistant, oppure con un tuo Document Server Euro-Office e un token di accesso condiviso.'
      },
      {
        label: 'Posso modificare in seguito i contenuti inseriti?',
        content:
          'Sì. L’IA legge i contenuti e sostituisce esattamente le parti che indichi. Grafici, diagrammi, immagini e pentagrammi conservano la loro fonte nel testo alternativo e si possono modificare via chat; i pentagrammi anche nella sezione musica.'
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
          'Sì, con licenza MIT. Include abcjs, dagre e qrcode-generator (tutti MIT) e i file del plugin ONLYOFFICE (AGPL-3.0); l’app Worksheet Assistant contiene Node.js e pacchetti npm – tutti con i rispettivi testi di licenza.'
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
    uses: 'usa abcjs, dagre e qrcode-generator (MIT) e l’SDK per plugin di ONLYOFFICE (AGPL-3.0) · Pittogrammi: Sergio Palao, ARASAAC (CC BY-NC-SA)',
    copy: 'Copia',
    copied: 'Copiato',
    zoom: 'Apri l’immagine a dimensione intera'
  }
}

export default it
