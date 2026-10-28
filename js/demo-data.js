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

const OPSLAG = "byd-afleverproces-demo-v3";
const OPSLAG_IMPORT = "byd-afleverproces-import-v1";
const OPSLAG_PREMIE = "byd-afleverproces-premie-v1";

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
      if (!p.verplicht || puntKlaar(o, p) || p.soort === "import") continue;
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

  /* ---------- rij 1: onderweg ---------- */

  /* Fase 1: verkoper is nog bezig, bestelling, 3 weken voor levering dus oranje */
  let o = basis({ id: "26000113", verkoper: "Sanne Vos", aangemaakt: -1, levertijd: 20,
    klant: { aanhef: "Dhr.", naam: "Jansen" }, auto: { model: "ATTO 2", chassis: "" }, extra: { voorraad: "bestelling" } });
  o.contact.push({ op: moment(-1, "15:20"), door: "Sanne Vos", tekst: "Klant gebeld na het tekenen, levertijd doorgegeven." });
  orders.push(o);

  /* Bestelling, ver weg, onderdelen deels besteld: grijs */
  o = basis({ id: "26000108", verkoper: "Tim de Wit", aangemaakt: -12, levertijd: 45,
    klant: { aanhef: "Mevr.", naam: "de Boer" }, auto: { model: "SEALION 7", chassis: "" },
    extra: { voorraad: "bestelling", heeftInruil: true, inruil: { kenteken: "GX-482-T", boekwaarde: 8500 } } });
  vulFases(o, [[1, -11]]);
  o.accessoires = [
    { naam: "Trekhaak, inclusief montage", besteld: true, verwacht: dag(20) },
    { naam: "Dakdragers", besteld: true, verwacht: dag(10) },
    { naam: "NFC-kaart" }
  ];
  orders.push(o);

  /* Andere vestiging, levertijd binnen 3 weken: oranje. Trekhaak komt te laat. */
  o = basis({ id: "26000110", verkoper: "Joost Kramer", aangemaakt: -9, levertijd: 12,
    klant: { aanhef: "Dhr.", naam: "Mulder" }, auto: { model: "DOLPHIN SURF", chassis: "LGXC16C48S0034567" },
    extra: { voorraad: "andere-locatie", mastercare: false } });
  vulFases(o, [[1, -8]]);
  o.accessoires = [{ naam: "Trekhaak, inclusief montage", besteld: true, verwacht: dag(14) }];
  o.vink.w_gecontroleerd = { door: "Henk Postma", op: moment(-7) };
  o.opmerkingen.push({ id: 1, fase: 2, tekst: "Trekhaak pas over twee weken leverbaar bij de importeur.", open: true, auteur: "Henk Postma", op: moment(-6, "14:20") });
  orders.push(o);

  /* Bestelling, 5 dagen over de verwachte leverdatum: rood */
  o = basis({ id: "26000104", verkoper: "Sanne Vos", aangemaakt: -48, levertijd: -5,
    klant: { aanhef: "Mevr.", naam: "Meijer" }, auto: { model: "SEAL U DM-i", phev: true, chassis: "LGXCH6CD2S0061290" },
    extra: { voorraad: "bestelling" } });
  vulFases(o, [[1, -47], [2, -40]]);
  o.contact.push({ op: moment(-24, "11:10"), door: "Sanne Vos", tekst: "Helft van de levertijd: klant bijgepraat, datum blijft staan.", momenten: ["helft"] });
  o.contact.push({ op: moment(-20, "16:45"), door: "Lisa Brouwer", tekst: "3 weken voor levering gebeld, datum bevestigd.", momenten: ["drieweken"] });
  orders.push(o);

  /* Import, verkocht, nog niet binnen */
  o = basis({ id: "26000112", verkoper: "Tim de Wit", aangemaakt: -6, levertijd: 36,
    klant: { aanhef: "Dhr.", naam: "Wolters" }, auto: { model: "SEALION 7", chassis: "LGXCS7CD6S0099881" },
    extra: { type: "import", voorraad: null } });
  vulFases(o, [[1, -5]]);
  orders.push(o);

  /* ---------- rij 2: binnen, in het afleverproces ---------- */

  /* Gebruikt: binnen met kenteken, werkplaats moet nog onderdelen bekijken */
  o = basis({ id: "26000111", verkoper: "Joost Kramer", aangemaakt: -3, levertijd: 14,
    klant: { aanhef: "Dhr.", naam: "Peters" }, auto: { model: "BYD ATTO 3, 2023", chassis: "LGXCE4CB2P0098765", kenteken: "S-381-KP" },
    extra: { type: "gebruikt", voorraad: null } });
  vulFases(o, [[1, -2]]);
  o.vink.binnen = { door: "Lisa Brouwer", op: moment(-2, "11:00") };
  o.contact.push({ op: moment(-2, "14:05"), door: "Joost Kramer", tekst: "Klant gebeld: auto staat binnen, afleverdatum volgt na de werkplaats." });
  orders.push(o);

  /* Nieuw van de winkel: binnen gemeld in hetzelfde scherm als fase 1 */
  o = basis({ id: "26000114", verkoper: "Joost Kramer", aangemaakt: -2, levertijd: 12,
    klant: { aanhef: "Fam.", naam: "Kuipers" }, auto: { model: "DOLPHIN G", phev: true, chassis: "LGXCG2CB1S0040217" } });
  vulFases(o, [[1, -2]]);
  orders.push(o);

  /* Auto binnen, kenteken aangevraagd, nog niet ingepland in de werkplaats */
  o = basis({ id: "26000101", verkoper: "Sanne Vos", aangemaakt: -20, levertijd: 10,
    klant: { aanhef: "Mevr.", naam: "Visser" }, auto: { model: "SEAL U DM-i", phev: true, chassis: "LGXCH6CD5S0045678" },
    extra: { voorraad: "bestelling", afleverdatum: dag(9), aflevertijd: "14:00" } });
  vulFases(o, [[1, -19], [2, -15]]);
  o.werkorder = "WO-55120";
  Object.assign(o.vink, { binnen: { door: "Lisa Brouwer", op: moment(-2) }, kent_aangevraagd: { door: "Lisa Brouwer", op: moment(-2, "10:30") } });
  o.verzekering = true;
  o.contact.push({ op: moment(-5, "16:10"), door: "Sanne Vos", tekst: "Gebeld: auto is onderweg, klant blij met datum rond de 4e.", momenten: ["helft", "drieweken"] });
  orders.push(o);

  /* Werkplaats ingepland, OTT loopt tegelijk */
  o = basis({ id: "26000099", verkoper: "Joost Kramer", aangemaakt: -25, levertijd: 6,
    klant: { aanhef: "Dhr.", naam: "de Groot" }, auto: { model: "SEAL 6 DM-i", phev: true, chassis: "LGXCH4CD1S0067890", kenteken: "ZT-120-H" },
    extra: { voorraad: "andere-locatie", ott: true, ott_via: "Leasemaatschappij van de klant", afleverdatum: dag(6), aflevertijd: "10:00", werkorder: "WO-55107" } });
  o.accessoires = [{ naam: "Laadkabel mode 3", besteld: true, verwacht: dag(2) }];
  vulFases(o, [[1, -24], [2, -20], [3, -4]]);
  o.accessoires[0].binnen = false;
  o.vink.wp_ingepland = { door: "Henk Postma", op: moment(-3) };
  o.contact.push({ op: moment(-4, "09:50"), door: "Lisa Brouwer", tekst: "Afspraak bevestigd, klant komt met partner.", momenten: ["helft", "drieweken"] });
  orders.push(o);

  /* Morgen aflevering, werkplaats nog niet helemaal klaar: rood */
  o = basis({ id: "26000094", verkoper: "Sanne Vos", aangemaakt: -30, levertijd: 1,
    klant: { aanhef: "Mevr.", naam: "Bos" }, auto: { model: "DOLPHIN G", phev: true, chassis: "LGXCG2CB7S0023456", kenteken: "ZT-118-H" },
    extra: { afleverdatum: dag(1), aflevertijd: "15:30", werkorder: "WO-55101", opm_verkoop: "Klant is jarig op de dag van aflevering." } });
  vulFases(o, [[1, -29], [2, -22], [3, -6]]);
  o.vink.wp_ingepland = { door: "Henk Postma", op: moment(-5) };
  o.vink.wp_klaar = { door: "Henk Postma", op: moment(-1, "16:00") };
  o.opmerkingen.push({ id: 2, fase: 4, tekst: "Laadkabel type 2 nog niet binnen, komt morgenochtend.", open: true, auteur: "Henk Postma", op: moment(-1, "16:05") });
  o.contact.push({ op: moment(-3, "13:15"), door: "Lisa Brouwer", tekst: "Bevestigd: aflevering morgen 15.30 uur.", momenten: ["helft", "drieweken"] });
  orders.push(o);

  /* WP-klaar, nu volladen */
  o = basis({ id: "26000092", verkoper: "Tim de Wit", aangemaakt: -35, levertijd: 3,
    klant: { aanhef: "Dhr.", naam: "Hendriks" }, auto: { model: "SEALION 7", chassis: "LGXCS7CD3S0078901", kenteken: "ZT-109-H", sleutel: "Verkocht WP-klaar" },
    extra: { ott: true, ott_via: "Financiering via de dealer", ott_code: "K7R2-94MX", afleverdatum: dag(3), aflevertijd: "11:00", werkorder: "WO-55093" } });
  vulFases(o, [[1, -34], [2, -28], [3, -9], [4, -1], ["ott", -2]]);
  o.vink.w_gelezen = { door: "Lisa Brouwer", op: moment(0, "08:45") };
  o.contact.push({ op: moment(-9, "15:00"), door: "Lisa Brouwer", tekst: "Afleverdatum afgestemd.", momenten: ["helft", "drieweken"] });
  orders.push(o);

  /* Morgen aflevering, volgeladen, poetsen vandaag */
  o = basis({ id: "26000090", verkoper: "Joost Kramer", aangemaakt: -28, levertijd: 1,
    klant: { aanhef: "Mevr.", naam: "Dekker" }, auto: { model: "ATTO 2 DM-i", phev: true, chassis: "LGXCA2CD9S0089012", kenteken: "ZT-104-H", km: 12, sleutel: "Farman" },
    extra: { afleverdatum: dag(1), aflevertijd: "09:30", werkorder: "WO-55090" } });
  vulFases(o, [[1, -27], [2, -21], [3, -8], [4, -2]]);
  Object.assign(o.vink, { w_gelezen: { door: "Lisa Brouwer", op: moment(-1) }, volgeladen: { door: "Lisa Brouwer", op: moment(-1, "16:30") } });
  o.poets = { datum: dag(0), vorm: "Mastercare", gedaan: false };
  o.contact.push({ op: moment(-6, "10:20"), door: "Lisa Brouwer", tekst: "Klant gebeld, morgen 9.30 uur bevestigd.", momenten: ["helft", "drieweken"] });
  orders.push(o);

  /* ---------- rij 3: import, binnen, nog geen kenteken ---------- */

  o = basis({ id: "26000096", verkoper: "Tim de Wit", aangemaakt: -40, levertijd: 8,
    klant: { aanhef: "Dhr.", naam: "Smit" }, auto: { model: "ATTO 3 EVO", chassis: "LGXCE4CB0S0011223" },
    extra: { type: "import", voorraad: null, afleverdatum: dag(8), aflevertijd: "10:00", werkorder: "WO-55098" } });
  vulFases(o, [[1, -39], [2, -30]]);
  o.vink.binnen = { door: "Lisa Brouwer", op: moment(-8) };
  o.vink.wp_ingepland = { door: "Henk Postma", op: moment(-6) };
  o.verzekering = false;
  o.contact.push({ op: moment(-12, "11:40"), door: "Lisa Brouwer", tekst: "Klant gebeld, uitgelegd dat het kenteken bij import langer duurt.", momenten: ["helft"] });
  orders.push(o);

  o = basis({ id: "26000107", verkoper: "Sanne Vos", aangemaakt: -14, levertijd: 25,
    klant: { aanhef: "Mevr.", naam: "Bakker" }, auto: { model: "SEAL U DM-i", phev: true, chassis: "LGXCH6CD8S0071234" },
    extra: { type: "import", voorraad: null } });
  vulFases(o, [[1, -13]]);
  o.vink.binnen = { door: "Lisa Brouwer", op: moment(-3) };
  orders.push(o);

  /* ---------- afgeleverd ---------- */

  o = basis({ id: "26000081", verkoper: "Sanne Vos", aangemaakt: -45, levertijd: -10,
    klant: { aanhef: "Dhr.", naam: "van Dijk" }, auto: { model: "SEAL U", chassis: "LGXCH6CD1R0056789", kenteken: "ZS-990-G", km: 14, sleutel: "Klant" },
    extra: { afleverdatum: dag(-10), aflevertijd: "13:00", werkorder: "WO-55071" } });
  vulFases(o, [[1, -44], [2, -38], [3, -20], [4, -13], [5, -10]]);
  orders.push(o);

  o = basis({ id: "26000074", verkoper: "Tim de Wit", aangemaakt: -60, levertijd: -29,
    klant: { aanhef: "Mevr.", naam: "Kok" }, auto: { model: "DOLPHIN SURF", chassis: "LGXC16C41R0023412", kenteken: "ZS-912-G", km: 9, sleutel: "Klant" },
    extra: { afleverdatum: dag(-29), aflevertijd: "16:00", werkorder: "WO-55052", nps: 9, review: 5 } });
  vulFases(o, [[1, -59], [2, -50], [3, -38], [4, -32], [5, -29]]);
  orders.push(o);

  orders.push(...historie());
  return orders;
}

/* Afleveringen van de afgelopen maanden, zodat het dashboard per maand en kwartaal iets te
   tellen heeft. Ouder dan 30 dagen, dus de klantgegevens zijn al gewist. Vaste "willekeur",
   zodat de cijfers bij elke herstart hetzelfde zijn. */
function historie() {
  let zaad = 7;
  const kans = () => (zaad = (zaad * 9301 + 49297) % 233280) / 233280;
  const uit = l => l[Math.floor(kans() * l.length)];
  const verkopers = PERSONEN.filter(p => p.rol === "verkoper").map(p => p.naam);
  const lijst = [];
  for (let i = 0; i < 46; i++) {
    const af = -(31 + Math.floor(kans() * 190));
    const f5 = af, f4 = af - 2 - Math.floor(kans() * 3), f3 = f4 - 4 - Math.floor(kans() * 6);
    const f2 = f3 - 3 - Math.floor(kans() * 12), f1 = f2 - 1 - Math.floor(kans() * 6);
    const type = kans() < .8 ? "nieuw" : uit(["gebruikt", "import"]);
    const o = basis({ id: `2500${String(200 + i)}`, verkoper: uit(verkopers), aangemaakt: f1 - 1, levertijd: af,
      klant: { aanhef: "Dhr.", naam: "Historie" }, auto: { model: uit(MODELLEN), chassis: `LGXHIST${String(i).padStart(10, "0")}`, kenteken: `ZR-${100 + i}-B`, sleutel: "Klant" },
      extra: { type, voorraad: type === "nieuw" ? "winkel" : null, afleverdatum: dag(af), aflevertijd: "11:00", werkorder: `WO-54${100 + i}` } });
    vulFases(o, [[1, f1], [2, f2], [3, f3], [4, f4], [5, f5]]);
    Object.assign(o, { klant: {}, gewist: true, contact: [], opmerkingen: [] });
    lijst.push(o);
  }
  return lijst;
}

/* De importlijst: elke auto die geïmporteerd wordt, verkocht of niet. Een verkochte auto
   hoort bij een order met hetzelfde chassisnummer. */
function maakImports() {
  const st = (...dagen) => Object.fromEntries(dagen.map((d, i) => [i, { door: "Lisa Brouwer", op: moment(d) }]));
  return [
    { chassis: "LGXCE4CB0S0011223", merk: "BYD", model: "ATTO 3 EVO", uitvoering: "Design", kleur_ext: "Surf Blue", kleur_int: "Zwart", bouwjaar: 2025, km: 120,
      toegevoegd: { door: "Tim de Wit", op: moment(-41) }, stappen: st(-8, -8, -5, -2) },
    { chassis: "LGXCH6CD8S0071234", merk: "BYD", model: "SEAL U DM-i", uitvoering: "Design", kleur_ext: "Arctic White", kleur_int: "Grijs", bouwjaar: 2025, km: 85,
      toegevoegd: { door: "Sanne Vos", op: moment(-15) }, stappen: st(-3, -3) },
    { chassis: "LGXCS7CD6S0099881", merk: "BYD", model: "SEALION 7", uitvoering: "Excellence AWD", kleur_ext: "Atlantis Grey", kleur_int: "Bruin", bouwjaar: 2025, km: 40,
      toegevoegd: { door: "Tim de Wit", op: moment(-7) }, stappen: {} },
    { chassis: "5YJ3E7EB4NF208114", merk: "Tesla", model: "Model 3", uitvoering: "Long Range AWD", kleur_ext: "Pearl White", kleur_int: "Zwart", bouwjaar: 2022, km: 48210,
      toegevoegd: { door: "Joost Kramer", op: moment(-30) }, stappen: st(-21, -21, -16, -12, -9, -4) },
    { chassis: "LGXC76C43R0015530", merk: "BYD", model: "DOLPHIN", uitvoering: "Comfort", kleur_ext: "Coral Pink", kleur_int: "Grijs", bouwjaar: 2024, km: 6300,
      toegevoegd: { door: "Sanne Vos", op: moment(-2) }, stappen: {} },
    { chassis: "WVGZZZE2ZPP031877", merk: "Volkswagen", model: "ID.4", uitvoering: "Pro 77 kWh", kleur_ext: "Moonstone Grey", kleur_int: "Zwart", bouwjaar: 2023, km: 31540,
      toegevoegd: { door: "Joost Kramer", op: moment(-44) }, stappen: st(-36, -36, -30, -25, -22, -17, -12), kenteken: "ZV-317-K" }
  ];
}

/* Inruilpremies per model. De manager houdt deze lijst bij. Voorbeeldbedragen, niet de echte premies. */
function maakPremies() {
  return [
    { model: "DOLPHIN SURF", bedrag: 1000, tot: dag(33) },
    { model: "ATTO 2", bedrag: 1500, tot: dag(33) },
    { model: "SEAL U DM-i", bedrag: 2000, tot: dag(33) },
    { model: "SEALION 7", bedrag: 2500, tot: dag(33) }
  ];
}

function lees_(sleutel, maak) {
  try { const r = localStorage.getItem(sleutel); if (r) return JSON.parse(r); } catch (e) { /* geen opslag, dan voorbeelddata */ }
  const d = maak(); schrijf_(sleutel, d); return d;
}
function schrijf_(sleutel, d) { try { localStorage.setItem(sleutel, JSON.stringify(d)); } catch (e) { /* prototype werkt ook zonder */ } }

/* Orders en importlijst worden bij elk laden op chassisnummer gelijkgetrokken. */
function laadOrders() {
  const orders = lees_(OPSLAG, maakDemo);
  const imports = laadImports();
  if (koppelImports(orders, imports)) { bewaar(orders); bewaarImports(imports); }
  return orders;
}
function bewaar(orders) { schrijf_(OPSLAG, orders); }
function laadImports() { return lees_(OPSLAG_IMPORT, maakImports); }
function bewaarImports(imports) { schrijf_(OPSLAG_IMPORT, imports); }
function laadPremies() { return lees_(OPSLAG_PREMIE, maakPremies); }
function bewaarPremies(p) { schrijf_(OPSLAG_PREMIE, p); }
function premieVoor(model) { return laadPremies().find(p => p.model === model && (!p.tot || dagenTot(p.tot) >= 0)); }
function herstelDemo() { try { [OPSLAG, OPSLAG_IMPORT, OPSLAG_PREMIE].forEach(k => localStorage.removeItem(k)); } catch (e) { } location.reload(); }
