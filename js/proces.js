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
  const metKenteken = o.type !== "gebruikt";
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
    } else {
      add("Auto", { key: "chassis", label: "Chassisnummer of kenteken", soort: "tekst", pad: "auto.chassis" });
    }
    if (o.voorraad === "andere-locatie" && nieuw) {
      add("Auto", { key: "rdc", label: "Transport ingepland via RDC", soort: "vink", verplicht: false, hint: "Indien nodig" });
      add("Auto", { key: "team_info", label: "Team geïnformeerd, ook Meppel", soort: "actie", knop: "Stuur melding met chassisnummer" });
    }
    if (nieuw) add("Auto", { key: "premie", label: "Inruilpremie excl. dealerbijdrage", soort: "info", tekst: "Komt uit de maandelijkse premietabel. Die is nog niet aangeleverd.", verplicht: false });
    add("Auto", { key: "accessoires", label: "Accessoires uit de order", soort: "lijst", verplicht: false });

    add("Inruil", { key: "inruil", label: "Inruil", soort: "janee", pad: "heeftInruil" });
    if (o.heeftInruil) {
      add("Inruil", { key: "i_kenteken", label: "Kenteken inruil", soort: "tekst", pad: "inruil.kenteken" });
      add("Inruil", { key: "i_boekwaarde", label: "Boekwaarde", soort: "getal", pad: "inruil.boekwaarde", eenheid: "€" });
      add("Inruil", { key: "i_opm", label: "Opmerkingen inruil", soort: "tekst", pad: "inruil.opm", verplicht: false, hint: "Bijvoorbeeld losse inkoop" });
    }
    add("Opmerkingen", { key: "opm_verkoop", label: "Opmerkingen voor het team", soort: "tekstvak", pad: "opm_verkoop", verplicht: false, hint: "Bijvoorbeeld: levering op verjaardag" });
  }

  if (nr === 2) {
    add("Werkplaats", { key: "w_gecontroleerd", label: "Orderbevestiging en accessoirelijst uit fase 1 gecontroleerd", soort: "vink" });
    add("Werkplaats", { key: "onderdelen", label: "Onderdelen besteld, met verwachte leverdatum", soort: "onderdelen" });
    add("Werkplaats", { key: "werkorder", label: "Werkordernummer", soort: "tekst", pad: "werkorder" });
  }

  if (nr === 3) {
    add("Ontvangst", { key: "binnen", label: "Auto binnen gemeld", soort: "actie", knop: "Auto is binnen" });
    add("Afspraak met klant", { key: "afleverdatum", label: o.type === "import" ? "Verwachte afleverdatum" : "Afleverdatum", soort: "datum", pad: "afleverdatum",
      hint: o.type === "import" ? "Import: 6 weken aanhouden, definitief pas als het kenteken er is" : "Zet straks automatisch een afspraak in de agenda van bydgroningen@" });
    add("Afspraak met klant", { key: "aflevertijd", label: "Tijd", soort: "tijd", pad: "aflevertijd" });
    add("Afspraak met klant", { key: "k_geboorte", label: "Geboortedatum klant", soort: "datum", pad: "klant.geboortedatum", verplicht: false, hint: "Voor de verzekeringsofferte" });
    add("Afspraak met klant", { key: "k_schadevrij", label: "Schadevrije jaren", soort: "getal", pad: "klant.schadevrij", verplicht: false });
    add("Afspraak met klant", { key: "verzekering", label: "Verzekering besproken", soort: "janee", pad: "verzekering", hint: "Alles onder één dak, originele onderdelen, BYD-monteurs" });
    if (metKenteken) {
      add("Kenteken", { key: "kent_aangevraagd", label: "Kenteken aangevraagd", soort: "actie", knop: "Kenteken aangevraagd" });
      add("Kenteken", { key: "kenteken", label: "Kenteken", soort: "tekst", pad: "auto.kenteken" });
      add("Kenteken", { key: "naar_admin", label: "Afleverdocument naar administratie", soort: "actie", knop: "Formulier naar administratie" });
    }
    add("Werkplaats inplannen", { key: "klaarmaak", label: "Klaarmaakdatum werkplaats", soort: "datum", pad: "klaarmaakdatum", hint: "Uiterlijk 2 dagen vóór aflevering" });
  }

  if (nr === 4) {
    add("Afleverklaar", { key: "wp_klaar", label: "Auto werkplaatsklaar", soort: "vink" });
    if (o.auto?.phev) add("Afleverklaar", { key: "getankt", label: "Getankt", soort: "vink", hint: "Plug-in hybride" });
    add("Afleverklaar", { key: "lader", label: "Aan de lader, laadpas of laadpaal", soort: "janee", pad: "lader" });
    add("Afleverklaar", { key: "wp_agenda", label: "WP-klaar in de agenda", soort: "info", tekst: "Gaat automatisch zodra deze fase groen is.", verplicht: false });
  }

  if (nr === "ott") {
    add("OTT", { key: "ott_code", label: "OTT-code opgevraagd bij financiering of lease", soort: "tekst", pad: "ott_code" });
  }

  if (nr === 5) {
    add("Voorbereiding", { key: "w_gelezen", label: "Opmerkingen werkplaats gelezen en open punten opgelost", soort: "vink" });
    add("Voorbereiding", { key: "poets", label: "Ingepland bij de poetser", soort: "poets", hint: "Minimaal 24 uur vooraf, anders extra kosten" });
    add("Voorbereiding", { key: "showroom", label: "Showroomcheck: schoon, kabels, accessoires, mastercare, calamiteitenpakket, kenteken op de auto", soort: "vink" });
    add("Voorbereiding", { key: "km", label: "Kilometerstand", soort: "getal", pad: "auto.km", eenheid: "km" });
    add("Voorbereiding", { key: "betaling", label: "Betaling gecontroleerd", soort: "vink", hint: "Ontvangen bankbetalingen" });
    add("Aflevering", { key: "afgeleverd", label: "Aflevering afgerond", soort: "actie", knop: "Aflevering afgerond" });
  }
  return p;
}

/* Is één punt ingevuld? */
function puntKlaar(o, punt) {
  if (punt.soort === "info" || punt.soort === "lijst") return true;
  if (punt.soort === "vink" || punt.soort === "actie" || punt.soort === "upload") return !!o.vink?.[punt.key];
  if (punt.soort === "janee") return typeof lees(o, punt.pad) === "boolean";
  if (punt.soort === "onderdelen") return (o.accessoires || []).every(a => a.besteld && a.verwacht);
  if (punt.soort === "poets") return !!o.poets?.datum;
  const v = lees(o, punt.pad);
  return v !== undefined && v !== null && String(v).trim() !== "";
}

function openPunten(o, nr) { return puntenVoor(o, nr).filter(p => p.verplicht && !puntKlaar(o, p)); }

/* ---------- welke fase wacht op welke ----------
   nieuw en import: 1 → 2 → 3 → 4 → 5, en 5.1 (OTT) start tegelijk met 4.
   gebruikt: 1 → 2 en 3 tegelijk → 4 → 5. */
function vereist(o, nr) {
  const gebruikt = o.type === "gebruikt";
  return {
    1: [],
    2: [1],
    3: gebruikt ? [1] : [2],
    4: gebruikt ? [2, 3] : [3],
    ott: gebruikt ? [2, 3] : [3],
    5: o.ott ? [4, "ott"] : [4]
  }[nr];
}

function faseVanToepassing(o, nr) { return nr !== "ott" || !!o.ott; }

/* Kleur van één fase: grijs, oranje, rood of groen. */
function faseStatus(o, nr) {
  if (!faseVanToepassing(o, nr)) return "nvt";
  const vorigeGroen = vereist(o, nr).every(v => ["groen", "nvt"].includes(faseStatus(o, v)));
  if (!vorigeGroen) return "grijs";
  /* een fase die een manager heeft heropend, telt als lopend tot de eigenaar hem opnieuw afrondt */
  if (!o.heropend?.[nr] && openPunten(o, nr).length === 0) return "groen";
  return faseTeLaat(o, nr) ? "rood" : "oranje";
}

/* Wanneer staat een lopende fase op rood? De deadlines uit de tabel "Timers en meldingen". */
function faseTeLaat(o, nr) {
  if (o.levertijd && dagenTot(o.levertijd) < 0 && !o.vink?.afgeleverd) return true;
  if (nr === 2) {
    /* onderdeel komt pas na de klaarmaakdatum binnen, of zonder klaarmaakdatum na levertijd min 2 dagen */
    const grens = o.klaarmaakdatum || (o.levertijd && plusDagen(o.levertijd, -2));
    return !!grens && (o.accessoires || []).some(a => a.verwacht && a.verwacht > grens);
  }
  if (nr === 3) {
    const aangevraagd = o.vink?.kent_aangevraagd?.op;
    if (aangevraagd && !o.auto?.kenteken && dagenTot(aangevraagd.slice(0, 10)) < -4) return true;
    return false;
  }
  if (nr === 4) return !!o.afleverdatum && dagenTot(o.afleverdatum) <= 2;
  if (nr === 5) return !!o.afleverdatum && dagenTot(o.afleverdatum) < 0;
  return false;
}

/* Dezelfde regels als faseTeLaat, maar dan als zin voor op het scherm. */
function waaromTeLaat(o, nr) {
  if (o.levertijd && dagenTot(o.levertijd) < 0 && !o.vink?.afgeleverd) return "Afgesproken levertijd is voorbij";
  if (nr === 2) return "Onderdeel komt na de uiterste klaarmaakdatum binnen";
  if (nr === 3) return "Kenteken langer dan 4 dagen onderweg";
  if (nr === 4) return "Nog niet werkplaatsklaar, aflevering binnen 2 dagen";
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
   50% van de wachttijd verstreken → verkoper neemt contact op.
   3 weken voor de afleverdatum → klant bellen met een statusupdate.
   Een vastgelegd contactmoment zet de teller opnieuw: volgende keer 2 weken voor het einde. */
function contactTimer(o) {
  if (o.vink?.afgeleverd) return null;
  const eind = o.afleverdatum || o.levertijd;
  if (!eind || !o.aangemaakt) return null;
  const laatste = (o.contact || []).map(c => c.op.slice(0, 10)).sort().pop();
  const totEind = dagenTot(eind);
  if (laatste) {
    const sinds = -dagenTot(laatste);
    if (totEind <= 14 && sinds > 7) return { wie: "afleverspecialist", tekst: "Klant bellen, 2 weken voor aflevering" };
    return null;
  }
  const totaal = dagenTot(eind) - dagenTot(o.aangemaakt.slice(0, 10));
  const verstreken = -dagenTot(o.aangemaakt.slice(0, 10));
  if (totEind <= 21) return { wie: "afleverspecialist", tekst: "Klant bellen, 3 weken voor aflevering" };
  if (verstreken >= totaal / 2) return { wie: "verkoper", tekst: "Helft wachttijd voorbij, klant bellen" };
  return null;
}

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
