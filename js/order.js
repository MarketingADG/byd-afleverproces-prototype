/* Orderdetail: één auto, één fase tegelijk. Kies de fase in de stappenbalk; elke fase is
   één checklist met dezelfde regel per punt. Rechts staan open punten, klantcontact en logboek.
   Een afgeronde fase blijft te herstellen door wie hem mag invullen; elke wijziging komt in
   het logboek. */

const ik = kopbalk("");
const orders = laadOrders();
const params = new URLSearchParams(location.search);
const hoofd = document.getElementById("order");


/* ---------- nieuwe order ---------- */
if (params.get("nieuw")) {
  const nummer = String(Math.max(...orders.map(o => Number(o.id))) + 1);
  const verkoper = ik.rol === "verkoper" ? ik.naam : PERSONEN.find(p => p.rol === "verkoper").naam;
  orders.push({
    id: nummer, ordernummer: "", type: "nieuw", voorraad: "winkel", verkoper, aangemaakt: nu(),
    klant: {}, auto: { sleutel: "Verkocht" }, accessoires: [], vink: {}, contact: [], opmerkingen: [],
    log: [{ op: nu(), door: ik.naam, wat: "Order aangemaakt" }]
  });
  bewaar(orders);
  history.replaceState(null, "", `order.html?id=${nummer}`);
}

const o = orders.find(x => x.id === (params.get("id") || orders[orders.length - 1].id));
if (!o) hoofd.innerHTML = `<p>Deze order bestaat niet (meer). <a href="${startpagina(ik.rol)}">Terug</a></p>`;

function nrUit(s) { return s === "ott" ? "ott" : Number(s); }
const lopend = s => s === "oranje" || s === "rood";

/* Welke fase staat open: uit de link (#fase-3), anders de lopende fase die jij mag doen
   (te laat eerst), anders de eerste lopende, anders de laatst afgeronde. */
function startFase() {
  const m = location.hash.match(/^#fase-(.+)$/);
  if (m) { const nr = nrUit(m[1]); if (FASES.some(f => f.nr === nr) && faseStatus(o, nr) !== "nvt") return nr; }
  const actief = FASES.filter(f => lopend(faseStatus(o, f.nr)));
  const mijn = actief.filter(f => magBewerken(ik, o, f.nr));
  const rood = l => l.find(f => faseStatus(o, f.nr) === "rood");
  const keuze = rood(mijn) || mijn[0] || rood(actief) || actief[0];
  if (keuze) return keuze.nr;
  const groen = FASES.filter(f => faseStatus(o, f.nr) === "groen");
  return (groen[groen.length - 1] || FASES[0]).nr;
}

let gekozen = o ? startFase() : null;
let vorigeGekozen = null;
let heelLogboek = false;

/* ---------- wijzigen: bewaren, loggen en melden wat er groen werd ---------- */

function alleStatussen() { return Object.fromEntries(FASES.map(f => [f.nr, faseStatus(o, f.nr)])); }

function wijzig(fn, logtekst) {
  const voor = alleStatussen();
  fn();
  if (logtekst) o.log.push({ op: nu(), door: ik.naam, wat: logtekst });
  const imports = laadImports();
  if (koppelImports(orders, imports)) bewaarImports(imports);
  const na = alleStatussen();
  for (const f of FASES) {
    if (voor[f.nr] !== "groen" && na[f.nr] === "groen") {
      o.log.push({ op: nu(), door: ik.naam, wat: `Fase ${faseLabel(f.nr)} afgerond` });
      const volgende = FASES.find(v => voor[v.nr] === "grijs" && na[v.nr] !== "grijs");
      toast(volgende
        ? `Fase ${faseLabel(f.nr)} is groen. ${ROLLEN[volgende.eigenaar]} krijgt een melding: fase ${faseLabel(volgende.nr)} kan starten.`
        : `Fase ${faseLabel(f.nr)} is groen.`, "groen");
    }
  }
  bewaar(orders);
  /* opnieuw tekenen na de focusverplaatsing, zodat Tab naar het volgende veld blijft werken */
  setTimeout(() => { const id = document.activeElement?.id; teken(); if (id) document.getElementById(id)?.focus(); });
}

/* ---------- één punt: bolletje, label met uitleg, invoer rechts ---------- */

function waardeTekst(p, w) {
  if (w === undefined || w === null || w === "") return "Nog niet ingevuld";
  if (p.soort === "datum") return datumKort(w);
  if (p.soort === "tijd") return w.replace(":", ".");
  if (p.eenheid === "€") return bedrag(w);
  if (p.eenheid) return `${Number(w).toLocaleString("nl-NL")} ${p.eenheid}`;
  if (p.soort === "keuze") return p.opties[w] || w;
  return w;
}

function puntHtml(p, mag) {
  const klaar = puntKlaar(o, p);
  const id = `p_${p.key}`;
  const v = o.vink[p.key];
  const lbl = esc(p.label);
  const dl = `data-label="${lbl}"`;
  const wieWanneer = v ? `${v.door}, ${tijdstip(v.op)}${v.bestand ? " · " + v.bestand : ""}` : "";
  const neutraal = p.soort === "info" || p.soort === "lijst";

  let meta = !p.verplicht ? `Optioneel${p.hint ? ". " + p.hint : ""}` : (!klaar && p.hint ? p.hint : "");
  let metaRood = "", ctl = "", onder = "", breed = false, labelFor = true;

  switch (p.soort) {
    case "tekst": case "getal": case "datum": case "tijd": {
      const w = lees(o, p.pad);
      const type = { getal: "number", datum: "date", tijd: "time" }[p.soort] || "text";
      ctl = mag
        ? `<input id="${id}" class="invoer ${p.soort === "tekst" ? "" : "half"}" type="${type}" data-pad="${p.pad}" data-soort="${p.soort}" ${dl} value="${esc(w ?? "")}">`
        : `<span class="waarde">${esc(waardeTekst(p, w))}</span>`;
      break;
    }
    case "keuze": {
      const w = lees(o, p.pad) ?? "";
      ctl = mag
        ? `<select id="${id}" class="invoer" data-pad="${p.pad}" ${dl}><option value="">Kies</option>${Object.entries(p.opties).map(([k, t]) => `<option value="${esc(k)}" ${k === w ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>`
        : `<span class="waarde">${esc(waardeTekst(p, w))}</span>`;
      break;
    }
    case "janee": {
      const w = lees(o, p.pad);
      labelFor = false;
      ctl = mag
        ? `<div class="janee" role="group" aria-labelledby="l_${p.key}">${[["1", "Ja", true], ["0", "Nee", false]].map(([k, t, b]) =>
          `<button type="button" id="${id}_${k}" data-janee="${p.pad}" data-w="${k}" ${dl} class="${w === b ? "aan" : ""}" aria-pressed="${w === b}">${t}</button>`).join("")}</div>`
        : `<span class="waarde">${w === true ? "Ja" : w === false ? "Nee" : "Nog niet gekozen"}</span>`;
      break;
    }
    case "vink":
      labelFor = false;
      if (klaar) { meta = wieWanneer; if (mag) ctl = `<button type="button" class="knop" id="${id}" data-terug="${p.key}" ${dl}>Terugzetten</button>`; }
      else if (mag) ctl = `<button type="button" class="knop" id="${id}" data-vink="${p.key}" ${dl}>Afvinken</button>`;
      break;
    case "actie":
      labelFor = false;
      if (klaar) { meta = wieWanneer; if (mag) ctl = `<button type="button" class="knop" id="${id}" data-terug="${p.key}" ${dl}>Terugzetten</button>`; }
      else if (mag) {
        const geblokt = actieGeblokt(p.key);
        if (geblokt) meta = geblokt;
        ctl = `<button type="button" class="knop donker ${geblokt ? "uit" : ""}" id="${id}" data-actie="${p.key}" ${dl} ${geblokt ? 'aria-disabled="true"' : ""}>${esc(p.knop)}</button>`;
      }
      break;
    case "upload":
      if (klaar) meta = wieWanneer;
      if (mag) ctl = `<label class="knop" for="${id}">${klaar ? "Vervangen" : "Uploaden"}</label><input type="file" id="${id}" class="vh" data-upload="${p.key}" ${dl}>`;
      labelFor = false;
      break;
    case "tekstvak": {
      breed = true;
      const w = lees(o, p.pad);
      onder = mag
        ? `<textarea id="${id}" class="invoer" data-pad="${p.pad}" ${dl}>${esc(w)}</textarea>`
        : `<p>${esc(w || "Nog niets ingevuld")}</p>`;
      if (!mag) labelFor = false;
      break;
    }
    case "info":
      labelFor = false;
      meta = p.tekst;
      break;
    case "lijst": {
      breed = true; labelFor = false;
      meta = o.accessoires.length ? "" : "Geen accessoires.";
      onder = (o.accessoires.length ? `<ul class="lijstje">${o.accessoires.map((a, i) => `<li><span>${esc(a.naam)}</span>${mag ? `<button type="button" class="knop link" data-weg="${i}">Verwijderen</button>` : ""}</li>`).join("")}</ul>` : "")
        + (mag ? `<div class="toevoegen"><label class="vh" for="nieuw_acc">Accessoire toevoegen</label><input id="nieuw_acc" class="invoer" placeholder="Bijvoorbeeld: trekhaak, inclusief montage"><button type="button" class="knop" id="acc_toevoegen">Toevoegen</button></div>` : "");
      if (!onder) breed = false;
      break;
    }
    case "onderdelen": {
      labelFor = false;
      if (!o.accessoires.length) { meta = "Geen accessoires in de order, niets te bestellen."; break; }
      breed = true;
      const grens = wpDeadline(o) || (o.levertijd && plusDagen(o.levertijd, -2));
      if (grens && o.accessoires.some(a => a.verwacht > grens))
        metaRood = `Een onderdeel komt pas na ${datumKort(grens)} binnen, de dag dat de werkplaats klaar moet zijn. Werkplaatschef en afleverspecialist krijgen een melding.`;
      const vak = (a, i, veld, naam) => mag
        ? `<label><input type="checkbox" data-acc="${i}" data-veld="${veld}" ${a[veld] ? "checked" : ""}><span class="vh">${naam}: ${esc(a.naam)}</span></label>`
        : (a[veld] ? "Ja" : "Nee");
      onder = `<table class="tabel"><thead><tr><th>Onderdeel</th><th>Besteld</th><th>Verwacht binnen</th><th>Binnen</th></tr></thead><tbody>
        ${o.accessoires.map((a, i) => `<tr class="${grens && a.verwacht > grens ? "te-laat" : ""}"><td>${esc(a.naam)}</td>
          <td>${vak(a, i, "besteld", "Besteld")}</td>
          <td>${mag ? `<label class="vh" for="acc_${i}_verwacht">Verwacht binnen: ${esc(a.naam)}</label><input id="acc_${i}_verwacht" class="invoer" type="date" data-acc="${i}" data-veld="verwacht" value="${a.verwacht || ""}">` : esc(a.verwacht ? datumKort(a.verwacht) : "Onbekend")}</td>
          <td>${vak(a, i, "binnen", "Binnen")}</td></tr>`).join("")}
        </tbody></table>`;
      break;
    }
    case "importkeuze": {
      const imports = laadImports();
      const vrij = imports.filter(i => i.chassis === o.auto.chassis || !orders.some(x => x !== o && x.auto.chassis === i.chassis));
      const imp = imports.find(i => i.chassis === o.auto.chassis);
      if (imp) meta = `${imp.merk} ${imp.model} ${imp.uitvoering}, ${imp.kleur_ext}, ${imp.bouwjaar}. Meldcode ${meldcode(o)}.`;
      ctl = mag
        ? `<select id="${id}" class="invoer" data-importkeuze="1" ${dl}><option value="">Kies een auto</option>${vrij.map(i => `<option value="${esc(i.chassis)}" ${i.chassis === o.auto.chassis ? "selected" : ""}>${esc(`${i.merk} ${i.model}, ${i.kleur_ext} · ${i.chassis.slice(-6)}`)}</option>`).join("")}</select>`
        : `<span class="waarde">${esc(o.auto.chassis || "Nog niet gekozen")}</span>`;
      if (mag) onder = `<a class="knop link" href="import.html">Staat hij er niet tussen? Voeg hem toe aan de importlijst</a>`;
      breed = mag;
      break;
    }
    case "import": {
      labelFor = false;
      const imp = laadImports().find(i => i.chassis === o.auto.chassis);
      const stand = importStand(imp);
      meta = o.auto.kenteken ? "Uit de importlijst." : imp ? `Importlijst: ${eersteKlein(IMPORT_STAPPEN[stand])}, stap ${stand} van 6.` : "Deze auto staat niet in de importlijst.";
      ctl = o.auto.kenteken ? `<span class="waarde">${esc(o.auto.kenteken)}</span>` : `<a class="knop" href="import.html#${esc(o.auto.chassis || "")}">Naar de importlijst</a>`;
      break;
    }
    case "poets": {
      labelFor = false;
      const pt = o.poets || {};
      const vorm = pt.vorm || (o.mastercare ? "Mastercare" : "Standaard");
      if (pt.gedaan) meta = `Gepoetst. ${vorm}, ${datumKort(pt.datum)}.`;
      else if (pt.datum && dagenTot(pt.datum) < 1) metaRood = "Minder dan 24 uur van tevoren ingepland. Dat kost extra.";
      ctl = mag
        ? `<label class="vh" for="${id}">Poetsdatum</label><input id="${id}" class="invoer half" type="date" data-poets="datum" value="${pt.datum || ""}">
           <label class="vh" for="${id}_vorm">Poetsvorm</label><select id="${id}_vorm" class="invoer half" data-poets="vorm">${["Mastercare", "Standaard"].map(x => `<option ${x === vorm ? "selected" : ""}>${x}</option>`).join("")}</select>`
        : `<span class="waarde">${pt.datum ? `${datumKort(pt.datum)} · ${vorm}` : "Nog niet ingepland"}</span>`;
      break;
    }
  }

  /* uitleg die van de rest van de order afhangt */
  if (p.key === "afleverdatum" && vroegsteAflevering(o)) meta = `Vroegst ${datumKort(vroegsteAflevering(o))}: auto binnen plus 6 werkdagen klaarmaken plus 2 dagen.`;
  if (p.key === "wp_deadline") meta = o.afleverdatum ? `${datumKort(wpDeadline(o))}, 2 werkdagen voor de aflevering. Dit is de datum die de werkplaatschef in zijn agenda ziet.` : "Volgt uit de afleverdatum.";
  if (p.key === "premie") {
    const pr = premieVoor(o.auto.model);
    meta = !o.auto.model ? "Kies eerst een model." : pr ? `${bedrag(pr.bedrag)} voor de ${o.auto.model}, geldig tot en met ${datumKort(pr.tot)}.` : `Geen premie voor de ${o.auto.model} in de premielijst.`;
  }
  if (p.key === "kenteken" && o.vink.kent_aangevraagd && !o.auto.kenteken) {
    const d = -dagenTot(o.vink.kent_aangevraagd.op.slice(0, 10));
    const t = `Aangevraagd ${relatief(o.vink.kent_aangevraagd.op.slice(0, 10))}.`;
    if (d > 4) metaRood = `${t} Normaal duurt het 1 tot 4 dagen.`; else meta = t;
  }

  const labelTag = labelFor && ctl + onder ? `<label class="lbl" id="l_${p.key}" for="${id}">${lbl}</label>` : `<span class="lbl" id="l_${p.key}">${lbl}</span>`;
  return `<div class="punt ${klaar && !neutraal ? "klaar" : ""} ${p.verplicht ? "" : "optioneel"} ${neutraal ? "info" : ""} ${breed ? "breed" : ""}">
    <span class="bol">${neutraal ? icoon("info", 18) : klaar ? icoon("vink", 12) : ""}</span>
    <div>${labelTag}${meta ? `<div class="meta">${esc(meta)}</div>` : ""}${metaRood ? `<div class="meta rood">${esc(metaRood)}</div>` : ""}</div>
    <div class="ctl">${ctl}</div>
    ${onder ? `<div class="onder">${onder}</div>` : ""}
  </div>`;
}

function actieGeblokt(key) {
  if (key === "factuur" && !(o.auto.kenteken && o.afleverdatum && o.aflevertijd)) return "Kan pas als kenteken, afleverdatum en tijd er zijn.";
  if (key === "afgeleverd" && faseStatus(o, 3) !== "groen") return "Kan pas als fase 3 rond is: kenteken, afspraak en factuur.";
  return "";
}

/* ---------- de gekozen fase ---------- */

function faseHtml(f) {
  const status = faseStatus(o, f.nr);
  const punten = puntenVoor(o, f.nr);
  const verplicht = punten.filter(p => p.verplicht);
  const gedaan = verplicht.filter(p => puntKlaar(o, p)).length;
  const magRol = magBewerken(ik, o, f.nr);
  const mag = magRol && (lopend(status) || status === "groen");
  const eigenaar = persoonVanRol(o, f.eigenaar);
  const wie = lopend(status) ? (eigenaar === ik.naam ? "Jij bent aan zet" : `${eigenaar} is aan zet`) : `${eigenaar}, ${ROLLEN[f.eigenaar].toLowerCase()}`;
  const pct = verplicht.length ? Math.round(gedaan / verplicht.length * 100) : 100;

  const m = [];
  if (status === "rood") m.push(`<div class="melding rood"><b>Te laat.</b> ${esc(waaromTeLaat(o, f.nr))}.</div>`);
  if (lopend(status) && !magRol) m.push(`<div class="melding">Deze fase is van ${esc(eigenaar)} (${ROLLEN[f.eigenaar].toLowerCase()}). Je kunt meelezen en rechts een open punt plaatsen.</div>`);
  if (o.heropend?.[f.nr]) m.push(`<div class="melding oranje">Heropend door ${esc(o.heropend[f.nr].door)}, ${tijdstip(o.heropend[f.nr].op)}.${magRol ? `<button type="button" class="knop" data-afronden="${f.nr}">Opnieuw afronden</button>` : ""}</div>`);
  if (status === "groen") {
    const af = [...o.log].reverse().find(l => l.wat === `Fase ${faseLabel(f.nr)} afgerond`);
    m.push(`<div class="melding groen">Afgerond${af ? ` door ${esc(af.door)}, ${tijdstip(af.op)}` : ""}.${magRol ? " Iets verkeerd ingevuld? Je kunt het hieronder herstellen; elke wijziging komt in het logboek." : ""}${ik.rol === "manager" ? `<button type="button" class="knop" data-heropen="${f.nr}">Fase heropenen</button>` : ""}</div>`);
  }
  if (status === "grijs") {
    const wacht = vereist(o, f.nr).filter(v => !["groen", "nvt"].includes(faseStatus(o, v))).map(faseLabel).join(" en ");
    m.push(`<div class="melding">Deze fase start zodra ${wacht ? `fase ${wacht} is afgerond` : ""}${wacht && f.nr === 4 && !o.vink.binnen ? " en " : ""}${f.nr === 4 && !o.vink.binnen ? "de auto binnen is" : ""}.</div>`);
  }
  if (f.nr === 5) {
    const wp = o.opmerkingen.filter(x => x.open && [2, 4].includes(x.fase));
    if (wp.length) m.push(`<div class="melding oranje"><b>Open punten van de werkplaats</b><br>${wp.map(x => esc(x.tekst)).join("<br>")}</div>`);
  }
  if (f.nr === 3) m.push(`<div class="melding">Loopt tegelijk met fase 2. De werkplaats kan beginnen zodra de auto binnen is.</div>`);
  if (f.nr === 3 || f.nr === 5) {
    const d = verkoopDelen(o);
    m.push(`<div class="balk-blok"><div class="veld-lbl">Voortgang verkoop en aflevering</div>${delenBalk(d, "Verkoop en aflevering")}<div class="delen-labels">${d.map(x => `<span class="${x.klaar ? "af" : ""}">${x.nr}. ${esc(x.label)}</span>`).join("")}</div></div>`);
  }
  if (f.nr === "ott") m.push(`<div class="melding">Loopt tegelijk met fase 4. Aflevering kan pas groen als de OTT-code er is.</div>`);

  const groepen = [...new Set(punten.map(p => p.groep))];
  let voet = "";
  if (f.nr === 2 && mag) voet = `<div class="fase-voet stapel">
      <label class="veld-lbl" for="afwijking">Afwijking melden</label>
      <textarea id="afwijking" class="invoer" placeholder="Bijvoorbeeld: trekhaak niet leverbaar, komt over drie weken"></textarea>
      <button type="button" class="knop" id="afwijking_melden">Melden aan verkoper en afleverspecialist</button></div>`;
  if (f.nr === 3) voet = `<div class="fase-voet">
      <button type="button" class="knop" id="agenda" ${o.afleverdatum && o.aflevertijd ? "" : "disabled"}>Zet in agenda</button>
      <a class="knop" href="briefje.html?id=${o.id}" target="_blank">Print briefje voorruit</a></div>`;

  return `<section class="fase" id="fase-${f.nr}" aria-labelledby="fase-titel">
    <div class="fase-kop">
      <div class="boven"><div><h2 id="fase-titel">Fase ${faseLabel(f.nr)} · ${f.naam}</h2><p>${esc(wie)} · ${gedaan} van ${verplicht.length} klaar</p></div>${pil(status)}</div>
      <div class="voortgang"><i class="st-${status}" style="width:${pct}%"></i></div>
    </div>
    ${m.length ? `<div class="fase-meldingen">${m.join("")}</div>` : ""}
    ${groepen.map(g => `<div class="groep"><h3>${esc(g)}</h3>${punten.filter(p => p.groep === g).map(p => puntHtml(p, mag)).join("")}</div>`).join("")}
    ${voet}
  </section>`;
}

/* ---------- zijkolom ---------- */

function zijHtml() {
  const open = o.opmerkingen.filter(m => m.open);
  const opgelost = o.opmerkingen.filter(m => !m.open);
  const timer = contactTimer(o);
  const keuzeNodig = !!timer || levertijdVoorbij(o);
  const docs = Object.values(o.vink).filter(v => v.bestand);
  const log = [...o.log].sort((a, b) => b.op.localeCompare(a.op));
  const fase = faseInfo(gekozen);
  const item = m => `<div class="item ${m.open ? "" : "af"}"><div class="tekst">${esc(m.tekst)}</div>
    <div class="meta"><span>Fase ${faseLabel(m.fase)} · ${esc(m.auteur)}, ${tijdstip(m.op)}</span>${m.open ? `<button type="button" class="knop link" data-opgelost="${m.id}">Opgelost</button>` : ""}</div></div>`;

  return `
    <section class="zij-blok"><h2>Open punten${open.length ? ` <span class="n">${open.length}</span>` : ""}</h2>
      ${open.length ? `<div class="items">${open.map(item).join("")}</div>` : `<p class="zij-leeg">Geen open punten.</p>`}
      ${opgelost.length ? `<details class="opgelost"><summary>${opgelost.length} opgelost</summary><div class="items">${opgelost.map(item).join("")}</div></details>` : ""}
      <form class="zij-form" id="f_opmerking">
        <label class="veld-lbl" for="opm_tekst">Open punt bij fase ${faseLabel(fase.nr)} · ${fase.naam}</label>
        <textarea id="opm_tekst" name="tekst" class="invoer" required placeholder="Wat moet er nog gebeuren?"></textarea>
        <button class="knop">Plaatsen</button>
      </form>
    </section>
    <section class="zij-blok"><h2>Klantcontact</h2>
      ${timer ? `<div class="melding oranje">${esc(timer.tekst)}. Taak voor ${esc(persoonVanRol(o, timer.wie))}. Leg na het gesprek vast of de datum blijft of welke nieuwe datum is afgesproken.</div>` : ""}
      ${levertijdVoorbij(o) ? `<div class="melding rood"><b>Verwachte leverdatum ${-dagenTot(o.levertijd)} dagen voorbij.</b> Spreek een nieuwe datum af met de klant.</div>` : ""}
      ${o.contact.length ? `<div class="items">${[...o.contact].reverse().map(c => `<div class="item"><div class="tekst">${esc(c.tekst)}</div><div class="meta">${esc(c.door)}, ${tijdstip(c.op)}</div></div>`).join("")}</div>` : `<p class="zij-leeg">Nog geen contact vastgelegd.</p>`}
      <form class="zij-form" id="f_contact">
        <label class="veld-lbl" for="contact_tekst">Contactmoment vastleggen</label>
        <textarea id="contact_tekst" name="tekst" class="invoer" required placeholder="Wat is er besproken?"></textarea>
        ${keuzeNodig ? `<fieldset class="keuze-datum"><legend class="veld-lbl">Verwachte levering na dit gesprek</legend>
          ${verwachteDatum(o) && !levertijdVoorbij(o) ? `<label><input type="radio" name="datum_keuze" value="blijft" required> Blijft ${datumKort(verwachteDatum(o))}</label>` : ""}
          <label><input type="radio" name="datum_keuze" value="nieuw" required> Nieuwe datum afgesproken</label>
          <label class="vh" for="nieuwe_datum">Nieuwe datum</label><input id="nieuwe_datum" name="nieuwe_datum" type="date" class="invoer">
        </fieldset>` : ""}
        <button class="knop">Vastleggen</button>
      </form>
    </section>
    ${docs.length ? `<section class="zij-blok"><h2>Documenten</h2><div class="items">${docs.map(d => `<div class="item"><div class="tekst">${esc(d.bestand)}</div><div class="meta">${esc(d.door)}, ${tijdstip(d.op)}</div></div>`).join("")}</div></section>` : ""}
    <section class="zij-blok"><h2>Logboek</h2>
      <div class="items">${(heelLogboek ? log : log.slice(0, 5)).map(l => `<div class="item"><div class="tekst">${esc(l.wat)}</div><div class="meta">${esc(l.door)}, ${tijdstip(l.op)}</div></div>`).join("")}</div>
      ${log.length > 5 && !heelLogboek ? `<button type="button" class="knop link meer" id="log_meer">Toon alles (${log.length})</button>` : ""}
    </section>`;
}

/* ---------- alles ---------- */

function teken() {
  if (faseStatus(o, gekozen) === "nvt") gekozen = startFase();
  const klaar = huidigeFase(o) === "klaar";
  const status = klaar ? "groen" : kaartStatus(o);
  const wis = wisDatum(o);
  const scroll = window.scrollY;
  const nieuweFase = vorigeGekozen !== gekozen;
  vorigeGekozen = gekozen;
  const sleutelMag = ["afleverspecialist", "poetser", "manager", "werkplaatschef"].includes(ik.rol);
  const feit = (dt, dd) => `<div><dt>${dt}</dt><dd>${dd}</dd></div>`;
  const stappen = FASES.filter(f => faseVanToepassing(o, f.nr));

  hoofd.innerHTML = `
    <div class="order-kop">
      <a class="terug" href="${startpagina(ik.rol)}">${icoon("pijl-links", 16)}${MENU[MENU_PER_ROL[ik.rol][0]][1]}</a>
      <div class="order-titel"><h1>${esc(klantNaam(o))}</h1>${pil(status, klaar ? "Afgeleverd" : STATUS_TEKST[status])}</div>
      <p class="order-sub">${esc(o.auto.model || "Model nog kiezen")} · ${TYPES[o.type]} · Order ${esc(o.ordernummer || "nog geen nummer")}</p>
      <dl class="feiten">
        ${feit("Verkoper", esc(o.verkoper))}
        ${feit("Levertijd", o.levertijd ? datumKort(o.levertijd) : "Nog invullen")}
        ${feit("Aflevering", o.afleverdatum ? datumKort(o.afleverdatum) + (o.aflevertijd ? ", " + o.aflevertijd.replace(":", ".") : "") : "Nog niet gepland")}
        ${feit("Mastercare", o.mastercare === true ? "Ja" : o.mastercare === false ? "Nee" : "Nog kiezen")}
        ${feit("Kenteken", esc(o.auto.kenteken || "Nog niet bekend"))}
        ${sleutelMag
          ? `<div><dt><label for="sleutel">Sleutel</label></dt><dd><select id="sleutel" class="invoer">${SLEUTELLOCATIES.map(s => `<option ${s === o.auto.sleutel ? "selected" : ""}>${s}</option>`).join("")}</select></dd></div>`
          : feit("Sleutel", esc(o.auto.sleutel || "Onbekend"))}
      </dl>
      ${wis ? `<div class="melding">Klantgegevens gaan er op ${datumKort(wis)} uit, 30 dagen na aflevering. ${o.nps != null ? `NPS ${o.nps}, review ${o.review} van 5.` : `NPS en review komen vanaf ${datumKort(npsDatum(o))} binnen.`}</div>` : ""}
    </div>
    <nav class="stappen" aria-label="Fases">${stappen.map((f, i) => {
      const s = faseStatus(o, f.nr);
      const vorige = i ? faseStatus(o, stappen[i - 1].nr) : "";
      return `<button type="button" class="stap ${s} ${f.nr === gekozen ? "gekozen" : ""} ${vorige === "groen" ? "na-groen" : ""}" data-naar="${f.nr}" ${f.nr === gekozen ? 'aria-current="step"' : ""}>
        <span class="bol">${s === "groen" ? icoon("vink", 14) : faseLabel(f.nr)}</span><span class="nm">${f.naam}</span><span class="st">${STATUS_TEKST[s]}</span></button>`;
    }).join("")}</nav>
    <div class="order-grid">
      <div class="${nieuweFase ? "vervaag-in" : ""}">${faseHtml(faseInfo(gekozen))}</div>
      <aside class="zij">${zijHtml()}</aside>
    </div>`;
  window.scrollTo(0, scroll);
}

/* ---------- agenda-afspraak als .ics, tot de Graph-koppeling er is ---------- */
function agendaBestand() {
  const meldcode = o.auto.meldcode || (o.auto.chassis || "").slice(-4);
  const start = `${o.afleverdatum.replaceAll("-", "")}T${o.aflevertijd.replace(":", "")}00`;
  const eindUur = String(Number(o.aflevertijd.slice(0, 2)) + 1).padStart(2, "0");
  const eind = `${o.afleverdatum.replaceAll("-", "")}T${eindUur}${o.aflevertijd.slice(3, 5)}00`;
  const titel = `Afl. ${klantNaam(o)} BYD ${o.auto.model} #${meldcode}${o.type !== "nieuw" ? " (" + TYPES[o.type].toLowerCase() + ")" : ""}`;
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ADG Groep//Afleverproces BYD//NL", "METHOD:PUBLISH", "BEGIN:VEVENT",
    `UID:aflevering-${o.id}@adggroep.nl`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
    `DTSTART:${start}`, `DTEND:${eind}`, `SUMMARY:${titel}`, "CATEGORIES:Oranje categorie",
    `DESCRIPTION:Verkoper: ${o.verkoper}\\nMastercare: ${o.mastercare ? "ja" : "nee"}\\nOrder: ${o.ordernummer}`,
    "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  a.download = `${titel}.ics`;
  a.click();
  toast("Afspraak gedownload. Open hem en sla hem op in de agenda van bydgroningen@.");
}

/* ---------- invoer ---------- */

const ACTIE_MELDING = {
  team_info: () => `Melding met chassisnummer ${o.auto.chassis || "(nog leeg)"} naar het team in Groningen en Meppel.`,
  binnen: () => `Auto staat als binnen gemeld. De werkplaats kan ingepland worden.${o.type === "import" ? " De importlijst is bijgewerkt." : ""}`,
  kent_aangevraagd: () => "Kenteken-timer gestart. Verwacht binnen 1 tot 4 dagen.",
  factuur: () => "Factuuraanvraag naar de administratie (Marieke Hoek).",
  afgeleverd: () => "Aflevering afgerond. NPS volgt na 28 dagen, klantgegevens gaan er na 30 dagen uit."
};

hoofd.addEventListener("change", e => {
  const t = e.target, d = t.dataset;
  if (d.pad) {
    let w = t.value;
    if (d.soort === "getal") w = w === "" ? "" : Number(w);
    wijzig(() => {
      zet(o, d.pad, w);
      if (d.pad === "type" && w !== "nieuw") o.voorraad = null;
      if (d.pad === "type" && w === "nieuw") o.voorraad ||= "winkel";
    }, `${d.label} gewijzigd`);
  } else if (d.importkeuze) {
    const imp = laadImports().find(i => i.chassis === t.value);
    wijzig(() => {
      o.auto.chassis = t.value;
      if (imp) o.auto.model = `${imp.merk === "BYD" ? "" : imp.merk + " "}${imp.model}`;
    }, imp ? `Gekoppeld aan importauto ${imp.merk} ${imp.model} (${imp.chassis})` : "Importauto losgekoppeld");
  } else if (d.upload) {
    const naam = t.files[0]?.name; if (!naam) return;
    wijzig(() => { o.vink[d.upload] = { door: ik.naam, op: nu(), bestand: naam }; }, `${naam} geüpload`);
  } else if (d.acc) {
    const a = o.accessoires[d.acc];
    wijzig(() => { a[d.veld] = t.type === "checkbox" ? t.checked : t.value; }, `Onderdeel ${a.naam}: ${d.veld} bijgewerkt`);
  } else if (d.poets) {
    wijzig(() => { o.poets = { ...(o.poets || {}), [d.poets]: t.value }; }, "Poetser ingepland");
    if (d.poets === "datum" && t.value && dagenTot(t.value) < 1) toast("Minder dan 24 uur vooraf ingepland bij de poetser. Dat kost extra.");
  } else if (t.id === "sleutel") {
    wijzig(() => { o.auto.sleutel = t.value; }, `Sleutellocatie: ${t.value}`);
  }
});

hoofd.addEventListener("click", e => {
  const t = e.target.closest("button");
  if (!t) return;
  const d = t.dataset;
  if (d.naar) {
    gekozen = nrUit(d.naar);
    history.replaceState(null, "", `#fase-${d.naar}`);
    teken(); return;
  }
  if (d.janee) { wijzig(() => zet(o, d.janee, d.w === "1"), `${d.label}: ${d.w === "1" ? "ja" : "nee"}`); return; }
  if (d.vink) {
    wijzig(() => { o.vink[d.vink] = { door: ik.naam, op: nu() }; }, `${d.label} afgevinkt`);
    if (d.vink === "wp_klaar") toast("WP-klaar. De afspraak in de Outlook-agenda van bydgroningen@ gaat straks vanzelf naar WP-klaar.");
    return;
  }
  if (d.actie) {
    if (actieGeblokt(d.actie)) { toast(actieGeblokt(d.actie)); return; }
    wijzig(() => {
      o.vink[d.actie] = { door: ik.naam, op: nu() };
      if (d.actie === "afgeleverd") o.auto.sleutel = "Klant";
    }, t.textContent);
    toast(ACTIE_MELDING[d.actie]?.() || `${t.textContent}.`);
    return;
  }
  if (d.terug) { wijzig(() => delete o.vink[d.terug], `${d.label} teruggezet`); o.log[o.log.length - 1].terug = true; bewaar(orders); return; }
  if (d.weg) { wijzig(() => o.accessoires.splice(Number(d.weg), 1), "Accessoire verwijderd"); return; }
  if (d.opgelost) { wijzig(() => { o.opmerkingen.find(m => m.id == d.opgelost).open = false; }, "Open punt opgelost"); return; }
  if (d.heropen) { wijzig(() => { (o.heropend ??= {})[nrUit(d.heropen)] = { door: ik.naam, op: nu() }; }, `Fase ${faseLabel(nrUit(d.heropen))} heropend`); return; }
  if (d.afronden) { wijzig(() => { delete o.heropend[d.afronden]; }, `Fase ${faseLabel(nrUit(d.afronden))} opnieuw afgerond`); return; }
  if (t.id === "acc_toevoegen") {
    const naam = document.getElementById("nieuw_acc").value.trim(); if (!naam) return;
    wijzig(() => o.accessoires.push({ naam }), `Accessoire ${naam} toegevoegd`); return;
  }
  if (t.id === "afwijking_melden") {
    const tekst = document.getElementById("afwijking").value.trim(); if (!tekst) return;
    wijzig(() => o.opmerkingen.push({ id: Date.now(), fase: 2, tekst, open: true, auteur: ik.naam, op: nu() }), "Afwijking gemeld");
    toast(`Melding naar ${o.verkoper} en Lisa Brouwer.`); return;
  }
  if (t.id === "agenda") agendaBestand();
  if (t.id === "log_meer") { heelLogboek = true; teken(); }
});

hoofd.addEventListener("keydown", e => {
  if (e.key === "Enter" && e.target.id === "nieuw_acc") { e.preventDefault(); document.getElementById("acc_toevoegen").click(); }
});

hoofd.addEventListener("submit", e => {
  e.preventDefault();
  const tekst = new FormData(e.target).get("tekst");
  if (e.target.id === "f_opmerking") {
    wijzig(() => o.opmerkingen.push({ id: Date.now(), fase: gekozen, tekst, open: true, auteur: ik.naam, op: nu() }), "Open punt geplaatst");
  }
  if (e.target.id === "f_contact") {
    const fd = new FormData(e.target);
    const keuze = fd.get("datum_keuze");
    const nieuw = fd.get("nieuwe_datum");
    if (keuze === "nieuw" && !nieuw) { toast("Vul de nieuwe datum in die je met de klant hebt afgesproken."); document.getElementById("nieuwe_datum").focus(); return; }
    const timer = contactTimer(o);
    const veld = o.afleverdatum ? "afleverdatum" : "levertijd";
    const oud = o[veld];
    wijzig(() => {
      o.contact.push({ op: nu(), door: ik.naam, tekst, momenten: timer ? [timer.soort, ...(timer.soort === "drieweken" ? ["helft"] : [])] : [] });
      if (keuze === "nieuw") {
        o[veld] = nieuw;
        o.log.push({ op: nu(), door: ik.naam, wat: `${veld === "afleverdatum" ? "Afleverdatum" : "Verwachte leverdatum"} na klantcontact: ${datumKort(oud)} wordt ${datumKort(nieuw)}` });
      } else if (keuze === "blijft") {
        o.log.push({ op: nu(), door: ik.naam, wat: `Na klantcontact: ${datumKort(oud)} blijft staan` });
      }
    }, "Contactmoment vastgelegd");
    toast(keuze === "nieuw" ? `Vastgelegd. Nieuwe verwachte datum: ${datumKort(nieuw)}.` : "Contactmoment vastgelegd.");
  }
});

if (o) teken();
