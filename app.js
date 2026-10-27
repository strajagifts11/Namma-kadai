
/* ST Raja Gifts - Storefront + UPI checkout
   Keep the existing Supabase URL and public anon/publishable key.
   NEVER use a service_role key in browser code.
*/

const SUPABASE_URL = "https://bqrsavbnewekhzzqgkae.supabase.co";

// IMPORTANT: Replace this line with your EXISTING public anon/publishable key.
const SUPABASE_ANON_KEY = "sb_publishable_5Crk8oH9IMCAAyILA2b8jQ_RscWPJcK";

const DEFAULT_WHATSAPP_NUMBER = "918489880411";

const demo = [
  {id:"demo1",name:"Personalised Photo Frame",category:"Personalized gifts",price:499,description:"A keepsake for favourite memories",emoji:"🖼️"},
  {id:"demo2",name:"Celebration Gift Hamper",category:"Gift hampers",price:799,description:"A thoughtful bundle",emoji:"🎀"},
  {id:"demo3",name:"Cuddly Teddy Bear",category:"Soft toys",price:399,description:"A soft little hug",emoji:"🧸"},
  {id:"demo4",name:"Classic Everyday Watch",category:"Watches & accessories",price:999,description:"Everyday style",emoji:"⌚"},
  {id:"demo5",name:"Return Gift Set",category:"Return gifts",price:299,description:"A thank-you for guests",emoji:"🎉"}
];

const cats = [
  "All gifts",
  "Personalized gifts",
  "Gift hampers",
  "Soft toys",
  "Watches & accessories",
  "Return gifts"
];

let db = null;
let products = [];
let cart = [];
let category = "All gifts";
let paymentSettings = {
  upi_id: "",
  whatsapp_number: DEFAULT_WHATSAPP_NUMBER,
  qr_image_url: ""
};

const $ = id => document.getElementById(id);

const ready =
  !SUPABASE_URL.startsWith("PASTE_") &&
  !SUPABASE_ANON_KEY.startsWith("PASTE_") &&
  SUPABASE_ANON_KEY !== "hide";

if (ready && window.supabase) {
  db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  }[c]));
}

function cash(n) {
  return Number(n || 0).toLocaleString("en-IN");
}

function showNotice(message) {
  const notice = $("notice");
  if (!notice) return;
  notice.textContent = message;
  notice.classList.add("show");
}

async function loadPaymentSettings() {
  if (!db) return;

  try {
    const r = await db
      .from("store_settings")
      .select("upi_id,whatsapp_number,qr_image_url")
      .eq("id", 1)
      .maybeSingle();

    if (r.error) {
      console.error("Payment settings could not load:", r.error);
      return;
    }

    if (r.data) {
      paymentSettings = {
        upi_id: r.data.upi_id || "",
        whatsapp_number:
          String(r.data.whatsapp_number || DEFAULT_WHATSAPP_NUMBER)
            .replace(/\D/g, ""),
        qr_image_url: r.data.qr_image_url || ""
      };
    }
  } catch (error) {
    console.error("Payment settings error:", error);
  }
}

async function load() {
  if (db) {
    const r = await db
      .from("products")
      .select("id,name,category,price,description,image_url,active")
      .eq("active", true)
      .order("created_at", {ascending:false});

    if (!r.error && r.data) {
      products = r.data;
    } else {
      products = demo;
      showNotice("Live catalogue unavailable; demo products shown.");
    }
  } else {
    products = demo;
    showNotice("Preview mode only. Connect Supabase to accept real orders.");
  }

  renderCats();
  renderProducts();
}

function renderCats() {
  $("categories").innerHTML = cats.map(c =>
    `<button class="chip ${c === category ? "active" : ""}"
      onclick="setCat('${c.replace(/'/g, "\\'")}')">${esc(c)}</button>`
  ).join("");
}

function setCat(c) {
  category = c;
  renderCats();
  renderProducts();
}

function renderProducts() {
  const search = ($("gift-search")?.value || "").trim().toLowerCase();

  const list = products.filter(p => {
    const categoryMatch =
      category === "All gifts" || p.category === category;
    const searchMatch =
      !search ||
      String(p.name || "").toLowerCase().includes(search) ||
      String(p.category || "").toLowerCase().includes(search) ||
      String(p.description || "").toLowerCase().includes(search);

    return categoryMatch && searchMatch;
  });

  $("products").innerHTML = list.length
    ? list.map(p => `
      <article class="card">
        ${p.image_url
          ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}">`
          : `<div class="emoji">${esc(p.emoji || "🎁")}</div>`}
        <div class="info">
          <h3>${esc(p.name)}</h3>
          <div class="price">₹${cash(p.price)}</div>
          <p>${esc(p.description || p.category)}</p>
          <div class="product-actions">
            <button class="btn" onclick="add('${esc(p.id)}')">
              Add to basket
            </button>
          </div>
        </div>
      </article>
    `).join("")
    : `<div class="empty-search">No gifts found. Try another search or category.</div>`;

  const count = $("result-count");
  if (count) {
    count.textContent = `${list.length} gift${list.length === 1 ? "" : "s"} found`;
  }
}

function add(id) {
  const p = products.find(x => String(x.id) === String(id));
  if (!p) return;

  const item = cart.find(x => String(x.id) === String(id));
  if (item) item.qty++;
  else cart.push({...p, qty:1});

  renderCart();
  $("checkout").scrollIntoView({behavior:"smooth"});
}

function qty(id, d) {
  const item = cart.find(x => String(x.id) === String(id));
  if (!item) return;

  item.qty += d;

  if (item.qty < 1) {
    cart = cart.filter(x => String(x.id) !== String(id));
  }

  renderCart();
}

function renderCart() {
  $("cart-items").innerHTML = cart.length
    ? cart.map(p => `
      <div class="line">
        <span>
          ${esc(p.name)} × ${p.qty}<br>
          <button type="button" class="chip"
            onclick="qty('${esc(p.id)}',-1)">−</button>
          <button type="button" class="chip"
            onclick="qty('${esc(p.id)}',1)">+</button>
        </span>
        <b>₹${cash(Number(p.price) * p.qty)}</b>
      </div>
    `).join("")
    : "Basket empty — add a gift above.";

  $("cart-total").textContent = cash(
    cart.reduce((sum, p) => sum + Number(p.price) * p.qty, 0)
  );
}

function buildPaymentPanel(orderId, total, payload, items, lines) {
  const out = $("order-result");
  const upi = paymentSettings.upi_id.trim();
  const qr = paymentSettings.qr_image_url;
  const wa = paymentSettings.whatsapp_number || DEFAULT_WHATSAPP_NUMBER;

  const upiLink = upi
    ? `upi://pay?pa=${encodeURIComponent(upi)}` +
      `&pn=${encodeURIComponent("ST Raja Gifts")}` +
      `&am=${encodeURIComponent(Number(total).toFixed(2))}` +
      `&cu=INR&tn=${encodeURIComponent("Order " + orderId)}`
    : "";

  const message =
    `Hi ST Raja Gifts! I placed order ${orderId}.\n\n` +
    `${lines}\n\n` +
    `Estimated total: ₹${cash(total)}\n` +
    `Name: ${payload.customer_name}\n` +
    `Phone: ${payload.customer_phone}\n` +
    `Address: ${payload.delivery_address}\n` +
    `Notes: ${payload.customer_note || "None"}\n\n` +
    `Payment status: I will share my payment confirmation/screenshot separately.\n` +
    `Please confirm my order and delivery details.`;

  const whatsappUrl =
    `https://wa.me/${wa}?text=${encodeURIComponent(message)}`;

  out.innerHTML = `
    <div style="margin-top:18px;padding:18px;border:1px solid #e9dfce;background:#fffdf9">
      <p style="color:#16875b;font-weight:700">
        ✓ Order request saved successfully
      </p>
      <p>Order reference: <b>${esc(orderId)}</b></p>
      <p>Estimated amount: <b>₹${cash(total)}</b></p>

      <h3 style="font-family:Georgia,serif">Complete your UPI payment</h3>

      ${qr ? `
        <div style="text-align:center;margin:15px 0">
          <img src="${esc(qr)}"
            alt="ST Raja Gifts UPI payment QR code"
            style="display:block;width:min(260px,100%);height:auto;margin:auto;border:1px solid #e9dfce;padding:8px;background:#fff"
            loading="lazy">
        </div>
      ` : `
        <p>QR image is not configured yet. Contact the shop on WhatsApp.</p>
      `}

      ${upi ? `
        <p>UPI ID: <b>${esc(upi)}</b></p>
        <button type="button" class="btn btn-outline"
          id="copy-upi">COPY UPI ID</button>
        <p style="margin-top:12px">
          <a class="btn btn-gold" href="${esc(upiLink)}">
            PAY ₹${cash(total)} USING UPI
          </a>
        </p>
      ` : `
        <p>UPI ID is not configured. Please contact the shop.</p>
      `}

      <p style="font-size:12px;line-height:1.7;color:#817667">
        After paying, return to WhatsApp and send your payment confirmation
        or screenshot. Your order remains unverified until the shop confirms
        receipt of payment.
      </p>

      <a class="btn" target="_blank" rel="noopener"
        href="${esc(whatsappUrl)}">
        SEND ORDER DETAILS ON WHATSAPP
      </a>
    </div>
  `;

  const copyButton = $("copy-upi");
  if (copyButton) {
    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(upi);
        copyButton.textContent = "UPI ID COPIED";
      } catch {
        window.prompt("Copy this UPI ID:", upi);
      }
    });
  }
}

$("order-form").addEventListener("submit", async e => {
  e.preventDefault();

  const out = $("order-result");

  if (!cart.length) {
    out.textContent = "Add a product to your basket first.";
    return;
  }

  if (!db) {
    out.textContent =
      "Preview only: check your Supabase public key and connection before accepting real orders.";
    return;
  }

  const items = cart.map(p => ({
    product_id: String(p.id).startsWith("demo") ? null : p.id,
    name: p.name,
    price: Number(p.price),
    quantity: p.qty
  }));

  const total = cart.reduce(
    (sum, p) => sum + Number(p.price) * p.qty, 0
  );

  const payload = {
    customer_name: $("customer-name").value.trim(),
    customer_phone: $("customer-phone").value.trim(),
    delivery_address: $("customer-address").value.trim(),
    customer_note: $("customer-note").value.trim(),
    items,
    total,
    status: "New"
  };

  const button = $("place-order");
  button.disabled = true;
  button.textContent = "SAVING ORDER…";
  out.textContent = "";

  try {
    const r = await db
      .from("orders")
      .insert(payload)
      .select("id")
      .single();

    if (r.error) {
      console.error("Order save failed:", r.error);
      out.textContent =
        "Could not save the order. Please contact the shop on WhatsApp.";
      return;
    }

    const orderId = r.data.id;

    const lines = cart.map(p =>
      `• ${p.name} × ${p.qty} — ₹${cash(Number(p.price) * p.qty)}`
    ).join("\n");

    await loadPaymentSettings();

    buildPaymentPanel(orderId, total, payload, items, lines);

    cart = [];
    renderCart();
    $("order-form").reset();

  } catch (error) {
    console.error("Checkout error:", error);
    out.textContent =
      "Something went wrong. Please try again or contact the shop.";
  } finally {
    button.disabled = false;
    button.textContent = "PLACE ORDER REQUEST";
  }
});

$("gift-search")?.addEventListener("input", renderProducts);

async function initStorefront() {
  await Promise.all([
    load(),
    loadPaymentSettings()
  ]);
  renderCart();
}

initStorefront();
