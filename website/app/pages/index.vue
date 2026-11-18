<script setup lang="ts">
import type { ButtonProps, PageFeatureProps, AccordionItem } from '@nuxt/ui'

const REPO = 'https://github.com/felixwochnick/eurooffice-music-notation-plugin'
const RAW = 'https://raw.githubusercontent.com/felixwochnick/eurooffice-music-notation-plugin/main'
const img = (name: string) => `${useRuntimeConfig().app.baseURL}img/${name}`

const heroLinks: ButtonProps[] = [
  { label: 'Installieren', to: '#installation', icon: 'i-lucide-download', size: 'xl' },
  { label: 'Live-Demo', to: '#demo', color: 'neutral', variant: 'subtle', trailingIcon: 'i-lucide-arrow-right', size: 'xl' }
]

const features: PageFeatureProps[] = [
  {
    title: 'KI-Chat im Editor',
    description: '„Füge unter Aufgabe 2 eine Notenzeile mit c – f – g ein“: Die KI sieht die Gliederung des Dokuments und setzt die Noten an die richtige Stelle.',
    icon: 'i-lucide-messages-square'
  },
  {
    title: 'Auch ganz ohne KI',
    description: 'Manueller Modus mit ABC-Editor, Live-Vorschau, Vorlagen und Tonnamen-Umrechnung – funktioniert ohne Server und ohne API-Key.',
    icon: 'i-lucide-pencil-ruler'
  },
  {
    title: 'Deutsche Tonnamen',
    description: 'h und b, fis und es, c′ und C, „b vor dem Ton“ und Taktangaben wie 4/4 – mit automatischen Taktstrichen.',
    icon: 'i-lucide-languages'
  },
  {
    title: 'Liedtext & Strophen',
    description: 'Text unter die Noten: Die KI trennt die Silben selbst, der manuelle Modus verteilt sie auf die Noten – auch mehrere Strophen.',
    icon: 'i-lucide-text-quote'
  },
  {
    title: 'Druckfertig und bearbeitbar',
    description: 'Notenbilder mit 300 dpi. Der ABC-Quelltext steckt im Alt-Text – Zeilen lassen sich später laden, ändern und ersetzen.',
    icon: 'i-lucide-printer'
  },
  {
    title: 'Für Nextcloud AIO gemacht',
    description: 'Ein Befehl installiert das Plugin in Euro-Office und spielt es nach jedem AIO-Update automatisch wieder ein.',
    icon: 'i-lucide-cloud'
  }
]

const prompts = [
  { text: 'Füge unter Aufgabe 2 eine Notenzeile mit c – f – g im Violinschlüssel ein und darunter eine leere Zeile zum Nachschreiben.', icon: 'i-lucide-plus' },
  { text: 'Ich brauche eine Notenzeile: 4/4 bc1, f1, g2, be2, c1, c1', icon: 'i-lucide-hash' },
  { text: 'Bitte ändere Zeile 1: statt bc #c', icon: 'i-lucide-replace' },
  { text: 'Füge zu Zeile 1 den Text hinzu: Hänschen klein ging allein', icon: 'i-lucide-text-quote' },
  { text: 'Und darunter als zweite Strophe: Stock und Hut steht ihm gut', icon: 'i-lucide-list-plus' },
  { text: 'Füge nach Aufgabe 3 drei leere Notenzeilen im Bassschlüssel ohne Taktstriche ein.', icon: 'i-lucide-rows-3' }
]

const parts = [
  {
    title: 'Plugin',
    icon: 'i-lucide-puzzle',
    badge: 'immer',
    description: 'Nur Dateien (≈ 0,8 MB) im Plugin-Ordner von Euro-Office. Läuft im Browser im Editor – ohne eigenen Server.',
    bullets: ['Noten zeichnen und einfügen', 'Manueller Modus komplett', 'Laden, ändern, ersetzen']
  },
  {
    title: 'Proxy',
    icon: 'i-lucide-server',
    badge: 'nur für den KI-Chat',
    description: 'Kleiner Docker-Dienst (≈ 30 MB RAM), per HTTPS erreichbar – z. B. auf dem Nextcloud-Server.',
    bullets: ['API-Key bleibt auf dem Server', 'Token, CORS, Anfragelimit', 'Prüft die Noten, bevor sie ins Dokument kommen']
  },
  {
    title: 'Sprachmodell',
    icon: 'i-lucide-brain',
    badge: 'nur für den KI-Chat',
    description: 'Mistral (Standard), jede OpenAI-kompatible API wie ein lokales Ollama, oder Anthropic.',
    bullets: ['Austauschbar ohne Plugin-Änderung', 'EU-Anbieter oder lokal möglich', 'Kosten beim Anbieter']
  }
]

const installAio = `curl -fsSL ${RAW}/scripts/install-aio.sh | sudo bash -s -- --watch`
const installProxy = `mkdir music-proxy && cd music-proxy
curl -fsSLO ${RAW}/proxy/compose.release.yml
curl -fsSL ${RAW}/proxy/.env.example -o .env
nano .env    # PROXY_TOKEN, CORS_ORIGINS, LLM_API_KEY
docker compose -f compose.release.yml up -d`

const faq: AccordionItem[] = [
  {
    label: 'Braucht das Plugin einen eigenen Server?',
    content: 'Nein. Das Plugin besteht nur aus Dateien, die Euro-Office ausliefert, und läuft im Browser. Nur für den KI-Chat braucht es zusätzlich den kleinen Proxy – der manuelle Modus funktioniert ohne ihn.'
  },
  {
    label: 'Warum geht der KI-Chat nicht direkt vom Browser zur KI?',
    content: 'Dann müsste der API-Key im Browser jeder Lehrkraft stehen und könnte ausgelesen werden. Der Proxy hält den Key auf dem Server, sichert den Zugang mit Token und Anfragelimit ab und prüft die Notenschrift, bevor sie im Dokument landet.'
  },
  {
    label: 'Welche Daten gehen an die KI?',
    content: 'Mit jeder Chat-Anfrage der Gesprächsverlauf und die Gliederung des Dokuments (Absatztexte, Notenzeilen als ABC-Text). Der Proxy speichert keine Gespräche oder Dokumente. Wer das vermeiden will, nutzt ein lokales Modell über Ollama oder nur den manuellen Modus.'
  },
  {
    label: 'Was passiert bei einem Update von Nextcloud AIO?',
    content: 'AIO erzeugt den Euro-Office-Container neu, dabei verschwinden eigene Plugins. Mit der Option --watch richtet das Installationsskript einen kleinen Dienst ein, der das Plugin nach jedem Neustart des Containers automatisch wieder einspielt.'
  },
  {
    label: 'Mit welcher Euro-Office-Version ist das getestet?',
    content: 'Mit Euro-Office 9.3.8 (ghcr.io/euro-office/documentserver) und Mistral (mistral-large-latest): Einfügen, Ändern, Liedtext und Speichern als .docx. Ein Test in einer echten Nextcloud-AIO-Installation steht noch aus.'
  },
  {
    label: 'Kann ich eingefügte Notenzeilen später ändern?',
    content: 'Ja. Jede Notenzeile trägt ihren ABC-Quelltext als Alt-Text. Per Chat („ändere Zeile 2: statt f fis“) oder im manuellen Modus („Markiertes Notenbild laden“ → ändern → „Ersetzen“).'
  },
  {
    label: 'Ist das Open Source?',
    content: 'Ja, unter MIT-Lizenz. Mitgeliefert werden abcjs (MIT) und die ONLYOFFICE-Plugin-Dateien plugins.js / plugins-ui.js (AGPL-3.0), unverändert und mit ihren Lizenztexten.'
  }
]
</script>

<template>
  <div>
    <UPageHero
      headline="Open-Source-Plugin für Euro-Office in Nextcloud"
      title="Notenzeilen für Arbeitsblätter – per Chat oder von Hand"
      description="Der Noten-Assistent fügt Melodien, leere Notenzeilen und Liedtext direkt in Euro-Office-Dokumente ein. Einfach beschreiben, was du brauchst – oder deutsche Tonnamen eintippen."
      :links="heroLinks"
    >
      <template #headline>
        <UBadge color="primary" variant="subtle" size="lg" icon="i-lucide-music" label="Open Source · MIT" />
      </template>
      <div class="overflow-hidden rounded-xl shadow-2xl ring ring-default">
        <img
          :src="img('editor-chat.webp')"
          alt="Euro-Office mit dem Noten-Assistenten: Notenzeile mit Liedtext unter Aufgabe 1, Notenzeile und leere Zeile unter Aufgabe 2, daneben der KI-Chat"
          width="1800"
          height="1125"
          class="w-full"
        >
      </div>
    </UPageHero>

    <UPageSection
      id="funktionen"
      headline="Funktionen"
      title="Alles, was ein Musik-Arbeitsblatt braucht"
      description="Gebaut für Lehrkräfte und Lehramtsstudierende: schnell eine Notenzeile, eine Übung zum Nachschreiben oder ein Lied mit Text."
      :features="features"
    />

    <UPageSection
      headline="Beispiele"
      title="So sprichst du mit dem Noten-Assistenten"
      description="Normale Sätze genügen. Die KI kennt die Gliederung deines Dokuments, deutsche Tonnamen und zählt Notenzeilen von oben."
    >
      <UPageGrid>
        <UPageCard
          v-for="p in prompts"
          :key="p.text"
          :icon="p.icon"
          :description="`„${p.text}“`"
          variant="subtle"
        />
      </UPageGrid>
    </UPageSection>

    <UPageSection
      headline="Manueller Modus"
      title="Funktioniert auch ohne KI"
      description="Vorlagen, ABC-Editor mit Live-Vorschau, Tonnamen-Umrechnung und Liedtext-Verteilung. Ein markiertes Notenbild lässt sich laden, ändern und ersetzen."
      orientation="horizontal"
      :features="[
        { title: 'Vorlagen', description: 'Leere Zeilen im Violin- oder Bassschlüssel, Tonleitern, Beispielmelodie mit Text.', icon: 'i-lucide-layout-template' },
        { title: 'Ziffern-Lesart wählbar', description: 'c1 als eingestrichenes c oder als ganze Note – automatisch erkannt und angezeigt.', icon: 'i-lucide-binary' },
        { title: 'Einfügen, wo du willst', description: 'An der Cursorposition oder hinter einem bestimmten Absatz.', icon: 'i-lucide-text-cursor-input' }
      ]"
    >
      <div class="overflow-hidden rounded-xl shadow-xl ring ring-default">
        <img
          :src="img('editor-manual.webp')"
          alt="Manueller Modus: Vorlage Alle meine Entchen mit Liedtext, ABC-Notation und Vorschau"
          width="1800"
          height="1125"
          loading="lazy"
          class="w-full"
        >
      </div>
    </UPageSection>

    <UPageSection
      id="demo"
      headline="Live-Demo"
      title="Probier es direkt hier aus"
      description="Deutsche Tonnamen eintippen – die Notenzeile erscheint sofort. Das ist derselbe Umrechner, den das Plugin im Editor verwendet."
    >
      <ClientOnly>
        <AbcDemo />
        <template #fallback>
          <p class="text-center text-muted">
            Die Demo wird geladen …
          </p>
        </template>
      </ClientOnly>
    </UPageSection>

    <UPageSection
      headline="Was läuft wo"
      title="Ein Plugin – und ein Proxy nur für die KI"
      description="Das Plugin braucht keinen eigenen Server. Wer den KI-Chat nutzen will, betreibt zusätzlich einen kleinen Proxy."
    >
      <UPageGrid>
        <UPageCard v-for="p in parts" :key="p.title" :icon="p.icon" :title="p.title" :description="p.description" variant="outline">
          <template #footer>
            <div class="space-y-3">
              <UBadge :label="p.badge" :color="p.badge === 'immer' ? 'primary' : 'neutral'" variant="subtle" />
              <ul class="space-y-1 text-sm text-muted">
                <li v-for="b in p.bullets" :key="b" class="flex items-start gap-2">
                  <UIcon name="i-lucide-check" class="mt-0.5 size-4 shrink-0 text-primary" />{{ b }}
                </li>
              </ul>
            </div>
          </template>
        </UPageCard>
      </UPageGrid>
    </UPageSection>

    <UPageSection
      id="installation"
      headline="Installation"
      title="In drei Schritten startklar"
      description="Für Nextcloud All-in-One mit Euro-Office. Andere Wege (eigener Document Server, manuelles Kopieren) stehen in der README."
    >
      <div class="mx-auto w-full max-w-3xl space-y-8">
        <div class="flex gap-4">
          <UBadge label="1" size="xl" class="h-9 w-9 shrink-0 justify-center rounded-full" />
          <div class="min-w-0 flex-1 space-y-3">
            <h3 class="text-lg font-semibold">
              Plugin installieren
            </h3>
            <p class="text-muted">
              Auf dem AIO-Server ausführen. Das Skript kopiert das Plugin in den Euro-Office-Container und richtet mit
              <code>--watch</code> einen Dienst ein, der es nach jedem AIO-Update automatisch wieder einspielt.
            </p>
            <CodeBlock :code="installAio" label="Shell (AIO-Host)" />
          </div>
        </div>
        <div class="flex gap-4">
          <UBadge label="2" size="xl" class="h-9 w-9 shrink-0 justify-center rounded-full" />
          <div class="min-w-0 flex-1 space-y-3">
            <h3 class="text-lg font-semibold">
              Proxy starten <span class="text-sm font-normal text-muted">(nur für den KI-Chat)</span>
            </h3>
            <p class="text-muted">
              Auf einem Server mit Docker, per HTTPS erreichbar – z. B. hinter deinem Reverse Proxy als
              <code>https://noten-proxy.deine-domain.de</code>.
            </p>
            <CodeBlock :code="installProxy" label="Shell" />
          </div>
        </div>
        <div class="flex gap-4">
          <UBadge label="3" size="xl" class="h-9 w-9 shrink-0 justify-center rounded-full" />
          <div class="min-w-0 flex-1 space-y-3">
            <h3 class="text-lg font-semibold">
              Im Editor einrichten
            </h3>
            <p class="text-muted">
              Dokument öffnen → <strong>Plugins</strong> → <strong>Noten-Assistent</strong> → <strong>Einstellungen</strong>:
              Proxy-URL und Token eintragen. Die dort angezeigte Adresse gehört in <code>CORS_ORIGINS</code> des Proxys.
              Dann „Verbindung testen“ – fertig.
            </p>
          </div>
        </div>
      </div>
    </UPageSection>

    <UPageSection id="faq" headline="FAQ" title="Häufige Fragen">
      <div class="mx-auto w-full max-w-3xl">
        <UAccordion :items="faq" type="multiple" />
      </div>
    </UPageSection>

    <UPageSection>
      <UPageCTA
        title="Bereit für das nächste Arbeitsblatt?"
        description="Quelltext, Releases und ausführliche Dokumentation auf GitHub."
        variant="subtle"
        :links="[
          { label: 'Zum Repository', to: REPO, target: '_blank', icon: 'i-simple-icons-github' },
          { label: 'Releases', to: `${REPO}/releases`, target: '_blank', color: 'neutral', variant: 'subtle', trailingIcon: 'i-lucide-arrow-right' }
        ]"
      />
    </UPageSection>
  </div>
</template>
