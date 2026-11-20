import type { SiteContent } from './types'

const es: SiteContent = {
  meta: {
    title: 'Worksheet Assistant para Euro-Office',
    description:
      'Crea fichas de trabajo con IA – para cualquier asignatura: ejercicios con buen diseño, pasatiempos, gráficos, imágenes, diagramas de informática y pentagramas. En Nextcloud, en la aplicación de escritorio o con Claude y compañía a través de MCP. Código abierto.'
  },
  nav: { features: 'Funciones', informatics: 'Informática', ways: 'Usos', mcp: 'MCP', install: 'Instalación', faq: 'FAQ', language: 'Idioma' },
  hero: {
    badge: 'Novedad en {version}: diagramas de informática',
    headline: 'Plugin de IA para Euro-Office – en Nextcloud y en el escritorio',
    title: 'Crea fichas de trabajo con IA – para cualquier asignatura',
    description:
      'Describe lo que necesitas: Worksheet Assistant (tu asistente para fichas de trabajo) maqueta ejercicios, textos con huecos, pasatiempos, gráficos, fórmulas, imágenes, diagramas UML y pentagramas con un diseño uniforme, directamente en tu documento – con el chat de IA integrado o con tu propio asistente de IA a través de MCP.',
    install: 'Instalar',
    more: 'Todas las funciones',
    imageAlt:
      'Euro-Office con Worksheet Assistant: una ficha sobre el ciclo del agua con el diseño «Moderno», con encabezado, título, línea para el nombre y ejercicios numerados con iconos, estrellas y puntos; a la izquierda, el panel con el chat de IA'
  },
  features: {
    headline: 'Funciones',
    title: 'Todo para tu próxima ficha',
    description: 'Pensado para docentes y futuros docentes – para fichas, exámenes y material de clase de cualquier asignatura. La IA elige los bloques y el plugin los coloca con limpieza en el documento.',
    items: [
      {
        title: 'Fichas completas desde el chat',
        description: '«Crea una ficha sobre el ciclo del agua para 5.º de primaria» – con título, línea para el nombre, ejercicios, material y recuadro informativo. Primero la vista previa y después se inserta.'
      },
      {
        title: 'Tres diseños',
        description: 'Clásico (blanco y negro, ahorra tóner), Moderno o Primaria (letra grande, a todo color). Las fuentes, los colores y los espacios vienen del diseño.'
      },
      {
        title: 'Ejercicios y pasatiempos',
        description: 'Texto con huecos y banco de palabras, opción múltiple, verdadero/falso, relacionar, crucigramas y sopas de letras, texto de lectura con números de línea y más.'
      },
      {
        title: 'Gráficos y fórmulas',
        description: 'Recta numérica, sistema de coordenadas, diagramas, mapa mental, pautas de escritura y papel cuadriculado. Las fórmulas en LaTeX se convierten en ecuaciones reales y editables.'
      },
      {
        title: 'Imágenes',
        description: 'Pictogramas de ARASAAC, fotos de Wikimedia Commons o tus propias imágenes – la atribución de la licencia aparece automáticamente debajo.'
      },
      {
        title: 'Diagramas de informática',
        description: 'Diagramas UML de clases, de secuencia, de estados, de actividades y de casos de uso, autómatas, diagramas de Nassi-Shneiderman, diagramas de flujo y diagramas ER.'
      },
      {
        title: 'Pentagramas y letras de canciones',
        description: 'Melodías, pentagramas vacíos y letras como imágenes listas para imprimir. Los nombres de notas alemanes (h, fis, b) se convierten de forma fiable.'
      },
      {
        title: 'Página y estilo del centro',
        description: 'A4, A5 o Letter, vertical u horizontal, márgenes, columnas, encabezado con el nombre del centro y el logotipo, pie de página con números de página.'
      },
      {
        title: 'Revisada, con hoja de soluciones',
        description: 'Después de crearla, la IA revisa la numeración, los enunciados, el espacio para las respuestas, los puntos y que se lea bien para el curso. Si quieres, la solución sale con el mismo diseño.'
      },
      {
        title: 'Edita en lugar de empezar de cero',
        description: '«Reformula el ejercicio 1 para 3.º de primaria», «Convierte el ejercicio 2 en un texto con huecos» – la IA solo cambia lo que le pides. Para borrar hace falta tu confirmación.'
      },
      {
        title: 'Tu asistente de IA a través de MCP',
        description: 'Claude, ChatGPT, Le Chat y otros editan el documento abierto con las mismas herramientas – sin clave de IA en el plugin.'
      },
      {
        title: 'La privacidad en tus manos',
        description: 'Mistral como proveedor europeo, un modelo local con Ollama o ninguna IA. La clave se queda en el servidor y el inicio de sesión es con la cuenta de Nextcloud.'
      }
    ],
    more: 'Más información'
  },
  designs: {
    headline: 'Diseños',
    title: 'Un diseño para toda la hoja',
    description:
      'La IA solo elige el diseño – las fuentes, los tamaños, los colores y los espacios de todo lo que inserta el asistente salen de él. Así cada hoja parece hecha de una pieza, aunque más adelante añadas ejercicios.',
    themes: [
      { title: 'Clásico', description: 'Blanco y negro y ahorra tóner – para fotocopias y exámenes.' },
      { title: 'Moderno', description: 'Letra clara con un acento azul – para secundaria.' },
      { title: 'Primaria', description: 'Letra grande, interlineado de 1,5 y colores agradables.' }
    ],
    imageAlt: 'La misma ficha, «Der Igel im Herbst» (el erizo en otoño), con el diseño {theme}',
    items: [
      { title: 'Cabeceras de ejercicio', description: 'Número, iconos para la forma de trabajo y la actividad, estrellas de dificultad, puntos y tiempo de realización.' },
      { title: 'Recuadros informativos', description: 'Recuerda, consejo, atención, ejemplo, definición, solución e información – cada uno con su icono.' },
      { title: 'En tu idioma', description: 'Rótulos como nombre, curso, banco de palabras o verdadero/falso en siete idiomas.' }
    ]
  },
  tasks: {
    headline: 'Ejercicios',
    title: 'Ejercicios con buen aspecto',
    description:
      'Más de 40 bloques que la IA combina libremente. Los pasatiempos se calculan en lugar de improvisarse – los crucigramas y las sopas de letras siempre se pueden resolver.',
    imageAlt: 'Página de ejercicios con el diseño «Moderno»: un crucigrama calculado con pistas horizontales y verticales y una sopa de letras con lista de palabras',
    items: [
      { title: 'Textos con huecos y cuestionarios', description: 'Texto con huecos con banco de palabras automático, opción múltiple, tabla de verdadero/falso, relacionar con líneas o con letras.' },
      { title: 'Pasatiempos', description: 'Crucigramas y sopas de letras en tres niveles de dificultad – con solución si lo pides.' },
      { title: 'Leer y escribir', description: 'Textos de lectura con números de línea, **coloreado de sílabas** (sílabas alternas en azul y rojo), pautas de escritura de primaria (**Lineatur** 1–4, las líneas de escritura alemanas) y papel cuadriculado.' },
      { title: 'Alrededor del ejercicio', description: 'Autoevaluación con caritas, tarjetas de ayuda para recortar, tabla de puntos y notas, códigos QR y maquetación en dos o tres columnas.' }
    ]
  },
  graphics: {
    headline: 'Gráficos y fórmulas',
    title: 'Matemáticas y ciencias, bien dibujadas',
    description:
      'Los gráficos se dibujan a partir de datos, no se inventan como imagen: los ejes, las escalas y los rótulos son correctos. Cada gráfico lleva su fuente en el texto alternativo – la IA puede modificarlo más adelante.',
    imageAlt: 'Ficha de matemáticas: recta numérica con huecos, diagrama de columnas, sistema de coordenadas con un triángulo y una fórmula del área',
    items: [
      { title: 'Recta numérica y sistema de coordenadas', description: 'Con huecos para rellenar, puntos, segmentos y polígonos.' },
      { title: 'Diagramas', description: 'Columnas, barras, líneas y circular – también vacíos para dibujarlos a mano.' },
      { title: 'Fórmulas', description: 'LaTeX se convierte en una ecuación real en el documento, también en medio de una frase.' },
      { title: 'Mapas mentales y dibujos', description: 'Mapas mentales (también con burbujas vacías) y dibujos sencillos que diseña la propia IA.' }
    ]
  },
  pictures: {
    headline: 'Imágenes',
    title: 'Imágenes que encajan en la ficha',
    description:
      'Sobre todo en primaria y en educación especial, las imágenes ayudan a comprender. La IA busca imágenes adecuadas y las coloca en la hoja – junto a las palabras, como introducción o en columnas junto al texto. La atribución de la licencia la imprime automáticamente debajo.',
    imageAlt: 'Ficha «Tiere im Wald» (animales del bosque) con el diseño «Primaria»: pictogramas de ARASAAC de erizo, búho, liebre, ardilla, zorro y cuervo con la atribución de la licencia; debajo, los nombres de los animales con sílabas coloreadas y una pauta de escritura de primaria (Lineatur)',
    items: [
      { title: 'Pictogramas', description: 'ARASAAC – dibujos sencillos y uniformes de objetos, animales, actividades y emociones, pensados para la educación especial.' },
      { title: 'Fotos e imágenes históricas', description: 'Wikimedia Commons – animales, plantas, lugares, arte, romanos y Edad Media.' },
      { title: 'Tus propias imágenes', description: 'Una carpeta en tu Nextcloud o en tu ordenador, p. ej. con imágenes de cómic para latín. La IA las encuentra por los nombres de los archivos y las carpetas.' }
    ]
  },
  informatics: {
    badge: 'Novedad',
    headline: 'Informática',
    title: 'UML, diagramas de Nassi-Shneiderman y diagramas ER',
    description:
      'La IA solo describe el modelo; el diseño se calcula: las cajas y las flechas quedan rectas y legibles, con la notación escolar como en el libro de texto. Diez tipos de diagramas – cada uno también como diagrama con huecos y con hoja de soluciones.',
    diagrams: [
      { title: 'Diagrama de clases para rellenar', description: 'Un atributo como línea de escritura, un método como línea vacía, la herencia de Sparkonto (cuenta de ahorros) para que la dibujen los alumnos.' },
      { title: 'Diagrama de secuencia', description: 'Actor y objetos, llamadas, respuesta, barras de activación y un fragmento alt.' },
      { title: 'Autómata finito', description: 'Flecha de inicio, estado de aceptación como doble círculo, transiciones con símbolos.' },
      { title: 'Diagrama de Nassi-Shneiderman', description: 'Según DIN 66261: condicional y bucle (mcd según Euclides).' },
      { title: 'Diagrama de flujo', description: 'Según DIN 66001: inicio, entrada y salida, decisión con ja/nein (sí/no), fin.' },
      { title: 'Diagrama ER', description: 'Notación de Chen con atributos clave y cardinalidades 1:n y n:m.' }
    ],
    items: [
      { title: 'Diez tipos de diagramas', description: 'Diagramas de clases, de objetos, de secuencia, de estados, de actividades y de casos de uso, autómatas finitos, diagramas de Nassi-Shneiderman, diagramas de flujo y diagramas ER (Chen, (min,max), pata de gallo).' },
      { title: 'Para rellenar', description: 'Huecos en cualquier texto, flechas y relaciones que faltan, líneas y cajas vacías – y con una sola frase, la solución con el mismo diseño.' },
      { title: 'Encaja en la hoja', description: 'El diseño se calcula y se ajusta al ancho del texto. Como todos los gráficos, cada diagrama se puede cambiar desde el chat.' }
    ]
  },
  music: {
    headline: 'Música',
    title: 'Fichas de música – incluso sin IA',
    description:
      'La pestaña de música funciona sin servidor y sin clave de API: plantillas, editor ABC con vista previa en directo, nombres de notas alemanes y letras. Un pentagrama seleccionado se puede cargar, cambiar y sustituir.',
    imageAlt: 'Pestaña de música: la plantilla «Alle meine Entchen» con letra, notación ABC y vista previa, insertada debajo de un ejercicio con el diseño «Moderno»',
    items: [
      { title: 'Plantillas', description: 'Pentagramas vacíos en clave de sol o de fa, escalas y una melodía de ejemplo con letra.' },
      { title: 'Convertir nombres de notas', description: 'c – f – g, fis′ g′ a′ h′, «bc» para do bemol y compases como 4/4 – los números como octava o como valor de nota.' },
      { title: 'Listo para imprimir y editable', description: 'Imágenes a 300 ppp; el código ABC se guarda en el texto alternativo. Desde el chat: «Cambia el pentagrama 1: en lugar de bc #c».' }
    ]
  },
  mcp: {
    headline: 'MCP',
    title: 'Tu asistente de IA escribe contigo',
    description:
      'Con el Model Context Protocol, Claude, ChatGPT, Le Chat y otros asistentes de IA trabajan directamente en el documento que tienes abierto en Euro-Office. El plugin aplica los cambios – los ves al instante y puedes deshacerlos con Ctrl+Z.',
    imageAlt: 'Un asistente de IA ha añadido mediante MCP un tercer ejercicio con la canción «Es regnet» como pentagrama; el panel muestra las llamadas MCP',
    items: [
      { title: 'Las mismas herramientas', description: 'Todos los bloques, imágenes, diagramas, diseño de página, revisión, edición y pentagramas – todo se revisa antes de llegar al documento.' },
      { title: 'Solo tus documentos', description: 'Con el inicio de sesión de Nextcloud, un asistente solo accede a los documentos de su usuario.' },
      { title: 'Tú tienes el control', description: 'El documento solo se conecta si activas «MCP-Zugriff erlauben» (permitir acceso MCP) en el plugin. El acceso lo revocas en Nextcloud.' }
    ],
    clientsTitle: 'Probado',
    clientsText: 'Con el SDK de TypeScript de MCP (protocolo 2026-07-28) y peticiones en formato 2025, por HTTP y stdio. Los asistentes alojados como claude.ai, ChatGPT y Le Chat aún no se han probado con una instalación pública.'
  },
  companion: {
    headline: 'Escritorio',
    title: 'La aplicación Worksheet Assistant para tu ordenador',
    description:
      'Las aplicaciones de escritorio de Euro-Office y Nextcloud Office no tienen gestor de plugins ni servidor. La aplicación Worksheet Assistant se encarga de ambas cosas: se instala como cualquier otra aplicación, la abres una vez – y después trabaja de forma invisible en segundo plano. Sin terminal ni navegador.',
    imageAlt: 'Ventana de la aplicación Worksheet Assistant, página «Übersicht» (resumen): los tres pasos completados – plugin en la aplicación de escritorio, chat de IA en el plugin, Claude conectado',
    items: [
      { title: 'Plugin configurado automáticamente', description: 'Instala el plugin en Euro-Office y Nextcloud Office, lo conecta y lo mantiene actualizado – sin ajustes en el editor.' },
      { title: 'Tu IA, tus imágenes', description: 'Mistral, OpenAI, Anthropic, Ollama o cualquier API compatible con OpenAI – la clave se queda en tu ordenador. Además, una carpeta de imágenes propia.' },
      { title: 'Claude con un clic', description: 'Conecta Claude Desktop o Claude Code. La aplicación instala las nuevas versiones con un clic y, si quieres, se inicia con el ordenador. En macOS, notarizada por Apple.' }
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
        bullets: ['Instalación con un solo comando (Nextcloud AIO)', 'Se mantiene tras las actualizaciones de AIO', 'Imágenes propias en una carpeta de Nextcloud'],
        link: 'Instalar en Nextcloud'
      },
      {
        title: 'En tu ordenador',
        badge: 'Windows · macOS · Linux',
        description: 'La aplicación de escritorio de Euro-Office o Nextcloud Office con la aplicación Worksheet Assistant – se instala como cualquier otra aplicación, sin servidor propio.',
        bullets: ['Instala y actualiza el plugin por sí sola', 'Tu propia clave de API o un modelo local', 'Conecta Claude Desktop con un clic'],
        link: 'Descargar la aplicación'
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
    groups: [
      {
        label: 'Fichas de trabajo',
        items: [
          'Crea una ficha sobre el ciclo del agua para 5.º de primaria con tres ejercicios, un texto con huecos y un recuadro informativo.',
          'Conviértela en un crucigrama con diez términos y añade al final una página de soluciones.',
          'Cambia el enunciado del ejercicio 1 para que lo entiendan alumnos de 3.º de primaria.',
          'Usa el diseño Clásico y pon el nombre de nuestro centro y los números de página en el encabezado y el pie.',
          'Revisa la ficha y borra el ejercicio 3.'
        ]
      },
      {
        label: 'Imágenes y diagramas',
        items: [
          'Una ficha de lectura para 1.º de primaria sobre los animales del bosque – con un pictograma junto a cada palabra y sílabas coloreadas.',
          'Pon una foto de un legionario romano junto al texto.',
          'Dibuja un diagrama de clases UML de Cuenta, Cuenta corriente y Cuenta de ahorros en el que los alumnos completen la herencia.',
          'Crea un diagrama de Nassi-Shneiderman del algoritmo de Euclides y debajo un diagrama de flujo vacío para rellenar.',
          'Un diagrama ER para alumnos, cursos y docentes en notación de Chen.'
        ]
      },
      {
        label: 'Música',
        items: [
          'Debajo del ejercicio 2, inserta un pentagrama con c – f – g y, debajo, un pentagrama vacío para copiarlo.',
          'Necesito un pentagrama: 4/4 bc1, f1, g2, be2, c1, c1',
          'Cambia el pentagrama 1, por favor: en lugar de bc #c',
          'Añade la letra al pentagrama 1: Los pollitos dicen pío, pío, pío',
          'Después del ejercicio 3, inserta tres pentagramas vacíos en clave de fa.'
        ]
      }
    ]
  },
  parts: {
    headline: 'Qué se ejecuta dónde',
    title: 'Un plugin, un pequeño servidor – y la IA que elijas',
    description: 'El plugin no necesita servidor propio. Para el chat de IA, las imágenes y MCP se añade un pequeño servicio – en el servidor o en la aplicación Worksheet Assistant de tu ordenador.',
    items: [
      {
        title: 'Plugin',
        badge: 'siempre',
        description: 'Solo archivos (≈ 1,4 MB) en la carpeta de plugins de Euro-Office. Funciona en el editor del navegador o en la aplicación de escritorio.',
        bullets: ['Maqueta fichas, gráficos y diagramas', 'Dibuja pentagramas, pestaña de música completa', 'Ejecuta las llamadas MCP en el documento']
      },
      {
        title: 'Servidor',
        badge: 'para el chat de IA, imágenes y MCP',
        description: 'Un pequeño servicio (Docker, ≈ 30 MB de RAM) junto a Nextcloud – o en segundo plano en la aplicación Worksheet Assistant de tu propio ordenador.',
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
        description: 'Guarda la clave de IA, busca imágenes y ofrece el endpoint MCP. Hazlo accesible por HTTPS, p. ej. como `https://worksheets.your-school.org`. Con `AUTH_MODE=nextcloud`, cada docente inicia sesión con su cuenta de Nextcloud.',
        codeLabel: 'Shell'
      },
      {
        title: 'Iniciar sesión en el editor',
        description: 'Abre un documento → **Plugins** → **Asistente de fichas** → **Einstellungen** (ajustes): introduce la dirección del servidor y pulsa **Mit Nextcloud anmelden** (iniciar sesión con Nextcloud). Listo. Tus propias imágenes las guardas en la carpeta `Arbeitsblatt-Bilder` de tu Nextcloud.'
      }
    ],
    desktop: [
      { title: 'Instalar Euro-Office', description: 'Instala la aplicación de escritorio de Euro-Office o Nextcloud Office para Windows, macOS o Linux y ábrela una vez.' },
      {
        title: 'Instalar la aplicación Worksheet Assistant',
        description: 'Descarga el instalador para tu sistema e instala la aplicación como cualquier otra (macOS: arrástrala a **Aplicaciones**); se llama **Worksheet Assistant**. Al iniciarla se abre su ventana: configura el plugin y trabaja de forma invisible en segundo plano. En macOS la aplicación está notarizada por Apple. En Windows aún no está firmada – si SmartScreen muestra una advertencia: **Más información → Ejecutar de todas formas**.'
      },
      {
        title: 'Elegir tu IA',
        description: 'En la aplicación, en la página **KI-Chat** (chat de IA), introduce el proveedor y la clave de API – o un modelo local con Ollama, o solo MCP. En la página **Bilder** (imágenes) eliges una carpeta de imágenes propia. Después abre un documento en Euro-Office: **Plugins → Asistente de fichas**. Puedes cerrar la ventana – la aplicación sigue funcionando en el área de notificación (macOS: barra de menús).'
      }
    ],
    docker: [
      { title: 'Compilar el plugin', description: 'Descarga el archivo de la release o compila el plugin tú mismo.', codeLabel: 'Shell' },
      {
        title: 'Iniciar el Document Server y el servidor',
        description: '`deploy/` inicia Euro-Office con el plugin como volumen y, además, el servidor. Después, Nextcloud usa el Document Server como servidor externo.',
        codeLabel: 'Shell'
      },
      { title: 'Configurar el editor', description: 'En **Einstellungen** (ajustes) del plugin, introduce la dirección del servidor y el token (o inicia sesión con Nextcloud) y pulsa «Verbindung testen» (probar conexión).' }
    ],
    mcp: [
      {
        title: 'Conectar el documento',
        description: 'En el documento abierto, activa **Plugins → Asistente de fichas → Einstellungen → MCP-Zugriff erlauben** (ajustes → permitir acceso MCP); con la aplicación Worksheet Assistant ya viene activado. El panel muestra la dirección MCP.'
      },
      {
        title: 'Conectar tu asistente de IA',
        description: 'Añade la dirección MCP: en Claude, ChatGPT o Le Chat como conector personalizado (inicio de sesión con Nextcloud), en Claude Code con un comando. La aplicación Worksheet Assistant conecta Claude Desktop y Claude Code con un clic (página **Claude & MCP**).',
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
          'El plugin en sí, no – son solo archivos que sirve Euro-Office. El chat de IA, la búsqueda de imágenes y MCP necesitan el pequeño servidor; en tu propio ordenador, la aplicación Worksheet Assistant cumple esa función. La pestaña de música funciona sin ningún servidor.'
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
        label: '¿De dónde salen las imágenes – y puedo usarlas?',
        content:
          'De tres fuentes: pictogramas de ARASAAC (CC BY-NC-SA, de uso libre en la escuela), Wikimedia Commons (licencias libres) y tu propia carpeta de imágenes. El autor y la licencia de las imágenes libres aparecen automáticamente debajo de la imagen. El servidor solo consulta las direcciones fijas de ARASAAC y Wikimedia y tu carpeta – la IA nunca indica direcciones por su cuenta. Con `IMAGE_SOURCES` o en la aplicación desactivas las imágenes de internet.'
      },
      {
        label: '¿Qué diagramas de informática hay?',
        content:
          'Diagramas UML de clases, de objetos, de secuencia, de estados, de actividades y de casos de uso, autómatas finitos (AFD/AFN), diagramas de Nassi-Shneiderman según DIN 66261, diagramas de flujo según DIN 66001 y diagramas ER en notación de Chen, (min,max) o pata de gallo. Cada diagrama también está disponible para rellenar y con solución.'
      },
      {
        label: '¿Qué es MCP?',
        content:
          'El Model Context Protocol es un estándar abierto que permite a los asistentes de IA usar herramientas. El servidor ofrece las herramientas del plugin – así, por ejemplo, Claude edita tu documento abierto como si hubieras usado el chat del plugin.'
      },
      {
        label: '¿Cómo inician sesión los docentes?',
        content:
          'Con `AUTH_MODE=nextcloud`, con su cuenta de Nextcloud: en el plugin con un clic (Nextcloud Login Flow); los asistentes de IA, mediante OAuth a través de Nextcloud o con una contraseña de aplicación. Cada persona solo accede a sus propios documentos e imágenes; el acceso se puede revocar en Nextcloud, en Dispositivos y sesiones.'
      },
      {
        label: '¿Funciona sin Nextcloud?',
        content: 'Sí: con la aplicación de escritorio de Euro-Office o Nextcloud Office y la aplicación Worksheet Assistant, o con tu propio Document Server de Euro-Office y un token de acceso compartido.'
      },
      {
        label: '¿Puedo cambiar después el contenido insertado?',
        content:
          'Sí. La IA lee el contenido y sustituye exactamente las partes que indiques. Los gráficos, diagramas, imágenes y pentagramas guardan su fuente en el texto alternativo y se pueden cambiar desde el chat; los pentagramas, también en la pestaña de música.'
      },
      {
        label: '¿Qué pasa cuando se actualiza Nextcloud AIO?',
        content:
          'AIO vuelve a crear el contenedor de Euro-Office, y con ello desaparecen los plugins añadidos. Con `--watch`, el script de instalación configura un pequeño servicio que vuelve a instalar el plugin automáticamente después de cada reinicio.'
      },
      {
        label: '¿Cómo se actualiza la aplicación?',
        content:
          'La aplicación Worksheet Assistant comprueba con regularidad si hay una versión nueva y la muestra en su ventana y en el área de notificación (macOS: barra de menús). Un clic la descarga y la instala – con el paquete .deb obtienes en su lugar un enlace a la página de descarga. La nueva versión actualiza automáticamente el plugin en Euro-Office.'
      },
      {
        label: '¿Con qué se ha probado?',
        content:
          'Con Euro-Office 9.3.8 (Document Server y aplicación de escritorio en Linux), Nextcloud 34 y Mistral – de forma automatizada en el editor real. La aplicación Worksheet Assistant se compila y se comprueba automáticamente para Windows, macOS y Linux. Los asistentes alojados como claude.ai aún no se han probado con una instalación pública.'
      },
      {
        label: '¿Es de código abierto?',
        content:
          'Sí, con licencia MIT. Incluye abcjs, dagre y qrcode-generator (todos MIT) y los archivos de plugin de ONLYOFFICE (AGPL-3.0); la aplicación Worksheet Assistant contiene Node.js y paquetes de npm – todos con sus textos de licencia.'
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
    uses: 'usa abcjs, dagre y qrcode-generator (MIT) y el SDK de plugins de ONLYOFFICE (AGPL-3.0) · Pictogramas: Sergio Palao, ARASAAC (CC BY-NC-SA)',
    copy: 'Copiar',
    copied: 'Copiado',
    zoom: 'Abrir la imagen a tamaño completo'
  }
}

export default es
