/* Werkplaats: weekagenda van maandag tot en met vrijdag. Elke auto staat op de dag waarop
   hij klaar moet zijn (2 werkdagen voor de aflevering), niet op de afleverdatum. Daaronder
   twee takenlijsten: onderdelen bestellen en auto's inplannen. */

const ik = kopbalk("werkplaats");
const orders = laadOrders();
const venster = document.getElementById("venster");
let weekVerschil = 0;
let openId = null;

const WP_STATUS_TEKST = { rood: "Nog niet ingepland", oranje: "Ingepland", groen: "WP-klaar" };
const KORT = { w_gecontroleerd: "accessoires invoeren", onderdelen: "bestellen", werkorder: "werkordernummer" };
const lopendeOrders = () => orders.filter(o => huidigeFase(o) !== "klaar");

function maandag(verschil) {
  const d = vandaag();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + verschil * 7);
  return naarIso(d);
}
function weeknummer(iso) {
  const d = naarDatum(iso); d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const jan4 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - jan4) / 864e5 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
}

function wpBlok(o, dagIso) {
  const st = werkplaatsStatus(o);
  const telaat = wpDeadline(o) < dagIso;
  return `<button type="button" class="wp-blok ${st}" data-open="${o.id}">
    <span class="wb1"><span class="stip st-${st}"></span>${esc(klantNaam(o))}</span>
    <span class="wb2">${esc(autoNaam(o))}</span>
    <span class="wb3">${esc(o.auto.kenteken || "Geen kenteken")} · meldcode ${esc(meldcode(o))}</span>
    <span class="wb4">${o.vink.wp_klaar && st !== "groen" ? `WP-klaar, nog open: ${openPunten(o, 4).map(p => p.label.toLowerCase()).join(", ")}` : WP_STATUS_TEKST[st]}${telaat ? `, moest ${datumKort(wpDeadline(o))} klaar` : ""}</span>
  </button>`;
}

function tekenWeek() {
  const ma = maandag(weekVerschil);
  const dagen = [0, 1, 2, 3, 4].map(n => plusDagen(ma, n));
  const vandaagIso = naarIso(vandaag());
  document.getElementById("weektitel").textContent = `Week ${weeknummer(ma)} · ${datumKort(dagen[0])} tot en met ${datumKort(dagen[4])}. Elke auto staat op de dag dat hij klaar moet zijn.`;

  const metDeadline = lopendeOrders().filter(o => wpDeadline(o));
  document.getElementById("week").innerHTML = dagen.map(d => {
    /* wat te laat is en nog niet klaar, schuift mee naar vandaag */
    const hier = metDeadline.filter(o => wpDeadline(o) === d || (d === vandaagIso && wpDeadline(o) < d && werkplaatsStatus(o) !== "groen"))
      .sort((a, b) => ["rood", "oranje", "groen"].indexOf(werkplaatsStatus(a)) - ["rood", "oranje", "groen"].indexOf(werkplaatsStatus(b)));
    return `<section class="week-dag ${d === vandaagIso ? "vandaag" : ""}">
      <h2>${datumKort(d)}${d === vandaagIso ? " · vandaag" : ""}</h2>
      ${hier.map(o => wpBlok(o, d)).join("") || `<p class="dag-leeg">Niets klaar te maken</p>`}
    </section>`;
  }).join("");
}

function tekenTaken() {
  const bestellen = lopendeOrders().filter(o => ["oranje", "rood"].includes(faseStatus(o, 2)))
    .sort((a, b) => (wpDeadline(a) || a.levertijd || "9").localeCompare(wpDeadline(b) || b.levertijd || "9"));
  const inplannen = lopendeOrders().filter(o => o.vink.binnen && !o.vink.wp_ingepland)
    .sort((a, b) => (wpDeadline(a) || "9").localeCompare(wpDeadline(b) || "9"));

  const uiterst = o => wpDeadline(o) ? `Klaar ${relatief(wpDeadline(o))}` : o.levertijd ? `Levertijd ${relatief(o.levertijd)}` : "";
  document.getElementById("wp_taken").innerHTML = `
    <section class="taken-groep"><h2>Onderdelen bestellen <span class="n">${bestellen.length}</span></h2>
      ${bestellen.length ? `<div class="rijen">${bestellen.map(o => `<a class="taak" href="order.html?id=${o.id}#fase-2">
        <span class="stip st-${faseStatus(o, 2)}"></span>
        <div><div class="wie">${esc(klantNaam(o))}</div><div class="sub">${esc(autoNaam(o))}${o.vink.binnen ? " · binnen" : " · nog niet binnen"}</div></div>
        <div class="wat"><div class="kop">${eersteKlein(openPunten(o, 2).map(p => KORT[p.key] || p.label).join(", ")).replace(/^./, c => c.toUpperCase()) || "Fase 2 afronden"}</div><div class="sub">${o.accessoires.length} ${o.accessoires.length === 1 ? "onderdeel" : "onderdelen"} in de order</div></div>
        <div class="wanneer">${uiterst(o)}</div></a>`).join("")}</div>`
      : `<div class="leeg-staat klein"><h2>Alles besteld</h2><p>Nieuwe orders verschijnen hier zodra de verkoop fase 1 afrondt.</p></div>`}
    </section>
    <section class="taken-groep"><h2>Inplannen <span class="n">${inplannen.length}</span></h2>
      ${inplannen.length ? `<div class="rijen">${inplannen.map(o => `<div class="taak met-knop">
        <span class="stip st-rood"></span>
        <div><a class="wie" href="order.html?id=${o.id}#fase-4">${esc(klantNaam(o))}</a><div class="sub">${esc(autoNaam(o))} · ${esc(o.auto.kenteken || "meldcode " + meldcode(o))}</div></div>
        <div class="wanneer">${uiterst(o) || "Nog geen afleverdatum"}</div>
        <button type="button" class="knop" data-ingepland="${o.id}">${icoon("vink", 14)}Ingepland</button></div>`).join("")}</div>`
      : `<div class="leeg-staat klein"><h2>Alles ingepland</h2><p>Auto's verschijnen hier zodra ze binnen zijn.</p></div>`}
    </section>`;
}

/* ---------- venster met de checklist van één auto ---------- */

function vensterHtml(o) {
  const v = o.vink;
  const regel = (key, label, mag = true, uitleg = "") => {
    const klaar = !!v[key];
    return `<div class="punt ${klaar ? "klaar" : ""}"><span class="bol">${klaar ? icoon("vink", 12) : ""}</span>
      <div><span class="lbl">${label}</span><div class="meta">${klaar ? `${esc(v[key].door)}, ${tijdstip(v[key].op)}` : esc(uitleg)}</div></div>
      <div class="ctl">${klaar ? `<button type="button" class="knop" data-terug="${key}">Terugzetten</button>`
        : `<button type="button" class="knop donker ${mag ? "" : "uit"}" data-vink="${key}" ${mag ? "" : 'aria-disabled="true"'}>Afvinken</button>`}</div></div>`;
  };
  const open = o.opmerkingen.filter(m => m.open);
  return `<form method="dialog" class="venster-kop">
      <div><h2 id="venster_titel">${esc(klantNaam(o))}</h2><p>${esc(autoNaam(o))} · ${esc(o.auto.kenteken || "geen kenteken")} · meldcode ${esc(meldcode(o))}${o.werkorder ? " · " + esc(o.werkorder) : ""}</p></div>
      <button class="knop" aria-label="Sluiten">Sluiten</button></form>
    <div class="melding ${werkplaatsStatus(o)}">Klaar uiterlijk ${datumKort(wpDeadline(o))}. ${WP_STATUS_TEKST[werkplaatsStatus(o)]}.</div>
    <div class="venster-lijst">
      ${regel("wp_ingepland", "Ingepland in de werkplaats")}
      ${regel("wp_klaar", "Auto werkplaatsklaar", !!v.wp_ingepland, v.wp_ingepland ? "Zet WP-klaar ook in de Outlook-agenda" : "Eerst inplannen")}
      ${o.auto.phev ? regel("getankt", "Getankt", true, "Plug-in hybride") : ""}
    </div>
    <h3>Onderdelen</h3>
    ${o.accessoires.length ? `<ul class="od-ul">${o.accessoires.map(a => `<li><span class="stip st-${a.binnen ? "groen" : a.besteld ? "oranje" : "rood"}"></span>${esc(a.naam)}: ${a.binnen ? "binnen" : a.besteld ? `besteld${a.verwacht ? ", verwacht " + datumKort(a.verwacht) : ""}` : "niet besteld"}</li>`).join("")}</ul>` : `<p class="zij-leeg">Geen onderdelen in de order.</p>`}
    ${open.length ? `<h3>Open punten</h3><ul class="od-ul">${open.map(m => `<li>${esc(m.tekst)}</li>`).join("")}</ul>` : ""}
    <div class="venster-voet"><a class="knop" href="order.html?id=${o.id}#fase-4">Hele order openen</a></div>`;
}

function openVenster(id) {
  openId = id;
  venster.innerHTML = vensterHtml(orders.find(o => o.id === id));
  if (!venster.open) venster.showModal();
}

const WP_LABEL = { wp_ingepland: "Ingepland in de werkplaats", wp_klaar: "Auto werkplaatsklaar", getankt: "Getankt" };

function zetVink(o, key, aan) {
  if (aan) o.vink[key] = { door: ik.naam, op: nu() };
  else delete o.vink[key];
  o.log.push({ op: nu(), door: ik.naam, wat: `${WP_LABEL[key]} ${aan ? "afgevinkt" : "teruggezet"}`, ...(aan ? {} : { terug: true }) });
  if (aan && faseStatus(o, 4) === "groen") o.log.push({ op: nu(), door: ik.naam, wat: "Fase 4 afgerond" });
  bewaar(orders);
  if (aan && key === "wp_klaar") toast("WP-klaar. De afspraak in de Outlook-agenda van bydgroningen@ gaat straks vanzelf naar WP-klaar.", "groen");
  else if (aan && key === "wp_ingepland") toast(`${klantNaam(o)} staat ingepland. Terugzetten kan via Behandeld.`);
  tekenWeek(); tekenTaken();
}

venster.addEventListener("click", e => {
  if (e.target === venster) { venster.close(); return; }
  const b = e.target.closest("button"); if (!b) return;
  const o = orders.find(x => x.id === openId);
  if (b.dataset.vink && b.getAttribute("aria-disabled") !== "true") { zetVink(o, b.dataset.vink, true); openVenster(o.id); }
  if (b.dataset.terug) { zetVink(o, b.dataset.terug, false); openVenster(o.id); }
});

document.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b || venster.contains(b)) return;
  if (b.dataset.open) openVenster(b.dataset.open);
  if (b.dataset.ingepland) zetVink(orders.find(o => o.id === b.dataset.ingepland), "wp_ingepland", true);
  if (b.dataset.week) { weekVerschil = b.dataset.week === "0" ? 0 : weekVerschil + Number(b.dataset.week); tekenWeek(); }
});

tekenWeek();
tekenTaken();
