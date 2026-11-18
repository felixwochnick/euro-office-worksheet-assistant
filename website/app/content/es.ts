import type { SiteContent } from './types'

const es: SiteContent = {
  meta: {
    title: 'Worksheet Assistant para Euro-Office',
    description:
      'Crea fichas de trabajo con IA – para cualquier asignatura, en Nextcloud, en la aplicación de escritorio o con Claude y compañía a través de MCP. Código abierto.'
  },
  nav: { features: 'Funciones', ways: 'Usos', mcp: 'MCP', demo: 'Demo en vivo', install: 'Instalación', faq: 'FAQ', language: 'Idioma' },
  hero: {
    badge: 'Código abierto · MIT',
    headline: 'Plugin de IA para Euro-Office – en Nextcloud y en el escritorio',
    title: 'Crea fichas de trabajo con IA – para cualquier asignatura',
    description:
      'Describe lo que necesitas: Worksheet Assistant (tu asistente para fichas de trabajo) escribe ejercicios, textos con huecos, tablas, líneas para escribir, recuadros informativos y pentagramas directamente en tu documento – con el chat de IA integrado o con tu propio asistente de IA a través de MCP.',
    install: 'Instalar',
    more: 'Cómo funciona',
    imageAlt:
      'Euro-Office con Worksheet Assistant: una ficha sobre el ciclo del agua creada con el chat de IA; a la izquierda, el chat con la petición'
  },
  features: {
    headline: 'Funciones',
    title: 'De la hoja en blanco a la ficha terminada',
    description: 'Pensado para docentes y futuros docentes – para fichas, exámenes y material de clase de cualquier asignatura.',
    items: [
      {
        title: 'Fichas completas desde el chat',
        description:
          '«Crea una ficha sobre el ciclo del agua para 5.º de primaria»: título, ejercicios, tabla, líneas para escribir y recuadro informativo en un solo paso – primero como vista previa, si quieres.'
      },
      {
        title: 'Edita en lugar de empezar de cero',
        description:
          '«Reformula el ejercicio 1 para 3.º de primaria», «Convierte el ejercicio 2 en un texto con huecos», «Añade una página de soluciones» – la IA solo cambia lo que le pides. Para borrar hace falta tu confirmación.'
      },
      {
        title: 'Pentagramas y letras de canciones',
        description:
          'Melodías, pentagramas vacíos y letras como imágenes listas para imprimir. Los nombres de notas alemanes (h, fis, b) se convierten de forma fiable; cada pentagrama sigue siendo editable.'
      },
      {
        title: 'Tu asistente de IA a través de MCP',
        description: 'Claude, ChatGPT, Le Chat y otros editan el documento abierto con las mismas herramientas – sin clave de IA en el plugin.'
      },
      {
        title: 'La privacidad en tus manos',
        description: 'Mistral como proveedor europeo, un modelo local con Ollama o ninguna IA. La clave se queda en el servidor y el inicio de sesión es con la cuenta de Nextcloud.'
      },
      {
        title: 'Nextcloud, servidor o escritorio',
        description:
          'Un solo comando para Nextcloud AIO, un archivo de Docker Compose para tu propio Document Server o la aplicación complementaria para la aplicación de escritorio (Windows, macOS, Linux).'
      }
    ]
  },
  ways: {
    headline: 'Usos',
    title: 'Tres formas – un solo plugin',
    description: 'Elige dónde trabajas y qué IA quieres usar. Todas las formas se pueden combinar.',
    items: [
      {
        title: 'En Nextcloud',
        badge: 'para centros escolares',
        description: 'El plugin en el Euro-Office de Nextcloud y, a su lado, el pequeño servidor. Cada docente inicia sesión con su cuenta de Nextcloud.',
        bullets: ['Instalación con un solo comando (Nextcloud AIO)', 'Se mantiene tras las actualizaciones de AIO', 'Clave de IA solo en el servidor'],
        link: 'Instalar en Nextcloud'
      },
      {
        title: 'En tu ordenador',
        badge: 'Windows · macOS · Linux',
        description: 'La aplicación de escritorio de Euro-Office o Nextcloud Office con la aplicación complementaria – sin servidor propio.',
        bullets: ['Instala el plugin por sí sola', 'Tu propia clave de API o un modelo local', 'MCP para Claude Desktop incluido'],
        link: 'Descargar la aplicación complementaria'
      },
      {
        title: 'Con tu asistente de IA',
        badge: 'MCP',
        description: 'Claude, ChatGPT, Le Chat u otro cliente MCP trabaja directamente en el documento abierto.',
        bullets: ['Las mismas herramientas que el chat', 'Inicio de sesión con Nextcloud (OAuth) o contraseña de aplicación', 'En local, sin inicio de sesión'],
        link: 'Configurar MCP'
      }
    ]
  },
  prompts: {
    headline: 'Ejemplos',
    title: 'Cómo hablar con Worksheet Assistant',
    description: 'Bastan frases normales. La IA conoce la estructura de tu documento y responde en tu idioma.',
    worksheetLabel: 'Fichas de trabajo',
    musicLabel: 'Música',
    worksheet: [
      'Crea una ficha sobre el ciclo del agua para 5.º de primaria con tres ejercicios, una tabla y un recuadro informativo.',
      'Cambia el enunciado del ejercicio 1 para que lo entiendan alumnos de 3.º de primaria.',
      'Convierte el ejercicio 2 en un texto con 8 huecos.',
      'Añade una página de soluciones al final.',
      'Borra el ejercicio 3.'
    ],
    music: [
      'Debajo del ejercicio 2, inserta un pentagrama con c – f – g y, debajo, un pentagrama vacío para copiarlo.',
      'Necesito un pentagrama: 4/4 bc1, f1, g2, be2, c1, c1',
      'Cambia el pentagrama 1, por favor: en lugar de bc #c',
      'Añade la letra al pentagrama 1: Los pollitos dicen pío, pío, pío',
      'Después del ejercicio 3, inserta tres pentagramas vacíos en clave de fa.'
    ]
  },
  mcp: {
    headline: 'MCP',
    title: 'Tu asistente de IA escribe contigo',
    description:
      'Con el Model Context Protocol, Claude, ChatGPT, Le Chat y otros asistentes de IA trabajan directamente en el documento que tienes abierto en Euro-Office. El plugin aplica los cambios – los ves al instante y puedes deshacerlos con Ctrl+Z.',
    imageAlt: 'Un asistente de IA ha añadido mediante MCP un ejercicio extra con pentagrama y letra; el chat del plugin muestra las llamadas MCP',
    items: [
      { title: 'Las mismas herramientas', description: 'Bloques de ficha, edición, borrado, pentagramas y letras – todo se revisa antes de llegar al documento.' },
      { title: 'Solo tus documentos', description: 'Con el inicio de sesión de Nextcloud, un asistente solo accede a los documentos de su usuario.' },
      { title: 'Tú tienes el control', description: 'El documento solo se conecta si activas «Allow MCP access» en el plugin. El acceso lo revocas en Nextcloud.' }
    ],
    clientsTitle: 'Probado',
    clientsText: 'Con el SDK de TypeScript de MCP (protocolo 2026-07-28) y peticiones en formato 2025, por HTTP y stdio. Claude, ChatGPT y Le Chat aún no se han conectado.'
  },
  companion: {
    headline: 'Escritorio',
    title: 'La aplicación complementaria para los editores de escritorio',
    description:
      'Las aplicaciones de escritorio de Euro-Office y Nextcloud Office no tienen gestor de plugins ni servidor. La aplicación complementaria se encarga de ambas cosas en tu ordenador – un solo programa, sin instalación.',
    imageAlt: 'Página de ajustes de la aplicación complementaria: plugin instalado, proveedor de IA Mistral, configuración para Claude Desktop',
    items: [
      { title: 'Plugin configurado automáticamente', description: 'Instala, actualiza y conecta el plugin – sin ajustes en el editor.' },
      { title: 'Tu IA', description: 'Mistral, OpenAI, Anthropic, Ollama o cualquier API compatible con OpenAI – la clave se queda en tu ordenador.' },
      { title: 'MCP incluido', description: 'Entradas listas para Claude Desktop y Claude Code; si quieres, se inicia con el ordenador.' }
    ]
  },
  music: {
    headline: 'Música',
    title: 'Fichas de música – incluso sin IA',
    description:
      'La pestaña de música funciona sin servidor y sin clave de API: plantillas, editor ABC con vista previa en directo, nombres de notas alemanes y letras. Un pentagrama seleccionado se puede cargar, cambiar y sustituir.',
    imageAlt: 'Pestaña de música: plantilla «Alle meine Entchen» con letra, notación ABC y vista previa',
    items: [
      { title: 'Plantillas', description: 'Pentagramas vacíos en clave de sol o de fa, escalas y una melodía de ejemplo con letra.' },
      { title: 'Convertir nombres de notas', description: 'c – f – g, fis′ g′ a′ h′, «bc» para do bemol y compases como 4/4 – los números como octava o como valor de nota.' },
      { title: 'Listo para imprimir y editable', description: 'Imágenes a 300 ppp; el código ABC se guarda en el texto alternativo.' }
    ]
  },
  demo: {
    headline: 'Demo en vivo',
    title: 'Prueba el conversor de nombres de notas',
    description: 'Escribe nombres de notas alemanes – el pentagrama aparece al instante. Es el mismo conversor que usa el plugin en el editor.',
    loading: 'Cargando la demo…',
    notesLabel: 'Nombres de notas (alemanes)',
    notesHelp: 'p. ej. c – f – g, fis′ g′ a′ h′, bc = do bemol, 4/4 = compás',
    clefLabel: 'Clave',
    treble: 'Clave de sol',
    bass: 'Clave de fa',
    digitsLabel: 'Números',
    digitsAuto: 'Números: automático',
    digitsOctave: 'Números = octava (c1 = c′)',
    digitsDuration: 'Números = valor de nota (c1 = redonda)',
    lyricsLabel: 'Letra (opcional)',
    lyricsHelp: 'Separa las sílabas con -: Los po-lli-tos di-cen',
    showAbc: 'Mostrar notación ABC',
    paperLoading: 'Cargando el pentagrama…',
    examples: ['c – f – g', 'Hänschen klein', 'Valores de nota', 'Clave de fa'],
    noteCount: '{n} notas',
    readAsDurations: 'números leídos como valores de nota',
    readAsOctaves: 'números leídos como octavas',
    meterInfo: 'Compás de {meter}, {bars} compases',
    issues: {
      unknownName: '«{token}» no es un nombre de nota conocido.',
      doubleAccidental: '«{token}» tiene dos alteraciones.',
      farFromStaff: '«{token}» ({octave}) queda muy fuera del pentagrama.',
      incompleteBar: 'Las notas no completan compases enteros de {meter} ({bars} compases).',
      tooManySyllables: 'La letra tiene más sílabas que notas la melodía.',
      tooFewSyllables: 'La letra no alcanza para todas las notas – las demás quedan sin texto.'
    }
  },
  parts: {
    headline: 'Qué se ejecuta dónde',
    title: 'Un plugin, un pequeño servidor – y la IA que elijas',
    description: 'El plugin no necesita servidor propio. Para el chat de IA y MCP se añade un pequeño servicio – en el servidor o como aplicación complementaria.',
    items: [
      {
        title: 'Plugin',
        badge: 'siempre',
        description: 'Solo archivos (≈ 1 MB) en la carpeta de plugins de Euro-Office. Funciona en el editor del navegador o en la aplicación de escritorio.',
        bullets: ['Inserta y edita contenido', 'Dibuja pentagramas, pestaña de música completa', 'Ejecuta las llamadas MCP en el documento']
      },
      {
        title: 'Servidor',
        badge: 'para el chat de IA y MCP',
        description: 'Un pequeño servicio (Docker, ≈ 30 MB de RAM) junto a Nextcloud – o la aplicación complementaria en tu propio ordenador.',
        bullets: ['La clave de API se queda en el servidor', 'Inicio de sesión con Nextcloud, límite de peticiones', 'Revisa el contenido antes de que llegue al documento']
      },
      {
        title: 'Modelo de lenguaje',
        badge: 'opcional',
        description: 'Mistral (predeterminado), OpenAI, Anthropic, cualquier API compatible con OpenAI como Ollama – o tu propio asistente de IA a través de MCP.',
        bullets: ['Intercambiable sin modificar el plugin', 'Posible con proveedor europeo o en local', 'Los costes los factura el proveedor']
      }
    ]
  },
  install: {
    headline: 'Instalación',
    title: 'Listo en tres pasos',
    description: 'Elige tu opción. Más variantes y todos los ajustes están en el README.',
    tabs: { nextcloud: 'Nextcloud AIO', desktop: 'Aplicación de escritorio', docker: 'Servidor propio', mcp: 'Asistente de IA (MCP)' },
    nextcloud: [
      {
        title: 'Instalar el plugin',
        description: 'Ejecútalo en el servidor AIO. El script copia el plugin en el contenedor de Euro-Office; con `--watch` lo vuelve a instalar automáticamente después de cada actualización de AIO.',
        codeLabel: 'Shell (servidor AIO)'
      },
      {
        title: 'Iniciar el servidor',
        description: 'Guarda la clave de IA y ofrece el endpoint MCP. Hazlo accesible por HTTPS, p. ej. como `https://worksheets.your-school.org`. Con `AUTH_MODE=nextcloud`, cada docente inicia sesión con su cuenta de Nextcloud.',
        codeLabel: 'Shell'
      },
      {
        title: 'Iniciar sesión en el editor',
        description: 'Abre un documento → **Plugins** → **Worksheet Assistant** → **Settings**: introduce la dirección del servidor y pulsa **Sign in with Nextcloud**. Listo.'
      }
    ],
    desktop: [
      { title: 'Instalar la aplicación de escritorio', description: 'Instala la aplicación de escritorio de Euro-Office o Nextcloud Office para Windows, macOS o Linux y ábrela una vez.' },
      {
        title: 'Iniciar la aplicación complementaria',
        description: 'Descarga `worksheet-assistant` para tu sistema desde las Releases, descomprímelo e inícialo. Instala el plugin y abre sus ajustes en el navegador. macOS: la primera vez, clic derecho → **Abrir**; Windows: **Más información → Ejecutar de todas formas**.',
        codeLabel: 'Linux / macOS'
      },
      {
        title: 'Elegir tu IA',
        description: 'En los ajustes (`http://127.0.0.1:8787`), introduce el proveedor y la clave de API – o un modelo local con Ollama, o solo MCP. Después abre un documento en la aplicación de escritorio: **Plugins → Worksheet Assistant**.'
      }
    ],
    docker: [
      { title: 'Compilar el plugin', description: 'Descarga el archivo de la release o compila el plugin tú mismo.', codeLabel: 'Shell' },
      {
        title: 'Iniciar el Document Server y el servidor',
        description: '`deploy/` inicia Euro-Office con el plugin como volumen y, además, el servidor. Después, Nextcloud usa el Document Server como servidor externo.',
        codeLabel: 'Shell'
      },
      { title: 'Configurar el editor', description: 'En **Settings** del plugin, introduce la dirección del servidor y el token (o inicia sesión con Nextcloud) y pulsa «Test connection».' }
    ],
    mcp: [
      {
        title: 'Conectar el documento',
        description: 'En el documento abierto, activa **Plugins → Worksheet Assistant → Settings → Allow MCP access** (con la aplicación complementaria ya viene activado). El panel muestra la dirección MCP.'
      },
      {
        title: 'Conectar tu asistente de IA',
        description: 'Añade la dirección MCP: en Claude, ChatGPT o Le Chat como conector personalizado (inicio de sesión con Nextcloud), en Claude Code con un comando, en Claude Desktop a través de la aplicación complementaria (`mcp-stdio`).',
        codeLabel: 'Claude Code'
      },
      { title: 'Manos a la obra', description: '«Crea en el documento abierto una ficha sobre fracciones para 6.º de primaria» – los cambios aparecen al instante en el editor.' }
    ],
    readme: 'Todas las opciones en el README'
  },
  faq: {
    headline: 'FAQ',
    title: 'Preguntas frecuentes',
    items: [
      {
        label: '¿El plugin necesita su propio servidor?',
        content:
          'El plugin en sí, no – son solo archivos que sirve Euro-Office. El chat de IA y MCP necesitan el pequeño servidor; en la aplicación de escritorio, la aplicación complementaria cumple esa función. La pestaña de música funciona sin ningún servidor.'
      },
      {
        label: '¿Qué IA se usa?',
        content:
          'La que tú configures: Mistral (proveedor europeo, predeterminado), OpenAI, Anthropic, cualquier API compatible con OpenAI o un modelo local con Ollama. O ninguna – entonces usas tu propio asistente de IA a través de MCP.'
      },
      {
        label: '¿Qué datos se envían a la IA?',
        content:
          'Con cada petición del chat, la conversación y la estructura del documento (textos, pentagramas en ABC). El servidor no guarda conversaciones ni documentos. Con MCP, tu asistente de IA lee el documento mediante las herramientas. Si no quieres que nada salga de tu red, usa un modelo local.'
      },
      {
        label: '¿Qué es MCP?',
        content:
          'El Model Context Protocol es un estándar abierto que permite a los asistentes de IA usar herramientas. El servidor ofrece las herramientas del plugin – así, por ejemplo, Claude edita tu documento abierto como si hubieras usado el chat del plugin.'
      },
      {
        label: '¿Cómo inician sesión los docentes?',
        content:
          'Con `AUTH_MODE=nextcloud`, con su cuenta de Nextcloud: en el plugin con un clic (Nextcloud Login Flow); los asistentes de IA, mediante OAuth a través de Nextcloud o con una contraseña de aplicación. Cada persona solo accede a sus propios documentos; el acceso se puede revocar en Nextcloud, en Dispositivos y sesiones.'
      },
      {
        label: '¿Funciona sin Nextcloud?',
        content: 'Sí: con la aplicación de escritorio y la aplicación complementaria, o con tu propio Document Server de Euro-Office y un token de acceso compartido.'
      },
      {
        label: '¿Puedo cambiar después el contenido insertado?',
        content:
          'Sí. La IA lee el contenido y sustituye exactamente las partes que indiques. Los pentagramas guardan su código ABC en el texto alternativo y se pueden cambiar desde el chat o en la pestaña de música.'
      },
      {
        label: '¿Qué pasa cuando se actualiza Nextcloud AIO?',
        content:
          'AIO vuelve a crear el contenedor de Euro-Office, y con ello desaparecen los plugins añadidos. Con `--watch`, el script de instalación configura un pequeño servicio que vuelve a instalar el plugin automáticamente después de cada reinicio.'
      },
      {
        label: '¿Con qué se ha probado?',
        content:
          'Con Euro-Office 9.3.8 (Document Server y aplicación de escritorio en Linux), Nextcloud 34 y Mistral – de forma automatizada en el editor real. La aplicación complementaria se compila y se comprueba automáticamente para Windows y macOS. Los asistentes alojados como claude.ai aún no se han probado con una instalación pública.'
      },
      {
        label: '¿Es de código abierto?',
        content:
          'Sí, con licencia MIT. Incluye abcjs (MIT) y los archivos de plugin de ONLYOFFICE (AGPL-3.0); la aplicación complementaria contiene Node.js y paquetes de npm – todos con sus textos de licencia.'
      }
    ]
  },
  cta: {
    title: '¿Todo listo para tu próxima ficha?',
    description: 'Código fuente, releases y documentación detallada en GitHub.',
    repo: 'Ir al repositorio',
    releases: 'Releases'
  },
  footer: {
    license: 'Worksheet Assistant · licencia MIT',
    uses: 'usa abcjs (MIT) y el SDK de plugins de ONLYOFFICE (AGPL-3.0)',
    copy: 'Copiar',
    copied: 'Copiado'
  }
}

export default es
