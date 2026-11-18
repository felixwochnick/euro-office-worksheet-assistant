import type { SiteContent } from './types'

const fr: SiteContent = {
  meta: {
    title: 'Worksheet Assistant pour Euro-Office',
    description:
      'Créez des fiches d’exercices avec l’IA – pour toutes les matières, dans Nextcloud, dans l’application de bureau ou avec Claude & co. via MCP. Open source.'
  },
  nav: { features: 'Fonctionnalités', ways: 'Utilisations', mcp: 'MCP', demo: 'Démo en direct', install: 'Installation', faq: 'FAQ', language: 'Langue' },
  hero: {
    badge: 'Open source · MIT',
    headline: 'Plugin d’IA pour Euro-Office – dans Nextcloud et sur ordinateur',
    title: 'Créez des fiches d’exercices avec l’IA – pour toutes les matières',
    description:
      'Décrivez ce dont vous avez besoin : le Worksheet Assistant (assistant de fiches d’exercices) écrit exercices, textes à trous, tableaux, lignes d’écriture, encadrés et portées directement dans votre document – avec le chat IA intégré ou avec votre propre assistant IA via MCP.',
    install: 'Installer',
    more: 'Comment ça marche',
    imageAlt:
      'Euro-Office avec le Worksheet Assistant : une fiche d’exercices sur le cycle de l’eau créée par le chat IA, à gauche le chat avec la demande'
  },
  features: {
    headline: 'Fonctionnalités',
    title: 'De la page blanche à la fiche terminée',
    description: 'Conçu pour les enseignants et les futurs enseignants – pour les fiches d’exercices, les évaluations et les supports de cours dans toutes les matières.',
    items: [
      {
        title: 'Des fiches complètes par chat',
        description:
          '« Crée une fiche d’exercices sur le cycle de l’eau pour le CM2 » : titre, exercices, tableau, lignes d’écriture et encadré en une seule étape – d’abord en aperçu si vous le souhaitez.'
      },
      {
        title: 'Modifier plutôt que recommencer',
        description:
          '« Reformule l’exercice 1 pour le CE2 », « Transforme l’exercice 2 en texte à trous », « Ajoute une page de corrigés » – l’IA ne modifie que ce que vous demandez. Toute suppression nécessite votre confirmation.'
      },
      {
        title: 'Portées et paroles',
        description:
          'Mélodies, portées vides et paroles sous forme d’images prêtes à imprimer. Les noms de notes allemands (h, fis, b) sont convertis de manière fiable ; chaque portée reste modifiable.'
      },
      {
        title: 'Votre assistant IA via MCP',
        description: 'Claude, ChatGPT, Le Chat et d’autres modifient le document ouvert avec les mêmes outils – sans clé d’IA dans le plugin.'
      },
      {
        title: 'La confidentialité entre vos mains',
        description: 'Mistral comme fournisseur européen, un modèle local via Ollama ou pas d’IA du tout. La clé reste sur le serveur, la connexion se fait avec le compte Nextcloud.'
      },
      {
        title: 'Nextcloud, serveur ou ordinateur',
        description:
          'Une seule commande pour Nextcloud AIO, un fichier Docker Compose pour votre propre Document Server, ou l’application compagnon pour l’application de bureau (Windows, macOS, Linux).'
      }
    ]
  },
  ways: {
    headline: 'Utilisations',
    title: 'Trois façons – un seul plugin',
    description: 'Choisissez où vous travaillez et quelle IA vous voulez utiliser. Toutes les options peuvent être combinées.',
    items: [
      {
        title: 'Dans Nextcloud',
        badge: 'pour les écoles',
        description: 'Le plugin dans l’Euro-Office de Nextcloud, avec le petit serveur à côté. Chaque enseignant se connecte avec son compte Nextcloud.',
        bullets: ['Installation en une seule commande (Nextcloud AIO)', 'Conservé après les mises à jour d’AIO', 'Clé d’IA uniquement sur le serveur'],
        link: 'Installer dans Nextcloud'
      },
      {
        title: 'Sur votre ordinateur',
        badge: 'Windows · macOS · Linux',
        description: 'L’application de bureau Euro-Office ou Nextcloud Office avec l’application compagnon – sans serveur à vous.',
        bullets: ['Installe elle-même le plugin', 'Votre propre clé API ou un modèle local', 'MCP pour Claude Desktop inclus'],
        link: 'Télécharger l’application compagnon'
      },
      {
        title: 'Avec votre assistant IA',
        badge: 'MCP',
        description: 'Claude, ChatGPT, Le Chat ou un autre client MCP travaille directement dans le document ouvert.',
        bullets: ['Les mêmes outils que le chat', 'Connexion via Nextcloud (OAuth) ou mot de passe d’application', 'En local, sans connexion'],
        link: 'Configurer MCP'
      }
    ]
  },
  prompts: {
    headline: 'Exemples',
    title: 'Comment parler au Worksheet Assistant',
    description: 'Des phrases simples suffisent. L’IA connaît la structure de votre document et répond dans votre langue.',
    worksheetLabel: 'Fiches d’exercices',
    musicLabel: 'Musique',
    worksheet: [
      'Crée une fiche d’exercices sur le cycle de l’eau pour le CM2 avec trois exercices, un tableau et un encadré « À retenir ».',
      'Reformule la consigne de l’exercice 1 pour que des élèves de CE2 la comprennent.',
      'Transforme l’exercice 2 en texte à trous avec 8 trous.',
      'Ajoute une page de corrigés à la fin.',
      'Supprime l’exercice 3.'
    ],
    music: [
      'Sous l’exercice 2, insère une portée avec c – f – g et, en dessous, une portée vide pour recopier.',
      'J’ai besoin d’une portée : 4/4 bc1, f1, g2, be2, c1, c1',
      'Modifie la portée 1, s’il te plaît : au lieu de bc #c',
      'Ajoute les paroles à la portée 1 : Frère Jacques, dormez-vous',
      'Après l’exercice 3, insère trois portées vides en clé de fa.'
    ]
  },
  mcp: {
    headline: 'MCP',
    title: 'Votre assistant IA écrit avec vous',
    description:
      'Grâce au Model Context Protocol, Claude, ChatGPT, Le Chat et d’autres assistants IA travaillent directement dans le document que vous avez ouvert dans Euro-Office. Le plugin applique les modifications – vous les voyez immédiatement et pouvez les annuler avec Ctrl+Z.',
    imageAlt: 'Un assistant IA a ajouté via MCP un exercice supplémentaire avec une portée et des paroles ; le chat du plugin affiche les appels MCP',
    items: [
      { title: 'Les mêmes outils', description: 'Blocs de fiche, modification, suppression, portées et paroles – tout est vérifié avant d’arriver dans le document.' },
      { title: 'Uniquement vos documents', description: 'Avec la connexion Nextcloud, un assistant n’accède qu’aux documents de son utilisateur.' },
      { title: 'Vous gardez le contrôle', description: 'Le document n’est connecté que si vous activez « Allow MCP access » dans le plugin. Vous révoquez l’accès dans Nextcloud.' }
    ],
    clientsTitle: 'Testé',
    clientsText: 'Avec le SDK TypeScript MCP (protocole 2026-07-28) et des requêtes au format 2025, via HTTP et stdio. Claude, ChatGPT et Le Chat eux-mêmes n’ont pas encore été connectés.'
  },
  companion: {
    headline: 'Application de bureau',
    title: 'L’application compagnon des éditeurs de bureau',
    description:
      'Les applications de bureau Euro-Office et Nextcloud Office n’ont ni gestionnaire de plugins ni serveur. L’application compagnon se charge des deux sur votre ordinateur – un seul programme, sans installation.',
    imageAlt: 'Page des paramètres de l’application compagnon : plugin installé, fournisseur d’IA Mistral, configuration pour Claude Desktop',
    items: [
      { title: 'Plugin configuré automatiquement', description: 'Installe, met à jour et connecte le plugin – aucun réglage dans l’éditeur.' },
      { title: 'Votre IA', description: 'Mistral, OpenAI, Anthropic, Ollama ou toute API compatible OpenAI – la clé reste sur votre ordinateur.' },
      { title: 'MCP inclus', description: 'Entrées prêtes à l’emploi pour Claude Desktop et Claude Code ; démarre avec votre ordinateur si vous le souhaitez.' }
    ]
  },
  music: {
    headline: 'Musique',
    title: 'Fiches de musique – même sans IA',
    description:
      'L’onglet musique fonctionne sans serveur et sans clé API : modèles, éditeur ABC avec aperçu en direct, noms de notes allemands et paroles. Une portée sélectionnée peut être chargée, modifiée et remplacée.',
    imageAlt: 'Onglet musique : modèle « Alle meine Entchen » avec paroles, notation ABC et aperçu',
    items: [
      { title: 'Modèles', description: 'Portées vides en clé de sol ou en clé de fa, gammes, une mélodie d’exemple avec paroles.' },
      { title: 'Convertir les noms de notes', description: 'c – f – g, fis′ g′ a′ h′, « bc » pour do bémol et des mesures comme 4/4 – les chiffres comme octave ou comme durée.' },
      { title: 'Prêt à imprimer et modifiable', description: 'Images en 300 ppp ; la source ABC est enregistrée dans le texte alternatif.' }
    ]
  },
  demo: {
    headline: 'Démo en direct',
    title: 'Essayez le convertisseur de noms de notes',
    description: 'Tapez des noms de notes allemands – la portée s’affiche aussitôt. C’est le même convertisseur que celui qu’utilise le plugin dans l’éditeur.',
    loading: 'Chargement de la démo…',
    notesLabel: 'Noms de notes (allemands)',
    notesHelp: 'p. ex. c – f – g, fis′ g′ a′ h′, bc = do bémol, 4/4 = mesure',
    clefLabel: 'Clé',
    treble: 'Clé de sol',
    bass: 'Clé de fa',
    digitsLabel: 'Chiffres',
    digitsAuto: 'Chiffres : automatique',
    digitsOctave: 'Chiffres = octave (c1 = c′)',
    digitsDuration: 'Chiffres = durée (c1 = ronde)',
    lyricsLabel: 'Paroles (facultatif)',
    lyricsHelp: 'Séparez les syllabes par un - : Frè-re Jac-ques',
    showAbc: 'Afficher la notation ABC',
    paperLoading: 'Chargement de la portée…',
    examples: ['c – f – g', 'Hänschen klein', 'Durées', 'Clé de fa'],
    noteCount: '{n} notes',
    readAsDurations: 'chiffres lus comme des durées',
    readAsOctaves: 'chiffres lus comme des octaves',
    meterInfo: 'Mesure à {meter}, {bars} mesures',
    issues: {
      unknownName: '« {token} » n’est pas un nom de note connu.',
      doubleAccidental: '« {token} » a deux altérations.',
      farFromStaff: '« {token} » ({octave}) est bien en dehors de la portée.',
      incompleteBar: 'Les notes ne remplissent pas des mesures à {meter} complètes ({bars} mesures).',
      tooManySyllables: 'Les paroles ont plus de syllabes que la mélodie n’a de notes.',
      tooFewSyllables: 'Les paroles ne couvrent pas toutes les notes – les autres restent sans texte.'
    }
  },
  parts: {
    headline: 'Ce qui tourne, et où',
    title: 'Un plugin, un petit serveur – et l’IA de votre choix',
    description: 'Le plugin n’a pas besoin de son propre serveur. Le chat IA et MCP ajoutent un petit service – sur le serveur ou sous forme d’application compagnon.',
    items: [
      {
        title: 'Plugin',
        badge: 'toujours',
        description: 'De simples fichiers (≈ 1 Mo) dans le dossier des plugins d’Euro-Office. Fonctionne dans l’éditeur du navigateur ou dans l’application de bureau.',
        bullets: ['Insère et modifie du contenu', 'Dessine les portées, onglet musique complet', 'Exécute les appels MCP dans le document']
      },
      {
        title: 'Serveur',
        badge: 'pour le chat IA et MCP',
        description: 'Un petit service (Docker, ≈ 30 Mo de RAM) à côté de Nextcloud – ou l’application compagnon sur votre propre ordinateur.',
        bullets: ['La clé API reste sur le serveur', 'Connexion via Nextcloud, limite de requêtes', 'Vérifie le contenu avant qu’il n’arrive dans le document']
      },
      {
        title: 'Modèle de langage',
        badge: 'optionnel',
        description: 'Mistral (par défaut), OpenAI, Anthropic, toute API compatible OpenAI comme Ollama – ou votre propre assistant IA via MCP.',
        bullets: ['Interchangeable sans modifier le plugin', 'Fournisseur européen ou modèle local possible', 'Coûts facturés par le fournisseur']
      }
    ]
  },
  install: {
    headline: 'Installation',
    title: 'Prêt en trois étapes',
    description: 'Choisissez votre méthode. D’autres options et tous les réglages se trouvent dans le README.',
    tabs: { nextcloud: 'Nextcloud AIO', desktop: 'Application de bureau', docker: 'Votre serveur', mcp: 'Assistant IA (MCP)' },
    nextcloud: [
      {
        title: 'Installer le plugin',
        description: 'À exécuter sur le serveur AIO. Le script copie le plugin dans le conteneur Euro-Office ; avec `--watch`, il réinstalle automatiquement le plugin après chaque mise à jour d’AIO.',
        codeLabel: 'Shell (serveur AIO)'
      },
      {
        title: 'Démarrer le serveur',
        description: 'Il conserve la clé d’IA et fournit le point d’accès MCP. Rendez-le accessible en HTTPS, p. ex. à l’adresse `https://worksheets.your-school.org`. Avec `AUTH_MODE=nextcloud`, chaque enseignant se connecte avec son compte Nextcloud.',
        codeLabel: 'Shell'
      },
      {
        title: 'Se connecter dans l’éditeur',
        description: 'Ouvrez un document → **Plugins** → **Worksheet Assistant** → **Settings** : saisissez l’adresse du serveur et cliquez sur **Sign in with Nextcloud**. C’est tout.'
      }
    ],
    desktop: [
      { title: 'Installer l’application de bureau', description: 'Installez l’application de bureau Euro-Office ou Nextcloud Office pour Windows, macOS ou Linux et lancez-la une première fois.' },
      {
        title: 'Lancer l’application compagnon',
        description: 'Téléchargez `arbeitsblatt-assistent` pour votre système depuis les Releases, décompressez-le et lancez-le. Il installe le plugin et ouvre ses paramètres dans le navigateur. macOS : la première fois, clic droit → **Ouvrir** ; Windows : **Informations complémentaires → Exécuter quand même**.',
        codeLabel: 'Linux / macOS'
      },
      {
        title: 'Choisir votre IA',
        description: 'Dans les paramètres (`http://127.0.0.1:8787`), indiquez le fournisseur et la clé API – ou un modèle local via Ollama, ou seulement MCP. Ouvrez ensuite un document dans l’application de bureau : **Plugins → Worksheet Assistant**.'
      }
    ],
    docker: [
      { title: 'Construire le plugin', description: 'Téléchargez l’archive de la release ou construisez le plugin vous-même.', codeLabel: 'Shell' },
      {
        title: 'Démarrer le Document Server et le serveur',
        description: '`deploy/` démarre Euro-Office avec le plugin comme volume, ainsi que le serveur. Nextcloud utilise ensuite le Document Server comme serveur externe.',
        codeLabel: 'Shell'
      },
      { title: 'Configurer l’éditeur', description: 'Dans les **Settings** du plugin, saisissez l’adresse du serveur et le jeton (ou connectez-vous avec Nextcloud), puis cliquez sur « Test connection ».' }
    ],
    mcp: [
      {
        title: 'Connecter le document',
        description: 'Dans le document ouvert, activez **Plugins → Worksheet Assistant → Settings → Allow MCP access** (déjà activé avec l’application compagnon). Le panneau affiche l’adresse MCP.'
      },
      {
        title: 'Connecter votre assistant IA',
        description: 'Ajoutez l’adresse MCP : dans Claude, ChatGPT ou Le Chat comme connecteur personnalisé (connexion via Nextcloud), dans Claude Code avec une commande, dans Claude Desktop via l’application compagnon (`mcp-stdio`).',
        codeLabel: 'Claude Code'
      },
      { title: 'C’est parti', description: '« Crée dans le document ouvert une fiche d’exercices sur les fractions pour la 6e » – les modifications apparaissent aussitôt dans l’éditeur.' }
    ],
    readme: 'Toutes les options dans le README'
  },
  faq: {
    headline: 'FAQ',
    title: 'Questions fréquentes',
    items: [
      {
        label: 'Le plugin a-t-il besoin de son propre serveur ?',
        content:
          'Le plugin lui-même, non – ce ne sont que des fichiers servis par Euro-Office. Le chat IA et MCP ont besoin du petit serveur ; dans l’application de bureau, c’est l’application compagnon qui joue ce rôle. L’onglet musique fonctionne sans aucun serveur.'
      },
      {
        label: 'Quelle IA est utilisée ?',
        content:
          'Celle que vous configurez : Mistral (fournisseur européen, par défaut), OpenAI, Anthropic, toute API compatible OpenAI ou un modèle local via Ollama. Ou aucune – vous utilisez alors votre propre assistant IA via MCP.'
      },
      {
        label: 'Quelles données sont envoyées à l’IA ?',
        content:
          'À chaque demande dans le chat : la conversation et la structure du document (textes, portées en ABC). Le serveur n’enregistre ni conversations ni documents. Avec MCP, votre assistant IA lit le document à l’aide des outils. Si rien ne doit quitter votre réseau, utilisez un modèle local.'
      },
      {
        label: 'Qu’est-ce que MCP ?',
        content:
          'Le Model Context Protocol est une norme ouverte qui permet aux assistants IA d’utiliser des outils. Le serveur propose les outils du plugin – ainsi Claude, par exemple, modifie votre document ouvert comme si vous aviez utilisé le chat du plugin.'
      },
      {
        label: 'Comment les enseignants se connectent-ils ?',
        content:
          'Avec `AUTH_MODE=nextcloud`, avec leur compte Nextcloud : dans le plugin en un clic (Nextcloud Login Flow), les assistants IA via OAuth par Nextcloud ou avec un mot de passe d’application. Chacun n’accède qu’à ses propres documents ; l’accès peut être révoqué dans Nextcloud, sous Appareils et sessions.'
      },
      {
        label: 'Est-ce que ça marche sans Nextcloud ?',
        content: 'Oui : avec l’application de bureau et l’application compagnon, ou avec votre propre Document Server Euro-Office et un jeton d’accès partagé.'
      },
      {
        label: 'Puis-je modifier plus tard le contenu inséré ?',
        content:
          'Oui. L’IA lit le contenu et remplace exactement les parties que vous indiquez. Les portées conservent leur source ABC dans le texte alternatif et peuvent être modifiées par chat ou dans l’onglet musique.'
      },
      {
        label: 'Que se passe-t-il lors d’une mise à jour de Nextcloud AIO ?',
        content:
          'AIO recrée le conteneur Euro-Office, ce qui supprime les plugins ajoutés. Avec `--watch`, le script d’installation met en place un petit service qui réinstalle automatiquement le plugin après chaque redémarrage.'
      },
      {
        label: 'Avec quoi a-t-il été testé ?',
        content:
          'Euro-Office 9.3.8 (Document Server et application de bureau sous Linux), Nextcloud 34 et Mistral – de façon automatisée dans le véritable éditeur. L’application compagnon est compilée et vérifiée automatiquement pour Windows et macOS. Les assistants hébergés comme claude.ai n’ont pas encore été testés avec une installation publique.'
      },
      {
        label: 'Est-ce open source ?',
        content:
          'Oui, sous licence MIT. Il inclut abcjs (MIT) et les fichiers de plugin ONLYOFFICE (AGPL-3.0) ; l’application compagnon contient Node.js et des paquets npm – tous avec leurs textes de licence.'
      }
    ]
  },
  cta: {
    title: 'Prêt pour votre prochaine fiche d’exercices ?',
    description: 'Code source, releases et documentation détaillée sur GitHub.',
    repo: 'Voir le dépôt',
    releases: 'Releases'
  },
  footer: {
    license: 'Worksheet Assistant · licence MIT',
    uses: 'utilise abcjs (MIT) et le SDK de plugins ONLYOFFICE (AGPL-3.0)',
    copy: 'Copier',
    copied: 'Copié'
  }
}

export default fr
