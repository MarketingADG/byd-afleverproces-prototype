/* Mijn taken: alles wat bij één persoon openstaat, over alle auto's heen. */

const ik = kopbalk("taken");
const orders = laadOrders();
const kies = document.getElementById("f_persoon");

kies.innerHTML = `<option value="">Iedereen</option>` +
  PERSONEN.map(p => `<option value="${esc(p.naam)}">${esc(p.naam)} · ${ROLLEN[p.rol]}</option>`).join("");
kies.value = ik.rol === "manager" ? "" : ik.naam;

/* Elke taak: wie, welke auto, wat er moet, uiterste datum en kleur. */
function alleTaken() {
  const lijst = [];
  for (const o of orders) {
    if (huidigeFase(o) === "klaar") continue;
    const deadline = o.afleverdatum || o.levertijd;

    for (const f of FASES) {
      const s = faseStatus(o, f.nr);
      if (s !== "oranje" && s !== "rood") continue;
      const open = openPunten(o, f.nr);
      const wat = open.length
        ? `${open.slice(0, 2).map(p => p.label).join(", ")}${open.length > 2 ? ` en nog ${open.length - 2}` : ""}`
        : "Fase opnieuw afronden na heropenen";
      lijst.push({ o, naam: persoonVanRol(o, f.eigenaar), kleur: s, deadline: s === "rood" ? naarIso(vandaag()) : deadline,
        kop: `Fase ${faseLabel(f.nr)} · ${f.naam}`, wat, anker: f.nr });
    }

    const t = contactTimer(o);
    if (t) lijst.push({ o, naam: persoonVanRol(o, t.wie), kleur: "oranje", deadline: naarIso(vandaag()), kop: "Contact met de klant", wat: t.tekst });

    if (o.poets?.datum && !o.poets.gedaan)
      lijst.push({ o, naam: persoonVanRol(o, "poetser"), kleur: dagenTot(o.poets.datum) < 0 ? "rood" : "oranje", deadline: o.poets.datum,
        kop: "Poetsen", wat: `${o.poets.vorm}, sleutel ligt bij: ${o.auto.sleutel}`, link: "poetsen.html" });

    if (o.vink.naar_admin && !o.vink.afgeleverd)
      lijst.push({ o, naam: persoonVanRol(o, "administratie"), kleur: "oranje", deadline: o.afleverdatum,
        kop: "Afleverdocument", wat: "Verwerken voor kenteken " + (o.auto.kenteken || "") });
  }
  return lijst;
}

function teken() {
  const wie = kies.value;
  const taken = alleTaken().filter(t => !wie || t.naam === wie)
    .sort((a, b) => (a.kleur === "rood" ? 0 : 1) - (b.kleur === "rood" ? 0 : 1) || (a.deadline || "9").localeCompare(b.deadline || "9"));

  const groepen = [
    ["Te laat", taken.filter(t => t.kleur === "rood")],
    ["Vandaag en morgen", taken.filter(t => t.kleur !== "rood" && t.deadline && dagenTot(t.deadline) <= 1)],
    ["Later", taken.filter(t => t.kleur !== "rood" && !(t.deadline && dagenTot(t.deadline) <= 1))]
  ];

  const rood = groepen[0][1].length;
  document.getElementById("samenvatting").textContent = taken.length
    ? `${taken.length} ${taken.length === 1 ? "taak" : "taken"} open${rood ? `, ${rood} te laat` : ""}.`
    : "";

  document.getElementById("taken").innerHTML = taken.length ? groepen.filter(([, l]) => l.length).map(([titel, l]) => `
    <section class="taken-groep"><h2>${titel} <span class="n ${titel === "Te laat" ? "rood" : ""}">${l.length}</span></h2>
      <div class="rijen">${l.map(t => `<a class="taak" href="${t.link || `order.html?id=${t.o.id}${t.anker ? "#fase-" + t.anker : ""}`}">
        <span class="stip st-${t.kleur}"></span>
        <div><div class="wie">${esc(klantNaam(t.o))}</div><div class="sub">${esc(t.o.auto.model || "")}${t.o.auto.kenteken ? " · " + esc(t.o.auto.kenteken) : ""}${wie ? "" : " · " + esc(t.naam)}</div></div>
        <div class="wat"><div class="kop">${esc(t.kop)}</div><div class="sub">${esc(t.wat)}</div></div>
        <div class="wanneer">${t.deadline ? (t.o.afleverdatum && t.deadline === t.o.afleverdatum ? "Aflevering " : "") + relatief(t.deadline) : ""}</div>
      </a>`).join("")}</div>
    </section>`).join("")
    : `<div class="leeg-staat"><span class="rondje">${icoon("vink", 22)}</span><h2>Niets open voor ${esc(wie || "het team")}</h2><p>Nieuwe taken verschijnen hier zodra een fase op jou wacht.</p></div>`;
}

kies.addEventListener("input", teken);
teken();
