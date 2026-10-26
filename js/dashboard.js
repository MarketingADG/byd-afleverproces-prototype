/* Dashboard voor de manager: waar staan de auto's, wat loopt achter, hoe tevreden zijn klanten. */

const ik = kopbalk("dashboard");
const orders = laadOrders();
const bak = document.getElementById("dashboard");

/* Doorlooptijd en NPS per maand hebben een paar maanden historie nodig. Die is er in het
   prototype niet, dus deze twee panelen tonen vaste voorbeeldcijfers. */
const VOORBEELD_DOORLOOP = [["Verkoop", 2], ["Onderdelen", 9], ["Auto binnen", 6], ["Werkplaats", 4], ["Aflevering", 3]];
const VOORBEELD_NPS = [["mei", 61], ["jun", 58], ["jul", 66], ["aug", 52], ["sep", 63], ["okt", 70]];

function balken(rijen, max, eenheid, kleur = () => "") {
  return rijen.map(([lbl, n]) => `<div class="balk-rij"><span>${esc(lbl)}</span>
    <div class="baan" title="${esc(lbl)}: ${n}${eenheid}"><div class="balk ${kleur(lbl, n)}" style="width:${max ? Math.round(n / max * 100) : 0}%"></div></div>
    <span class="n">${n}${eenheid}</span></div>`).join("");
}

function teken() {
  if (ik.rol !== "manager") {
    bak.innerHTML = `<div class="melding">Het dashboard is voor de manager. Kies linksonder bij "Bekijk als" Ruud Veenstra.</div>`;
    return;
  }
  const lopend = orders.filter(o => huidigeFase(o) !== "klaar");
  const afgeleverd = orders.filter(o => huidigeFase(o) === "klaar");
  const rood = lopend.filter(o => kaartStatus(o) === "rood");
  const dezeWeek = lopend.filter(o => o.afleverdatum && dagenTot(o.afleverdatum) >= 0 && dagenTot(o.afleverdatum) <= 7);
  const metNps = afgeleverd.filter(o => o.nps != null);

  const perFase = BORD_FASES.map(f => {
    const hier = lopend.filter(o => huidigeFase(o) === f.nr);
    return [`${f.nr} · ${f.naam}`, hier.length, hier.filter(o => kaartStatus(o) === "rood").length];
  });

  const perVerkoper = PERSONEN.filter(p => p.rol === "verkoper").map(p => {
    const van = lopend.filter(o => o.verkoper === p.naam);
    return { naam: p.naam, lopend: van.length, rood: van.filter(o => kaartStatus(o) === "rood").length,
      contact: van.filter(o => contactTimer(o)?.wie === "verkoper").length };
  });

  const redenen = rood.map(o => {
    const f = FASES.find(x => faseStatus(o, x.nr) === "rood");
    return `<a class="taak" href="order.html?id=${o.id}#fase-${f.nr}"><span class="stip st-rood"></span>
      <div><div class="wie">${esc(klantNaam(o))}</div><div class="sub">${esc(o.auto.model)} · ${esc(o.verkoper)}</div></div>
      <div class="wat"><div class="kop">Fase ${faseLabel(f.nr)} · ${f.naam}</div><div class="sub">${esc(waaromTeLaat(o, f.nr))}</div></div>
      <div class="wanneer">${o.afleverdatum ? "Aflevering " + relatief(o.afleverdatum) : "Levertijd " + relatief(o.levertijd)}</div></a>`;
  }).join("");

  bak.innerHTML = `
    <div class="kpi">
      <div><div class="getal">${lopend.length}</div><div class="lbl">Auto's onderweg naar de klant</div></div>
      <div><div class="getal ${rood.length ? "rood" : ""}">${rood.length}</div><div class="lbl">Lopen achter</div></div>
      <div><div class="getal">${dezeWeek.length}</div><div class="lbl">Afleveringen komende 7 dagen</div></div>
      <div><div class="getal">${metNps.length ? (metNps.reduce((s, o) => s + o.nps, 0) / metNps.length).toFixed(1) : "-"}</div><div class="lbl">Gemiddelde NPS-score, laatste 30 dagen</div></div>
    </div>
    <div class="dash-grid">
      <section class="paneel"><h2>Auto's per fase</h2>
        ${balken(perFase.map(([l, n]) => [l, n]), Math.max(...perFase.map(r => r[1]), 1), "", l => perFase.find(r => r[0] === l)[2] ? "rood" : "")}
        <p class="toelichting" style="margin:10px 0 0">Rode balk: in die fase loopt minstens één auto achter.</p>
      </section>
      <section class="paneel"><h2>Gemiddelde doorlooptijd per fase</h2>
        <p class="toelichting">Voorbeeldcijfers. Echte cijfers komen zodra er een paar maanden orders in staan.</p>
        ${balken(VOORBEELD_DOORLOOP, 10, " d")}
      </section>
      <section class="paneel"><h2>NPS per maand</h2>
        <p class="toelichting">Voorbeeldcijfers. Bron van de echte NPS is nog een open vraag (docs/plan.md).</p>
        ${balken(VOORBEELD_NPS, 100, "")}
      </section>
      <section class="paneel"><h2>Per verkoper</h2>
        <table class="tabel"><thead><tr><th>Verkoper</th><th>Lopend</th><th>Achter</th><th>Contact nodig</th></tr></thead><tbody>
        ${perVerkoper.map(v => `<tr><td>${esc(v.naam)}</td><td>${v.lopend}</td><td class="${v.rood ? "rood" : ""}">${v.rood}</td><td>${v.contact}</td></tr>`).join("")}
        </tbody></table>
      </section>
    </div>
    <section class="taken-groep dash-sectie"><h2>Wat loopt er achter <span class="n ${rood.length ? "rood" : ""}">${rood.length}</span></h2>${redenen ? `<div class="rijen">${redenen}</div>` : `<div class="leeg-staat"><h2>Niets loopt achter</h2></div>`}</section>`;
}

teken();
