/* Bord: één kolom per fase, elke auto als kaart in de vroegste fase die nog loopt. */

const ik = kopbalk("bord");
const orders = laadOrders();

const fVerkoper = document.getElementById("f_verkoper");
PERSONEN.filter(p => p.rol === "verkoper").forEach(p => fVerkoper.insertAdjacentHTML("beforeend", `<option>${esc(p.naam)}</option>`));
if (ik.rol === "verkoper") fVerkoper.value = ik.naam;

let weergave = "alle";
let eersteKeer = true;

function kaartHtml(o, i) {
  const fase = huidigeFase(o);
  const kleur = fase === "klaar" ? "groen" : kaartStatus(o);
  const open = o.opmerkingen.filter(m => m.open).length;
  const timer = fase === "klaar" ? null : contactTimer(o);
  const roodFase = kleur === "rood" ? FASES.find(f => faseStatus(o, f.nr) === "rood") : null;
  const soort = o.type === "nieuw" ? "" : " · " + TYPES[o.type];

  let datum, extra = "";
  if (fase === "klaar") {
    datum = `Afgeleverd ${datumKort(o.vink.afgeleverd.op.slice(0, 10))}`;
    const wis = dagenTot(wisDatum(o));
    extra = `<div class="k4">${o.nps != null ? `NPS ${o.nps}` : `NPS vanaf ${datumKort(npsDatum(o))}`} · gegevens weg ${wis <= 0 ? "vandaag" : wis === 1 ? "morgen" : "over " + wis + " dagen"}</div>`;
  } else if (o.afleverdatum) {
    datum = `${o.type === "import" && !o.auto.kenteken ? "Verwacht" : "Aflevering"} ${datumKort(o.afleverdatum)}${o.aflevertijd ? ", " + o.aflevertijd.replace(":", ".") : ""}`;
  } else {
    datum = o.levertijd ? `Levertijd ${datumKort(o.levertijd)}` : "Levertijd nog invullen";
  }

  const iconen = [
    open ? `<span class="ico" title="${open} open ${open === 1 ? "punt" : "punten"}">${icoon("bubbel", 14)}${open}</span>` : "",
    timer ? `<span class="ico" title="${esc(timer.tekst)}">${icoon("bellen", 14)}<span class="vh">${esc(timer.tekst)}</span></span>` : ""
  ].join("");

  return `
    <a class="kaartje ${eersteKeer ? "in-beeld" : ""}" style="--i:${i}" href="order.html?id=${o.id}${roodFase ? "#fase-" + roodFase.nr : ""}">
      <div class="k1"><span class="stip st-${kleur}" title="${kleur === "groen" ? "Afgeleverd" : STATUS_TEKST[kleur]}"></span><span class="naam">${esc(klantNaam(o))}</span><span class="avatar klein" title="Verkoper: ${esc(o.verkoper)}">${initialen(o.verkoper)}</span></div>
      <div class="k2">${esc(o.auto.model || "Model nog kiezen")}${soort}</div>
      ${roodFase ? `<div class="reden">${esc(waaromTeLaat(o, roodFase.nr))}</div>` : ""}
      <div class="k3"><span class="datum">${datum}</span>${iconen}</div>
      ${extra}
    </a>`;
}

function teken() {
  const zoek = document.getElementById("zoek").value.trim().toLowerCase();
  const type = document.getElementById("f_type").value;
  const verkoper = fVerkoper.value;

  const gefilterd = orders.filter(o =>
    (!type || o.type === type) &&
    (!verkoper || o.verkoper === verkoper) &&
    (!zoek || [klantNaam(o), o.auto.model, o.auto.kenteken, o.ordernummer].join(" ").toLowerCase().includes(zoek)));
  const lopend = gefilterd.filter(o => huidigeFase(o) !== "klaar");
  const telRood = lopend.filter(o => kaartStatus(o) === "rood").length;
  const telBellen = lopend.filter(o => contactTimer(o)).length;

  document.getElementById("weergave").innerHTML = [["alle", "Alle", ""], ["rood", "Te laat", telRood], ["bellen", "Klant bellen", telBellen]]
    .map(([k, t, n]) => `<button type="button" data-weergave="${k}" class="${weergave === k ? "aan" : ""}" aria-pressed="${weergave === k}">${t}${n !== "" ? ` <span class="n">${n}</span>` : ""}</button>`).join("");

  const zichtbaar = gefilterd.filter(o =>
    weergave === "alle" ||
    (weergave === "rood" && huidigeFase(o) !== "klaar" && kaartStatus(o) === "rood") ||
    (weergave === "bellen" && huidigeFase(o) !== "klaar" && contactTimer(o)));

  const kolommen = [...BORD_FASES.map(f => ({ nr: f.nr, naam: f.naam, sub: `Fase ${f.nr} · ${ROLLEN[f.eigenaar]}` })), { nr: "klaar", naam: "Afgeleverd", sub: "Laatste 30 dagen" }];
  /* sorteren: te laat eerst, dan op datum */
  const volgorde = o => [kaartStatus(o) === "rood" ? 0 : 1, o.afleverdatum || o.levertijd || "9999"];
  let i = 0;
  document.getElementById("bord").innerHTML = kolommen.map(k => {
    const inKolom = zichtbaar.filter(o => huidigeFase(o) === k.nr)
      .sort((a, b) => { const x = volgorde(a), y = volgorde(b); return x[0] - y[0] || x[1].localeCompare(y[1]); });
    return `<section class="kolom ${k.nr === "klaar" ? "klaar" : ""}">
      <div class="kolom-kop"><div><h2>${k.naam}</h2><p>${k.sub}</p></div><span class="aantal">${inKolom.length}</span></div>
      ${inKolom.map(o => kaartHtml(o, i++)).join("") || `<div class="kolom-leeg">Geen auto's</div>`}
    </section>`;
  }).join("");
  eersteKeer = false;

  const alleLopend = orders.filter(o => huidigeFase(o) !== "klaar");
  const rood = alleLopend.filter(o => kaartStatus(o) === "rood").length;
  document.getElementById("samenvatting").textContent =
    `${alleLopend.length} auto's onderweg naar de klant, ${rood} ${rood === 1 ? "loopt" : "lopen"} achter.`;
}

document.getElementById("weergave").addEventListener("click", e => {
  const b = e.target.closest("[data-weergave]"); if (!b) return;
  weergave = b.dataset.weergave; teken();
});
["zoek", "f_type", "f_verkoper"].forEach(id => document.getElementById(id).addEventListener("input", teken));
teken();
