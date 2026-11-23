import type { SiteContent } from './types'

const fr: SiteContent = {
  meta: {
    title: 'Worksheet Assistant pour Euro-Office',
    description:
      'Créez des fiches d’exercices avec l’IA – pour toutes les matières : exercices mis en page, jeux, graphiques, images, diagrammes d’informatique et portées. Dans Nextcloud, dans l’application de bureau ou avec Claude & co. via MCP. Open source.'
  },
  nav: { features: 'Fonctionnalités', informatics: 'Informatique', ways: 'Utilisations', mcp: 'MCP', install: 'Installation', faq: 'FAQ', language: 'Langue' },
  hero: {
    badge: 'Nouveau en {version} : scènes 3D de solides',
    headline: 'Plugin d’IA pour Euro-Office – dans Nextcloud et sur ordinateur',
    title: 'Créez des fiches d’exercices avec l’IA – pour toutes les matières',
    description:
      'Décrivez ce dont vous avez besoin : le Worksheet Assistant (assistant de fiches d’exercices) met en page exercices, textes à trous, jeux, graphiques, formules, images, diagrammes UML et portées dans un design homogène, directement dans votre document – avec le chat IA intégré ou avec votre propre assistant IA via MCP.',
    install: 'Installer',
    more: 'Toutes les fonctionnalités',
    imageAlt:
      'Euro-Office avec le Worksheet Assistant : une fiche d’exercices sur le cycle de l’eau dans le design « Moderne », avec en-tête, titre, ligne pour le nom et exercices numérotés avec pictogrammes, étoiles et points ; à gauche, le panneau avec le chat IA'
  },
  features: {
    headline: 'Fonctionnalités',
    title: 'Tout pour votre prochaine fiche d’exercices',
    description:
      'Conçu pour les enseignants et les futurs enseignants – pour les fiches d’exercices, les évaluations et les supports de cours dans toutes les matières. L’IA choisit les blocs, le plugin les place proprement dans le document.',
    items: [
      {
        title: 'Des fiches complètes par chat',
        description:
          '« Crée une fiche d’exercices sur le cycle de l’eau pour le CM2 » – avec titre, ligne pour le nom, exercices, documents et encadré « À retenir ». D’abord un aperçu, puis l’insertion.'
      },
      {
        title: 'Trois designs',
        description:
          'Classique (noir et blanc, économe en toner), Moderne ou Primaire (grande écriture, en couleurs). Polices, couleurs et espacements viennent du design.'
      },
      {
        title: 'Exercices et jeux',
        description:
          'Texte à trous avec banque de mots, QCM, vrai/faux, association, mots croisés et mots mêlés, texte à lire avec numéros de ligne, et bien plus.'
      },
      {
        title: 'Graphiques et formules',
        description:
          'Droite numérique, repère cartésien, diagrammes, carte mentale, lignes d’écriture et papier quadrillé. Les formules LaTeX deviennent de véritables équations modifiables.'
      },
      {
        title: 'Solides en 3D',
        description: 'Cubes, pavés droits, cylindres, cônes et pyramides – aussi empilés en maisons et en tours. Une perspective calculée juste, en dessin à colorier ou en couleur.'
      },
      {
        title: 'Images',
        description: 'Pictogrammes ARASAAC, photos de Wikimedia Commons ou vos propres images – la mention de licence figure automatiquement en dessous.'
      },
      {
        title: 'Diagrammes d’informatique',
        description:
          'Diagrammes UML de classes, de séquence, d’états, d’activité et de cas d’utilisation, automates, structogrammes, organigrammes de programmation et diagrammes ER.'
      },
      {
        title: 'Portées et paroles',
        description:
          'Mélodies, portées vides et paroles sous forme d’images prêtes à imprimer. Les noms de notes allemands (h, fis, b) sont convertis de manière fiable.'
      },
      {
        title: 'Page et charte graphique',
        description:
          'A4, A5 ou Letter, portrait ou paysage, marges, colonnes, en-tête avec le nom de l’école et le logo, pied de page avec numéros de page.'
      },
      {
        title: 'Vérifiée, avec corrigé',
        description:
          'Après la création, l’IA vérifie la numérotation, les consignes, la place pour les réponses, les points et la lisibilité pour le niveau de la classe. Sur demande, le corrigé est fourni dans la même mise en page.'
      },
      {
        title: 'Modifier plutôt que recommencer',
        description:
          '« Reformule l’exercice 1 pour le CE2 », « Transforme l’exercice 2 en texte à trous » – l’IA ne modifie que ce que vous demandez. Toute suppression nécessite votre confirmation.'
      },
      {
        title: 'Votre assistant IA via MCP',
        description: 'Claude, ChatGPT, Le Chat et d’autres modifient le document ouvert avec les mêmes outils – sans clé d’IA dans le plugin.'
      },
      {
        title: 'La confidentialité entre vos mains',
        description: 'Mistral comme fournisseur européen, un modèle local via Ollama ou pas d’IA du tout. La clé reste sur le serveur, la connexion se fait avec le compte Nextcloud.'
      }
    ],
    more: 'En savoir plus'
  },
  designs: {
    headline: 'Designs',
    title: 'Un design pour toute la page',
    description:
      'L’IA ne choisit que le design – polices, tailles, couleurs et espacements de tout ce que l’assistant insère en découlent. Chaque fiche est ainsi d’un seul tenant, même si vous ajoutez des exercices plus tard.',
    themes: [
      { title: 'Classique', description: 'Noir et blanc, économe en toner – pour les photocopies et les évaluations.' },
      { title: 'Moderne', description: 'Écriture claire avec une touche de bleu – pour le secondaire.' },
      { title: 'Primaire', description: 'Grande écriture, interligne de 1,5, couleurs sympathiques.' }
    ],
    imageAlt: 'La même fiche d’exercices « Le hérisson en automne » dans le design {theme}',
    items: [
      { title: 'En-têtes d’exercice', description: 'Numéro, pictogrammes pour le mode de travail et l’activité, étoiles de difficulté, points et temps de travail.' },
      { title: 'Encadrés', description: 'À retenir, Astuce, Attention, Exemple, Définition, Solution et Info – chacun avec un pictogramme.' },
      { title: 'Dans votre langue', description: 'Des intitulés comme Nom, Classe, Banque de mots ou vrai/faux, en sept langues.' }
    ]
  },
  tasks: {
    headline: 'Exercices',
    title: 'Des exercices au rendu soigné',
    description:
      'Plus de 40 blocs que l’IA combine librement. Les jeux sont calculés au lieu d’être devinés – mots croisés et mots mêlés sont toujours résolubles.',
    imageAlt: 'Page d’exercices dans le design « Moderne » : des mots croisés calculés avec définitions horizontales et verticales et une grille de mots mêlés avec liste de mots',
    items: [
      { title: 'Textes à trous et quiz', description: 'Texte à trous avec banque de mots automatique, QCM, tableau vrai/faux, association par traits ou par lettres.' },
      { title: 'Jeux', description: 'Mots croisés et mots mêlés en trois niveaux de difficulté – avec le corrigé sur demande.' },
      {
        title: 'Lire et écrire',
        description:
          'Textes à lire avec numéros de ligne, **coloration des syllabes** (syllabes alternativement en bleu et en rouge), lignes d’écriture 1 à 4 de l’école primaire allemande (Lineaturen) et papier quadrillé.'
      },
      {
        title: 'Autour de l’exercice',
        description: 'Auto-évaluation avec des smileys, cartes d’aide à découper, tableau points-notes, codes QR et mise en page sur deux ou trois colonnes.'
      }
    ]
  },
  graphics: {
    headline: 'Graphiques & formules',
    title: 'Maths et sciences, dessinées proprement',
    description:
      'Les graphiques sont dessinés à partir de données, pas inventés comme une image : axes, échelles et légendes sont justes. Chaque graphique porte sa source dans le texte alternatif – l’IA peut le modifier plus tard.',
    imageAlt: 'Fiche de maths : droite numérique avec des cases vides, diagramme en colonnes, repère cartésien avec un triangle et une formule pour l’aire',
    items: [
      { title: 'Droite numérique et repère', description: 'Avec des cases à remplir, des points, des segments et des polygones.' },
      { title: 'Diagrammes', description: 'Colonnes, barres, courbes et secteurs – aussi vides, à dessiner soi-même.' },
      { title: 'Formules', description: 'LaTeX devient une véritable équation dans le document, même au milieu d’une phrase.' },
      { title: 'Cartes mentales et dessins', description: 'Cartes mentales (aussi avec des bulles vides) et dessins simples que l’IA conçoit elle-même.' },
      { title: 'Scènes 3D', description: 'Des scènes de cubes, de cylindres, de cônes et plus, calculées au lieu d’être dessinées : un dessin à colorier sans lignes cachées, la même scène en couleur pour le corrigé ou une perspective cavalière avec les arêtes cachées en pointillés.' }
    ]
  },
  pictures: {
    headline: 'Images',
    title: 'Des images qui vont avec la fiche',
    description:
      'Surtout à l’école primaire et dans l’enseignement spécialisé, les images aident à comprendre. L’IA cherche des images adaptées et les place sur la fiche – à côté des mots, en introduction ou en colonnes à côté du texte. Elle imprime automatiquement la mention de licence en dessous.',
    imageAlt:
      'Fiche « Animaux de la forêt » dans le design « Primaire » : pictogrammes ARASAAC de hérisson, hibou, lièvre, écureuil, renard et corbeau avec mention de licence, en dessous les noms des animaux avec coloration des syllabes et une ligne d’écriture du primaire',
    items: [
      { title: 'Pictogrammes', description: 'ARASAAC – des dessins simples et homogènes d’objets, d’animaux, d’actions et de sentiments, conçus pour l’enseignement spécialisé.' },
      { title: 'Photos et images historiques', description: 'Wikimedia Commons – animaux, plantes, lieux, art, Romains et Moyen Âge.' },
      {
        title: 'Vos propres images',
        description: 'Un dossier dans votre Nextcloud ou sur votre ordinateur, p. ex. avec des images de bandes dessinées pour le latin. L’IA les trouve grâce aux noms de fichiers et de dossiers.'
      }
    ]
  },
  informatics: {
    badge: 'Nouveau',
    headline: 'Informatique',
    title: 'UML, structogrammes et diagrammes ER',
    description:
      'L’IA ne décrit que le modèle, la mise en page est calculée : boîtes et flèches sont droites et lisibles, dans la notation scolaire comme dans le manuel. Dix types de diagrammes – chacun aussi en version à compléter, avec corrigé.',
    diagrams: [
      {
        title: 'Diagramme de classes à compléter',
        description: 'Un attribut sous forme de ligne à écrire, une méthode sous forme de ligne vide, l’héritage de Sparkonto (compte épargne) à dessiner soi-même.'
      },
      { title: 'Diagramme de séquence', description: 'Acteur et objets, appels, réponse, barres d’activation et un fragment alt.' },
      { title: 'Automate fini', description: 'Flèche de départ, état accepteur en double cercle, transitions étiquetées avec des caractères.' },
      { title: 'Structogramme', description: 'Nassi-Shneiderman selon DIN 66261 : alternative et boucle (PGCD d’Euclide).' },
      { title: 'Organigramme de programmation', description: 'Selon DIN 66001 : début, entrée et sortie, embranchement avec ja/nein (oui/non), fin.' },
      { title: 'Diagramme ER', description: 'Notation de Chen avec attributs clés et cardinalités 1:n et n:m.' }
    ],
    items: [
      {
        title: 'Dix types de diagrammes',
        description:
          'Diagrammes de classes, d’objets, de séquence, d’états, d’activité et de cas d’utilisation, automates finis, structogrammes, organigrammes de programmation et diagrammes ER (Chen, (min,max), pied de corbeau).'
      },
      {
        title: 'À compléter',
        description: 'Trous dans chaque texte, flèches et relations manquantes, lignes et boîtes vides – et, en une phrase, le corrigé dans la même mise en page.'
      },
      {
        title: 'Tient sur la page',
        description: 'La mise en page est calculée et adaptée à la largeur du texte. Comme tous les graphiques, chaque diagramme reste modifiable par chat.'
      }
    ]
  },
  music: {
    headline: 'Musique',
    title: 'Fiches de musique – même sans IA',
    description:
      'L’onglet musique fonctionne sans serveur et sans clé API : modèles, éditeur ABC avec aperçu en direct, noms de notes allemands et paroles. Une portée sélectionnée peut être chargée, modifiée et remplacée.',
    imageAlt: 'Onglet musique : le modèle « Alle meine Entchen » avec paroles, notation ABC et aperçu, inséré sous un exercice dans le design « Moderne »',
    items: [
      { title: 'Modèles', description: 'Portées vides en clé de sol ou en clé de fa, gammes, une mélodie d’exemple avec paroles.' },
      { title: 'Convertir les noms de notes', description: 'c – f – g, fis′ g′ a′ h′, « bc » pour do bémol et des mesures comme 4/4 – les chiffres comme octave ou comme durée.' },
      {
        title: 'Prêt à imprimer et modifiable',
        description: 'Images en 300 ppp ; la source ABC est enregistrée dans le texte alternatif. Par chat : « Modifie la portée 1 : au lieu de bc #c ».'
      }
    ]
  },
  mcp: {
    headline: 'MCP',
    title: 'Votre assistant IA écrit avec vous',
    description:
      'Grâce au Model Context Protocol, Claude, ChatGPT, Le Chat et d’autres assistants IA travaillent directement dans le document que vous avez ouvert dans Euro-Office. Le plugin applique les modifications – vous les voyez immédiatement et pouvez les annuler avec Ctrl+Z.',
    imageAlt: 'Un assistant IA a inséré via MCP un troisième exercice avec la chanson « Es regnet » sous forme de portée ; le panneau affiche les appels MCP',
    items: [
      {
        title: 'Les mêmes outils',
        description: 'Tous les blocs, les images, les diagrammes, la mise en page, la vérification, la modification et les portées – tout est vérifié avant d’arriver dans le document.'
      },
      { title: 'Uniquement vos documents', description: 'Avec la connexion Nextcloud, un assistant n’accède qu’aux documents de son utilisateur.' },
      {
        title: 'Vous gardez le contrôle',
        description: 'Le document n’est connecté que si vous activez « MCP-Zugriff erlauben » (autoriser l’accès MCP) dans le plugin. Vous révoquez l’accès dans Nextcloud.'
      }
    ],
    clientsTitle: 'Testé',
    clientsText:
      'Avec le SDK TypeScript MCP (protocole 2026-07-28) et des requêtes au format 2025, via HTTP et stdio. Les assistants hébergés comme claude.ai, ChatGPT et Le Chat n’ont pas encore été testés avec une installation publique.'
  },
  companion: {
    headline: 'Application de bureau',
    title: 'L’application Worksheet Assistant pour votre ordinateur',
    description:
      'Les applications de bureau Euro-Office et Nextcloud Office n’ont ni gestionnaire de plugins ni serveur. L’application Worksheet Assistant se charge des deux : installez-la comme n’importe quelle application, lancez-la une fois – ensuite, elle travaille de façon invisible en arrière-plan. Ni terminal, ni navigateur.',
    imageAlt: 'Fenêtre de l’application Worksheet Assistant, page « Übersicht » (vue d’ensemble) : les trois étapes sont terminées – plugin dans l’application de bureau, chat IA dans le plugin, Claude connecté',
    items: [
      { title: 'Plugin configuré automatiquement', description: 'Installe le plugin dans Euro-Office et Nextcloud Office, le connecte et le maintient à jour – aucun réglage dans l’éditeur.' },
      {
        title: 'Votre IA, vos images',
        description: 'Mistral, OpenAI, Anthropic, Ollama ou toute API compatible OpenAI – la clé reste sur votre ordinateur. En plus, un dossier d’images à vous.'
      },
      {
        title: 'Claude en un clic',
        description: 'Connecte Claude Desktop ou Claude Code. L’application installe les nouvelles versions en un clic et démarre avec votre ordinateur si vous le souhaitez. Notarisée par Apple sous macOS.'
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
        bullets: ['Installation en une seule commande (Nextcloud AIO)', 'Conservé après les mises à jour d’AIO', 'Vos propres images dans un dossier Nextcloud'],
        link: 'Installer dans Nextcloud'
      },
      {
        title: 'Sur votre ordinateur',
        badge: 'Windows · macOS · Linux',
        description: 'L’application de bureau Euro-Office ou Nextcloud Office avec l’application Worksheet Assistant – à installer comme n’importe quelle application, sans serveur à vous.',
        bullets: ['Installe et met à jour elle-même le plugin', 'Votre propre clé API ou un modèle local', 'Claude Desktop connecté en un clic'],
        link: 'Télécharger l’application'
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
    groups: [
      {
        label: 'Fiches d’exercices',
        items: [
          'Crée une fiche d’exercices sur le cycle de l’eau pour le CM2 avec trois exercices, un texte à trous et un encadré « À retenir ».',
          'Fais-en des mots croisés avec dix termes et ajoute une page de corrigés à la fin.',
          'Reformule la consigne de l’exercice 1 pour que des élèves de CE2 la comprennent.',
          'Utilise le design Classique et mets le nom de notre école et les numéros de page en en-tête et en pied de page.',
          'Un coloriage pour le CE1 : une ville faite de solides, avec la consigne de colorier tous les cubes en rouge et tous les cylindres en vert – et la ville en couleur sur la page de corrigés.',
          'Vérifie la fiche et supprime l’exercice 3.'
        ]
      },
      {
        label: 'Images & diagrammes',
        items: [
          'Une fiche de lecture pour le CP sur les animaux de la forêt – avec un pictogramme à côté de chaque mot et la coloration des syllabes.',
          'Place une photo d’un légionnaire romain à côté du texte.',
          'Dessine un cube, un pavé droit et un cylindre en perspective cavalière, avec les arêtes cachées en pointillés.',
          'Dessine un diagramme de classes UML pour Compte, Compte courant et Compte épargne, où les élèves complètent l’héritage.',
          'Crée un structogramme pour l’algorithme d’Euclide et, en dessous, un organigramme vide à compléter.',
          'Un diagramme ER pour les élèves, les cours et les enseignants, en notation de Chen.'
        ]
      },
      {
        label: 'Musique',
        items: [
          'Sous l’exercice 2, insère une portée avec c – f – g et, en dessous, une portée vide pour recopier.',
          'J’ai besoin d’une portée : 4/4 bc1, f1, g2, be2, c1, c1',
          'Modifie la portée 1, s’il te plaît : au lieu de bc #c',
          'Ajoute les paroles à la portée 1 : Frère Jacques, dormez-vous',
          'Après l’exercice 3, insère trois portées vides en clé de fa.'
        ]
      }
    ]
  },
  parts: {
    headline: 'Ce qui tourne, et où',
    title: 'Un plugin, un petit serveur – et l’IA de votre choix',
    description: 'Le plugin n’a pas besoin de son propre serveur. Pour le chat IA, les images et MCP, un petit service s’ajoute – sur le serveur ou dans l’application Worksheet Assistant sur votre ordinateur.',
    items: [
      {
        title: 'Plugin',
        badge: 'toujours',
        description: 'De simples fichiers (≈ 2 Mo) dans le dossier des plugins d’Euro-Office. Fonctionne dans l’éditeur du navigateur ou dans l’application de bureau.',
        bullets: ['Met en page les fiches, les graphiques et les diagrammes', 'Dessine les portées, onglet musique complet', 'Exécute les appels MCP dans le document']
      },
      {
        title: 'Serveur',
        badge: 'pour le chat IA, les images et MCP',
        description: 'Un petit service (Docker, ≈ 30 Mo de RAM) à côté de Nextcloud – ou en arrière-plan de l’application Worksheet Assistant sur votre propre ordinateur.',
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
        description: 'Il conserve la clé d’IA, cherche les images et fournit le point d’accès MCP. Rendez-le accessible en HTTPS, p. ex. à l’adresse `https://worksheets.your-school.org`. Avec `AUTH_MODE=nextcloud`, chaque enseignant se connecte avec son compte Nextcloud.',
        codeLabel: 'Shell'
      },
      {
        title: 'Se connecter dans l’éditeur',
        description: 'Ouvrez un document → **Plugins** → **Assistant fiches de travail** → **Einstellungen** (paramètres) : saisissez l’adresse du serveur et cliquez sur **Mit Nextcloud anmelden** (se connecter avec Nextcloud). C’est tout. Vos propres images vont dans le dossier `Arbeitsblatt-Bilder` de votre Nextcloud.'
      }
    ],
    desktop: [
      { title: 'Installer Euro-Office', description: 'Installez l’application de bureau Euro-Office ou Nextcloud Office pour Windows, macOS ou Linux et lancez-la une première fois.' },
      {
        title: 'Installer l’application Worksheet Assistant',
        description: 'Téléchargez le programme d’installation pour votre système et installez l’application comme n’importe quelle autre (macOS : faites-la glisser dans **Applications**) ; elle s’appelle **Worksheet Assistant**. Au démarrage, sa fenêtre s’ouvre : elle configure le plugin et travaille de façon invisible en arrière-plan. Sur macOS, l’application est notarisée par Apple. Sous Windows, elle n’est pas encore signée – si SmartScreen affiche un avertissement : **Informations complémentaires → Exécuter quand même**.'
      },
      {
        title: 'Choisir votre IA',
        description: 'Dans l’application, sur la page **KI-Chat** (chat IA), indiquez le fournisseur et la clé API – ou un modèle local via Ollama, ou seulement MCP. Sur la page **Bilder** (images), choisissez votre propre dossier d’images. Ouvrez ensuite un document dans Euro-Office : **Plugins → Assistant fiches de travail**. Vous pouvez fermer la fenêtre – l’application continue de tourner dans la zone de notification (macOS : barre des menus).'
      }
    ],
    docker: [
      { title: 'Construire le plugin', description: 'Téléchargez l’archive de la release ou construisez le plugin vous-même.', codeLabel: 'Shell' },
      {
        title: 'Démarrer le Document Server et le serveur',
        description: '`deploy/` démarre Euro-Office avec le plugin comme volume, ainsi que le serveur. Nextcloud utilise ensuite le Document Server comme serveur externe.',
        codeLabel: 'Shell'
      },
      {
        title: 'Configurer l’éditeur',
        description: 'Dans les **Einstellungen** (paramètres) du plugin, saisissez l’adresse du serveur et le jeton (ou connectez-vous avec Nextcloud), puis cliquez sur « Verbindung testen » (tester la connexion).'
      }
    ],
    mcp: [
      {
        title: 'Connecter le document',
        description: 'Dans le document ouvert, activez **Plugins → Assistant fiches de travail → Einstellungen → MCP-Zugriff erlauben** (autoriser l’accès MCP ; déjà activé avec l’application Worksheet Assistant). Le panneau affiche l’adresse MCP.'
      },
      {
        title: 'Connecter votre assistant IA',
        description: 'Ajoutez l’adresse MCP : dans Claude, ChatGPT ou Le Chat comme connecteur personnalisé (connexion via Nextcloud), dans Claude Code avec une commande. L’application Worksheet Assistant connecte Claude Desktop et Claude Code en un clic (page **Claude & MCP**).',
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
          'Le plugin lui-même, non – ce ne sont que des fichiers servis par Euro-Office. Le chat IA, la recherche d’images et MCP ont besoin du petit serveur ; sur votre propre ordinateur, c’est l’application Worksheet Assistant qui joue ce rôle. L’onglet musique fonctionne sans aucun serveur.'
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
        label: 'D’où viennent les images – et ai-je le droit de les utiliser ?',
        content:
          'De trois sources : les pictogrammes ARASAAC (CC BY-NC-SA, utilisables librement à l’école), Wikimedia Commons (licences libres) et votre propre dossier d’images. L’auteur et la licence des images libres figurent automatiquement sous l’image. Le serveur n’interroge que les adresses fixes d’ARASAAC et de Wikimedia ainsi que votre dossier – l’IA ne fournit jamais d’adresses elle-même. Avec `IMAGE_SOURCES` ou dans l’application, vous désactivez les images provenant d’Internet.'
      },
      {
        label: 'Quels diagrammes d’informatique sont disponibles ?',
        content:
          'Diagrammes UML de classes, d’objets, de séquence, d’états, d’activité et de cas d’utilisation, automates finis (AFD/AFN), structogrammes selon DIN 66261, organigrammes de programmation selon DIN 66001 et diagrammes ER en notation de Chen, (min,max) ou pied de corbeau. Chaque diagramme existe aussi à compléter et avec corrigé.'
      },
      {
        label: 'Qu’est-ce que MCP ?',
        content:
          'Le Model Context Protocol est une norme ouverte qui permet aux assistants IA d’utiliser des outils. Le serveur propose les outils du plugin – ainsi Claude, par exemple, modifie votre document ouvert comme si vous aviez utilisé le chat du plugin.'
      },
      {
        label: 'Comment les enseignants se connectent-ils ?',
        content:
          'Avec `AUTH_MODE=nextcloud`, avec leur compte Nextcloud : dans le plugin en un clic (Nextcloud Login Flow), les assistants IA via OAuth par Nextcloud ou avec un mot de passe d’application. Chacun n’accède qu’à ses propres documents et images ; l’accès peut être révoqué dans Nextcloud, sous Appareils et sessions.'
      },
      {
        label: 'Est-ce que ça marche sans Nextcloud ?',
        content: 'Oui : avec l’application de bureau Euro-Office ou Nextcloud Office et l’application Worksheet Assistant, ou avec votre propre Document Server Euro-Office et un jeton d’accès partagé.'
      },
      {
        label: 'Puis-je modifier plus tard le contenu inséré ?',
        content:
          'Oui. L’IA lit le contenu et remplace exactement les parties que vous indiquez. Les graphiques, diagrammes, images et portées conservent leur source dans le texte alternatif et peuvent être modifiés par chat ; les portées aussi dans l’onglet musique.'
      },
      {
        label: 'Que se passe-t-il lors d’une mise à jour de Nextcloud AIO ?',
        content:
          'AIO recrée le conteneur Euro-Office, ce qui supprime les plugins ajoutés. Avec `--watch`, le script d’installation met en place un petit service qui réinstalle automatiquement le plugin après chaque redémarrage.'
      },
      {
        label: 'Comment l’application est-elle mise à jour ?',
        content:
          'L’application Worksheet Assistant vérifie régulièrement s’il existe une nouvelle version et l’indique dans sa fenêtre et dans la zone de notification (macOS : barre des menus). Un clic la télécharge et l’installe – avec le paquet .deb, vous obtenez à la place un lien vers la page de téléchargement. La nouvelle version met automatiquement à jour le plugin dans Euro-Office.'
      },
      {
        label: 'Avec quoi a-t-il été testé ?',
        content:
          'Euro-Office 9.3.8 (Document Server et application de bureau sous Linux), Nextcloud 34 et Mistral – de façon automatisée dans le véritable éditeur. L’application Worksheet Assistant est compilée et vérifiée automatiquement pour Windows, macOS et Linux. Les assistants hébergés comme claude.ai n’ont pas encore été testés avec une installation publique.'
      },
      {
        label: 'Est-ce open source ?',
        content:
          'Oui, sous licence MIT. Il inclut abcjs, dagre, qrcode-generator et three.js (tous MIT) et les fichiers de plugin ONLYOFFICE (AGPL-3.0) ; l’application Worksheet Assistant contient Node.js et des paquets npm – tous avec leurs textes de licence.'
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
    uses: 'utilise abcjs, dagre, qrcode-generator et three.js (MIT) et le SDK de plugins ONLYOFFICE (AGPL-3.0) · Pictogrammes : Sergio Palao, ARASAAC (CC BY-NC-SA)',
    copy: 'Copier',
    copied: 'Copié',
    zoom: 'Ouvrir l’image en taille réelle'
  }
}

export default fr
