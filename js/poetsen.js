/* Poetsplanning: per dag welke auto's gepoetst worden. Gemaakt voor de telefoon van de poetser. */

const ik = kopbalk("poetsen");
const orders = laadOrders();
const bak = document.getElementById("poetsen");


function teken() {
  const ingepland = orders.filter(o => o.poets?.datum && !o.vink.afgeleverd)
    .sort((a, b) => a.poets.datum.localeCompare(b.poets.datum));
  const dagen = [...new Set(ingepland.map(o => o.poets.datum))];

  bak.innerHTML = dagen.map(d => `
    <section class="poets-dag"><h2>${relatief(d) === "vandaag" ? "Vandaag" : relatief(d) === "morgen" ? "Morgen" : datumKort(d)}, ${datumLang(d)}</h2>
      ${ingepland.filter(o => o.poets.datum === d).map(o => `
        <div class="poets-kaart ${o.poets.gedaan ? "gedaan" : ""}">
          <div class="boven">
            <div><div class="auto">${esc(autoNaam(o))}</div><div class="kent">${esc(o.auto.kenteken || "Nog geen kenteken")}</div></div>
            <span class="mc ${o.poets.vorm === "Mastercare" ? "ja" : "nee"}">${o.poets.vorm === "Mastercare" ? "Mastercare" : "Standaard"}</span>
          </div>
          <div class="feit">Aflevering ${o.afleverdatum ? datumKort(o.afleverdatum) + (o.aflevertijd ? ", " + o.aflevertijd.replace(":", ".") : "") : "nog niet gepland"} · ${esc(klantNaam(o))}</div>
          <div class="rij2">
            <label class="vh" for="sleutel_${o.id}">Sleutellocatie</label><select id="sleutel_${o.id}" data-sleutel="${o.id}">${SLEUTELLOCATIES.map(s => `<option ${s === o.auto.sleutel ? "selected" : ""}>${s}</option>`).join("")}</select>
            <button class="klaar-knop" data-gedaan="${o.id}">${o.poets.gedaan ? "Gepoetst" : "Klaar met poetsen"}</button>
          </div>
        </div>`).join("")}
    </section>`).join("") || `<div class="leeg-staat"><h2>Er staat niets ingepland</h2><p>De afleverspecialist plant poetsbeurten in bij fase 5 van een order.</p></div>`;
}

bak.addEventListener("change", e => {
  const o = orders.find(x => x.id === e.target.dataset.sleutel); if (!o) return;
  o.auto.sleutel = e.target.value;
  o.log.push({ op: nu(), door: ik.naam, wat: `Sleutellocatie: ${e.target.value}` });
  bewaar(orders);
  toast(`Sleutel van ${o.auto.kenteken || o.auto.model}: ${e.target.value}.`);
});

bak.addEventListener("click", e => {
  const o = orders.find(x => x.id === e.target.dataset.gedaan); if (!o) return;
  o.poets.gedaan = !o.poets.gedaan;
  o.log.push({ op: nu(), door: ik.naam, wat: o.poets.gedaan ? "Gepoetst" : "Poetsen teruggezet" });
  bewaar(orders);
  if (o.poets.gedaan) toast(`${o.auto.model} is gepoetst. Lisa Brouwer ziet het in de order.`, "groen");
  teken();
});

teken();
