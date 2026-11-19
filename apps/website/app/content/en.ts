import type { SiteContent } from './types'

const en: SiteContent = {
  meta: {
    title: 'Worksheet Assistant for Euro-Office',
    description:
      'Create worksheets with AI – for every subject: designed tasks, puzzles, graphics, pictures, computer science diagrams and music staves. In Nextcloud, in the desktop app or with Claude & co. via MCP. Open source.'
  },
  nav: { features: 'Features', informatics: 'Computer science', ways: 'Use cases', mcp: 'MCP', install: 'Installation', faq: 'FAQ', language: 'Language' },
  hero: {
    badge: 'New in {version}: computer science diagrams',
    headline: 'AI plugin for Euro-Office – in Nextcloud and on the desktop',
    title: 'Create worksheets with AI – for every subject',
    description:
      'Describe what you need: the Worksheet Assistant lays out tasks, cloze texts, puzzles, graphics, formulas, pictures, UML diagrams and music staves in one consistent design, right in your document – with the built-in AI chat or with your own AI assistant via MCP.',
    install: 'Install',
    more: 'All features',
    imageAlt:
      'Euro-Office with the Worksheet Assistant: a worksheet about the water cycle in the “Modern” design with header, title, name line and numbered tasks with symbols, stars and points; on the left the panel with the AI chat'
  },
  features: {
    headline: 'Features',
    title: 'Everything for your next worksheet',
    description: 'Built for teachers and student teachers – for worksheets, tests and handouts in every subject. The AI picks the building blocks, the plugin places them cleanly in the document.',
    items: [
      {
        title: 'Whole worksheets by chat',
        description: '“Create a worksheet about the water cycle for grade 5” – with title, name line, tasks, material and info box. Preview first, then insert.'
      },
      {
        title: 'Three designs',
        description: 'Classic (black and white, saves toner), Modern or Primary school (large type, colorful). Fonts, colors and spacing come from the design.'
      },
      {
        title: 'Tasks and puzzles',
        description: 'Cloze text with word bank, multiple choice, true/false, matching, crossword and word search, reading text with line numbers and more.'
      },
      {
        title: 'Graphics and formulas',
        description: 'Number line, coordinate system, charts, mind map, writing lines and squared paper. Formulas from LaTeX become real, editable equations.'
      },
      {
        title: 'Pictures',
        description: 'ARASAAC pictograms, photos from Wikimedia Commons or your own pictures – the license credit is placed underneath automatically.'
      },
      {
        title: 'Computer science diagrams',
        description: 'UML class, sequence, state, activity and use case diagrams, automata, Nassi-Shneiderman diagrams, flowcharts and ER diagrams.'
      },
      {
        title: 'Music and lyrics',
        description: 'Melodies, empty staves and lyrics as print-ready images. German note names (h, fis, b) are converted reliably.'
      },
      {
        title: 'Page and house style',
        description: 'A4, A5 or Letter, portrait or landscape, margins, columns, header with school name and logo, footer with page numbers.'
      },
      {
        title: 'Checked, with solution sheet',
        description: 'After creating, the AI checks numbering, instructions, space for answers, points and readability for the grade level. On request you get the solution in the same layout.'
      },
      {
        title: 'Edit instead of starting over',
        description: '“Reword task 1 for grade 3”, “Turn task 2 into a cloze text” – the AI changes only what you ask for. Deleting needs your confirmation.'
      },
      {
        title: 'Your AI assistant via MCP',
        description: 'Claude, ChatGPT, Le Chat and others edit the open document with the same tools – no AI key in the plugin.'
      },
      {
        title: 'Privacy in your hands',
        description: 'Mistral as an EU provider, a local model via Ollama or no AI at all. The key stays on the server, sign-in with the Nextcloud account.'
      }
    ],
    more: 'Learn more'
  },
  designs: {
    headline: 'Designs',
    title: 'One design for the whole sheet',
    description:
      'The AI only picks the design – fonts, sizes, colors and spacing of everything the assistant inserts come from it. That way every sheet looks like it was made in one go, even if you add tasks later.',
    themes: [
      { title: 'Classic', description: 'Black and white and toner-saving – for copies and tests.' },
      { title: 'Modern', description: 'Clear type with a blue accent – for secondary school.' },
      { title: 'Primary school', description: 'Large type, 1.5× line spacing, friendly colors.' }
    ],
    imageAlt: 'The same worksheet “Der Igel im Herbst” (the hedgehog in autumn) in the {theme} design',
    items: [
      { title: 'Task headers', description: 'Number, symbols for work format and activity, difficulty stars, points and working time.' },
      { title: 'Info boxes', description: 'Remember, tip, warning, example, definition, solution and info – each with a symbol.' },
      { title: 'In your language', description: 'Labels such as name, class, word bank or true/false in seven languages.' }
    ]
  },
  tasks: {
    headline: 'Tasks',
    title: 'Tasks that look right',
    description:
      'Over 40 building blocks that the AI combines freely. Puzzles are calculated instead of guessed – crosswords and word searches are always solvable.',
    imageAlt: 'Task page in the “Modern” design: a calculated crossword with clues across and down and a word search with a word list',
    items: [
      { title: 'Cloze texts and quizzes', description: 'Cloze text with automatic word bank, multiple choice, true/false table, matching with lines or letters.' },
      { title: 'Puzzles', description: 'Crosswords and word searches in three difficulty levels – with a solution on request.' },
      { title: 'Reading and writing', description: 'Reading texts with line numbers, **syllable coloring** (syllables alternately blue and red), German primary-school writing lines (Lineatur 1–4) and squared paper.' },
      { title: 'Around the task', description: 'Self-assessment with smileys, tip cards to cut out, points-to-grades table, QR codes and a two- or three-column layout.' }
    ]
  },
  graphics: {
    headline: 'Graphics & formulas',
    title: 'Math and science, cleanly drawn',
    description:
      'Graphics are drawn from data, not invented as a picture: axes, scales and labels are correct. Every graphic carries its source in the alt text – the AI can change it later.',
    imageAlt: 'Math worksheet: number line with gaps, column chart, coordinate system with a triangle and a formula for the area',
    items: [
      { title: 'Number line and coordinate system', description: 'With gaps to fill in, points, line segments and polygons.' },
      { title: 'Charts', description: 'Column, bar, line and pie charts – also empty, for students to draw themselves.' },
      { title: 'Formulas', description: 'LaTeX becomes a real equation in the document, even in the middle of a sentence.' },
      { title: 'Mind maps and drawings', description: 'Mind maps (also with empty bubbles) and simple drawings that the AI designs itself.' }
    ]
  },
  pictures: {
    headline: 'Pictures',
    title: 'Pictures that fit the sheet',
    description:
      'Especially in primary school and special education, pictures help with understanding. The AI looks for suitable pictures and puts them on the sheet – next to words, as an opener or in columns beside the text. It prints the license credit underneath automatically.',
    imageAlt: 'Worksheet “Tiere im Wald” (animals in the forest) in the “Primary school” design: ARASAAC pictograms of hedgehog, owl, hare, squirrel, fox and raven with license credit, below them the animal names in syllable coloring and a primary-school writing line',
    items: [
      { title: 'Pictograms', description: 'ARASAAC – simple, uniform drawings of things, animals, activities and feelings, made for special education.' },
      { title: 'Photos and historical pictures', description: 'Wikimedia Commons – animals, plants, places, art, Romans and the Middle Ages.' },
      { title: 'Your own pictures', description: 'A folder in your Nextcloud or on your computer, e.g. with comic pictures for Latin. The AI finds them by file and folder names.' }
    ]
  },
  informatics: {
    badge: 'New',
    headline: 'Computer science',
    title: 'UML, Nassi-Shneiderman and ER diagrams',
    description:
      'The AI only describes the model, the layout is calculated: boxes and arrows are straight and legible, in the school notation as in the textbook. Ten diagram types – each also as a fill-in diagram with a solution sheet.',
    diagrams: [
      { title: 'Class diagram to fill in', description: 'An attribute as a writing line, a method as an empty row, the inheritance from Sparkonto (savings account) for students to draw.' },
      { title: 'Sequence diagram', description: 'Actor and objects, calls, response, activation bars and an alt fragment.' },
      { title: 'Finite automaton', description: 'Start arrow, accepting state as a double circle, transitions labeled with symbols.' },
      { title: 'Nassi-Shneiderman diagram', description: 'To DIN 66261: branch and loop (Euclid’s greatest common divisor).' },
      { title: 'Flowchart', description: 'To DIN 66001: start, input and output, branch with yes/no, end.' },
      { title: 'ER diagram', description: 'Chen notation with key attributes and cardinalities 1:n and n:m.' }
    ],
    items: [
      { title: 'Ten diagram types', description: 'Class, object, sequence, state, activity and use case diagrams, finite automata, Nassi-Shneiderman diagrams, flowcharts and ER diagrams (Chen, (min,max), crow’s foot).' },
      { title: 'To fill in', description: 'Gaps in any text, missing arrows and relationships, empty rows and boxes – and with one sentence the solution in the same layout.' },
      { title: 'Fits on the sheet', description: 'The layout is calculated and fitted to the text width. Like all graphics, every diagram stays editable by chat.' }
    ]
  },
  music: {
    headline: 'Music',
    title: 'Music worksheets – even without any AI',
    description:
      'The music tab works without a server and without an API key: templates, ABC editor with live preview, German note names and lyrics. A selected staff can be loaded, changed and replaced.',
    imageAlt: 'Music tab: the template “Alle meine Entchen” with lyrics, ABC notation and preview, inserted below a task in the “Modern” design',
    items: [
      { title: 'Templates', description: 'Empty staves in treble or bass clef, scales, an example melody with lyrics.' },
      { title: 'Convert note names', description: 'c – f – g, fis′ g′ a′ h′, “bc” for C flat and time signatures such as 4/4 – digits as octave or note value.' },
      { title: 'Print-ready and editable', description: 'Images at 300 dpi; the ABC source is stored in the alt text. By chat: “Change staff 1: instead of bc #c”.' }
    ]
  },
  mcp: {
    headline: 'MCP',
    title: 'Your AI assistant writes along',
    description:
      'With the Model Context Protocol, Claude, ChatGPT, Le Chat and other AI assistants work directly in the document you have open in Euro-Office. The plugin applies the changes – you see them immediately and can undo them with Ctrl+Z.',
    imageAlt: 'An AI assistant added a third task with the song “Es regnet” as a staff via MCP; the panel shows the MCP calls',
    items: [
      { title: 'The same tools', description: 'All building blocks, pictures, diagrams, page layout, checking, editing and staves – checked before anything reaches the document.' },
      { title: 'Only your documents', description: 'With the Nextcloud sign-in, an assistant only reaches the documents of its user.' },
      { title: 'You stay in control', description: 'Only “Allow MCP access” in the plugin connects the document. You revoke the access in Nextcloud.' }
    ],
    clientsTitle: 'Tested',
    clientsText: 'With the MCP TypeScript SDK (protocol 2026-07-28) and 2025-era requests, over HTTP and stdio. Hosted assistants such as claude.ai, ChatGPT and Le Chat have not been tested against a public installation yet.'
  },
  companion: {
    headline: 'Desktop',
    title: 'The Worksheet Assistant app for your computer',
    description:
      'The Euro-Office and Nextcloud Office desktop apps have no plugin manager and no server. The Worksheet Assistant app does both: install it like any other app, start it once – then it works invisibly in the background. No terminal, no browser.',
    imageAlt: 'Window of the Worksheet Assistant app, page “Übersicht” (overview): all three steps done – plugin in the desktop app, AI chat in the plugin, Claude connected',
    items: [
      { title: 'Plugin set up automatically', description: 'Installs the plugin in Euro-Office and Nextcloud Office, connects it and keeps it up to date – no settings in the editor.' },
      { title: 'Your AI, your pictures', description: 'Mistral, OpenAI, Anthropic, Ollama or any OpenAI-compatible API – the key stays on your computer. Plus a folder of your own pictures.' },
      { title: 'Claude in one click', description: 'Connects Claude Desktop or Claude Code. The app installs new versions with one click and starts with your computer if you like. Notarized by Apple on macOS.' }
    ]
  },
  ways: {
    headline: 'Use cases',
    title: 'Three ways – one plugin',
    description: 'Choose where you work and which AI you want to use. All ways can be combined.',
    items: [
      {
        title: 'In Nextcloud',
        badge: 'for schools',
        description: 'The plugin in Nextcloud’s Euro-Office, the small server next to it. Every teacher signs in with their Nextcloud account.',
        bullets: ['Installation with one command (Nextcloud AIO)', 'Survives AIO updates', 'Your own pictures in a Nextcloud folder'],
        link: 'Install in Nextcloud'
      },
      {
        title: 'On your computer',
        badge: 'Windows · macOS · Linux',
        description: 'The Euro-Office or Nextcloud Office desktop app with the Worksheet Assistant app – install it like any other app, no server of your own.',
        bullets: ['Installs and updates the plugin by itself', 'Your own API key or a local model', 'Connect Claude Desktop with one click'],
        link: 'Download the app'
      },
      {
        title: 'With your AI assistant',
        badge: 'MCP',
        description: 'Claude, ChatGPT, Le Chat or another MCP client works directly in the open document.',
        bullets: ['Same tools as the chat', 'Sign-in via Nextcloud (OAuth) or app password', 'Locally without sign-in'],
        link: 'Set up MCP'
      }
    ]
  },
  prompts: {
    headline: 'Examples',
    title: 'How to talk to the Worksheet Assistant',
    description: 'Plain sentences are enough. The AI knows the outline of your document and answers in your language.',
    groups: [
      {
        label: 'Worksheets',
        items: [
          'Create a worksheet about the water cycle for grade 5 with three tasks, a cloze text and an info box.',
          'Turn this into a crossword with ten terms and add a solution page at the end.',
          'Reword the instruction of task 1 so that third-graders understand it.',
          'Use the Classic design and put our school name and page numbers in the header and footer.',
          'Check the sheet and delete task 3.'
        ]
      },
      {
        label: 'Pictures & diagrams',
        items: [
          'A reading sheet for grade 1 about animals in the forest – with a pictogram next to each word and syllable coloring.',
          'Put a photo of a Roman legionary next to the text.',
          'Draw a UML class diagram for account, checking account and savings account where the students complete the inheritance.',
          'Create a Nassi-Shneiderman diagram for the Euclidean algorithm and below it an empty flowchart to fill in.',
          'An ER diagram for students, courses and teachers in Chen notation.'
        ]
      },
      {
        label: 'Music',
        items: [
          'Below task 2, insert a staff with c – f – g and an empty staff underneath for copying.',
          'I need a staff: 4/4 bc1, f1, g2, be2, c1, c1',
          'Please change staff 1: instead of bc #c',
          'Add the lyrics to staff 1: Twinkle twinkle little star',
          'After task 3, insert three empty staves in bass clef.'
        ]
      }
    ]
  },
  parts: {
    headline: 'What runs where',
    title: 'One plugin, one small server – and the AI of your choice',
    description: 'The plugin needs no server of its own. For AI chat, pictures and MCP a small service is added – on the server or in the Worksheet Assistant app on your computer.',
    items: [
      {
        title: 'Plugin',
        badge: 'always',
        description: 'Just files (≈ 1.4 MB) in Euro-Office’s plugin folder. Runs in the editor in the browser or in the desktop app.',
        bullets: ['Lays out worksheets, graphics and diagrams', 'Draws staves, complete music tab', 'Executes MCP calls in the document']
      },
      {
        title: 'Server',
        badge: 'for AI chat, pictures and MCP',
        description: 'A small service (Docker, ≈ 30 MB RAM) next to Nextcloud – or in the background of the Worksheet Assistant app on your own computer.',
        bullets: ['API key stays on the server', 'Sign-in via Nextcloud, rate limit', 'Checks content before it reaches the document']
      },
      {
        title: 'Language model',
        badge: 'optional',
        description: 'Mistral (default), OpenAI, Anthropic, any OpenAI-compatible API such as Ollama – or your own AI assistant via MCP.',
        bullets: ['Switchable without changing the plugin', 'EU provider or local possible', 'Costs at the provider']
      }
    ]
  },
  install: {
    headline: 'Installation',
    title: 'Ready in three steps',
    description: 'Choose your way. More options and all settings are in the README.',
    tabs: { nextcloud: 'Nextcloud AIO', desktop: 'Desktop app', docker: 'Own server', mcp: 'AI assistant (MCP)' },
    nextcloud: [
      {
        title: 'Install the plugin',
        description: 'Run on the AIO server. The script copies the plugin into the Euro-Office container; with `--watch` it re-installs the plugin automatically after every AIO update.',
        codeLabel: 'Shell (AIO server)'
      },
      {
        title: 'Start the server',
        description: 'It holds the AI key, searches for pictures and serves the MCP endpoint. Make it reachable via HTTPS, e.g. as `https://worksheets.your-school.org`. With `AUTH_MODE=nextcloud` every teacher signs in with their Nextcloud account.',
        codeLabel: 'Shell'
      },
      {
        title: 'Sign in in the editor',
        description: 'Open a document → **Plugins** → **Worksheet Assistant** → **Settings**: enter the server address and **Sign in with Nextcloud**. Done. You put your own pictures in the `Arbeitsblatt-Bilder` folder of your Nextcloud.'
      }
    ],
    desktop: [
      { title: 'Install Euro-Office', description: 'Install the Euro-Office or Nextcloud Office desktop app for Windows, macOS or Linux and start it once.' },
      {
        title: 'Install the Worksheet Assistant app',
        description: 'Download the installer for your system and install it like any other app (macOS: drag it into **Applications**); it is called **Arbeitsblatt-Assistent**. On start its window opens: it sets up the plugin and works invisibly in the background. On macOS the app is notarized by Apple. On Windows it is not signed yet – if SmartScreen warns: **More info → Run anyway**.'
      },
      {
        title: 'Choose your AI',
        description: 'In the app, on the page **KI-Chat** (AI chat), enter the provider and API key – or a local model via Ollama, or MCP only. On the page **Bilder** (pictures) you choose a folder of your own pictures. Then open a document in Euro-Office: **Plugins → Worksheet Assistant**. You can close the window – the app keeps running in the system tray (macOS: menu bar).'
      }
    ],
    docker: [
      { title: 'Build the plugin', description: 'Download the release archive or build the plugin yourself.', codeLabel: 'Shell' },
      {
        title: 'Start the Document Server and the server',
        description: '`deploy/` starts Euro-Office with the plugin as a volume plus the server. Nextcloud then uses the Document Server as an external server.',
        codeLabel: 'Shell'
      },
      { title: 'Set up the editor', description: 'In the plugin’s **Settings**, enter the server address and the token (or sign in with Nextcloud) and “Test connection”.' }
    ],
    mcp: [
      {
        title: 'Connect the document',
        description: 'In the open document switch on **Plugins → Worksheet Assistant → Settings → Allow MCP access** (already on with the Worksheet Assistant app). The panel shows the MCP address.'
      },
      {
        title: 'Connect your AI assistant',
        description: 'Add the MCP address: in Claude, ChatGPT or Le Chat as a custom connector (sign-in via Nextcloud), in Claude Code with a command. The Worksheet Assistant app connects Claude Desktop and Claude Code with one click (page **Claude & MCP**).',
        codeLabel: 'Claude Code'
      },
      { title: 'Get started', description: '“Create a worksheet about fractions for grade 6 in the open document” – the changes appear in the editor right away.' }
    ],
    readme: 'All options in the README'
  },
  faq: {
    headline: 'FAQ',
    title: 'Frequently asked questions',
    items: [
      {
        label: 'Does the plugin need its own server?',
        content:
          'The plugin itself does not – it is just files served by Euro-Office. AI chat, picture search and MCP need the small server; on your own computer the Worksheet Assistant app takes this role. The music tab works without any server.'
      },
      {
        label: 'Which AI is used?',
        content:
          'The one you configure: Mistral (EU provider, default), OpenAI, Anthropic, any OpenAI-compatible API or a local model via Ollama. Or none at all – then you use your own AI assistant via MCP.'
      },
      {
        label: 'Which data is sent to the AI?',
        content:
          'With every chat request the conversation and the outline of the document (texts, staves as ABC). The server stores no conversations or documents. With MCP your AI assistant reads the document through the tools. If nothing should leave your network, use a local model.'
      },
      {
        label: 'Where do the pictures come from – and may I use them?',
        content:
          'From three sources: ARASAAC pictograms (CC BY-NC-SA, free for school use), Wikimedia Commons (free licenses) and your own picture folder. Author and license of free pictures are printed under the picture automatically. The server only queries the fixed addresses of ARASAAC and Wikimedia and your folder – the AI never supplies addresses itself. With `IMAGE_SOURCES` or in the app you can switch off pictures from the internet.'
      },
      {
        label: 'Which computer science diagrams are there?',
        content:
          'UML class, object, sequence, state, activity and use case diagrams, finite automata (DFA/NFA), Nassi-Shneiderman diagrams to DIN 66261, flowcharts to DIN 66001 and ER diagrams in Chen, (min,max) or crow’s foot notation. Every diagram is also available to fill in and with a solution.'
      },
      {
        label: 'What is MCP?',
        content:
          'The Model Context Protocol is an open standard that lets AI assistants use tools. The server offers the plugin’s tools – so Claude, for example, edits your open document as if you had used the chat in the plugin.'
      },
      {
        label: 'How do teachers sign in?',
        content:
          'With `AUTH_MODE=nextcloud` with their Nextcloud account: in the plugin with one click (Nextcloud Login Flow), AI assistants via OAuth through Nextcloud or with an app password. Everyone only reaches their own documents and pictures; the access can be revoked in Nextcloud under Devices & sessions.'
      },
      {
        label: 'Does it work without Nextcloud?',
        content: 'Yes: with the Euro-Office or Nextcloud Office desktop app and the Worksheet Assistant app, or with your own Euro-Office Document Server and a shared access token.'
      },
      {
        label: 'Can I change inserted content later?',
        content:
          'Yes. The AI reads the content and replaces exactly the parts you name. Graphics, diagrams, pictures and staves carry their source in the alt text and can be changed by chat; staves also in the music tab.'
      },
      {
        label: 'What happens when Nextcloud AIO updates?',
        content:
          'AIO re-creates the Euro-Office container, which removes custom plugins. With `--watch` the install script sets up a small service that re-installs the plugin automatically after every restart.'
      },
      {
        label: 'How is the app updated?',
        content:
          'The Worksheet Assistant app regularly checks for a new version and shows it in its window and in the system tray (macOS: menu bar). One click downloads and installs it – with the .deb package you get a link to the download page instead. The new version updates the plugin in Euro-Office automatically.'
      },
      {
        label: 'What has it been tested with?',
        content:
          'Euro-Office 9.3.8 (Document Server and desktop app on Linux), Nextcloud 34 and Mistral – automated in the real editor. The Worksheet Assistant app is built and checked automatically for Windows, macOS and Linux. Hosted assistants such as claude.ai have not been tested against a public installation yet.'
      },
      {
        label: 'Is it open source?',
        content:
          'Yes, under the MIT license. It ships abcjs, dagre and qrcode-generator (all MIT) and the ONLYOFFICE plugin files (AGPL-3.0); the Worksheet Assistant app contains Node.js and npm packages – all with their license texts.'
      }
    ]
  },
  cta: {
    title: 'Ready for your next worksheet?',
    description: 'Source code, releases and detailed documentation on GitHub.',
    repo: 'Go to the repository',
    releases: 'Releases'
  },
  footer: {
    license: 'Worksheet Assistant · MIT license',
    uses: 'uses abcjs, dagre and qrcode-generator (MIT) and the ONLYOFFICE plugin SDK (AGPL-3.0) · Pictograms: Sergio Palao, ARASAAC (CC BY-NC-SA)',
    copy: 'Copy',
    copied: 'Copied',
    zoom: 'Open image in full size'
  }
}

export default en
