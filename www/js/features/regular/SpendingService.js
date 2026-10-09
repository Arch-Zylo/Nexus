import { Component } from '../../core/Component.js';
import { BASE_SPEND_CATS, CAT_PALETTE } from '../../core/constants.js';
import { Util } from '../../core/Util.js';
import { Dom } from '../../core/Dom.js';

export class SpendingService extends Component {
  // Built-in categories plus any the user added (stored in store.customCats).
  spendCats() { return BASE_SPEND_CATS.concat(this.state.customCats || []); }

  spendCatLabel(key) { const c = this.spendCats().find(x => x.key === key); return c ? c.label : ''; }

  addSpendCategory(name, color) {
    name = (name || '').trim().replace(/\s+/g, ' ');
    if (!name) return { ok: false, msg: 'Enter a category name.' };
    if (name.length > 24) return { ok: false, msg: 'Keep the name under 25 characters.' };
    if (this.spendCats().some(c => c.label.toLowerCase() === name.toLowerCase())) return { ok: false, msg: 'That category already exists.' };
    const cat = { key: 'c_' + Util.id(), label: name, color: /^#[0-9a-f]{6}$/i.test(color) ? color : CAT_PALETTE[(this.state.customCats || []).length % CAT_PALETTE.length] };
    this.state.customCats = (this.state.customCats || []).concat(cat);
    this.app.store.save();
    return { ok: true, cat };
  }

  periodStart(mode) {
    const d = Util.parseD(Util.today());
    if (mode === 'week') { d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return Util.isoOf(d); }   // Monday
    if (mode === 'month') return Util.isoOf(new Date(d.getFullYear(), d.getMonth(), 1));
    if (mode === 'year') return Util.isoOf(new Date(d.getFullYear(), 0, 1));
    return '';
  }

  nextSpendReset(mode) {
    const d = Util.parseD(Util.today());
    if (mode === 'week') { d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 7); return Util.isoOf(d); }
    if (mode === 'month') return Util.isoOf(new Date(d.getFullYear(), d.getMonth() + 1, 1));
    if (mode === 'year') return Util.isoOf(new Date(d.getFullYear() + 1, 0, 1));
    return '';
  }

  // Chart only counts spending on/after this date ('' = everything), from the auto-reset period.
  spendFrom() { return this.periodStart(this.state.spendPeriod || 'all'); }

  // "Reset now" stamps a time; spending logged before it is hidden from the chart (transactions are kept).
  spendCounts(t) {
    const from = this.spendFrom();
    if (from && (t.date || '') < from) return false;
    const r = this.state.spendResetTs || 0;
    if (r) return t.ts ? t.ts >= r : (t.date || '') > Util.isoOf(new Date(r));
    return true;
  }

  // Expenses-only category breakdown (amt < 0). Loans and internal transfers
  // are excluded — they move your own money, they aren't spending. Shared by
  // the compact "Spending" metric tile and its full detail dialog.
  computeSpendBreakdown() {
    const catTotals = {};
    this.state.accounts.forEach(a => (a.tx||[]).forEach(t => {
      if (t.amt < 0 && !t.loan && !t.transfer && this.spendCounts(t)) {
        const key = this.spendCatLabel(t.cat) ? t.cat : 'other';
        catTotals[key] = (catTotals[key] || 0) + Math.abs(t.amt);
      }
    }));
    const spendTotal = Object.values(catTotals).reduce((s,v) => s+v, 0);
    let acc = 0;
    const stops = [];
    const legend = [];
    this.spendCats().forEach(c => {
      const amt = catTotals[c.key] || 0;
      if (!amt) return;
      const pct = amt / spendTotal;
      const start = acc * 360;
      acc += pct;
      const end = acc * 360;
      stops.push(`${c.color} ${start}deg ${end}deg`);
      legend.push(`
      <div class="pie-legend-row">
        <span class="pie-dot" style="background:${c.color}"></span>
        <span class="pie-label">${Util.esc(c.label)}</span>
        <span class="pie-val">${this.app.store.money(amt)} · ${Math.round(pct*100)}%</span>
      </div>`);
    });
    return { catTotals, spendTotal, stops, legendHtml: legend.join('') };
  }

  showSpendingDetail() {
    const spend = this.computeSpendBreakdown();
    const dlg = document.querySelector('.dialog');
    if (dlg) dlg.classList.add('dialog-wide');
    const mode = this.state.spendPeriod || 'all';
    const resetD = this.state.spendResetTs ? Util.isoOf(new Date(this.state.spendResetTs)) : '';
    const from = [this.spendFrom(), resetD].sort().pop();
    const fmt = iso => Util.parseD(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const nxt = this.nextSpendReset(mode);
    const range = (from ? 'Since ' + fmt(from) : 'All time') + (nxt ? ' · next reset ' + fmt(nxt) : '');
    const chart = spend.spendTotal
      ? `<div class="pie-wrap">
         <div class="pie" style="background:conic-gradient(${spend.stops.join(', ')});">
           <div class="donut-hole">
             <div class="donut-center">
               <div class="donut-total">${this.app.store.money(spend.spendTotal)}</div>
               <div class="donut-sub">spent</div>
             </div>
           </div>
         </div>
         <div class="pie-legend">${spend.legendHtml}</div>
       </div>`
      : '<div class="empty">No spending recorded in this period</div>';
    Dom.byId('dlgTitle').textContent = 'Spending by Category';
    Dom.byId('dlgBody').innerHTML = chart + `<div class="spend-tools"><div class="spend-range">${range}</div><div class="spend-range">Change the reset schedule or categories in Settings.</div></div>`;
    Dom.byId('backdrop').classList.add('open');
  }

  // Settings → Spending categories: add / delete custom categories.
  showCategoryManager() {
    const customs = this.state.customCats || [];
    const dlg = document.querySelector('.dialog');
    if (dlg) dlg.classList.remove('dialog-wide');
    Dom.byId('dlgTitle').textContent = 'Spending Categories';
    Dom.byId('dlgBody').innerHTML = `
    <div class="spend-tools" style="margin-top:0;padding-top:0;border-top:0;">
      <div class="field wide"><label>Built-in</label>
        <div class="cat-chips">${BASE_SPEND_CATS.map(c => `<span class="cat-chip" style="padding-right:10px;"><span class="pie-dot" style="background:${c.color}"></span>${Util.esc(c.label)}</span>`).join('')}</div>
      </div>
      <div class="field wide"><label>Your categories</label>
        <div class="cat-chips">${customs.length ? customs.map(c => `<span class="cat-chip"><span class="pie-dot" style="background:${c.color}"></span>${Util.esc(c.label)}<button type="button" data-delcat="${c.key}" title="Delete category" aria-label="Delete ${Util.esc(c.label)}">✕</button></span>`).join('') : '<span class="spend-range">None yet — add one below.</span>'}</div>
      </div>
      <div class="cat-add">
        <div class="field"><input id="spCatName" type="text" maxlength="24" placeholder="New category name"></div>
        <input id="spCatColor" type="color" value="${CAT_PALETTE[customs.length % CAT_PALETTE.length]}" aria-label="Category color">
        <button class="btn btn-gold" id="spCatAdd">Add</button>
      </div>
      <div class="spend-range" id="spMsg"></div>
    </div>`;
    const body = Dom.byId('dlgBody');
    const add = () => {
      const r = this.addSpendCategory(body.querySelector('#spCatName').value, body.querySelector('#spCatColor').value);
      if (!r.ok) { const m = body.querySelector('#spMsg'); m.textContent = r.msg; m.style.color = 'var(--coral)'; return; }
      this.app.settings.refreshSettingsUI(); this.showCategoryManager();
    };
    body.querySelector('#spCatAdd').onclick = add;
    body.querySelector('#spCatName').onkeydown = e => { if (e.key === 'Enter') add(); };
    body.querySelectorAll('[data-delcat]').forEach(b => b.onclick = () => {
      const c = (this.state.customCats || []).find(x => x.key === b.dataset.delcat);
      if (!c || !confirm(`Delete "${c.label}"?\n\nExisting spending in it will be counted under Other.`)) return;
      this.state.customCats = this.state.customCats.filter(x => x.key !== c.key); this.app.store.save(); this.app.settings.refreshSettingsUI(); this.app.home.drawHome(); this.showCategoryManager();
    });
    Dom.byId('backdrop').classList.add('open');
  }
}
