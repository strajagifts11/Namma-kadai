
/* ST Raja Gifts Admin
   Preserves products, orders, payment status and settings.
   MRP + automatic discount added.
*/
const SUPABASE_URL = "https://bqrsavbnewekhzzqgkae.supabase.co";

// Keep your existing working public anon/publishable key.
const SUPABASE_ANON_KEY = "sb_publishable_5Crk8oH9IMCAAyILA2b8jQ_RscWPJcK";

const $ = id => document.getElementById(id);
const ready = !SUPABASE_URL.startsWith("PASTE_") &&
              !SUPABASE_ANON_KEY.startsWith("PASTE_") &&
              SUPABASE_ANON_KEY !== "sb_publishable_5Crk8oH9IMCAAyILA2b8jQ_RscWPJcK";

const db = ready && window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

let products = [];

function msg(s) {
  $("message").textContent = s;
  $("message").classList.add("show");
}
function clearMsg() {
  $("message").classList.remove("show");
  $("message").textContent = "";
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[c]));
}
function cash(n) {
  return Number(n || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2
  });
}
function discountPercent(price, mrp) {
  price = Number(price);
  mrp = Number(mrp);
  if (!mrp || mrp <= price || price < 0) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}

$("login-form").addEventListener("submit", async e => {
  e.preventDefault();
  if (!db) {
    msg("Keep your existing public Supabase key in admin.js.");
    return;
  }
  const r = await db.auth.signInWithPassword({
    email: $("email").value.trim(),
    password: $("password").value
  });
  if (r.error) {
    msg("Sign-in failed. Check credentials and admin approval.");
    return;
  }
  await session();
});

$("logout").onclick = async () => {
  if (!db) return;
  await db.auth.signOut();
  await session();
};
$("refresh").onclick = load;
$("clear").onclick = clearForm;

$("product-form").addEventListener("submit", async e => {
  e.preventDefault();
  if (!db) return;

  const id = $("pid").value;
  const price = Number($("pprice").value);
  const mrpInput = $("pmrp")?.value.trim() ?? "";
  const mrp = mrpInput === "" ? null : Number(mrpInput);

  if (!Number.isFinite(price) || price < 0) {
    msg("Enter a valid selling price.");
    return;
  }
  if (mrp !== null &&
      (!Number.isFinite(mrp) || mrp < price || mrp <= 0)) {
    msg("MRP must be greater than or equal to selling price.");
    return;
  }

  const p = {
    name: $("pname").value.trim(),
    category: $("pcat").value,
    price,
    mrp,
    description: $("pdesc").value.trim(),
    image_url: $("pimage").value.trim() || null,
    active: $("pactive").checked
  };

  const file = $("pfile").files[0];
  if (file) {
    if (file.size > 5 * 1024 * 1024 ||
        !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      msg("Photo must be JPG, PNG or WebP and under 5 MB.");
      return;
    }

    const ext = file.name.split(".").pop().toLowerCase();
    const path = `${crypto.randomUUID()}.${ext}`;
    const up = await db.storage.from("product-images").upload(path, file, {
      contentType: file.type
    });

    if (up.error) {
      msg("Photo upload failed. Check Storage permissions.");
      console.error(up.error);
      return;
    }

    p.image_url =
      db.storage.from("product-images").getPublicUrl(path).data.publicUrl;
  }

  const r = id
    ? await db.from("products").update(p).eq("id", id)
    : await db.from("products").insert(p);

  if (r.error) {
    msg("Product save failed. Check database permissions and mrp column.");
    console.error(r.error);
    return;
  }

  clearForm();
  msg("Product saved.");
  await load();
});

function clearForm() {
  $("pid").value = "";
  $("product-form").reset();
  if ($("pmrp")) $("pmrp").value = "";
  $("pactive").checked = true;
  $("form-title").textContent = "Add product";
}

async function session() {
  if (!db) {
    msg("Setup required: preserve your existing public Supabase key.");
    return;
  }

  const r = await db.auth.getSession();
  const s = r.data.session;

  $("login-panel").classList.toggle("hidden", !!s);
  $("dashboard").classList.add("hidden");
  $("logout").classList.toggle("hidden", !s);
  $("signed-user").textContent = s?.user?.email || "";

  if (!s) return;

  const a = await db.from("admin_users")
    .select("user_id")
    .eq("user_id", s.user.id)
    .maybeSingle();

  if (a.error || !a.data) {
    msg("Not approved as admin. Check admin_users.");
    await db.auth.signOut();
    $("login-panel").classList.remove("hidden");
    $("logout").classList.add("hidden");
    return;
  }

  clearMsg();
  $("dashboard").classList.remove("hidden");
  await load();
  await loadPaymentSettings();
}

async function load() {
  if (!db) return;

  const [p, o] = await Promise.all([
    db.from("products").select("*").order("created_at", { ascending: false }),
    db.from("orders").select("*").order("created_at", { ascending: false }).limit(200)
  ]);

  if (p.error || o.error) {
    msg("Cannot load data. Check admin access and SQL policies.");
    console.error(p.error || o.error);
    return;
  }

  products = p.data || [];

  $("product-rows").innerHTML = products.map(x => {
    const mrp = Number(x.mrp || 0);
    const price = Number(x.price || 0);
    const off = discountPercent(price, mrp);

    return `<tr>
      <td><b>${esc(x.name)}</b><br>${esc(x.category)}</td>
      <td>₹${cash(price)}</td>
      <td>${mrp > 0 ? "₹" + cash(mrp) : "—"}</td>
      <td>${off > 0 ? off + "% OFF" : "—"}</td>
      <td>${x.active ? "Yes" : "No"}</td>
      <td>
        <button class="btn alt" onclick="editProduct('${x.id}')">Edit</button>
        <button class="btn alt" onclick="toggleProduct('${x.id}',${!x.active})">
          ${x.active ? "Hide" : "Show"}
        </button>
      </td>
    </tr>`;
  }).join("") || "<tr><td colspan='6'>No products yet.</td></tr>";

  $("order-rows").innerHTML = (o.data || []).map(x => {
    const items = Array.isArray(x.items)
      ? x.items.map(i =>
          `${esc(i.name)} × ${i.quantity} (₹${cash(i.price)})`
        ).join("<br>")
      : "";

    const orderStatuses = [
      "New", "Confirmed", "Preparing", "Shipped", "Delivered", "Cancelled"
    ];
    const paymentStatuses = ["Pending", "Paid", "Failed", "Refunded"];

    const orderOptions = orderStatuses.map(s =>
      `<option value="${s}" ${x.status === s ? "selected" : ""}>${s}</option>`
    ).join("");

    const paymentValue = paymentStatuses.includes(x.payment_status)
      ? x.payment_status
      : "Pending";

    const paymentOptions = paymentStatuses.map(s =>
      `<option value="${s}" ${paymentValue === s ? "selected" : ""}>${s}</option>`
    ).join("");

    return `<tr>
      <td>${esc(String(x.id).slice(0, 8))}<br>
        <span class="muted">${esc(new Date(x.created_at).toLocaleString())}</span>
      </td>
      <td><b>${esc(x.customer_name)}</b><br>
        ${esc(x.customer_phone)}<br>
        ${esc(x.delivery_address)}<br>
        ${esc(x.customer_note || "")}
      </td>
      <td>${items}</td>
      <td>₹${cash(x.total)}</td>
      <td>${esc(x.status || "New")}</td>
      <td>
        <select id="s-${x.id}">${orderOptions}</select>
        <button class="btn alt" onclick="saveStatus('${x.id}')">Save Order</button>
      </td>
      <td><select id="pay-${x.id}">${paymentOptions}</select></td>
      <td><button class="btn alt" onclick="savePaymentStatus('${x.id}')">Save Payment</button></td>
    </tr>`;
  }).join("") || "<tr><td colspan='8'>No orders yet.</td></tr>";
}

/* Payment Settings */
async function loadPaymentSettings() {
  if (!db || !$("payment-form")) return;

  const r = await db.from("store_settings")
    .select("upi_id,whatsapp_number,qr_image_url")
    .eq("id", 1)
    .maybeSingle();

  if (r.error) {
    msg("Payment settings could not load. Check Supabase policies.");
    console.error(r.error);
    return;
  }

  const s = r.data || {};
  $("payment-upi").value = s.upi_id || "";
  $("payment-whatsapp").value = s.whatsapp_number || "";
  $("payment-qr-url").value = s.qr_image_url || "";

  const preview = $("payment-qr-preview");
  const image = $("payment-qr-image");

  if (s.qr_image_url) {
    image.src = s.qr_image_url;
    preview.classList.remove("hidden");
  } else {
    image.removeAttribute("src");
    preview.classList.add("hidden");
  }
}

$("payment-form")?.addEventListener("submit", async e => {
  e.preventDefault();
  if (!db) return;

  const upi = $("payment-upi").value.trim();
  const whatsapp = $("payment-whatsapp").value.trim();
  let qrUrl = $("payment-qr-url").value.trim();
  const file = $("payment-qr-file").files[0];

  if (!upi || !whatsapp) {
    msg("Enter UPI ID and WhatsApp number.");
    return;
  }
  if (!/^[0-9]{10,15}$/.test(whatsapp)) {
    msg("Enter WhatsApp number with country code, digits only.");
    return;
  }

  if (file) {
    if (file.size > 5 * 1024 * 1024 ||
        !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      msg("QR must be JPG, PNG or WebP and under 5 MB.");
      return;
    }

    const ext = file.name.split(".").pop().toLowerCase();
    const path = `payment-qr/${crypto.randomUUID()}.${ext}`;
    const up = await db.storage.from("product-images").upload(path, file, {
      contentType: file.type,
      upsert: false
    });

    if (up.error) {
      msg("QR upload failed. Check Storage upload permissions.");
      console.error(up.error);
      return;
    }

    qrUrl = db.storage.from("product-images").getPublicUrl(path).data.publicUrl;
  }

  if (!qrUrl) {
    msg("Upload your QR image or enter its image URL.");
    return;
  }

  const save = await db.from("store_settings").update({
    upi_id: upi,
    whatsapp_number: whatsapp,
    qr_image_url: qrUrl,
    updated_at: new Date().toISOString()
  }).eq("id", 1);

  if (save.error) {
    msg("Settings save failed. Check Supabase UPDATE permission.");
    console.error(save.error);
    return;
  }

  $("payment-qr-url").value = qrUrl;
  $("payment-qr-file").value = "";
  msg("Payment settings saved.");
  await loadPaymentSettings();
});

window.editProduct = id => {
  const p = products.find(x => String(x.id) === String(id));
  if (!p) return;

  $("pid").value = p.id;
  $("pname").value = p.name;
  $("pcat").value = p.category;
  $("pprice").value = p.price;
  if ($("pmrp")) $("pmrp").value = p.mrp ?? "";
  $("pdesc").value = p.description || "";
  $("pimage").value = p.image_url || "";
  $("pfile").value = "";
  $("pactive").checked = !!p.active;
  $("form-title").textContent = "Edit product";
  window.scrollTo({ top: 0, behavior: "smooth" });
};

window.toggleProduct = async (id, active) => {
  const r = await db.from("products").update({ active }).eq("id", id);
  if (r.error) {
    msg("Could not update product visibility.");
    console.error(r.error);
    return;
  }
  msg("Product visibility updated.");
  await load();
};

window.saveStatus = async id => {
  const r = await db.from("orders").update({
    status: $("s-" + id).value
  }).eq("id", id);

  if (r.error) {
    msg("Could not update order status.");
    console.error(r.error);
    return;
  }
  msg("Order status updated.");
  await load();
};

window.savePaymentStatus = async id => {
  const status = $("pay-" + id).value;

  if (status === "Paid" && !window.confirm(
    "Have you verified the successful payment in your bank/UPI app?"
  )) return;

  const r = await db.from("orders")
    .update({ payment_status: status })
    .eq("id", id);

  if (r.error) {
    msg("Could not update payment status. Check orders permissions.");
    console.error(r.error);
    return;
  }
  msg("Payment status updated.");
  await load();
};

if (db) db.auth.onAuthStateChange(() => setTimeout(session, 0));
session(
   
);
  
/* ST Raja Gifts — Coupon Admin Integration
   Requires the coupon form IDs already present in admin.html.
   Uses the existing authenticated Supabase client: db.
*/

let coupons = [];

function couponMsg(message) {
  if (typeof msg === "function") msg(message);
  else alert(message);
}

function couponDiscountLabel(c) {
  const value = Number(c.discount_value || 0);
  return c.discount_type === "percentage"
    ? `${value}%`
    : `₹${value}`;
}

function clearCouponForm() {
  $("coupon-id").value = "";
  $("coupon-form").reset();
  $("coupon-type").value = "flat";
  $("coupon-minimum").value = "0";
  $("coupon-active").checked = true;
}

async function loadCoupons() {
  if (!db || !$("coupon-rows")) return;

  const { data, error } = await db
    .from("coupons")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    couponMsg(
      "Coupons load aagala. Check Supabase admin policy."
    );
    console.error("Coupon load error:", error);
    return;
  }

  coupons = data || [];

  $("coupon-rows").innerHTML = coupons.map(c => {
    const expiry = c.expires_at || "No expiry";
    const active = !!c.active;

    return `
      <tr>
        <td>
          <b>${esc(c.code)}</b><br>
          <small>${esc(c.discount_type)}</small>
        </td>
        <td>${esc(couponDiscountLabel(c))}</td>
        <td>₹${cash(c.minimum_order)}</td>
        <td>${c.maximum_discount == null
          ? "No limit"
          : "₹" + cash(c.maximum_discount)}</td>
        <td>${esc(expiry)}</td>
        <td>${active ? "Active" : "Inactive"}</td>
        <td>
          <button class="btn alt"
            onclick="editCoupon(${Number(c.id)})">Edit</button>
          <button class="btn alt"
            onclick="toggleCoupon(${Number(c.id)},${!active})">
            ${active ? "Disable" : "Enable"}
          </button>
        </td>
      </tr>
    `;
  }).join("") ||
    "<tr><td colspan='7'>No coupons created yet.</td></tr>";
}

$("coupon-form")?.addEventListener("submit", async e => {
  e.preventDefault();
  if (!db) {
    couponMsg("Supabase connection unavailable.");
    return;
  }

  const id = $("coupon-id").value;
  const code = $("coupon-code").value.trim().toUpperCase();
  const type = $("coupon-type").value;
  const value = Number($("coupon-value").value);
  const minimum = Number($("coupon-minimum").value || 0);
  const maximumText = $("coupon-maximum").value.trim();
  const expiry = $("coupon-expiry").value || null;

  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) {
    couponMsg(
      "Coupon code 3–30 characters: letters, numbers, _ or -."
    );
    return;
  }

  if (!["flat", "percentage"].includes(type)) {
    couponMsg("Choose flat or percentage discount.");
    return;
  }

  if (!Number.isFinite(value) || value <= 0 ||
      (type === "percentage" && value > 100)) {
    couponMsg("Enter a valid discount value. Percentage max is 100.");
    return;
  }

  if (!Number.isFinite(minimum) || minimum < 0) {
    couponMsg("Minimum order cannot be negative.");
    return;
  }

  const maximum = maximumText === ""
    ? null
    : Number(maximumText);

  if (maximum !== null &&
      (!Number.isFinite(maximum) || maximum <= 0)) {
    couponMsg("Maximum discount must be greater than zero.");
    return;
  }

  const payload = {
    code,
    discount_type: type,
    discount_value: value,
    minimum_order: minimum,
    maximum_discount: maximum,
    expires_at: expiry,
    active: $("coupon-active").checked
  };

  const result = id
    ? await db.from("coupons").update(payload).eq("id", id)
    : await db.from("coupons").insert(payload);

  if (result.error) {
    couponMsg(
      result.error.code === "23505"
        ? "Indha coupon code already exists."
        : "Coupon save failed. Check admin policy and field values."
    );
    console.error("Coupon save error:", result.error);
    return;
  }

  clearCouponForm();
  couponMsg("Coupon saved successfully.");
  await loadCoupons();
});

window.editCoupon = id => {
  const c = coupons.find(x => Number(x.id) === Number(id));
  if (!c) return;

  $("coupon-id").value = c.id;
  $("coupon-code").value = c.code;
  $("coupon-type").value = c.discount_type;
  $("coupon-value").value = c.discount_value;
  $("coupon-minimum").value = c.minimum_order ?? 0;
  $("coupon-maximum").value = c.maximum_discount ?? "";
  $("coupon-expiry").value = c.expires_at || "";
  $("coupon-active").checked = !!c.active;

  $("coupon-form").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
};

window.toggleCoupon = async (id, active) => {
  if (!db) return;

  const { error } = await db
    .from("coupons")
    .update({ active })
    .eq("id", id);

  if (error) {
    couponMsg("Coupon status update failed.");
    console.error("Coupon toggle error:", error);
    return;
  }

  couponMsg(active ? "Coupon enabled." : "Coupon disabled.");
  await loadCoupons();
};

$("coupon-clear")?.addEventListener("click", e => {
  e.preventDefault();
  clearCouponForm();
});

/* Call this after a successful admin login/session check. */
window.loadCoupons = loadCoupons;

