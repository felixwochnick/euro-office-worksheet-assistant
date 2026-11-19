import type { SiteContent } from './types'

const en: SiteContent = {
  meta: {
    title: 'Worksheet Assistant for Euro-Office',
    description:
      'Create worksheets with AI – for every subject, in Nextcloud, in the desktop app or with Claude & co. via MCP. Open source.'
  },
  nav: { features: 'Features', ways: 'Use cases', mcp: 'MCP', demo: 'Live demo', install: 'Installation', faq: 'FAQ', language: 'Language' },
  hero: {
    badge: 'Open source · MIT',
    headline: 'AI plugin for Euro-Office – in Nextcloud and on the desktop',
    title: 'Create worksheets with AI – for every subject',
    description:
      'Describe what you need: the Worksheet Assistant lays out tasks, cloze texts, puzzles, tables, charts, formulas, writing lines, info boxes and music staves in one consistent design, right in your document – with the built-in AI chat or with your own AI assistant via MCP.',
    install: 'Install',
    more: 'How it works',
    imageAlt:
      'Euro-Office with the Worksheet Assistant: a worksheet about the water cycle created by the AI chat, the chat with the request on the left'
  },
  features: {
    headline: 'Features',
    title: 'From a blank page to a finished worksheet',
    description: 'Built for teachers and student teachers – for worksheets, tests and handouts in every subject.',
    items: [
      {
        title: 'Designed worksheets by chat',
        description:
          '“Create a worksheet about the water cycle for grade 3”: title, numbered tasks with symbols and points, cloze text with word bank, crossword, chart and info box – in one design (modern, primary school, classic) and checked automatically afterwards.'
      },
      {
        title: 'Edit instead of starting over',
        description:
          '“Reword task 1 for grade 3”, “Turn task 2 into a cloze text”, “Add a solution page” – the AI changes only what you ask for. Deleting needs your confirmation.'
      },
      {
        title: 'Music staves and lyrics',
        description:
          'Melodies, empty staves and lyrics as print-ready images. German note names (h, fis, b) are converted reliably; every staff stays editable.'
      },
      {
        title: 'Your AI assistant via MCP',
        description: 'Claude, ChatGPT, Le Chat and others edit the open document with the same tools – no AI key in the plugin.'
      },
      {
        title: 'Privacy in your hands',
        description: 'Mistral as an EU provider, a local model via Ollama or no AI at all. The key stays on the server, sign-in with the Nextcloud account.'
      },
      {
        title: 'Nextcloud, server or desktop',
        description:
          'One command for Nextcloud AIO, a Docker Compose file for your own Document Server, or the Worksheet Assistant app for the Euro-Office desktop app (Windows, macOS, Linux).'
      }
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
        bullets: ['Installation with one command (Nextcloud AIO)', 'Survives AIO updates', 'AI key only on the server'],
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
    worksheetLabel: 'Worksheets',
    musicLabel: 'Music',
    worksheet: [
      'Create a worksheet about the water cycle for grade 5 with three tasks, a table and an info box.',
      'Reword the instruction of task 1 so that third-graders understand it.',
      'Turn task 2 into a cloze text with 8 gaps.',
      'Add a solution page at the end.',
      'Delete task 3.'
    ],
    music: [
      'Below task 2, insert a staff with c – f – g and an empty staff underneath for copying.',
      'I need a staff: 4/4 bc1, f1, g2, be2, c1, c1',
      'Please change staff 1: instead of bc #c',
      'Add the lyrics to staff 1: Twinkle twinkle little star',
      'After task 3, insert three empty staves in bass clef.'
    ]
  },
  mcp: {
    headline: 'MCP',
    title: 'Your AI assistant writes along',
    description:
      'With the Model Context Protocol, Claude, ChatGPT, Le Chat and other AI assistants work directly in the document you have open in Euro-Office. The plugin applies the changes – you see them immediately and can undo them with Ctrl+Z.',
    imageAlt: 'An AI assistant added an extra task with a staff and lyrics via MCP; the plugin’s chat shows the MCP calls',
    items: [
      { title: 'The same tools', description: 'Worksheet blocks, editing, deleting, staves and lyrics – checked before anything reaches the document.' },
      { title: 'Only your documents', description: 'With the Nextcloud sign-in, an assistant only reaches the documents of its user.' },
      { title: 'You stay in control', description: 'Only “Allow MCP access” in the plugin connects the document. You revoke the access in Nextcloud.' }
    ],
    clientsTitle: 'Tested',
    clientsText: 'With the MCP TypeScript SDK (protocol 2026-07-28) and 2025-era requests, over HTTP and stdio. Claude, ChatGPT and Le Chat themselves have not been connected yet.'
  },
  companion: {
    headline: 'Desktop',
    title: 'The Worksheet Assistant app for your computer',
    description:
      'The Euro-Office and Nextcloud Office desktop apps have no plugin manager and no server. The Worksheet Assistant app does both: install it like any other app, start it once – then it works invisibly in the background. No terminal, no browser.',
    imageAlt: 'Window of the Worksheet Assistant app, page “Übersicht” (overview): all three steps done – plugin in the desktop app, AI chat in the plugin, Claude connected',
    items: [
      { title: 'Plugin set up automatically', description: 'Installs the plugin in Euro-Office and Nextcloud Office, connects it and keeps it up to date – no settings in the editor.' },
      { title: 'Your AI', description: 'Mistral, OpenAI, Anthropic, Ollama or any OpenAI-compatible API – the key stays on your computer.' },
      { title: 'Claude in one click', description: 'Connects Claude Desktop or Claude Code with one click. The app reports new versions itself and starts with your computer if you like.' }
    ]
  },
  music: {
    headline: 'Music',
    title: 'Music worksheets – even without any AI',
    description:
      'The music tab works without a server and without an API key: templates, ABC editor with live preview, German note names and lyrics. A selected staff can be loaded, changed and replaced.',
    imageAlt: 'Music tab: template “Alle meine Entchen” with lyrics, ABC notation and preview',
    items: [
      { title: 'Templates', description: 'Empty staves in treble or bass clef, scales, an example melody with lyrics.' },
      { title: 'Convert note names', description: 'c – f – g, fis′ g′ a′ h′, “bc” for C flat and time signatures such as 4/4 – digits as octave or note value.' },
      { title: 'Print-ready and editable', description: 'Images at 300 dpi; the ABC source is stored in the alt text.' }
    ]
  },
  demo: {
    headline: 'Live demo',
    title: 'Try the note name converter',
    description: 'Type German note names – the staff appears instantly. It is the same converter the plugin uses in the editor.',
    loading: 'Loading the demo …',
    notesLabel: 'Note names (German)',
    notesHelp: 'e.g. c – f – g, fis′ g′ a′ h′, bc = C flat, 4/4 = time signature',
    clefLabel: 'Clef',
    treble: 'Treble clef',
    bass: 'Bass clef',
    digitsLabel: 'Digits',
    digitsAuto: 'Digits: automatic',
    digitsOctave: 'Digits = octave (c1 = c′)',
    digitsDuration: 'Digits = note value (c1 = whole note)',
    lyricsLabel: 'Lyrics (optional)',
    lyricsHelp: 'Separate syllables with -: Twin-kle twin-kle',
    showAbc: 'Show ABC notation',
    paperLoading: 'Loading the staff …',
    examples: ['c – f – g', 'Hänschen klein', 'Note values', 'Bass clef'],
    noteCount: '{n} notes',
    readAsDurations: 'digits read as note values',
    readAsOctaves: 'digits read as octaves',
    meterInfo: '{meter} time, {bars} bars',
    issues: {
      unknownName: '“{token}” is not a known note name.',
      doubleAccidental: '“{token}” has two accidentals.',
      farFromStaff: '“{token}” is in the {octave} – far outside the staff.',
      incompleteBar: 'The notes do not fill whole {meter} bars ({bars} bars).',
      tooManySyllables: 'The lyrics have more syllables than the melody has notes.',
      tooFewSyllables: 'The lyrics do not cover all notes – the rest stay without text.'
    }
  },
  parts: {
    headline: 'What runs where',
    title: 'One plugin, one small server – and the AI of your choice',
    description: 'The plugin needs no server of its own. The AI chat and MCP add a small service – on the server or in the Worksheet Assistant app on your computer.',
    items: [
      {
        title: 'Plugin',
        badge: 'always',
        description: 'Just files (≈ 1 MB) in Euro-Office’s plugin folder. Runs in the editor in the browser or in the desktop app.',
        bullets: ['Inserts and edits content', 'Draws staves, complete music tab', 'Executes MCP calls in the document']
      },
      {
        title: 'Server',
        badge: 'for AI chat and MCP',
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
        description: 'It holds the AI key and serves the MCP endpoint. Make it reachable via HTTPS, e.g. as `https://worksheets.your-school.org`. With `AUTH_MODE=nextcloud` every teacher signs in with their Nextcloud account.',
        codeLabel: 'Shell'
      },
      {
        title: 'Sign in in the editor',
        description: 'Open a document → **Plugins** → **Worksheet Assistant** → **Settings**: enter the server address and **Sign in with Nextcloud**. Done.'
      }
    ],
    desktop: [
      { title: 'Install Euro-Office', description: 'Install the Euro-Office or Nextcloud Office desktop app for Windows, macOS or Linux and start it once.' },
      {
        title: 'Install the Worksheet Assistant app',
        description: 'Download the installer for your system and install it like any other app (macOS: drag it into **Applications**); it is called **Arbeitsblatt-Assistent**. On start its window opens: it sets up the plugin and works invisibly in the background. The app is not signed yet – if macOS refuses to open it: **System Settings → Privacy & Security → Open Anyway**; Windows: **More info → Run anyway**.'
      },
      {
        title: 'Choose your AI',
        description: 'In the app, on the page **KI-Chat** (AI chat), enter the provider and API key – or a local model via Ollama, or MCP only. Then open a document in Euro-Office: **Plugins → Worksheet Assistant**. You can close the window – the app keeps running in the system tray (macOS: menu bar). Tip: switch on autostart under **Einstellungen** (settings).'
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
          'The plugin itself does not – it is just files served by Euro-Office. The AI chat and MCP need the small server; on your own computer the Worksheet Assistant app takes this role. The music tab works without any server.'
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
        label: 'What is MCP?',
        content:
          'The Model Context Protocol is an open standard that lets AI assistants use tools. The server offers the plugin’s tools – so Claude, for example, edits your open document as if you had used the chat in the plugin.'
      },
      {
        label: 'How do teachers sign in?',
        content:
          'With `AUTH_MODE=nextcloud` with their Nextcloud account: in the plugin with one click (Nextcloud Login Flow), AI assistants via OAuth through Nextcloud or with an app password. Everyone only reaches their own documents; the access can be revoked in Nextcloud under Devices & sessions.'
      },
      {
        label: 'Does it work without Nextcloud?',
        content: 'Yes: with the Euro-Office or Nextcloud Office desktop app and the Worksheet Assistant app, or with your own Euro-Office Document Server and a shared access token.'
      },
      {
        label: 'Can I change inserted content later?',
        content:
          'Yes. The AI reads the content and replaces exactly the parts you name. Staves carry their ABC source in the alt text and can be changed by chat or in the music tab.'
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
          'Yes, under the MIT license. It ships abcjs (MIT) and the ONLYOFFICE plugin files (AGPL-3.0); the Worksheet Assistant app contains Node.js and npm packages – all with their license texts.'
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
    uses: 'uses abcjs (MIT) and the ONLYOFFICE plugin SDK (AGPL-3.0)',
    copy: 'Copy',
    copied: 'Copied'
  }
}

export default en
