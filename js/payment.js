// payment.js - vanilla JS module to implement purchase flow and Supabase integration

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.46.1/+esm';

// Supabase credentials (shared with moniteex_ai_trading)
const SUPABASE_URL = 'https://fsrkmahzufdgcrrffpey.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzcmttYWh6dWZkZ2NycmZmcGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3MDIxMDgsImV4cCI6MjA2OTI3ODEwOH0.yW6FEwBpG9-SU8eI7BSguosqAYKb5uVM2bSyW-avO6g';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const USD_TO_IRR = 104000; // نرخ تبدیل دلار به تومان

// State
let selectedPlan = '3 Months';
let selectedPrice = '$39';
let paymentMethod = 'card'; // 'card' for rial, 'usdt' for tether
let customerInfo = {
  fullName: '',
  email: '',
  phone: '',
  mt5Account: '',
  investorPassword: '',
  brokerName: '',
  serverName: ''
};
let discount = {
  code: '',
  applied: false,
  info: null
};
let confirmation = {
  transactionId: '',
  senderName: '',
  transactionHash: ''
};

// Helpers
const parseUSD = (priceStr) => {
  const m = String(priceStr).match(/\$\s*(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
};
const formatUSD = (n) => `$${Number(n).toFixed(2)}`;
const nowInvoiceNumber = () => `INV-${Date.now().toString().slice(-8)}`;
const nowDateStr = () => new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

const calculateFinalUSD = () => {
  const base = parseUSD(selectedPrice);
  if (!discount.applied || !discount.info) return base;
  const d = discount.info;
  if (d.discount_type === 'percentage' && d.discount_percentage) {
    return Math.max(0, base * (1 - d.discount_percentage / 100));
  }
  if (d.discount_type === 'amount' && d.discount_amount) {
    return Math.max(0, base - d.discount_amount);
  }
  return base;
};

// UI Injection
const injectStyles = () => {
  const style = document.createElement('style');
  style.textContent = `
    .mmodal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.6);z-index:9999}
    .mmodal.open{display:flex}
    .mmodal-card{width:95%;max-width:720px;background:#0b0b12;color:#fff;border:1px solid rgba(255,255,255,.08);border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,.35);overflow:hidden}
    .mmodal-header{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid rgba(255,255,255,.08)}
    .mmodal-title{font-weight:700;font-size:18px}
    .mmodal-body{padding:16px 20px}
    .mmodal-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .mmodal-grid .full{grid-column:1/-1}
    .mmodal-label{font-size:12px;color:#c7c7d1;margin-bottom:6px}
    .mmodal-input{width:100%;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.08);background:#0f0f18;color:#f0f0f5}
    .mmodal-radio{display:flex;gap:12px;margin:8px 0 4px}
    .mmodal-radio label{display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid rgba(255,255,255,.08);border-radius:10px;background:#0f0f18;cursor:pointer}
    .mmodal-footer{padding:14px 20px;border-top:1px solid rgba(255,255,255,.08);display:flex;gap:10px;justify-content:flex-end}
    .mmodal-btn{padding:10px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:#151527;color:#fff;cursor:pointer}
    .mmodal-btn.primary{background:#7c3aed}
    .minvoice{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.6);z-index:9999}
    .minvoice.open{display:flex}
    .minvoice-card{width:95%;max-width:860px;background:#0b0b12;color:#fff;border:1px solid rgba(255,255,255,.08);border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,.35);overflow:hidden}
    .minvoice-header{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid rgba(255,255,255,.08)}
    .minvoice-title{font-weight:700;font-size:18px}
    .minvoice-body{padding:16px 20px}
    .minvoice-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .minvoice-summary{margin-top:10px;padding:12px;border-radius:12px;background:#0f0f18;border:1px solid rgba(255,255,255,.06)}
    .info-row{display:flex;justify-content:space-between;margin:6px 0;color:#c7c7d1}
    .minvoice-footer{padding:14px 20px;border-top:1px solid rgba(255,255,255,.08);display:flex;gap:10px;justify-content:flex-end}
    .hint{font-size:12px;color:#c7c7d1}
    .success{background:#0f1a0f;color:#9ef09e;border:1px solid #2e7d32;padding:10px;border-radius:10px;margin-top:8px}
    .pay-info{display:grid;grid-template-columns:1fr;gap:10px}
    .pay-box{border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:10px;background:#0f0f18}
    .pay-title{font-weight:600;color:#e5e7eb;margin-bottom:6px}
    .pay-value{display:flex;justify-content:space-between;align-items:center;font-family:monospace;background:#0b0b12;border:1px solid rgba(255,255,255,.06);padding:8px;border-radius:10px}
    .copy-btn{border:none;background:#1f2937;color:#fff;padding:6px 10px;border-radius:8px;cursor:pointer}
    .copy-btn:hover{background:#374151}
  `;
  document.head.appendChild(style);
};

const createPaymentModal = () => {
  const wrap = document.createElement('div');
  wrap.className = 'mmodal';
  wrap.id = 'paymentModal';
  wrap.innerHTML = `
    <div class="mmodal-card fa-text">
      <div class="mmodal-header">
        <div class="mmodal-title">پرداخت</div>
        <button class="mmodal-btn" id="mmodalClose">بستن</button>
      </div>
      <div class="mmodal-body">
        <div class="hint">پلن انتخابی: <span id="mmodalSelectedPlan"></span> — قیمت: <span id="mmodalSelectedPrice"></span></div>
        <div class="mmodal-radio" role="group" aria-label="روش پرداخت">
          <label><input type="radio" name="payMethod" value="card" checked> کارت‌به‌کارت (تومانی)</label>
          <label><input type="radio" name="payMethod" value="usdt"> USDT (BEP20)</label>
        </div>
        <div class="mmodal-grid">
          <div>
            <div class="mmodal-label">نام کامل</div>
            <input class="mmodal-input" id="mmName" placeholder="نام و نام خانوادگی" />
          </div>
          <div>
            <div class="mmodal-label">ایمیل</div>
            <input class="mmodal-input" id="mmEmail" placeholder="name@example.com" />
          </div>
          <div>
            <div class="mmodal-label">تلفن</div>
            <input class="mmodal-input" id="mmPhone" placeholder="0912..." />
          </div>
          <div>
            <div class="mmodal-label">شماره حساب MT5</div>
            <input class="mmodal-input" id="mmMt5" placeholder="12345678" />
          </div>
          <div>
            <div class="mmodal-label">رمز Investor</div>
            <input class="mmodal-input" id="mmInvestor" placeholder="********" />
          </div>
          <div>
            <div class="mmodal-label">نام بروکر</div>
            <input class="mmodal-input" id="mmBroker" placeholder="Exness" />
          </div>
          <div>
            <div class="mmodal-label">نام سرور</div>
            <input class="mmodal-input" id="mmServer" placeholder="Exness-MT5" />
          </div>
          <div class="full">
            <div class="hint">با زدن ادامه، خلاصه سفارش و اطلاعات پرداخت نمایش داده می‌شود.</div>
          </div>
        </div>
      </div>
      <div class="mmodal-footer">
        <button class="mmodal-btn" id="mmodalCancel">انصراف</button>
        <button class="mmodal-btn primary" id="mmodalContinue">ادامه خرید</button>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);
  // Harden input types and autocomplete to improve privacy
  const setAttrs = (id, attrs) => { const el = document.getElementById(id); if (!el) return; Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k, v)); };
  setAttrs('mmName', { type: 'text', autocomplete: 'name' });
  setAttrs('mmEmail', { type: 'email', autocomplete: 'email' });
  setAttrs('mmPhone', { type: 'tel', inputmode: 'numeric', autocomplete: 'tel' });
  setAttrs('mmMt5', { type: 'text', inputmode: 'numeric' });
  setAttrs('mmInvestor', { type: 'password', autocomplete: 'new-password' });
  setAttrs('mmBroker', { type: 'text' });
  setAttrs('mmServer', { type: 'text' });
};

const createInvoiceOverlay = () => {
  const wrap = document.createElement('div');
  wrap.className = 'minvoice';
  wrap.id = 'invoiceOverlay';
  wrap.innerHTML = `
    <div class="minvoice-card fa-text">
      <div class="minvoice-header">
        <div class="minvoice-title">فاکتور و تأیید پرداخت</div>
        <button class="mmodal-btn" id="invoiceClose">بستن</button>
      </div>
      <div class="minvoice-body">
        <div class="minvoice-grid">
          <div>
            <div class="hint">اطلاعات مشتری</div>
            <div class="minvoice-summary" id="summaryCustomer"></div>
          </div>
          <div>
            <div class="hint">جزییات اشتراک</div>
            <div class="minvoice-summary" id="summaryPlan"></div>
          </div>
        </div>
        <div class="minvoice-grid">
          <div>
            <div class="mmodal-label">کد تخفیف</div>
            <div style="display:flex;gap:8px">
              <input class="mmodal-input" id="discountCode" placeholder="کد تخفیف را وارد کنید" />
              <button class="mmodal-btn" id="applyDiscount">اعمال</button>
            </div>
            <div id="discountInfo" class="hint" style="margin-top:6px"></div>
          </div>
          <div>
            <div class="mmodal-label">مبلغ قابل پرداخت</div>
            <div class="minvoice-summary" id="summaryPrice"></div>
          </div>
        </div>
        <div class="minvoice-grid" style="margin-top:8px">
          <div>
            <div class="mmodal-label">شماره تراکنش *</div>
            <input class="mmodal-input" id="confirmTxId" placeholder="شماره تراکنش" />
          </div>
          <div id="confirmSenderWrap">
            <div class="mmodal-label">نام فرستنده *</div>
            <input class="mmodal-input" id="confirmSender" placeholder="نام کامل فرستنده" />
          </div>
          <div id="confirmHashWrap" class="full" style="display:none">
            <div class="mmodal-label">هش تراکنش USDT *</div>
            <input class="mmodal-input" id="confirmHash" placeholder="Transaction Hash" />
          </div>
        </div>
        <div class="minvoice-summary" style="margin-top:10px">
          <div class="hint">روش پرداخت: <span id="summaryMethod"></span></div>
          <div class="pay-info" style="margin-top:8px">
            <div id="bankInfo" class="pay-box">
              <div class="pay-title">کارت جهت کارت‌به‌کارت</div>
              <div class="pay-value">
                <span id="cardNumber">6219861984536515</span>
                <button class="copy-btn" id="copyCard">کپی</button>
              </div>
              <div class="hint">به نام Ali Khademi — بانک سامان</div>
            </div>
            <div id="usdtInfo" class="pay-box">
              <div class="pay-title">آدرس کیف پول USDT (BEP20)</div>
              <div class="pay-value">
                <span id="usdtAddress">0xB27f11B1Dcf170b7203448ec1A2784e180ca8363</span>
                <button class="copy-btn" id="copyUsdt">کپی</button>
              </div>
            </div>
          </div>
        </div>
        <div id="submitStatus" style="margin-top:8px"></div>
      </div>
      <div class="minvoice-footer">
        <button class="mmodal-btn" id="invoiceBack">بازگشت</button>
        <button class="mmodal-btn primary" id="submitPayment">ارسال اطلاعات پرداخت</button>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);
};

// Success modal (final message like moniteex_ai_trading)
const createSuccessModal = () => {
  const wrap = document.createElement('div');
  wrap.className = 'mmodal';
  wrap.id = 'successModal';
  wrap.innerHTML = `
    <div class="mmodal-card fa-text">
      <div class="mmodal-header">
        <div class="mmodal-title">🎉 خوش آمدید به پلتفرم ما!</div>
        <button class="mmodal-btn" id="successClose">بستن</button>
      </div>
      <div class="mmodal-body">
        <div id="successHello" class="hint" style="font-size:16px;font-weight:700;color:#fff;margin-bottom:8px"></div>
        <div class="hint">اطلاعات پرداخت شما با موفقیت ارسال شد.</div>
        <div class="hint" style="margin-top:6px">جزئیات حساب شما تا ۱۲ ساعت آینده به <span id="successEmail"></span> ارسال می‌شود.</div>
      </div>
      <div class="mmodal-footer">
        <button class="mmodal-btn primary" id="successGoHome">بستن و رفتن به صفحه اصلی</button>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);
};
const openSuccessModal = (name, email) => {
  document.getElementById('successHello').textContent = `سلام ${name}!`;
  document.getElementById('successEmail').textContent = email;
  document.getElementById('successModal').classList.add('open');
};

// Open/Close helpers
const openPaymentModal = () => {
  document.getElementById('mmodalSelectedPlan').textContent = selectedPlan;
  document.getElementById('mmodalSelectedPrice').textContent = selectedPrice;
  document.getElementById('paymentModal').classList.add('open');
};
const closePaymentModal = () => document.getElementById('paymentModal').classList.remove('open');
const openInvoice = () => {
  // fill summaries
  const sc = document.getElementById('summaryCustomer');
  const E = (s) => String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;')
    .replace(/`/g,'&#96;');
  sc.innerHTML = `
    <div class="info-row"><span>نام:</span><span>${E(customerInfo.fullName)}</span></div>
    <div class="info-row"><span>ایمیل:</span><span>${E(customerInfo.email)}</span></div>
    <div class="info-row"><span>تلفن:</span><span>${E(customerInfo.phone)}</span></div>
    <div class="info-row"><span>MT5:</span><span>${E(customerInfo.mt5Account)}</span></div>
    <div class="info-row"><span>Investor:</span><span>${E(customerInfo.investorPassword)}</span></div>
  `;
  const sp = document.getElementById('summaryPlan');
  sp.innerHTML = `
    <div class="info-row"><span>پلن:</span><span>${E(selectedPlan)}</span></div>
    <div class="info-row"><span>روش پرداخت:</span><span id="summaryMethodTxt">${paymentMethod === 'card' ? 'کارت‌به‌کارت' : 'USDT'}</span></div>
    <div class="info-row"><span>قیمت اولیه:</span><span>${E(selectedPrice)}</span></div>
  `;
  document.getElementById('summaryMethod').textContent = paymentMethod === 'card' ? 'کارت‌به‌کارت (تومانی)' : 'USDT (BEP20)';
  updateSummaryPrice();
  // toggle confirmations
  document.getElementById('confirmSenderWrap').style.display = paymentMethod === 'card' ? 'block' : 'none';
  document.getElementById('confirmHashWrap').style.display = paymentMethod === 'usdt' ? 'block' : 'none';
  // toggle pay info panels
  const bankBox = document.getElementById('bankInfo');
  const usdtBox = document.getElementById('usdtInfo');
  if (bankBox && usdtBox) {
    bankBox.style.display = paymentMethod === 'card' ? 'block' : 'none';
    usdtBox.style.display = paymentMethod === 'usdt' ? 'block' : 'none';
  }
  document.getElementById('invoiceOverlay').classList.add('open');
};
const closeInvoice = () => document.getElementById('invoiceOverlay').classList.remove('open');

const updateSummaryPrice = () => {
  const originalUSD = parseUSD(selectedPrice);
  const finalUSD = calculateFinalUSD();
  const finalUSDStr = formatUSD(finalUSD);
  // محاسبه دقیق قیمت‌ها به تومان
const originalTomanValue = Math.floor(originalUSD * USD_TO_IRR);
const finalTomanValue = Math.floor(finalUSD * USD_TO_IRR);
// نمایش اعداد به فرمت فارسی بدون صفر اضافی
const originalToman = originalTomanValue.toLocaleString('fa-IR');
const finalToman = finalTomanValue.toLocaleString('fa-IR');

  let html = '';
  const infoEl = document.getElementById('discountInfo');

  if (discount.applied && discount.info) {
    const dLabel = discount.info.discount_type === 'percentage'
      ? `${discount.info.discount_percentage}%`
      : `${formatUSD(discount.info.discount_amount)}`;
    if (infoEl) infoEl.textContent = 'کد تخفیف با موفقیت اعمال شد.';
    html = `
      <div class="info-row"><span>قیمت اولیه (USD):</span><span style="text-decoration:line-through">${formatUSD(originalUSD)}</span></div>
      <div class="info-row"><span>قیمت اولیه (تومان):</span><span style="text-decoration:line-through">${originalToman} تومان</span></div>
      <div class="info-row"><span>تخفیف اعمال‌شده:</span><span>${dLabel}</span></div>
      <div class="info-row"><span>قیمت نهایی (USD):</span><span>${finalUSDStr}</span></div>
      <div class="info-row"><span>قیمت نهایی (تومان):</span><span>${finalToman} تومان</span></div>
    `;
  } else {
    if (infoEl) infoEl.textContent = '';
    html = `
      <div class="info-row"><span>قیمت (USD):</span><span>${formatUSD(originalUSD)}</span></div>
      <div class="info-row"><span>قیمت (تومان):</span><span>${originalToman} تومان</span></div>
    `;
  }

  const summary = document.getElementById('summaryPrice');
  if (summary) summary.innerHTML = html;
};

// Supabase interactions
const applyDiscount = async () => {
  const code = document.getElementById('discountCode').value.trim();
  if (!code) return;
  const infoEl = document.getElementById('discountInfo');
  infoEl.textContent = 'در حال بررسی کد تخفیف...';
  try {
    const { data, error } = await supabase.rpc('check_and_apply_discount_code', { p_code: code });
    if (error) throw error;
    if (data && data.length > 0) {
      const result = data[0];
      if (result.is_valid) {
        discount.code = code;
        discount.applied = true;
        discount.info = {
          discount_type: result.discount_type,
          discount_percentage: result.discount_percentage,
          discount_amount: result.discount_amount
        };
        infoEl.textContent = result.message || 'کد تخفیف با موفقیت اعمال شد.';
        updateSummaryPrice();
      } else {
        discount.code = '';
        discount.applied = false;
        discount.info = null;
        infoEl.textContent = result.message || 'کد تخفیف نامعتبر است.';
        updateSummaryPrice();
      }
    } else {
      infoEl.textContent = 'کد تخفیف نامعتبر است.';
    }
  } catch (err) {
    console.error('Discount error', err);
    infoEl.textContent = 'خطا در بررسی کد تخفیف. دوباره تلاش کنید.';
  }
};

const submitPayment = async () => {
  const statusEl = document.getElementById('submitStatus');
  statusEl.innerHTML = '';

  confirmation.transactionId = document.getElementById('confirmTxId').value.trim();
  confirmation.senderName = document.getElementById('confirmSender')?.value?.trim() || '';
  confirmation.transactionHash = document.getElementById('confirmHash')?.value?.trim() || '';

  if (!confirmation.transactionId || (paymentMethod === 'card' && !confirmation.senderName) || (paymentMethod === 'usdt' && !confirmation.transactionHash)) {
    statusEl.innerHTML = '<div class="success" style="border-color:#7d2222;color:#ffb3b3;background:#1a0f0f">لطفاً همه فیلدهای الزامی تأیید پرداخت را تکمیل کنید.</div>';
    return;
  }

  const invoiceNumber = nowInvoiceNumber();
  const currentDate = nowDateStr();
  const finalUSD = calculateFinalUSD();
  const priceStr = formatUSD(finalUSD);

  const paymentData = {
    invoice_number: invoiceNumber,
    customer_name: customerInfo.fullName,
    customer_email: customerInfo.email,
    customer_phone: customerInfo.phone,
    mt5_account: customerInfo.mt5Account,
    investor_password: customerInfo.investorPassword,
    broker_name: customerInfo.brokerName,
    server_name: customerInfo.serverName,
    plan: selectedPlan,
    price: priceStr,
    payment_method: paymentMethod,
    created_at: currentDate,
    transaction_id: confirmation.transactionId,
    ...(paymentMethod === 'card' ? { sender_name: confirmation.senderName } : { transaction_hash: confirmation.transactionHash })
  };

  try {
    statusEl.innerHTML = '<div class="success">در حال ارسال اطلاعات به Supabase...</div>';
    const { data, error } = await supabase.from('payment_submissions').insert([paymentData]);
    if (error) throw error;
    statusEl.innerHTML = '<div class="success">پرداخت با موفقیت ثبت شد.</div>';
    // reset simple fields
    document.getElementById('confirmTxId').value = '';
    const senderEl = document.getElementById('confirmSender');
    if (senderEl) senderEl.value = '';
    const hashEl = document.getElementById('confirmHash');
    if (hashEl) hashEl.value = '';
    // show final success modal exactly like the original project
    openSuccessModal(customerInfo.fullName, customerInfo.email);
  } catch (err) {
    console.error('Error submitting payment', err);
    statusEl.innerHTML = `<div class="success" style="border-color:#7d2222;color:#ffb3b3;background:#1a0f0f">خطا در ارسال اطلاعات: ${err.message || 'لطفاً دوباره تلاش کنید.'}</div>`;
  }
};

// Wire events
const wirePaymentModalEvents = () => {
  const modal = document.getElementById('paymentModal');
  document.getElementById('mmodalClose').onclick = () => closePaymentModal();
  document.getElementById('mmodalCancel').onclick = () => closePaymentModal();
  document.getElementById('mmodalContinue').onclick = () => {
    // collect customer info
    customerInfo = {
      fullName: document.getElementById('mmName').value.trim(),
      email: document.getElementById('mmEmail').value.trim(),
      phone: document.getElementById('mmPhone').value.trim(),
      mt5Account: document.getElementById('mmMt5').value.trim(),
      investorPassword: document.getElementById('mmInvestor').value.trim(),
      brokerName: document.getElementById('mmBroker').value.trim(),
      serverName: document.getElementById('mmServer').value.trim()
    };
    // basic validation
    if (!customerInfo.fullName || !customerInfo.email || !customerInfo.phone || !customerInfo.mt5Account || !customerInfo.investorPassword) {
      alert('لطفاً فیلدهای ضروری را تکمیل کنید.');
      return;
    }
    closePaymentModal();
    openInvoice();
  };
  // payment method radio
  modal.querySelectorAll('input[name="payMethod"]').forEach(r => {
    r.addEventListener('change', (e) => {
      paymentMethod = e.target.value;
    });
  });
};

const wireInvoiceEvents = () => {
  document.getElementById('invoiceClose').onclick = () => closeInvoice();
  document.getElementById('invoiceBack').onclick = () => {
    closeInvoice();
    openPaymentModal();
  };
  document.getElementById('applyDiscount').onclick = applyDiscount;
  document.getElementById('submitPayment').onclick = submitPayment;
  const copyCard = document.getElementById('copyCard');
  if (copyCard) copyCard.onclick = () => navigator.clipboard.writeText(document.getElementById('cardNumber').textContent || '');
  const copyUsdt = document.getElementById('copyUsdt');
  if (copyUsdt) copyUsdt.onclick = () => navigator.clipboard.writeText(document.getElementById('usdtAddress').textContent || '');
};

const wireSuccessEvents = () => {
  const closeBtn = document.getElementById('successClose');
  const goHomeBtn = document.getElementById('successGoHome');
  if (closeBtn) closeBtn.onclick = () => document.getElementById('successModal').classList.remove('open');
  if (goHomeBtn) goHomeBtn.onclick = () => {
    document.getElementById('successModal').classList.remove('open');
    closeInvoice();
    window.location.reload();
  };
};

const findPricingCardsAndAttach = () => {
  const cards = Array.from(document.querySelectorAll('.pricing-card'));
  if (!cards.length) return;
  cards.forEach(card => {
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
      // Try to read plan and price from card
      const titleEl = card.querySelector('.pricing-title-text');
      const priceEl = card.querySelector('.pricing-price-text');
      const priceTxt = priceEl ? priceEl.textContent : card.textContent;
      const usdMatch = priceTxt.match(/\$\s*(\d+(?:\.\d+)?)/);
      selectedPlan = titleEl ? titleEl.textContent.trim() : 'Subscription';
      selectedPrice = usdMatch ? `$${usdMatch[1]}` : selectedPrice;
      openPaymentModal();
    });
  });
};

// Boot
document.addEventListener('DOMContentLoaded', () => {
  injectStyles();
  createPaymentModal();
  createInvoiceOverlay();
  createSuccessModal();
  wirePaymentModalEvents();
  wireInvoiceEvents();
  wireSuccessEvents();
  findPricingCardsAndAttach();
});

// Replace testimonial avatars with a simple placeholder
(function replaceTestimonialAvatars(){
  const run = () => {
    const placeholder = 'images/avatar-placeholder.svg';
    // Target ONLY author avatar images
    const selectors = [
      '.testimonial-author-image-wrap img',
      'img.testimonial-author-image'
    ];
    let replacedCount = 0;
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(img => {
        // Ensure not inside rating/icon areas
        const inIconArea = img.closest('.testimonial-icon-wrap') || img.closest('.testimonial-icon-flex') || img.classList.contains('testimonial-icon');
        if (inIconArea) return;
        const inAuthor = img.closest('.testimonial-author-image-wrap') || img.classList.contains('testimonial-author-image');
        if (!inAuthor) return;
        img.src = placeholder;
        if (img.srcset) img.removeAttribute('srcset');
        img.alt = 'User avatar';
        replacedCount++;
      });
    });
    // Optional: if avatars are background images on author wrapper
    document.querySelectorAll('.testimonial-author-image-wrap').forEach(el => {
      const style = window.getComputedStyle(el);
      const hasBg = style.backgroundImage && style.backgroundImage !== 'none';
      if (hasBg) {
        el.style.backgroundImage = `url(${placeholder})`;
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
      }
    });
    // console.log('Avatars replaced:', replacedCount);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();