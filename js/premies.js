/* Premielijst: de manager zet per model de inruilpremie (exclusief dealerbijdrage) en tot
   wanneer die geldt. Fase 1 van een order toont het bedrag voor het gekozen model. */

const ik = kopbalk("premies");
const bak = document.getElementById("premies");
let premies = laadPremies();

function teken() {
  const rijen = [...premies].sort((a, b) => MODELLEN.indexOf(a.model) - MODELLEN.indexOf(b.model));
  const vrij = MODELLEN.filter(m => !premies.some(p => p.model === m));
  bak.innerHTML = `
    <section class="paneel">
      <h2>Premies</h2>
      <p class="toelichting">Voorbeeldbedragen in het prototype, niet de echte premies. Wijzig een bedrag of datum en het staat meteen goed in nieuwe orders.</p>
      ${rijen.length ? `<table class="tabel"><thead><tr><th>Model</th><th>Premie</th><th>Geldig tot en met</th><th>Laatst gewijzigd</th><th><span class="vh">Verwijderen</span></th></tr></thead><tbody>
        ${rijen.map(p => `<tr class="${p.tot && dagenTot(p.tot) < 0 ? "te-laat" : ""}">
          <td><b>${esc(p.model)}</b></td>
          <td><label class="vh" for="b_${p.model}">Premie ${esc(p.model)}</label><input id="b_${p.model}" class="invoer" type="number" min="0" step="50" data-model="${esc(p.model)}" data-veld="bedrag" value="${p.bedrag}"></td>
          <td><label class="vh" for="t_${p.model}">Geldig tot ${esc(p.model)}</label><input id="t_${p.model}" class="invoer" type="date" data-model="${esc(p.model)}" data-veld="tot" value="${p.tot || ""}"></td>
          <td>${p.gewijzigd ? `${esc(p.gewijzigd.door)}, ${tijdstip(p.gewijzigd.op)}` : "Voorbeelddata"}</td>
          <td><button type="button" class="knop link" data-weg="${esc(p.model)}">Verwijderen</button></td></tr>`).join("")}
      </tbody></table>` : `<p class="zij-leeg">Nog geen premies ingevoerd.</p>`}
    </section>
    ${vrij.length ? `<form class="paneel" id="f_premie">
      <h2>Premie toevoegen</h2>
      <div class="form-grid">
        <div class="veld"><label class="veld-lbl" for="n_model">Model</label><select id="n_model" name="model" class="invoer" required>${vrij.map(m => `<option>${esc(m)}</option>`).join("")}</select></div>
        <div class="veld"><label class="veld-lbl" for="n_bedrag">Premie in euro</label><input id="n_bedrag" name="bedrag" class="invoer" type="number" min="0" step="50" required></div>
        <div class="veld"><label class="veld-lbl" for="n_tot">Geldig tot en met</label><input id="n_tot" name="tot" class="invoer" type="date" required></div>
        <div class="veld"><span class="veld-lbl">&nbsp;</span><button class="knop donker">Toevoegen</button></div>
      </div>
    </form>` : ""}`;
}

function opslaan(melding) { bewaarPremies(premies); toast(melding); teken(); }

if (ik.rol !== "manager") {
  bak.innerHTML = `<div class="melding">De premielijst wordt bijgehouden door de manager.</div>`;
} else {
  bak.addEventListener("change", e => {
    const d = e.target.dataset; if (!d.model) return;
    const p = premies.find(x => x.model === d.model);
    p[d.veld] = d.veld === "bedrag" ? Number(e.target.value) : e.target.value;
    p.gewijzigd = { door: ik.naam, op: nu() };
    opslaan(`${p.model}: ${d.veld === "bedrag" ? bedrag(p.bedrag) : "geldig tot en met " + datumKort(p.tot)}.`);
  });
  bak.addEventListener("click", e => {
    const m = e.target.dataset.weg; if (!m) return;
    if (!confirm(`Premie voor de ${m} verwijderen?`)) return;
    premies = premies.filter(p => p.model !== m);
    opslaan(`Premie voor de ${m} verwijderd.`);
  });
  bak.addEventListener("submit", e => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.target));
    premies.push({ model: v.model, bedrag: Number(v.bedrag), tot: v.tot, gewijzigd: { door: ik.naam, op: nu() } });
    opslaan(`Premie voor de ${v.model} toegevoegd.`);
  });
  teken();
}
