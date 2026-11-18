'use strict';
// Unit tests for spoken German syllables (Silbenmethode).
const test = require('node:test');
const assert = require('node:assert/strict');
const gs = require('../shared/german-syllables.js');

// Spoken syllables ("Sprechsilben") of common primary-school words, hyphenated.
const WORDS = [
  'O-ma', 'A-bend', 'E-sel', 'I-gel', 'U-fer', 'Son-ne', 'Kat-ze', 'Zu-cker', 'Fens-ter', 'Ap-fel',
  'Bü-cher', 'Fla-sche', 'Mut-ter', 'sin-gen', 'Schu-le', 'Ba-na-ne', 'E-le-fant', 'Fa-mi-li-e',
  'A-mei-se', 'Feu-er', 'Bau-er', 'Haus-tür', 'Schmet-ter-ling', 'Kro-ko-dil', 'He-xe', 'Ta-xi',
  'Eu-le', 'Ei-mer', 'Bie-ne', 'Spie-gel', 'Was-ser', 'Gar-ten', 'Blu-me', 'Vo-gel', 'Leh-rer',
  'fah-ren', 'ge-hen', 'Pa-pa-gei', 'Scho-ko-la-de', 'Fahr-rad', 'Ge-burts-tag', 'Erd-bee-re',
  'Tisch', 'Brot', 'Stra-ße', 'Fuß-ball', 'Ka-nin-chen', 'Mäd-chen', 'Rit-ter', 'Pferd', 'Lö-we',
  'Ti-ger', 'Zi-tro-ne', 'To-ma-te', 'Kar-tof-fel', 'Schwes-ter', 'Freun-din', 'Blei-stift',
  'be-o-bach-ten', 'ver-ges-sen', 'Os-tern', 'Fe-ri-en', 'Mu-se-um', 'Hund', 'Maus', 'Kuh',
  'Schwein', 'Ha-se', 'Fuchs', 'Bär', 'Af-fe', 'Gi-raf-fe', 'Ze-bra', 'Schlan-ge', 'Spin-ne',
  'Schne-cke', 'Ra-be', 'En-te', 'Gans', 'Hen-ne', 'Hahn', 'Kü-ken', 'Fisch', 'Hai', 'Wal',
  'Del-fin', 'Pin-gu-in', 'Kä-fer', 'Ma-ri-en-kä-fer', 'Rau-pe', 'Kän-gu-ru', 'Ka-mel',
  'Meer-schwein-chen', 'Hams-ter', 'Frosch', 'Storch', 'Wurm', 'Mü-cke', 'Flie-ge', 'Wes-pe',
  'Hum-mel', 'Pfau', 'Tau-be', 'Am-sel', 'Specht', 'Ad-ler', 'Eich-hörn-chen', 'Kra-ke', 'Qual-le',
  'Rob-be', 'Ot-ter', 'Bi-ber', 'Dachs', 'Wolf', 'Reh', 'Hirsch', 'Zie-ge', 'Schaf', 'Lamm',
  'Schild-krö-te', 'Dra-che', 'Di-no-sau-ri-er', 'Leh-re-rin', 'Ta-fel', 'Krei-de', 'Heft', 'Buch',
  'Ra-dier-gum-mi', 'Li-ne-al', 'Map-pe', 'Ran-zen', 'Schul-ran-zen', 'Fe-der-mäpp-chen', 'Pau-se',
  'Schul-hof', 'Klas-se', 'Haus-auf-ga-be', 'Ma-the', 'Deutsch', 'Sport', 'Mu-sik', 'Kunst',
  'Zeug-nis', 'Schul-tü-te', 'Bil-der-buch', 'Wör-ter-buch', 'Buch-sta-be', 'Bei-spiel', 'Ma-ma',
  'Pa-pa', 'O-pa', 'Bru-der', 'On-kel', 'Tan-te', 'Ba-by', 'El-tern', 'Groß-el-tern', 'Kin-der',
  'Freund', 'Cou-sin', 'Nach-bar', 'Ge-schwis-ter', 'Bröt-chen', 'But-ter', 'Kä-se', 'Milch',
  'Bir-ne', 'Kir-sche', 'O-ran-ge', 'Trau-be', 'Pflau-me', 'Ka-rot-te', 'Gur-ke', 'Sa-lat',
  'Nu-deln', 'Piz-za', 'Ku-chen', 'Keks', 'Ho-nig', 'Salz', 'Ei', 'Ei-er', 'Saft', 'Tee',
  'Kaf-fee', 'Ka-ka-o', 'Jo-ghurt', 'Müs-li', 'Spa-ghet-ti', 'Pom-mes', 'Würst-chen', 'Sup-pe',
  'Ge-mü-se', 'Obst', 'Pa-pri-ka', 'Zwie-bel', 'Pilz', 'Nuss', 'Mit-tag-es-sen', 'Früh-stück',
  'A-bend-brot', 'Ge-burts-tags-ku-chen', 'Kopf', 'Au-ge', 'Na-se', 'Mund', 'Ohr', 'Haa-re',
  'Hand', 'Fin-ger', 'Arm', 'Bein', 'Fuß', 'Knie', 'Bauch', 'Rü-cken', 'Zahn', 'Zäh-ne', 'Zun-ge',
  'Hals', 'Haus', 'Tür', 'Kü-che', 'Zim-mer', 'Kin-der-zim-mer', 'Bett', 'Stuhl', 'Schrank',
  'Lam-pe', 'Trep-pe', 'Kel-ler', 'Dach', 'Bal-kon', 'Ba-de-wan-ne', 'Toi-let-te', 'Tep-pich',
  'So-fa', 'Fern-se-her', 'Kühl-schrank', 'Hei-zung', 'Kis-sen', 'De-cke', 'Mond', 'Stern',
  'Him-mel', 'Wol-ke', 'Re-gen', 'Schnee', 'Wind', 'Ge-wit-ter', 'Re-gen-bo-gen', 'Baum', 'Blatt',
  'Wald', 'Wie-se', 'Berg', 'Fluss', 'See', 'Meer', 'In-sel', 'Strand', 'Sand', 'Stein', 'Gras',
  'Busch', 'Ro-se', 'Tul-pe', 'Lö-wen-zahn', 'Kas-ta-ni-e', 'Pflan-ze', 'Früh-ling', 'Som-mer',
  'Herbst', 'Win-ter', 'Wet-ter', 'lau-fen', 'sprin-gen', 'spie-len', 'ma-len', 'schrei-ben',
  'le-sen', 'rech-nen', 'tan-zen', 'schwim-men', 'es-sen', 'trin-ken', 'schla-fen', 'ste-hen',
  'se-hen', 'ru-fen', 'sa-gen', 'fra-gen', 'ant-wor-ten', 'er-zäh-len', 'ver-ste-cken',
  'ent-de-cken', 'auf-räu-men', 'ein-kau-fen', 'an-zie-hen', 'aus-zie-hen', 'zu-hö-ren',
  'mit-spie-len', 'ba-cken', 'ko-chen', 'hel-fen', 'wa-schen', 'zeich-nen', 'bas-teln',
  'klet-tern', 'wan-dern', 'rei-ten', 'flie-gen', 'ler-nen', 'ken-nen', 'wis-sen', 'freu-en',
  'bau-en', 'schau-en', 'ver-ste-hen', 'be-kom-men', 'ge-win-nen', 'er-in-nern', 'auf-ste-hen',
  'ein-stei-gen', 'aus-stei-gen', 'um-ar-men', 'groß', 'klein', 'schön', 'lus-tig', 'trau-rig',
  'fröh-lich', 'freund-lich', 'mü-de', 'lang-sam', 'schnell', 'laut', 'lei-se', 'hell', 'dun-kel',
  'bunt', 'rot', 'blau', 'gelb', 'grün', 'ro-sa', 'li-la', 'ge-sund', 'krank', 'stark', 'dick',
  'dünn', 'wich-tig', 'rich-tig', 'falsch', 'ein-fach', 'schwie-rig', 'in-te-res-sant',
  'Ge-schenk', 'Weih-nach-ten', 'Ur-laub', 'Ge-schich-te', 'Mär-chen', 'Prin-zes-sin', 'Kö-nig',
  'Burg', 'Ge-spenst', 'Zau-be-rer', 'Rie-se', 'Zwerg', 'Pi-rat', 'Schatz', 'Ball', 'Pup-pe',
  'Ted-dy', 'Spiel-zeug', 'Au-to', 'Bus', 'Zug', 'Flug-zeug', 'Schiff', 'Ra-ke-te', 'Po-li-zei',
  'Feu-er-wehr', 'Kran-ken-haus', 'Bahn-hof', 'Spiel-platz', 'Schau-kel', 'Rut-sche',
  'Sand-kas-ten', 'Kin-der-gar-ten', 'Zoo', 'Zir-kus', 'Clown', 'The-a-ter', 'Ki-no', 'Com-pu-ter',
  'Han-dy', 'Fern-se-hen', 'Ra-di-o', 'Ka-me-ra', 'Te-le-fon', 'Uhr', 'Ka-len-der', 'Ja-nu-ar',
  'Fe-bru-ar', 'März', 'A-pril', 'Mai', 'Ju-ni', 'Ju-li', 'Au-gust', 'Sep-tem-ber', 'Ok-to-ber',
  'No-vem-ber', 'De-zem-ber', 'Mon-tag', 'Diens-tag', 'Mitt-woch', 'Don-ners-tag', 'Frei-tag',
  'Sams-tag', 'Sonn-tag', 'Wo-che', 'Wo-chen-en-de', 'Mor-gen', 'Nacht', 'heu-te', 'ges-tern',
  'Ka-pi-tän', 'Po-ny', 'Ham-bur-ger', 'Ket-chup', 'Ma-trat-ze', 'Ma-tro-se', 'Bi-bli-o-thek',
  'A-po-the-ke', 'Be-such', 'her-ein', 'hin-aus', 'ü-ber-all', 'Un-ter-richt', 'Ver-kehr',
  'Ab-fall', 'an-fan-gen', 'Er-de', 'ers-te', 'bes-te', 'be-stimmt', 'Be-steck', 'zu-erst',
  'Haus-tier', 'Fuß-ball-spiel', 'Kin-der-spiel-platz', 'Sonn-tag-a-bend', 'Was-ser-ei-mer',
  'Os-ter-ei', 'Os-ter-ha-se', 'Weih-nachts-mann', 'Tan-nen-baum', 'Re-gen-schirm', 'Hand-schuh',
  'Turn-hal-le', 'Schwimm-bad', 'Bus-hal-te-stel-le', 'Gar-ten-zwerg', 'Feu-er-wehr-au-to',
  'Ze-bra-strei-fen', 'Spiel-sa-chen', 'Schul-an-fang', 'Ge-burts-tags-fei-er', 'O-ze-an',
  'Vi-de-o', 'Li-ni-e', 'Li-li-e', 'Stu-di-e', 'Me-lo-die', 'Bat-te-rie', 'E-ner-gie',
  'Fan-ta-sie', 'Pa-pier', 'Kla-vier', 'Tier', 'vier', 'I-ta-li-en', 'Spa-ni-en', 'Fa-mi-li-en',
  'Him-bee-re', 'Brom-bee-re', 'Jo-han-nis-bee-re', 'Hei-del-bee-re', 'Glo-cke', 'Ja-cke', 'Ho-se',
  'Ho-sen', 'Müt-ze', 'Schal', 'Stie-fel', 'Schu-he', 'Hemd', 'Kleid', 'Rock', 'Pul-lo-ver',
  'Ruck-sack', 'Ak-ti-on', 'al-le', 'al-lein', 'Am-pel', 'an-de-re', 'Angst', 'Ant-wort',
  'Ar-beit', 'Arzt', 'Ärz-tin', 'Ast', 'auf-pas-sen', 'Auf-ga-be', 'Aus-flug', 'Au-to-bahn',
  'ba-den', 'Bahn', 'bald', 'Ba-cke-rei', 'Bä-cke-rei', 'Bank', 'Bas-tel-ar-beit', 'Bau-ern-hof',
  'Bee-re', 'be-geis-tert', 'be-gin-nen', 'Be-ginn', 'be-hal-ten', 'bei-de', 'Bei-ne', 'bei-ßen',
  'be-kannt', 'be-mer-ken', 'be-nut-zen', 'be-quem', 'be-reit', 'Be-richt', 'Be-ruf',
  'be-schrei-ben', 'be-son-ders', 'be-stel-len', 'be-su-chen', 'Bett-de-cke', 'be-we-gen',
  'be-zah-len', 'Bild', 'bil-lig', 'bin-den', 'bis-schen', 'Bit-te', 'bit-ten', 'blei-ben',
  'Blick', 'blind', 'Blitz', 'blü-hen', 'Blü-te', 'Bo-den', 'Bo-gen', 'Boot', 'bö-se', 'bra-chen',
  'brau-chen', 'breit', 'bren-nen', 'Brief', 'Bril-le', 'brin-gen', 'Brü-cke', 'Brun-nen', 'Brust',
  'Bü-ro', 'Bus-fah-rer', 'Cent', 'Chor', 'Christ-baum', 'Com-pu-ter-spiel', 'Da-me', 'dan-ken',
  'da-rum', 'Dau-men', 'De-ckel', 'den-ken', 'dies-mal', 'Ding', 'Dorf', 'Dra-chen', 'drau-ßen',
  'dre-hen', 'drü-cken', 'Duft', 'dür-fen', 'Durst', 'Du-sche', 'E-cke', 'e-gal', 'ei-ni-ge',
  'Ein-kauf', 'Eis-bär', 'Eis-ber-ge', 'E-mi-li-a', 'En-de', 'end-lich', 'Eng-land',
  'Ent-schul-di-gung', 'Er-geb-nis', 'Er-leb-nis', 'Ern-te', 'er-zie-hen', 'Es-sig', 'Eu-ro',
  'Fa-brik', 'Fah-ne', 'Fahr-kar-te', 'fal-len', 'fan-gen', 'Far-be', 'fast', 'fau-len-zen',
  'Fe-der', 'feh-len', 'Feh-ler', 'Fei-er', 'Feld', 'Fell', 'Fels', 'Fie-ber', 'fin-den',
  'Fin-ger-na-gel', 'Flug-ha-fen', 'Fleisch', 'flie-ßen', 'Flö-te', 'Flü-gel', 'Flur', 'Frau',
  'fremd', 'fres-sen', 'Freu-de', 'frie-ren', 'frisch', 'Fri-seur', 'Früch-te', 'füh-len',
  'fül-len', 'Fül-ler', 'Fut-ter', 'füt-tern', 'Ga-bel', 'Gar-ten-ar-beit', 'Gast', 'Ge-burt',
  'Ge-dicht', 'Ge-fahr', 'ge-fähr-lich', 'ge-fal-len', 'Ge-heim-nis', 'ge-hö-ren', 'Geist', 'Geld',
  'Ge-mein-de', 'ge-nau', 'ge-ra-de', 'gern', 'Ge-ruch', 'Ge-sicht', 'Ge-tränk', 'Ge-wicht',
  'Gift', 'Glas', 'glau-ben', 'gleich', 'Glück', 'glück-lich', 'Gold', 'Gras-hüp-fer', 'Gren-ze',
  'Grö-ße', 'Grup-pe', 'gru-se-lig', 'Gruß', 'gu-cken', 'Gür-tel', 'Ha-fen', 'Ha-gel', 'Hälf-te',
  'hal-ten', 'Ham-mer', 'Hand-tuch', 'hän-gen', 'Har-fe', 'hart', 'Hei-mat', 'hei-ßen', 'Hel-fer',
  'Her-de', 'Herz', 'Heu', 'hin-ter', 'Hit-ze', 'Hob-by', 'hof-fen', 'Hö-he', 'hohl', 'ho-len',
  'Holz', 'Hör-spiel', 'Ho-tel', 'Hü-gel', 'Huhn', 'Hun-ger', 'hüp-fen', 'Hus-ten', 'Hüt-te',
  'I-dee', 'Im-biss', 'In-di-a-ner', 'In-for-ma-ti-on', 'in-nen', 'Jahr', 'Jahr-markt', 'Jun-ge',
  'Kä-fig', 'Kak-tus', 'Kalb', 'kalt', 'Kamm', 'Kampf', 'Ka-nal', 'Kan-ne', 'Kap-pe', 'ka-putt',
  'Kar-ne-val', 'Kar-te', 'Kas-se', 'Kas-ten', 'Ka-ter', 'Kauf-mann', 'Ker-ze', 'Ket-te',
  'Kie-fer', 'Kin-der-wa-gen', 'Kis-te', 'kit-zeln', 'Klapp-tisch', 'klat-schen', 'Klei-dung',
  'Klin-gel', 'klop-fen', 'klug', 'Kna-be', 'Kno-chen', 'Knopf', 'Koch', 'Kof-fer', 'Kohl',
  'Kom-ma', 'Kon-zert', 'Kör-per', 'Kraft', 'Kran-ken-schwes-ter', 'Kranz', 'Kreis', 'Kreuz',
  'Krieg', 'Krü-mel', 'Kü-chen-tisch', 'Ku-gel', 'Kür-bis', 'kurz', 'Kuss', 'Kut-sche', 'La-den',
  'La-ger', 'La-ger-feu-er', 'Land-kar-te', 'Lärm', 'las-sen', 'Lauf', 'Lau-ne', 'Le-ben',
  'le-cker', 'Le-der', 'le-gen', 'leh-ren', 'lei-der', 'Lei-ter', 'Lie-be', 'Lied', 'lie-gen',
  'Löf-fel', 'Lo-ko-mo-ti-ve', 'Lö-sung', 'Luft', 'Lü-ge', 'Lust', 'Ma-cher', 'Mä-he', 'Ma-ler',
  'Man-tel', 'Mar-me-la-de', 'Ma-schi-ne', 'Mau-er', 'Me-di-zin', 'Mes-ser', 'Me-ter', 'Mi-nu-te',
  'Mit-te', 'Mo-nat', 'Mo-tor', 'Mö-we', 'Mü-he', 'Müll', 'Mün-ze', 'Mus-kel', 'Na-del', 'Na-gel',
  'Na-me', 'Nest', 'Netz', 'Ne-bel', 'nie-mand', 'Not', 'Num-mer', 'nütz-lich', 'O-fen', 'öff-nen',
  'oh-ne', 'Ohr-ring', 'Öl', 'Ord-nung', 'Ort', 'Pa-ket', 'Pal-me', 'Park', 'Pass', 'Pfan-ne',
  'Pfef-fer', 'Pfei-fe', 'Pfir-sich', 'Pfüt-ze', 'Pin-sel', 'Pi-lot', 'Plan', 'Pla-net', 'Platz',
  'plötz-lich', 'Post', 'Preis', 'Pro-blem', 'prü-fen', 'Pult', 'Pul-ver', 'Pum-pe', 'Punkt',
  'Quark', 'Quatsch', 'Quel-le', 'Rad', 'Rah-men', 'Rand', 'Ra-sen', 'ra-ten', 'Rät-sel', 'Re-gal',
  'Re-gel', 'reg-nen', 'rei-sen', 'Rei-se', 'ren-nen', 'Rest', 'ret-ten', 'Re-zept', 'Rin-de',
  'Ring', 'Ri-si-ko', 'Rol-ler', 'Rü-cken-schmer-zen', 'Ru-he', 'ru-hig', 'rund', 'Sa-che', 'Sack',
  'Sa-me', 'Samm-lung', 'Satz', 'Schach-tel', 'Scha-le', 'Schat-ten', 'Schau-fel', 'Schaum',
  'Schei-be', 'Schein-wer-fer', 'Sche-re', 'Schirm', 'Schlaf', 'Schlit-ten', 'Schloss',
  'Schlüs-sel', 'schmal', 'Schmerz', 'Schmuck', 'Schmutz', 'Schna-bel', 'Schnur',
  'Scho-ko-la-den-ku-chen', 'Schrift', 'Schritt', 'Schub-la-de', 'Schuh', 'Schul-ter', 'Schüs-sel',
  'schüt-teln', 'Schutz', 'Schwamm', 'Schwanz', 'schwer', 'Schwert', 'schwit-zen', 'See-hund',
  'Se-gel-boot', 'sei-fe', 'Sei-fe', 'Sei-te', 'Se-kun-de', 'Sel-te-ri', 'Sen-dung', 'Ses-sel',
  'sie-ben', 'Sil-ber', 'Sil-be', 'Sinn', 'Sitz', 'Skiz-ze', 'So-cke', 'Sohn', 'Sor-ge',
  'Spar-schwein', 'Spa-ten', 'Spaß', 'Spatz', 'Spei-se', 'Spie-gel-ei', 'Spiel-ver-der-ber',
  'Spit-ze', 'Sport-hal-le', 'Spra-che', 'Spray', 'Sprit-ze', 'Spur', 'Staat', 'Stadt', 'Stall',
  'Stamm', 'Stau-be', 'Stau-de', 'Stem-pel', 'Stift', 'still', 'Stim-me', 'Stirn', 'Stock',
  'Stoff', 'Stol-per-stein', 'Stra-ßen-bahn', 'Strauß', 'Streit', 'Strumpf', 'Stück', 'Stu-fe',
  'Stun-de', 'Sturm', 'Su-cher', 'Sum-me', 'Ta-ble-te', 'Ta-blet-te', 'Ta-ge-buch', 'Tal', 'Tank',
  'Tanz', 'Ta-sche', 'Tas-se', 'Tat', 'Tau', 'Tech-nik', 'Teig', 'Teil', 'Te-le-fon-buch',
  'Tel-ler', 'Tem-pe-ra-tur', 'Ten-nis', 'Test', 'teu-er', 'Text', 'Tier-arzt', 'Ti-tel',
  'Toch-ter', 'Toi-let-ten-pa-pier', 'Ton', 'Topf', 'Tor', 'Tor-te', 'Tou-rist', 'Trä-ne',
  'Trom-mel', 'Trop-fen', 'Trost', 'Tuch', 'Turm', 'Tü-te', 'Ü-bung', 'Um-welt', 'Un-fall',
  'Un-glück', 'U-ni-form', 'Va-se', 'Ver-band', 'Ver-ein', 'Ver-such', 'Vo-gel-nest', 'Vul-kan',
  'Waa-ge', 'Wa-gen', 'Wahl', 'Wan-ge', 'Wan-ne', 'Wap-pen', 'Wär-me', 'Wa-ren', 'War-te-zim-mer',
  'Wä-sche', 'Wasch-ma-schi-ne', 'Weg', 'Weih-nachts-baum', 'Wei-de', 'Wel-le', 'Welt', 'Wes-te',
  'Wet-ter-be-richt', 'Wie-ge', 'Wild-schwein', 'Wim-pel', 'Wip-pe', 'Wir-bel', 'Wit-we', 'Witz',
  'Woh-nung', 'Wol-le', 'Wort', 'Wun-der', 'Wunsch', 'Wurst', 'Wür-fel', 'Wur-zel', 'Wüs-te',
  'Zahl', 'Zan-ge', 'Zaun', 'Ze-he', 'Zei-chen', 'Zei-tung', 'Zelt', 'Zen-trum', 'Zet-tel', 'Zeug',
  'Zie-gel', 'Ziel', 'Zie-le', 'Zir-kel', 'Zoo-wär-ter', 'Zu-kunft', 'Zwil-ling', 'Zwil-lin-ge',
  'Zy-lin-der', 'beim', 'Gei-er', 'Ges-ten', 'bes-ter', 'Erb-se', 'un-ser', 'un-ten', 'He-ring',
  'A-na-nas', 'A-no-rak', 'A-ben-teu-er', 'Ber-lin', 'Ben-zin', 'Beil', 'Zu-ga-be', 'Rad-ler',
  'Bal-lon', 'Han-del', 'Fens-tern', 'Schwes-tern', 'Meis-tern', 'Hams-tern', 'flüs-tern',
  'Kris-tall', 'Trans-port', 'Stu-den-ten', 'Le-gen-de', 'spie-len-de', 'Ma-le-rei', 'Ei-sen',
  'Ei-sen-bahn', 'See-le', 'Wien', 'schien', 'Bie-nen', 'Me-lo-di-en', 'Bat-te-ri-en',
  'E-ner-gi-en', 'Pa-ti-en-ten', 'O-ri-ent', 'dient', 'ver-dient', 'An-ker', 'Mit-tel',
  'Mit-glied', 'Nach-tisch', 'Weg-wei-ser', 'Ur-sa-che', 'Knos-pe', 'Mus-ter', 'Klos-ter',
  'Pries-ter', 'Os-ten', 'Wes-ten', 'Gast-hof', 'Gast-haus', 'Ab-stand', 'Zu-stand', 'Ver-stand',
  'Ge-gen-stand', 'Kunst-stoff', 'Sau-er-stoff', 'Glas-fla-sche', 'Eng-lisch', 'Deutsch-land',
  'Peit-sche', 'Fleisch-wurst', 'Kirsch-baum', 'Tisch-ler', 'Lieb-ling', 'ek-lig', 'neb-lig',
  'mög-lich', 'Säug-ling', 'Kind-lein', 'A-fri-ka', 'Ma-kre-le', 'Pa-tro-ne', 'Hy-drant',
  'Mi-kro-fon', 'Pu-bli-kum', 'A-dres-se', 'Ta-blett', 'Kon-trol-le'
];

// Words the rules still get wrong (the AI overrides them with "|"). Keep this list small.
const KNOWN_LIMITATIONS = ['In-stal-la-ti-on', 'Kon-gress', 'Marsch-mu-sik', 'A-ber-glau-be', 'Ur-ur-en-kel'];

const split = (w) => gs.syllabify(w).join('-');

test('word list: every word gets its spoken syllables', () => {
  assert.ok(WORDS.length >= 150);
  const wrong = WORDS.filter((h) => split(h.replace(/-/g, '')) !== h)
    .map((h) => h + ' -> ' + split(h.replace(/-/g, '')));
  assert.deepEqual(wrong, []);
});

test('examples from the specification', () => {
  const cases = {
    Oma: 'O-ma', Abend: 'A-bend', Esel: 'E-sel', Igel: 'I-gel', Ufer: 'U-fer', Sonne: 'Son-ne',
    Katze: 'Kat-ze', Zucker: 'Zu-cker', Fenster: 'Fens-ter', Apfel: 'Ap-fel', singen: 'sin-gen',
    Familie: 'Fa-mi-li-e', Ferien: 'Fe-ri-en', Museum: 'Mu-se-um', Bauer: 'Bau-er',
    Haustür: 'Haus-tür', Fahrrad: 'Fahr-rad', Geburtstag: 'Ge-burts-tag', Erdbeere: 'Erd-bee-re',
    Bleistift: 'Blei-stift', beobachten: 'be-o-bach-ten', vergessen: 'ver-ges-sen', Ostern: 'Os-tern',
    Zitrone: 'Zi-tro-ne', Lehrer: 'Leh-rer', fahren: 'fah-ren', gehen: 'ge-hen'
  };
  for (const w of Object.keys(cases)) assert.equal(split(w), cases[w], w);
});

test('known limitations stay few and are still wrong (move fixed ones to WORDS)', () => {
  assert.ok(KNOWN_LIMITATIONS.length <= 8);
  for (const h of KNOWN_LIMITATIONS) assert.notEqual(split(h.replace(/-/g, '')), h, h + ' is correct now');
});

test('accuracy over word list and known limitations', () => {
  const all = WORDS.concat(KNOWN_LIMITATIONS);
  const ok = all.filter((h) => split(h.replace(/-/g, '')) === h).length;
  assert.ok(ok / all.length >= 0.99, ok + '/' + all.length);
});

test('case is preserved and the syllables join to the word', () => {
  assert.deepEqual(gs.syllabify('FAMILIE'), ['FA', 'MI', 'LI', 'E']);
  assert.deepEqual(gs.syllabify('Schmetterling'), ['Schmet', 'ter', 'ling']);
  for (const w of ['Kindergeburtstag', 'Ostereier', 'Hausaufgabe', 'Feuerwehrauto', 'Café']) {
    assert.equal(gs.syllabify(w).join(''), w);
  }
});

test('prefixes and compounds', () => {
  assert.equal(split('Hausaufgabe'), 'Haus-auf-ga-be');
  assert.equal(split('Ostereier'), 'Os-ter-ei-er');
  assert.equal(split('Kinderspielplatz'), 'Kin-der-spiel-platz');
  assert.equal(split('überall'), 'ü-ber-all');
  assert.equal(split('erinnern'), 'er-in-nern');
  assert.equal(split('Berg'), 'Berg');          // not be-rg
  assert.equal(split('gestern'), 'ges-tern');   // not ge-stern
  assert.equal(split('erste'), 'ers-te');
  assert.equal(split('Ananas'), 'A-na-nas');    // not An-a-nas
  assert.equal(split('Zugabe'), 'Zu-ga-be');    // not Zug-a-be
});

test('manual markers override the rules', () => {
  assert.deepEqual(gs.syllabify('Fahr|rad'), ['Fahr', 'rad']);
  assert.deepEqual(gs.syllabify('Ra·dies·chen'), ['Ra', 'dies', 'chen']);
  assert.deepEqual(gs.syllabify('Ins|tal|la|ti|on'), ['Ins', 'tal', 'la', 'ti', 'on']);
  assert.deepEqual(gs.syllabify('Mu|seum'), ['Mu', 'seum']);   // exactly at the markers
  assert.equal(gs.stripMarkers('Fahr|rad und Ra·dies·chen'), 'Fahrrad und Radieschen');
  // a marker that is not between two letters is ordinary text (word bank separators)
  assert.equal(gs.stripMarkers('Hund · Katze | Maus'), 'Hund · Katze | Maus');
});

test('non-letter input', () => {
  assert.deepEqual(gs.syllabify('123'), ['123']);
  assert.deepEqual(gs.syllabify('?!'), ['?!']);
  assert.deepEqual(gs.syllabify(''), []);
  assert.deepEqual(gs.syllabify('E-Mail'), ['E-', 'Mail']);
});

test('syllabifyText: words, punctuation, digits, capitals, markers', () => {
  const text = 'Die OMA kauft 3 Äpfel, oder? Schick eine E-Mail: Fahr|rad!';
  const tokens = gs.syllabifyText(text);
  assert.equal(tokens.map((t) => t.text).join(''), 'Die OMA kauft 3 Äpfel, oder? Schick eine E-Mail: Fahrrad!');
  const words = tokens.filter((t) => t.word);
  assert.deepEqual(words.map((t) => t.text),
    ['Die', 'OMA', 'kauft', 'Äpfel', 'oder', 'Schick', 'eine', 'E', 'Mail', 'Fahrrad']);
  assert.deepEqual(words.map((t) => t.syllables.join('-')),
    ['Die', 'O-MA', 'kauft', 'Äp-fel', 'o-der', 'Schick', 'ei-ne', 'E', 'Mail', 'Fahr-rad']);
  assert.deepEqual(tokens.filter((t) => !t.word).map((t) => t.text),
    [' ', ' ', ' 3 ', ', ', '? ', ' ', ' ', '-', ': ', '!']);
  for (const t of words) assert.equal(t.syllables.join(''), t.text);
});

test('syllabifyText: apostrophes inside words, word banks, empty input', () => {
  const tokens = gs.syllabifyText("Wie geht's? Hund · Katze");
  assert.deepEqual(tokens.filter((t) => t.word).map((t) => t.text), ['Wie', "geht's", 'Hund', 'Katze']);
  assert.equal(tokens.map((t) => t.text).join(''), "Wie geht's? Hund · Katze");
  assert.deepEqual(gs.syllabifyText(''), []);
  assert.deepEqual(gs.syllabifyText(null), []);
});
