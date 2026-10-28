/* ==========================================================================
   Het afleverproces: fases, wie ze afrondt, welke punten erin zitten en hoe de
   stoplichtkleur wordt bepaald. Bron: docs/bron/Systeemuitleg Digitaal Afleverproces
   BYD versie 1.docx.

   Dit bestand bevat alleen regels, geen schermcode. Straks moet de database dezelfde
   regels afdwingen (RPC fase_afronden); tot die tijd is dit de enige plek waar ze staan.
   ========================================================================== */

const ROLLEN = {
  verkoper: "Verkoper",
  afleverspecialist: "Afleverspecialist",
  werkplaatschef: "Werkplaatschef",
  poetser: "Poetser",
  administratie: "Administratie",
  manager: "Manager"
};

const TYPES = { nieuw: "Nieuw", gebruikt: "Gebruikt", import: "Import" };

const VOORRAAD = {
  winkel: "Eigen voorraad, op de winkel",
  "andere-locatie": "Eigen voorraad, andere locatie",
  bestelling: "Niet op voorraad, bestellen"
};

const MODELLEN = ["DOLPHIN SURF", "DOLPHIN G", "ATTO 2", "ATTO 2 DM-i", "ATTO 3 EVO", "SEAL",
  "SEAL 6 DM-i", "SEAL U", "SEAL U DM-i", "SEALION 7"];

const SLEUTELLOCATIES = ["Verkocht", "Verkocht WP-klaar", "Farman", "Farman gereed", "In auto (showroom)", "Klant"];

/* Kolommen op het bord. "ott" (5.1) is geen eigen kolom: hij hoort bij aflevering maar
   start al tegelijk met fase 4. */
const FASES = [
  { nr: 1, naam: "Verkoop", eigenaar: "verkoper" },
  { nr: 2, naam: "Onderdelen", eigenaar: "werkplaatschef" },
  { nr: 3, naam: "Auto binnen", eigenaar: "afleverspecialist" },
  { nr: 4, naam: "Werkplaats", eigenaar: "werkplaatschef" },
  { nr: "ott", naam: "OTT-code", eigenaar: "afleverspecialist" },
  { nr: 5, naam: "Aflevering", eigenaar: "afleverspecialist" }
];
const BORD_FASES = FASES.filter(f => f.nr !== "ott");

function faseInfo(nr) { return FASES.find(f => f.nr === nr); }

/* ---------- datums ---------- */

function vandaag() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function naarDatum(iso) { if (!iso) return null; const [j, m, d] = iso.slice(0, 10).split("-").map(Number); return new Date(j, m - 1, d); }
function naarIso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function plusDagen(iso, n) { const d = naarDatum(iso); d.setDate(d.getDate() + n); return naarIso(d); }
function dagenTot(iso) { return Math.round((naarDatum(iso) - vandaag()) / 864e5); }

/* Werkdagen = maandag t/m vrijdag. Of zaterdag meetelt is open vraag 8 in docs/plan.md. */
function plusWerkdagen(iso, n) {
  const d = naarDatum(iso);
  while (n > 0) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) n--; }
  return naarIso(d);
}

function minWerkdagen(iso, n) {
  const d = naarDatum(iso);
  while (n > 0) { d.setDate(d.getDate() - 1); if (d.getDay() !== 0 && d.getDay() !== 6) n--; }
  return naarIso(d);
}
function datumKortP(iso) { return typeof datumKort === "function" ? datumKort(iso) : iso; }

/* ---------- waarden in een order lezen en zetten via een pad als "klant.naam" ---------- */

function lees(o, pad) { return pad.split(".").reduce((v, k) => (v == null ? v : v[k]), o); }
function zet(o, pad, waarde) {
  const delen = pad.split("."); const laatste = delen.pop();
  const doel = delen.reduce((v, k) => (v[k] ??= {}), o);
  doel[laatste] = waarde;
}

/* ---------- de punten per fase ----------
   soort: tekst, getal, datum, tijd, keuze, janee, vink, actie, upload, tekstvak,
          onderdelen, poets, info
   Een punt met `pad` bewaart zijn waarde in de order zelf; een vink of actie in
   order.vink[key] als { door, op }. */

function puntenVoor(o, nr) {
  const nieuw = o.type === "nieuw";
  const p = [];
  const add = (groep, punt) => p.push({ groep, verplicht: true, ...punt });

  if (nr === 1) {
    add("Order", { key: "contract", label: "Ondertekend contract", soort: "upload" });
    add("Order", { key: "orderbev", label: "Orderbevestiging CarIt", soort: "upload", hint: "Later automatisch via de koppeling" });
    add("Order", { key: "ordernummer", label: "Ordernummer", soort: "tekst", pad: "ordernummer" });
    add("Order", { key: "type", label: "Soort", soort: "keuze", pad: "type", opties: TYPES });
    if (nieuw) add("Order", { key: "voorraad", label: "Waar komt de auto vandaan", soort: "keuze", pad: "voorraad", opties: VOORRAAD });
    add("Order", { key: "levertijd", label: "Afgesproken levertijd", soort: "datum", pad: "levertijd", hint: "Start de levertijd-timer" });
    add("Order", { key: "mastercare", label: "Mastercare", soort: "janee", pad: "mastercare" });
    add("Order", { key: "ott", label: "OTT-tenaamstelling", soort: "janee", pad: "ott" });
    if (o.ott) add("Order", { key: "ott_via", label: "Via wie wordt de OTT opgevraagd", soort: "tekst", pad: "ott_via" });

    add("Klant", { key: "k_aanhef", label: "Aanhef", soort: "keuze", pad: "klant.aanhef", opties: { "Dhr.": "Dhr.", "Mevr.": "Mevr.", "Fam.": "Fam." } });
    add("Klant", { key: "k_naam", label: "Achternaam", soort: "tekst", pad: "klant.naam" });
    add("Klant", { key: "k_postcode", label: "Postcode", soort: "tekst", pad: "klant.postcode" });
    add("Klant", { key: "k_huisnr", label: "Huisnummer", soort: "tekst", pad: "klant.huisnr" });
    add("Klant", { key: "k_email", label: "E-mail", soort: "tekst", pad: "klant.email" });
    add("Klant", { key: "k_tel", label: "Telefoon", soort: "tekst", pad: "klant.tel" });

    if (o.type === "gebruikt") add("Auto", { key: "model", label: "Merk en model", soort: "tekst", pad: "auto.model" });
    else add("Auto", { key: "model", label: "Model", soort: "keuze", pad: "auto.model", opties: Object.fromEntries(MODELLEN.map(m => [m, m])) });
    if (o.voorraad === "bestelling" && nieuw) {
      add("Auto", { key: "bgpc", label: "Besteld in BGPC", soort: "vink" });
      add("Auto", { key: "chassis", label: "Chassisnummer", soort: "tekst", pad: "auto.chassis", verplicht: false, hint: "Koppelen zodra bekend" });
    } else if (o.type === "import") {
      add("Auto", { key: "chassis", label: "Auto uit de importlijst", soort: "importkeuze", pad: "auto.chassis", hint: "Kenteken en binnenmelding lopen via de importlijst" });
    } else {
      add("Auto", { key: "chassis", label: "Chassisnummer of kenteken", soort: "tekst", pad: "auto.chassis" });
    }
    if (o.voorraad === "andere-locatie" && nieuw) {
      add("Auto", { key: "rdc", label: "Transport ingepland via RDC", soort: "vink", verplicht: false, hint: "Indien nodig" });
      add("Auto", { key: "team_info", label: "Team geïnformeerd, ook Meppel", soort: "actie", knop: "Stuur melding met chassisnummer" });
    }
    if (o.voorraad === "winkel" && nieuw) add("Auto", { key: "binnen", label: "Auto binnen gemeld", soort: "actie", knop: "Auto is binnen", hint: "Staat al op de vestiging, dus meteen binnen melden" });
    if (nieuw) add("Auto", { key: "premie", label: "Inruilpremie excl. dealerbijdrage", soort: "info", tekst: "Uit de premielijst van de manager.", verplicht: false });
    add("Auto", { key: "acc_info", label: "Accessoires", soort: "info", tekst: "Vult de werkplaatschef in bij fase 2.", verplicht: false });

    add("Inruil", { key: "inruil", label: "Inruil", soort: "janee", pad: "heeftInruil" });
    if (o.heeftInruil) {
      add("Inruil", { key: "i_kenteken", label: "Kenteken inruil", soort: "tekst", pad: "inruil.kenteken" });
      add("Inruil", { key: "i_boekwaarde", label: "Boekwaarde", soort: "getal", pad: "inruil.boekwaarde", eenheid: "€" });
      add("Inruil", { key: "i_opm", label: "Opmerkingen inruil", soort: "tekst", pad: "inruil.opm", verplicht: false, hint: "Bijvoorbeeld losse inkoop" });
    }
    add("Opmerkingen", { key: "opm_verkoop", label: "Opmerkingen voor het team", soort: "tekstvak", pad: "opm_verkoop", verplicht: false, hint: "Bijvoorbeeld: levering op verjaardag" });
  }

  if (nr === 2) {
    add("Werkplaats", { key: "accessoires", label: "Accessoires uit de orderbevestiging", soort: "lijst", verplicht: false });
    add("Werkplaats", { key: "w_gecontroleerd", label: "Orderbevestiging gecontroleerd en accessoires ingevoerd", soort: "vink" });
    add("Werkplaats", { key: "onderdelen", label: "Onderdelen besteld, met verwachte leverdatum", soort: "onderdelen" });
    add("Werkplaats", { key: "werkorder", label: "Werkordernummer", soort: "tekst", pad: "werkorder" });
  }

  if (nr === 3) {
    add("Ontvangst", { key: "binnen", label: "Auto binnen gemeld", soort: "actie", knop: "Auto is binnen" });
    if (o.type === "nieuw") {
      add("Kenteken", { key: "kent_aangevraagd", label: "Kenteken aangevraagd", soort: "actie", knop: "Kenteken aangevraagd" });
      add("Kenteken", { key: "kenteken", label: "Kenteken", soort: "tekst", pad: "auto.kenteken" });
    }
    if (o.type === "import") add("Kenteken", { key: "kenteken", label: "Kenteken", soort: "import", hint: "Komt vanzelf binnen zodra de importlijst op kenteken bekend staat" });
    add("Afspraak met klant", { key: "afleverdatum", label: "Definitieve afleverdatum", soort: "datum", pad: "afleverdatum",
      hint: o.type === "import" && !o.auto?.kenteken ? "Import: verwachte datum, definitief zodra het kenteken er is" : "Zet straks automatisch een afspraak in de agenda van bydgroningen@" });
    add("Afspraak met klant", { key: "aflevertijd", label: "Tijd", soort: "tijd", pad: "aflevertijd" });
    add("Afspraak met klant", { key: "wp_deadline", label: "Werkplaats klaar uiterlijk", soort: "info", tekst: "Volgt uit de afleverdatum.", verplicht: false });
    add("Afspraak met klant", { key: "k_geboorte", label: "Geboortedatum klant", soort: "datum", pad: "klant.geboortedatum", verplicht: false, hint: "Voor de verzekeringsofferte" });
    add("Afspraak met klant", { key: "k_schadevrij", label: "Schadevrije jaren", soort: "getal", pad: "klant.schadevrij", verplicht: false });
    add("Afspraak met klant", { key: "verzekering", label: "Verzekering besproken", soort: "janee", pad: "verzekering", hint: "Alles onder één dak, originele onderdelen, BYD-monteurs" });
    add("Administratie", { key: "factuur", label: "Factuur aangevraagd bij de administratie", soort: "actie", knop: "Factuur aanvragen" });
  }

  if (nr === 4) {
    add("Planning", { key: "wp_ingepland", label: "Ingepland in de werkplaats", soort: "vink" });
    add("Afleverklaar", { key: "wp_klaar", label: "Auto werkplaatsklaar", soort: "vink" });
    if (o.auto?.phev) add("Afleverklaar", { key: "getankt", label: "Getankt", soort: "vink", hint: "Plug-in hybride" });
    add("Afleverklaar", { key: "wp_agenda", label: "WP-klaar in de agenda", soort: "info", tekst: "Gaat automatisch zodra je WP-klaar afvinkt.", verplicht: false });
  }

  if (nr === "ott") {
    add("OTT", { key: "ott_code", label: "OTT-code opgevraagd bij financiering of lease", soort: "tekst", pad: "ott_code" });
  }

  if (nr === 5) {
    add("Voorbereiding", { key: "w_gelezen", label: "Opmerkingen werkplaats gelezen en open punten opgelost", soort: "vink" });
    add("Voorbereiding", { key: "volgeladen", label: "Auto volgeladen", soort: "vink" });
    add("Voorbereiding", { key: "poets", label: "Ingepland bij de poetser", soort: "poets", hint: "Minimaal 24 uur vooraf, anders extra kosten" });
    add("Voorbereiding", { key: "showroom", label: "Gepoetst in de showroom. Check: schoon, kabels, accessoires, mastercare, calamiteitenpakket, kenteken op de auto", soort: "vink" });
    add("Voorbereiding", { key: "km", label: "Kilometerstand", soort: "getal", pad: "auto.km", eenheid: "km" });
    add("Voorbereiding", { key: "betaling", label: "Betaling gecontroleerd", soort: "vink", hint: "Ontvangen bankbetalingen" });
    add("Aflevering", { key: "afgeleverd", label: "Aflevering afgerond", soort: "actie", knop: "Aflevering afgerond" });
  }
  return p;
}

/* Is één punt ingevuld? */
function puntKlaar(o, punt) {
  /* na 30 dagen zijn de klantgegevens gewist; dat heropent fase 1 niet */
  if (o.gewist && punt.pad?.startsWith("klant.")) return true;
  if (punt.soort === "info" || punt.soort === "lijst") return true;
  if (punt.soort === "vink" || punt.soort === "actie" || punt.soort === "upload") return !!o.vink?.[punt.key];
  if (punt.soort === "janee") return typeof lees(o, punt.pad) === "boolean";
  if (punt.soort === "onderdelen") return (o.accessoires || []).every(a => a.besteld && a.verwacht);
  if (punt.soort === "poets") return !!o.poets?.datum;
  if (punt.soort === "import") return !!o.auto?.kenteken;
  const v = lees(o, punt.pad);
  return v !== undefined && v !== null && String(v).trim() !== "";
}

function openPunten(o, nr) { return puntenVoor(o, nr).filter(p => p.verplicht && !puntKlaar(o, p)); }

/* ---------- welke fase wacht op welke ----------
   Binnen melden, kenteken en afspraak (3) wachten alleen op de verkoop (1). De werkplaats (4)
   start zodra de onderdelen geregeld zijn (2) en de auto binnen is, ook bij import zonder
   kenteken. Aflevering (5) start na WP-klaar; "Aflevering afgerond" kan pas als 3 groen is.
   5.1 (OTT) start na fase 3. */
function vereist(o, nr) {
  return { 1: [], 2: [1], 3: [1], 4: [2], ott: [3], 5: o.ott ? [4, "ott"] : [4] }[nr];
}

function faseVanToepassing(o, nr) { return nr !== "ott" || !!o.ott; }

/* Kleur van één fase: grijs, oranje, rood of groen. */
function faseStatus(o, nr) {
  if (!faseVanToepassing(o, nr)) return "nvt";
  const vorigeGroen = vereist(o, nr).every(v => ["groen", "nvt"].includes(faseStatus(o, v)));
  if (!vorigeGroen) return "grijs";
  if (nr === 4 && !o.vink?.binnen) return "grijs";
  /* een fase die een manager heeft heropend, telt als lopend tot de eigenaar hem opnieuw afrondt */
  if (!o.heropend?.[nr] && openPunten(o, nr).length === 0) return "groen";
  return faseTeLaat(o, nr) ? "rood" : "oranje";
}

/* Wanneer staat een lopende fase op rood? De deadlines uit de tabel "Timers en meldingen". */
function faseTeLaat(o, nr) {
  if (levertijdVoorbij(o)) return true;
  if (nr === 2) {
    /* onderdeel komt pas na de WP-deadline binnen, of zonder afleverdatum na levertijd min 2 dagen */
    const grens = wpDeadline(o) || (o.levertijd && plusDagen(o.levertijd, -2));
    return !!grens && (o.accessoires || []).some(a => a.verwacht && a.verwacht > grens);
  }
  if (nr === 3) {
    const aangevraagd = o.vink?.kent_aangevraagd?.op;
    return !!aangevraagd && !o.auto?.kenteken && dagenTot(aangevraagd.slice(0, 10)) < -4;
  }
  if (nr === 4) return !!wpDeadline(o) && dagenTot(wpDeadline(o)) < 0;
  if (nr === 5) return !!o.afleverdatum && dagenTot(o.afleverdatum) < 0;
  return false;
}

/* Dezelfde regels als faseTeLaat, maar dan als zin voor op het scherm. */
function waaromTeLaat(o, nr) {
  if (levertijdVoorbij(o)) return "Verwachte leverdatum is 4 dagen of meer voorbij";
  if (nr === 2) return "Onderdeel komt na de WP-deadline binnen";
  if (nr === 3) return "Kenteken langer dan 4 dagen onderweg";
  if (nr === 4) return `Nog niet werkplaatsklaar, moest ${datumKortP(wpDeadline(o))} klaar zijn`;
  if (nr === 5) return "Afleverdatum is voorbij";
  return "";
}

/* In welke kolom staat de kaart: de vroegste fase die nog niet groen is. */
function huidigeFase(o) {
  if (o.vink?.afgeleverd && faseStatus(o, 5) === "groen") return "klaar";
  for (const f of BORD_FASES) { const s = faseStatus(o, f.nr); if (s === "oranje" || s === "rood") return f.nr; }
  for (const f of BORD_FASES) if (faseStatus(o, f.nr) !== "groen") return f.nr;
  return "klaar";
}

/* Kleur van de kaart: de ergste kleur van alle fases die nu lopen. */
function kaartStatus(o) {
  const lopend = FASES.map(f => faseStatus(o, f.nr));
  if (lopend.includes("rood")) return "rood";
  if (lopend.includes("oranje")) return "oranje";
  return "groen";
}

/* ---------- timers voor contact met de klant ----------
   Twee belmomenten: de helft van de wachttijd voorbij (verkoper), en 3 weken voor de
   verwachte leverdatum (afleverspecialist; niet bij gebruikt en import). Wie de klant
   bijpraat, legt vast of de datum blijft of welke nieuwe datum is afgesproken; daarmee
   is dat belmoment klaar. */
function verwachteDatum(o) { return o.afleverdatum || o.levertijd; }

function contactTimer(o) {
  if (o.vink?.afgeleverd) return null;
  const eind = verwachteDatum(o);
  if (!eind || !o.aangemaakt) return null;
  const gedaan = new Set((o.contact || []).flatMap(c => c.momenten || []));
  const start = o.aangemaakt.slice(0, 10);
  const totaal = dagenTot(eind) - dagenTot(start);
  if (o.type === "nieuw" && dagenTot(eind) <= 21 && !gedaan.has("drieweken"))
    return { soort: "drieweken", wie: "afleverspecialist", tekst: "Klant bijpraten, 3 weken voor levering" };
  if (-dagenTot(start) >= totaal / 2 && !gedaan.has("helft") && !gedaan.has("drieweken"))
    return { soort: "helft", wie: "verkoper", tekst: "Helft van de levertijd voorbij, klant bijpraten" };
  return null;
}

/* Auto's die nog niet binnen zijn. Oranje in de laatste helft van de levertijd of vanaf
   3 weken voor de verwachte datum, rood bij 4 dagen of meer over die datum. */
function levertijdVoorbij(o) { return !o.vink?.afgeleverd && !!o.levertijd && !o.vink?.binnen && dagenTot(o.levertijd) <= -4; }

function onderwegKleur(o) {
  if (!o.levertijd) return "grijs";
  if (levertijdVoorbij(o)) return "rood";
  const start = (o.aangemaakt || "").slice(0, 10);
  const totaal = dagenTot(o.levertijd) - dagenTot(start);
  if (dagenTot(o.levertijd) <= 21 || -dagenTot(start) >= totaal / 2) return "oranje";
  return "grijs";
}

/* ---------- werkplaats ---------- */

/* De werkplaatschef ziet niet de afleverdatum, maar de dag waarop de auto klaar moet zijn:
   2 werkdagen vóór de aflevering. */
function wpDeadline(o) { return o.afleverdatum ? minWerkdagen(o.afleverdatum, 2) : null; }

/* Onderdelen-icoon: grijs zolang de werkplaats nog niet heeft gekeken, rood als er iets
   niet besteld is of te laat komt, oranje als er nog iets onderweg is, groen als alles binnen is. */
function onderdelenStatus(o) {
  const acc = o.accessoires || [];
  if (!o.vink?.w_gecontroleerd) return "grijs";
  const grens = wpDeadline(o);
  if (acc.some(a => !a.besteld || (grens && a.verwacht && a.verwacht > grens))) return "rood";
  if (acc.some(a => !a.binnen)) return "oranje";
  return "groen";
}

/* Werkplaats-icoon: rood niet ingepland, oranje ingepland, groen helemaal WP-klaar (fase 4 rond). */
function werkplaatsStatus(o) {
  if (o.vink?.wp_klaar && faseStatus(o, 4) === "groen") return "groen";
  if (o.vink?.wp_ingepland) return "oranje";
  return "rood";
}

/* ---------- de balk van verkoop en afleverspecialist ----------
   Vijf delen. Elk deel wordt een taak zodra het "open" staat, en groen als het "klaar" is. */
function verkoopDelen(o) {
  const v = o.vink || {};
  const d = [
    { nr: 1, label: "Kenteken toevoegen", klaar: !!o.auto?.kenteken, open: !!v.binnen },
    { nr: 2, label: "Afleverdatum en tijd vastleggen, factuur aanvragen", klaar: !!v.factuur, open: !!o.auto?.kenteken },
    { nr: 3, label: "Auto volladen", klaar: !!v.volgeladen, open: !!v.wp_klaar },
    { nr: 4, label: "Inplannen bij de poetser", klaar: !!o.poets?.datum, open: !!v.volgeladen },
    { nr: 5, label: "Gepoetst in de showroom", klaar: !!v.showroom, open: !!o.poets?.datum }
  ];
  /* de import regelt deel 1 zelf via de importlijst */
  if (o.type === "import") d[0].label = "Kenteken via de importlijst";
  return d;
}

/* ---------- import ----------
   Zeven stappen, 0 tot en met 6. De stand staat bij de auto in de importlijst; een order met
   hetzelfde chassisnummer leest daar mee, zodat beide plekken altijd hetzelfde tonen. */
const IMPORT_STAPPEN = ["Auto binnen gemeld", "Wachten op papieren", "Papieren binnen", "Goedkeuring RDW",
  "BPM-aangifte op de post", "BPM-aangifte betaald", "Kenteken bekend"];

function importStand(imp) { return IMPORT_STAPPEN.filter((_, i) => imp?.stappen?.[i]).length; }

/* Houdt importlijst en orders gelijk op chassisnummer. Geeft true als er iets veranderde. */
function koppelImports(orders, imports) {
  let anders = false;
  for (const o of orders) {
    if (o.type !== "import" || !o.auto?.chassis || o.vink?.afgeleverd) continue;
    const imp = imports.find(i => i.chassis === o.auto.chassis);
    if (!imp) continue;
    imp.stappen ??= {};
    if (imp.stappen[0] && !o.vink.binnen) { o.vink.binnen = { ...imp.stappen[0] }; anders = true; }
    if (o.vink.binnen && !imp.stappen[0]) { imp.stappen[0] = { ...o.vink.binnen }; anders = true; }
    if (imp.kenteken && o.auto.kenteken !== imp.kenteken) { o.auto.kenteken = imp.kenteken; anders = true; }
    if (!imp.kenteken && o.auto.kenteken) { o.auto.kenteken = ""; anders = true; }
  }
  return anders;
}

/* "BYD ATTO 3" voor een BYD-model, anders de naam zoals hij is ingevuld ("Tesla Model 3"). */
function autoNaam(o) {
  const m = o.auto?.model || "";
  return MODELLEN.some(x => m.startsWith(x.split(" ")[0])) ? `BYD ${m}` : m;
}

function meldcode(o) { return (o.auto?.chassis || o.chassis || "").slice(-4).toUpperCase(); }

/* Vroegst mogelijke afleverdatum: auto binnen + 6 werkdagen klaarmaken + 2 dagen. */
function vroegsteAflevering(o) {
  const binnen = o.vink?.binnen?.op?.slice(0, 10);
  if (!binnen) return null;
  return plusDagen(plusWerkdagen(binnen, 6), 2);
}

/* Klantgegevens gaan 30 dagen na aflevering weg. */
function wisDatum(o) { const op = o.vink?.afgeleverd?.op; return op ? plusDagen(op.slice(0, 10), 30) : null; }
function npsDatum(o) { const op = o.vink?.afgeleverd?.op; return op ? plusDagen(op.slice(0, 10), 28) : null; }

function klantNaam(o) {
  if (o.gewist) return "Klantgegevens gewist";
  const k = o.klant || {};
  return [k.aanhef, k.naam].filter(Boolean).join(" ") || "Nieuwe klant";
}
