import { Component } from '../../core/Component.js';
import { COLORS } from '../../core/constants.js';
import { Util } from '../../core/Util.js';
import { Dom } from '../../core/Dom.js';

export class WalletView extends Component {
  /** Wires DOM events and applies initial state. Called once by App.start(). */
  init() {
    Dom.byId('btnAddAcc').onclick = () => {
      Dom.byId('sheetTransfer').classList.remove('open');
      Dom.byId('sheetAcc').classList.toggle('open');
    };
    Dom.byId('cancelAcc').onclick = () => Dom.byId('sheetAcc').classList.remove('open');
    Dom.byId('saveAcc').onclick = () => {
      const name = Dom.byId('a-name').value.trim() || 'Account';
      const type = Dom.byId('a-type').value;
      const start = parseFloat(Dom.byId('a-start').value) || 0;
      const acc = { id: Util.id(), name, type, tx: [] };
      if (start) acc.tx.push({ id: Util.id(), desc: 'Opening balance', amt: start, date: Util.today() });
      this.state.accounts.push(acc);
      this.app.store.save(); this.app.store.log(`Account · ${name}`, COLORS[4]);
      Dom.byId('sheetAcc').classList.remove('open');
      Dom.byId('a-name').value = '';
      Dom.byId('a-start').value = '';
      this.drawWallet(); this.app.home.drawHome();
    };
    Dom.byId('btnTransfer').onclick = () => {
      if (this.state.accounts.length < 2) return;
      Dom.byId('sheetAcc').classList.remove('open');
      const sheet = Dom.byId('sheetTransfer');
      const opening = !sheet.classList.contains('open');
      if (opening) {
        this.fillTransferSelects();
        Dom.byId('xf-amt').value = '';
        Dom.byId('xf-note').value = '';
        this.syncTransferToOptions();
      }
      sheet.classList.toggle('open');
    };
    Dom.byId('xf-from').onchange = this.syncTransferToOptions;
    Dom.byId('cancelTransfer').onclick = () => Dom.byId('sheetTransfer').classList.remove('open');
    Dom.byId('saveTransfer').onclick = () => {
      const fromId = Dom.byId('xf-from').value;
      const toId = Dom.byId('xf-to').value;
      const amt = parseFloat(Dom.byId('xf-amt').value) || 0;
      const note = Dom.byId('xf-note').value.trim();
      if (amt <= 0 || !fromId || !toId || fromId === toId) return;
      const src = this.state.accounts.find(x => x.id === fromId);
      const dst = this.state.accounts.find(x => x.id === toId);
      if (!src || !dst) return;
      // Allow overdraft — same rule as regular expenses (negative balances ok)
      src.tx = src.tx || [];
      dst.tx = dst.tx || [];
      const srcDesc = note ? `Transfer to ${dst.name}: ${note}` : `Transfer to ${dst.name}`;
      const dstDesc = note ? `Transfer from ${src.name}: ${note}` : `Transfer from ${src.name}`;
      src.tx.push({ id: Util.id(), desc: srcDesc, amt: -amt, date: Util.today(), transfer: true });
      dst.tx.push({ id: Util.id(), desc: dstDesc, amt: amt, date: Util.today(), transfer: true });
      this.app.store.save(); this.app.store.log(`⇄ ${this.app.store.money(amt)} · ${src.name} → ${dst.name}`, COLORS[2]);
      Dom.byId('sheetTransfer').classList.remove('open');
      Dom.byId('xf-amt').value = '';
      Dom.byId('xf-note').value = '';
      this.drawWallet(); this.app.home.drawHome();
    };
  }

  accTypeLabel(t) {
    return t === 'cash' ? 'On Hand' : t === 'save' ? 'Savings' : 'Other';
  }

  drawWallet() {
    const list = Dom.byId('accList');
    let total = 0;
    this.state.accounts.forEach(a => total += Util.bal(a));
    const el = Dom.byId('walletTotal');
    el.textContent = this.app.store.money(total);
    el.classList.toggle('neg', total < 0);

    // Transfer needs at least 2 accounts — hide/disable otherwise
    const btnXfer = Dom.byId('btnTransfer');
    if (btnXfer) {
      const canXfer = this.state.accounts.length >= 2;
      btnXfer.disabled = !canXfer;
      btnXfer.style.opacity = canXfer ? '' : '0.4';
      btnXfer.title = canXfer ? 'Move money between accounts' : 'Add another account to transfer';
    }

    list.innerHTML = this.state.accounts.length ? this.state.accounts.map(a => {
      const b = Util.bal(a);
      return `<div class="account">
      <div class="account-top">
        <div>
          <div class="account-name">${Util.esc(a.name)}</div>
          <span class="account-type t-${a.type}">${a.type==='cash'?'On Hand':a.type==='save'?'Savings':'Other'}</span>
        </div>
        <div class="account-bal${b<0?' neg':''}">${this.app.store.money(b)}</div>
      </div>
      <div class="money-ops">
        <button class="m-btn in" data-in="${a.id}">+ In</button>
        <button class="m-btn out" data-out="${a.id}">− Out</button>
        <button class="m-btn loan" data-loan="${a.id}">Loan</button>
      </div>
      <div class="m-sub">
        <button data-hist="${a.id}">History</button>
        <button data-dela="${a.id}">Delete</button>
      </div>
      <div class="tx-form" id="tx-${a.id}"></div>
    </div>`;
    }).join('') : '<div class="empty">Add an account to start tracking</div>';

    // Income / Expense — note is required, compact single-line fields
    list.querySelectorAll('[data-in],[data-out]').forEach(btn => {
      btn.onclick = () => {
        const aid = btn.dataset.in || btn.dataset.out;
        const isIn = !!btn.dataset.in;
        const form = Dom.byId('tx-'+aid);
        form.classList.add('open');
        form.innerHTML = `
        <div class="fields">
          <div class="field"><label>Amount</label><input type="number" step="0.01" min="0" class="amt" placeholder="0.00" required></div>
          <div class="field wide"><label>Note (required)</label><input class="note" placeholder="e.g. Lunch, allowance from mom" required></div>
          ${!isIn ? `<div class="field wide"><label>Category</label>
            <select class="cat">
              ${[this.app.spending.spendCats().find(c=>c.key==='other'), ...this.app.spending.spendCats().filter(c=>c.key!=='other')].map(c => `<option value="${c.key}">${Util.esc(c.label)}</option>`).join('')}
            </select>
          </div>` : ''}
        </div>
        <div class="form-foot">
          <button class="btn btn-gold conf">${isIn?'Add In':'Add Out'}</button>
          <button class="btn btn-ghost can">Cancel</button>
        </div>`;
        form.querySelector('.can').onclick = () => form.classList.remove('open');
        form.querySelector('.conf').onclick = () => {
          const amt = parseFloat(form.querySelector('.amt').value) || 0;
          const note = form.querySelector('.note').value.trim();
          if (amt <= 0) return;
          if (!note) { form.querySelector('.note').focus(); return; }
          const acc = this.state.accounts.find(x => x.id === aid);
          if (!acc) return;
          acc.tx = acc.tx || [];
          const tx = { id: Util.id(), desc: note, amt: isIn ? amt : -amt, date: Util.today(), ts: Date.now() };
          if (!isIn) tx.cat = form.querySelector('.cat')?.value || 'other';
          acc.tx.push(tx);
          this.app.store.save(); this.app.store.log(`${isIn?'+':'-'}${this.app.store.money(amt)} · ${acc.name}`, isIn?COLORS[4]:COLORS[1]);
          this.drawWallet(); this.app.home.drawHome();
        };
      };
    });

    // Loan out — person, amount, purpose
    list.querySelectorAll('[data-loan]').forEach(btn => {
      btn.onclick = () => {
        const aid = btn.dataset.loan;
        const form = Dom.byId('tx-'+aid);
        form.classList.add('open');
        form.innerHTML = `
        <div class="fields">
          <div class="field"><label>Who</label><input class="who" placeholder="Friend's name" required></div>
          <div class="field"><label>Amount</label><input type="number" step="0.01" min="0" class="amt" placeholder="0.00" required></div>
          <div class="field wide"><label>For (required)</label><input class="purpose" placeholder="e.g. Textbook, lunch money" required></div>
        </div>
        <div class="form-foot">
          <button class="btn btn-gold conf">Record loan</button>
          <button class="btn btn-ghost can">Cancel</button>
        </div>`;
        form.querySelector('.can').onclick = () => form.classList.remove('open');
        form.querySelector('.conf').onclick = () => {
          const who = form.querySelector('.who').value.trim();
          const amt = parseFloat(form.querySelector('.amt').value) || 0;
          const purpose = form.querySelector('.purpose').value.trim();
          if (!who || amt <= 0 || !purpose) return;
          const acc = this.state.accounts.find(x => x.id === aid);
          if (!acc) return;
          // Deduct from account
          acc.tx = acc.tx || [];
          acc.tx.push({ id: Util.id(), desc: `Loan to ${who}: ${purpose}`, amt: -amt, date: Util.today(), loan: true });
          // Track as receivable
          this.state.loans = this.state.loans || [];
          this.state.customCats = Array.isArray(this.state.customCats) ? this.state.customCats : [];
          this.state.spendPeriod = ['all','week','month','year'].includes(this.state.spendPeriod) ? this.state.spendPeriod : 'all';
          this.state.spendResetTs = Number(this.state.spendResetTs) || 0;
          this.state.loans.push({
            id: Util.id(), who, amt, purpose, date: Util.today(),
            accountId: aid, settled: false
          });
          this.app.store.save(); this.app.store.log(`Loan · ${who} · ${this.app.store.money(amt)}`, COLORS[3]);
          this.drawWallet(); this.app.home.drawHome();
        };
      };
    });

    list.querySelectorAll('[data-hist]').forEach(btn => {
      btn.onclick = () => {
        const acc = this.state.accounts.find(a => a.id === btn.dataset.hist);
        if (!acc) return;
        Dom.byId('dlgTitle').textContent = acc.name + ' · History';
        const txs = [...(acc.tx||[])].reverse();
        Dom.byId('dlgBody').innerHTML = txs.length
          ? txs.map(t => `
          <div class="tx-row">
            <span class="tx-amt ${t.amt>=0?'pos':'neg'}">${t.amt>=0?'+':''}${this.app.store.money(t.amt)}</span>
            <span class="tx-desc">${Util.esc(t.desc)}${t.cat && this.app.spending.spendCatLabel(t.cat) && !t.transfer && !t.loan ? ' · ' + Util.esc(this.app.spending.spendCatLabel(t.cat)) : ''}</span>
            <span class="tx-date">${t.date}</span>
          </div>`).join('')
          : '<div class="empty">No transactions</div>';
        Dom.byId('backdrop').classList.add('open');
      };
    });

    list.querySelectorAll('[data-dela]').forEach(btn => {
      btn.onclick = () => {
        if (!confirm('Delete this account?')) return;
        this.state.accounts = this.state.accounts.filter(a => a.id !== btn.dataset.dela);
        this.app.store.save(); this.drawWallet(); this.app.home.drawHome();
      };
    });

    // Outstanding loans
    const openLoans = (this.state.loans || []).filter(l => !l.settled);
    const loansSec = Dom.byId('loansSection');
    const loansList = Dom.byId('loansList');
    if (openLoans.length) {
      loansSec.style.display = 'block';
      loansList.innerHTML = openLoans.map(l => `
      <div class="loan-card">
        <div class="loan-who">${Util.esc(l.who)}</div>
        <div class="loan-amt">${this.app.store.money(l.amt)}</div>
        <div class="loan-meta">${Util.esc(l.purpose)} · ${l.date}</div>
        <div class="loan-ops">
          <button class="btn btn-gold" data-settle="${l.id}" style="padding:8px 12px;font-size:0.8rem;">Mark repaid</button>
          <button class="btn btn-ghost" data-delloan="${l.id}" style="padding:8px 12px;font-size:0.8rem;">Remove</button>
        </div>
      </div>`).join('');

      loansList.querySelectorAll('[data-settle]').forEach(btn => {
        btn.onclick = () => {
          const loan = this.state.loans.find(l => l.id === btn.dataset.settle);
          if (!loan) return;
          loan.settled = true;
          // Add money back to the account it came from
          const acc = this.state.accounts.find(a => a.id === loan.accountId);
          if (acc) {
            acc.tx = acc.tx || [];
            acc.tx.push({ id: Util.id(), desc: `Repaid by ${loan.who}: ${loan.purpose}`, amt: loan.amt, date: Util.today() });
          }
          this.app.store.save(); this.app.store.log(`Repaid · ${loan.who} · ${this.app.store.money(loan.amt)}`, COLORS[4]);
          this.drawWallet(); this.app.home.drawHome();
        };
      });
      loansList.querySelectorAll('[data-delloan]').forEach(btn => {
        btn.onclick = () => {
          if (!confirm('Remove this loan record?')) return;
          this.state.loans = this.state.loans.filter(l => l.id !== btn.dataset.delloan);
          this.app.store.save(); this.drawWallet();
        };
      });
    } else {
      loansSec.style.display = 'none';
    }
  }

  fillTransferSelects(preferFromId) {
    const fromSel = Dom.byId('xf-from');
    const toSel = Dom.byId('xf-to');
    const opts = this.state.accounts.map(a =>
      `<option value="${a.id}">${Util.esc(a.name)} (${this.accTypeLabel(a.type)}) · ${this.app.store.money(Util.bal(a))}</option>`
    ).join('');
    fromSel.innerHTML = opts;
    toSel.innerHTML = opts;
    if (preferFromId) fromSel.value = preferFromId;
    // Default To to a different account than From
    const fromId = fromSel.value;
    const other = this.state.accounts.find(a => a.id !== fromId);
    if (other) toSel.value = other.id;
  }

  syncTransferToOptions() {
    const fromId = Dom.byId('xf-from').value;
    const toSel = Dom.byId('xf-to');
    const curTo = toSel.value;
    toSel.innerHTML = this.state.accounts
      .filter(a => a.id !== fromId)
      .map(a => `<option value="${a.id}">${Util.esc(a.name)} (${this.accTypeLabel(a.type)}) · ${this.app.store.money(Util.bal(a))}</option>`)
      .join('');
    if ([...toSel.options].some(o => o.value === curTo)) toSel.value = curTo;
  }
}
