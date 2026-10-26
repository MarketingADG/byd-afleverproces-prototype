/* ==========================================================================
   VOORBEELDDATA. Alleen voor het visuele prototype.

   Alle namen, kentekens en nummers zijn verzonnen. Wijzigingen blijven bewaard in de
   browser (localStorage) zodat je tussen pagina's kunt klikken; "Voorbeelddata
   herstellen" onderin zet alles terug. Zodra Supabase eraan hangt, verdwijnt dit
   bestand en komen laadOrders() en bewaar() uit de database.

   Datums staan relatief ten opzichte van vandaag, zodat de stoplichten elke dag kloppen.
   ========================================================================== */

const PERSONEN = [
  { naam: "Sanne Vos", rol: "verkoper" },
  { naam: "Tim de Wit", rol: "verkoper" },
  { naam: "Joost Kramer", rol: "verkoper" },
  { naam: "Lisa Brouwer", rol: "afleverspecialist" },
  { naam: "Henk Postma", rol: "werkplaatschef" },
  { naam: "Erik Schut", rol: "poetser" },
  { naam: "Marieke Hoek", rol: "administratie" },
  { naam: "Ruud Veenstra", rol: "manager" }
];

const OPSLAG = "byd-afleverproces-demo-v2";

function dag(n) { return plusDagen(naarIso(vandaag()), n); }
function moment(n, tijd = "10:00") { return `${dag(n)}T${tijd}`; }

function eigenaarNaam(o, nr) {
  const rol = faseInfo(nr).eigenaar;
  if (rol === "verkoper") return o.verkoper;
  return PERSONEN.find(p => p.rol === rol).naam;
}

/* Wat er in een tekstveld komt als vulFases het invult, zodat het scherm geen "Ingevuld" toont. */
const VOORBEELD = {
  werkorder: o => `WO-55${o.id.slice(-3)}`,
  ott_code: () => "K7R2-94MX",
  aflevertijd: () => "10:00",
  km: () => 11,
  kenteken: o => `ZT-${o.id.slice(-3)}-H`
};

/* Vinkt alle verplichte punten van de genoemde fases af, met een logregel per punt.
   `op` = dag (relatief) waarop die fase werd afgerond. */
function vulFases(o, fases) {
  for (const [nr, op] of fases) {
    const door = eigenaarNaam(o, nr);
    for (const p of puntenVoor(o, nr)) {
      if (!p.verplicht || puntKlaar(o, p)) continue;
      if (["vink", "actie", "upload"].includes(p.soort)) {
        o.vink[p.key] = { door, op: moment(op), ...(p.soort === "upload" ? { bestand: `${p.label}.pdf` } : {}) };
      } else if (p.soort === "janee") zet(o, p.pad, true);
      else if (p.soort === "onderdelen") o.accessoires.forEach(a => { a.besteld = true; a.verwacht ??= dag(op + 3); });
      else if (p.soort === "poets") o.poets = { datum: dag(op), vorm: o.mastercare ? "Mastercare" : "Standaard", gedaan: true };
      else if (p.soort === "datum") zet(o, p.pad, dag(op));
      else zet(o, p.pad, VOORBEELD[p.key] ? VOORBEELD[p.key](o) : p.soort === "getal" ? 10 : "Ingevuld");
      const wat = { upload: `${p.label} geüpload`, vink: `${p.label} afgevinkt`, actie: p.knop }[p.soort] || `${p.label} ingevuld`;
      o.log.push({ op: moment(op), door, wat });
    }
    o.log.push({ op: moment(op, "10:01"), door, wat: `Fase ${nr === "ott" ? "5.1" : nr} afgerond` });
  }
}

const POSTCODES = ["9721 KT", "9746 BG", "9603 AC", "9301 ZL", "9472 PR", "9351 NH", "9761 EM", "9741 JD", "9611 BW", "9751 SX", "9727 GD", "9408 HB"];
const HUISNRS = ["14", "3a", "87", "22", "161", "5", "48", "9", "113", "31", "62", "7"];
const TELEFOONS = ["06 4172 3859", "06 2938 1047", "06 5381 6624", "06 1847 2290", "06 3305 9182", "06 2716 4438",
  "06 4890 1573", "06 1264 8805", "06 5527 3916", "06 3048 7261", "06 2195 6340", "06 4613 0278"];
let volgnr = 0;

function basis(d) {
  const n = volgnr++ % POSTCODES.length;
  const o = {
    id: d.id, ordernummer: d.id.replace("26", "VO-"), type: "nieuw", voorraad: "winkel",
    verkoper: d.verkoper, aangemaakt: moment(d.aangemaakt, "09:15"), levertijd: dag(d.levertijd),
    mastercare: true, ott: false, heeftInruil: false,
    klant: { postcode: POSTCODES[n], huisnr: HUISNRS[n], email: `${(d.klant.naam || "klant").toLowerCase().replace(/[^a-z]/g, "")}@example.com`, tel: TELEFOONS[n], ...d.klant },
    auto: { sleutel: "Verkocht", ...d.auto },
    accessoires: [], vink: {}, contact: [], opmerkingen: [], log: [],
    ...d.extra
  };
  o.log.push({ op: o.aangemaakt, door: o.verkoper, wat: "Order aangemaakt" });
  return o;
}

function maakDemo() {
  const orders = [];
  volgnr = 0;

  /* Fase 1: verkoper is nog bezig, contract en orderbevestiging ontbreken */
  let o = basis({ id: "26000113", verkoper: "Sanne Vos", aangemaakt: -1, levertijd: 20,
    klant: { aanhef: "Dhr.", naam: "Jansen" }, auto: { model: "ATTO 2", chassis: "LGXC74C40S0012345" } });
  o.accessoires = [{ naam: "Rubber vloermatten" }, { naam: "Dashcam voor" }];
  o.contact.push({ op: moment(-1, "15:20"), door: "Sanne Vos", tekst: "Klant gebeld na het tekenen, levertijd doorgegeven." });
  orders.push(o);

  /* Fase 2: bestelling, onderdelen deels besteld */
  o = basis({ id: "26000108", verkoper: "Tim de Wit", aangemaakt: -12, levertijd: 45,
    klant: { aanhef: "Mevr.", naam: "de Boer" }, auto: { model: "SEALION 7", chassis: "" },
    extra: { voorraad: "bestelling", heeftInruil: true, inruil: { kenteken: "GX-482-T", boekwaarde: 8500 } } });
  o.accessoires = [
    { naam: "Trekhaak, inclusief montage", besteld: true, verwacht: dag(20) },
    { naam: "Dakdragers", besteld: true, verwacht: dag(10) },
    { naam: "NFC-kaart" }
  ];
  vulFases(o, [[1, -11]]);
  o.vink.w_gecontroleerd = { door: "Henk Postma", op: moment(-10) };
  orders.push(o);

  /* Fase 2 rood: trekhaak komt te laat voor de afgesproken levertijd */
  o = basis({ id: "26000110", verkoper: "Joost Kramer", aangemaakt: -9, levertijd: 12,
    klant: { aanhef: "Dhr.", naam: "Mulder" }, auto: { model: "DOLPHIN SURF", chassis: "LGXC16C48S0034567" },
    extra: { voorraad: "andere-locatie", mastercare: false } });
  o.accessoires = [{ naam: "Trekhaak, inclusief montage", besteld: true, verwacht: dag(14) }];
  vulFases(o, [[1, -8]]);
  o.vink.w_gecontroleerd = { door: "Henk Postma", op: moment(-7) };
  o.opmerkingen.push({ id: 1, fase: 2, tekst: "Trekhaak pas over twee weken leverbaar bij de importeur.", open: true, auteur: "Henk Postma", op: moment(-6, "14:20") });
  orders.push(o);

  /* Gebruikt: fase 2 en 3 lopen tegelijk */
  o = basis({ id: "26000111", verkoper: "Joost Kramer", aangemaakt: -3, levertijd: 14,
    klant: { aanhef: "Dhr.", naam: "Peters" }, auto: { model: "BYD ATTO 3, 2023", chassis: "LGXCE4CB2P0098765", kenteken: "S-381-KP" },
    extra: { type: "gebruikt", voorraad: null } });
  vulFases(o, [[1, -2]]);
  o.vink.binnen = { door: "Lisa Brouwer", op: moment(-2, "11:00") };
  o.contact.push({ op: moment(-2, "14:05"), door: "Joost Kramer", tekst: "Klant gebeld: auto staat binnen, afleverdatum volgt na de werkplaats." });
  orders.push(o);

  /* Fase 3: auto binnen, kenteken aangevraagd, klaarmaakdatum nog niet gepland */
  o = basis({ id: "26000101", verkoper: "Sanne Vos", aangemaakt: -20, levertijd: 10,
    klant: { aanhef: "Mevr.", naam: "Visser" }, auto: { model: "SEAL U DM-i", phev: true, chassis: "LGXCH6CD5S0045678" },
    extra: { afleverdatum: dag(9), aflevertijd: "14:00" } });
  vulFases(o, [[1, -19], [2, -15]]);
  o.werkorder = "WO-55120";
  Object.assign(o.vink, { binnen: { door: "Lisa Brouwer", op: moment(-2) }, kent_aangevraagd: { door: "Lisa Brouwer", op: moment(-2, "10:30") } });
  o.verzekering = true;
  o.contact.push({ op: moment(-5, "16:10"), door: "Sanne Vos", tekst: "Gebeld: auto is onderweg, klant blij met datum rond de 4e." });
  orders.push(o);

  /* Fase 3 rood: import, kenteken al 6 dagen aangevraagd */
  o = basis({ id: "26000096", verkoper: "Tim de Wit", aangemaakt: -40, levertijd: 8,
    klant: { aanhef: "Dhr.", naam: "Smit" }, auto: { model: "ATTO 3 EVO", chassis: "LGXCE4CB0S0011223" },
    extra: { type: "import", voorraad: null, afleverdatum: dag(8), aflevertijd: "10:00", klaarmaakdatum: dag(5), werkorder: "WO-55098" } });
  vulFases(o, [[1, -39], [2, -30]]);
  Object.assign(o.vink, { binnen: { door: "Lisa Brouwer", op: moment(-8) }, kent_aangevraagd: { door: "Lisa Brouwer", op: moment(-6) } });
  o.verzekering = false;
  o.contact.push({ op: moment(-12, "11:40"), door: "Lisa Brouwer", tekst: "Klant gebeld, uitgelegd dat het kenteken bij import langer duurt." });
  orders.push(o);

  /* Fase 4 met OTT tegelijk */
  o = basis({ id: "26000099", verkoper: "Joost Kramer", aangemaakt: -25, levertijd: 6,
    klant: { aanhef: "Dhr.", naam: "de Groot" }, auto: { model: "SEAL 6 DM-i", phev: true, chassis: "LGXCH4CD1S0067890", kenteken: "ZT-120-H" },
    extra: { ott: true, ott_via: "Leasemaatschappij van de klant", afleverdatum: dag(6), aflevertijd: "10:00", klaarmaakdatum: dag(3), werkorder: "WO-55107" } });
  vulFases(o, [[1, -24], [2, -20], [3, -4]]);
  o.contact.push({ op: moment(-4, "09:50"), door: "Lisa Brouwer", tekst: "Afspraak bevestigd, klant komt met partner." });
  orders.push(o);

  /* Fase 4 rood: morgen aflevering, werkplaats nog niet klaar */
  o = basis({ id: "26000094", verkoper: "Sanne Vos", aangemaakt: -30, levertijd: 1,
    klant: { aanhef: "Mevr.", naam: "Bos" }, auto: { model: "DOLPHIN G", phev: true, chassis: "LGXCG2CB7S0023456", kenteken: "ZT-118-H" },
    extra: { afleverdatum: dag(1), aflevertijd: "15:30", klaarmaakdatum: dag(-1), werkorder: "WO-55101", opm_verkoop: "Klant is jarig op de dag van aflevering." } });
  vulFases(o, [[1, -29], [2, -22], [3, -6]]);
  o.vink.wp_klaar = { door: "Henk Postma", op: moment(-1, "16:00") };
  o.opmerkingen.push({ id: 2, fase: 4, tekst: "Laadkabel type 2 nog niet binnen, komt morgenochtend.", open: true, auteur: "Henk Postma", op: moment(-1, "16:05") });
  o.contact.push({ op: moment(-3, "13:15"), door: "Lisa Brouwer", tekst: "Bevestigd: aflevering morgen 15.30 uur." });
  orders.push(o);

  /* Fase 5: poetser nog niet ingepland */
  o = basis({ id: "26000092", verkoper: "Tim de Wit", aangemaakt: -35, levertijd: 3,
    klant: { aanhef: "Dhr.", naam: "Hendriks" }, auto: { model: "SEALION 7", chassis: "LGXCS7CD3S0078901", kenteken: "ZT-109-H", sleutel: "Verkocht WP-klaar" },
    extra: { ott: true, ott_via: "Financiering via de dealer", ott_code: "K7R2-94MX", afleverdatum: dag(3), aflevertijd: "11:00", klaarmaakdatum: dag(-1), werkorder: "WO-55093" } });
  vulFases(o, [[1, -34], [2, -28], [3, -9], [4, -1], ["ott", -2]]);
  o.vink.w_gelezen = { door: "Lisa Brouwer", op: moment(0, "08:45") };
  o.contact.push({ op: moment(-9, "15:00"), door: "Lisa Brouwer", tekst: "Afleverdatum afgestemd." });
  o.contact.push({ op: moment(-1, "11:30"), door: "Lisa Brouwer", tekst: "Klant gebeld, afleverafspraak bevestigd." });
  orders.push(o);

  /* Fase 5: morgen aflevering, poetsen vandaag, betaling nog checken */
  o = basis({ id: "26000090", verkoper: "Joost Kramer", aangemaakt: -28, levertijd: 1,
    klant: { aanhef: "Mevr.", naam: "Dekker" }, auto: { model: "ATTO 2 DM-i", phev: true, chassis: "LGXCA2CD9S0089012", kenteken: "ZT-104-H", km: 12, sleutel: "Farman" },
    extra: { afleverdatum: dag(1), aflevertijd: "09:30", klaarmaakdatum: dag(-2), werkorder: "WO-55090" } });
  vulFases(o, [[1, -27], [2, -21], [3, -8], [4, -2]]);
  Object.assign(o.vink, { w_gelezen: { door: "Lisa Brouwer", op: moment(-1) }, showroom: { door: "Lisa Brouwer", op: moment(0, "08:30") } });
  o.poets = { datum: dag(0), vorm: "Mastercare", gedaan: false };
  o.contact.push({ op: moment(-6, "10:20"), door: "Lisa Brouwer", tekst: "Klant gebeld, morgen 9.30 uur bevestigd." });
  orders.push(o);

  /* Afgeleverd, NPS volgt */
  o = basis({ id: "26000081", verkoper: "Sanne Vos", aangemaakt: -45, levertijd: -10,
    klant: { aanhef: "Dhr.", naam: "van Dijk" }, auto: { model: "SEAL U", chassis: "LGXCH6CD1R0056789", kenteken: "ZS-990-G", km: 14, sleutel: "Klant" },
    extra: { afleverdatum: dag(-10), aflevertijd: "13:00", klaarmaakdatum: dag(-13), werkorder: "WO-55071" } });
  vulFases(o, [[1, -44], [2, -38], [3, -20], [4, -13], [5, -10]]);
  orders.push(o);

  /* Afgeleverd, NPS binnen, klantgegevens worden over 1 dag gewist */
  o = basis({ id: "26000074", verkoper: "Tim de Wit", aangemaakt: -60, levertijd: -29,
    klant: { aanhef: "Mevr.", naam: "Kok" }, auto: { model: "DOLPHIN SURF", chassis: "LGXC16C41R0023412", kenteken: "ZS-912-G", km: 9, sleutel: "Klant" },
    extra: { afleverdatum: dag(-29), aflevertijd: "16:00", klaarmaakdatum: dag(-32), werkorder: "WO-55052", nps: 9, review: 5 } });
  vulFases(o, [[1, -59], [2, -50], [3, -38], [4, -32], [5, -29]]);
  orders.push(o);

  return orders;
}

function laadOrders() {
  try { const r = localStorage.getItem(OPSLAG); if (r) return JSON.parse(r); } catch (e) { /* geen opslag, dan voorbeelddata */ }
  const orders = maakDemo(); bewaar(orders); return orders;
}
function bewaar(orders) { try { localStorage.setItem(OPSLAG, JSON.stringify(orders)); } catch (e) { /* prototype werkt ook zonder */ } }
function herstelDemo() { try { localStorage.removeItem(OPSLAG); } catch (e) { } location.reload(); }
