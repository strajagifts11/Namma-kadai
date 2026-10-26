
/* ST Raja Gifts Admin
   Uses the existing Supabase browser client.
   Never put a service_role key in this file.
*/
const SUPABASE_URL = "https://bqrsavbnewekhzzqgkae.supabase.co";
const SUPABASE_ANON_KEY = "PASTE_YOUR_EXISTING_PUBLIC_ANON_KEY_HERE";

const $ = id => document.getElementById(id);
const ready = !SUPABASE_URL.startsWith("PASTE_") &&
              !SUPABASE_ANON_KEY.startsWith("PASTE_");
const db = ready ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

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
  return Number(n || 0).toLocaleString("en-IN");
}

$("login-form").addEventListener("submit", async e => {
  e.preventDefault();
  if (!db) {
    msg("Add your existing public Supabase anon key in admin.js.");
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
  await db.auth.signOut();
  await session();
};
$("refresh").onclick = load;
$("clear").onclick = clearForm;

$("product-form").addEventListener("submit", async e => {
  e.preventDefault();
  if (!db) return;

  const id = $("pid").value;
  const p = {
    name: $("pname").value.trim(),
    category: $("pcat").value,
    price: Number($("pprice").value),
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

    p.image_url = db.storage.from("product-images").getPublicUrl(path).data.publicUrl;
  }

  const r = id
    ? await db.from("products").update(p).eq("id", id)
    : await db.from("products").insert(p);

  if (r.error) {
    msg("Product save failed. Check database permissions.");
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
  $("pactive").checked = true;
  $("form-title").textContent = "Add product";
}

async function session() {
  if (!db) {
    msg("Setup required: configure Supabase public key.");
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
    return;
  }

  products = p.data || [];

  $("product-rows").innerHTML = products.map(x => `
    <tr>
      <td><b>${esc(x.name)}</b><br>${esc(x.category)}</td>
      <td>₹${cash(x.price)}</td>
      <td>${x.active ? "Yes" : "No"}</td>
      <td>
        <button class="btn alt" onclick="editProduct('${x.id}')">Edit</button>
        <button class="btn alt" onclick="toggleProduct('${x.id}',${!x.active})">
          ${x.active ? "Hide" : "Show"}
        </button>
      </td>
    </tr>
  `).join("") || "<tr><td colspan='4'>No products yet.</td></tr>";

  $("order-rows").innerHTML = (o.data || []).map(x => {
    const items = Array.isArray(x.items)
      ? x.items.map(i => `${esc(i.name)} × ${i.quantity} (₹${cash(i.price)})`).join("<br>")
      : "";

    const opts = ["New", "Confirmed", "Preparing", "Shipped", "Delivered", "Cancelled"]
      .map(s => `<option ${x.status === s ? "selected" : ""}>${s}</option>`).join("");

    return `<tr>
      <td>${esc(String(x.id).slice(0, 8))}<br>
        <span class="muted">${esc(new Date(x.created_at).toLocaleString())}</span>
      </td>
      <td><b>${esc(x.customer_name)}</b><br>${esc(x.customer_phone)}<br>
        ${esc(x.delivery_address)}<br>${esc(x.customer_note || "")}
      </td>
      <td>${items}</td>
      <td>₹${cash(x.total)}</td>
      <td>${esc(x.status)}</td>
      <td><select id="s-${x.id}">${opts}</select>
        <button class="btn alt" onclick="saveStatus('${x.id}')">Save</button>
      </td>
    </tr>`;
  }).join("") || "<tr><td colspan='6'>No orders yet.</td></tr>";
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

  // Update the existing row; don't allow a public insert through the frontend.
  const save = await db.from("store_settings").update({
    upi_id: upi,
    whatsapp_number: whatsapp,
    qr_image_url: qrUrl,
    updated_at: new Date().toISOString()
  }).eq("id", 1);

  if (save.error) {
    msg("Settings save failed. Check admin UPDATE permission in Supabase.");
    console.error(save.error);
    return;
  }

  $("payment-qr-url").value = qrUrl;
  $("payment-qr-file").value = "";
  msg("Payment settings saved.");
  await loadPaymentSettings();
});

window.editProduct = id => {
  const p = products.find(x => x.id === id);
  if (!p) return;
  $("pid").value = p.id;
  $("pname").value = p.name;
  $("pcat").value = p.category;
  $("pprice").value = p.price;
  $("pdesc").value = p.description || "";
  $("pimage").value = p.image_url || "";
  $("pfile").value = "";
  $("pactive").checked = !!p.active;
  $("form-title").textContent = "Edit product";
  window.scrollTo({ top: 0, behavior: "smooth" });
};

window.toggleProduct = async (id, active) => {
  const r = await db.from("products").update({ active }).eq("id", id);
  if (r.error) msg("Could not update product visibility.");
  await load();
};

window.saveStatus = async id => {
  const r = await db.from("orders").update({
    status: $("s-" + id).value
  }).eq("id", id);

  if (r.error) {
    msg("Could not update order status.");
    return;
  }

  msg("Order status updated.");
  await load();
};

if (db) db.auth.onAuthStateChange(() => setTimeout(session, 0));
session();
    
