const API_URL = "https://script.google.com/macros/s/AKfycbzo9cyGF9knLJ71hpKRcGY9XRmBijDbxY7ZuiQZGhNLaNnBaUvj-_cH-gCKdhXClbxzCA/exec";
const DEFAULT_WHATSAPP = "201229295567";

let storeSettings = {};
let allProducts = [];
let selectedCategory = "ALL";
let cart = JSON.parse(localStorage.getItem("abusamra_cart_v2") || "[]");

function getPriceDetails(product, sizeIdx) {
  const regularPrice = (product.prices && product.prices[sizeIdx] !== undefined)
    ? Number(product.prices[sizeIdx])
    : Number((product.prices && product.prices[0]) || 0);

  let discPrice = null;
  if (product.discount_prices && product.discount_prices[sizeIdx] !== undefined && product.discount_prices[sizeIdx] !== null && product.discount_prices[sizeIdx] !== "") {
    const parsed = Number(product.discount_prices[sizeIdx]);
    if (parsed > 0 && parsed < regularPrice) discPrice = parsed;
  }

  return {
    finalPrice: discPrice !== null ? discPrice : regularPrice,
    oldPrice: discPrice !== null ? regularPrice : null,
    hasDiscount: discPrice !== null
  };
}

function productHasAnyDiscount(product) {
  if (!product.sizes || !product.sizes.length) return getPriceDetails(product, 0).hasDiscount;
  return product.sizes.some((_, idx) => getPriceDetails(product, idx).hasDiscount);
}

async function initStore() {
  try {
    const res = await fetch(API_URL);
    const data = await res.json();
    if (data.status === "success") {
      storeSettings = data.settings || {};
      allProducts = data.products || [];
      applySettings(storeSettings);
      populateFilters(allProducts);
      applyFilters();
      updateCartUI();
    } else {
      document.getElementById("productsGrid").innerHTML = `<div class="empty-msg">خطأ: ${data.message || "تعذر تحميل البيانات"}</div>`;
    }
  } catch (err) {
    console.error(err);
    document.getElementById("productsGrid").innerHTML = `<div class="empty-msg">تعذر تحميل المنتجات، تأكد من رابط السكريبت.</div>`;
  }
}

function applySettings(settings) {
  const name = settings.store_name || "معرض أبو سمرة كاربت";
  document.title = name;
  const titleEl = document.getElementById("storeTitle");
  if (titleEl) titleEl.textContent = name;

  if (settings.logo_image) {
    const logo = document.getElementById("storeLogo");
    if (logo) {
      logo.src = settings.logo_image;
      logo.style.display = "block";
    }
  }
  if (settings.store_address) {
    const addrEl = document.getElementById("footerAddress");
    if (addrEl) addrEl.textContent = `📍 العنوان: ${settings.store_address}`;
  }
  if (settings.store_phone) {
    const phoneEl = document.getElementById("footerPhone");
    if (phoneEl) phoneEl.textContent = `📞 للاستفسار: ${settings.store_phone}`;
  }
  if (settings.cover_image) {
    const cover = document.getElementById("coverImage");
    if (cover) {
      cover.src = settings.cover_image;
      cover.style.display = "block";
    }
  }
  if (settings.cover_title) {
    const cTitle = document.getElementById("coverTitle");
    if (cTitle) cTitle.textContent = settings.cover_title;
  }
  if (settings.cover_desc) {
    const cDesc = document.getElementById("coverDesc");
    if (cDesc) cDesc.textContent = settings.cover_desc;
  }
}

function populateFilters(products) {
  const categories = new Set();
  const sizes = new Set();
  let hasAnyPromo = false;

  products.forEach(p => {
    if (p.category) categories.add(p.category);
    if (Array.isArray(p.sizes)) p.sizes.forEach(s => sizes.add(s));
    if (productHasAnyDiscount(p)) hasAnyPromo = true;
  });

  const sizeFilter = document.getElementById("sizeFilter");
  sizeFilter.innerHTML = `<option value="ALL">جميع المقاسات</option>`;
  sizes.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = `${s} سم`;
    sizeFilter.appendChild(opt);
  });

  const catBar = document.getElementById("categoriesBar");
  catBar.innerHTML = `<button class="cat-pill active" onclick="selectCategory('ALL', this)">الكل</button>`;

  if (hasAnyPromo) {
    const promoBtn = document.createElement("button");
    promoBtn.className = "cat-pill promo-pill";
    promoBtn.textContent = "🔥 العروض والخصومات";
    promoBtn.onclick = () => selectCategory("DISCOUNTS", promoBtn);
    catBar.appendChild(promoBtn);
  }

  categories.forEach(cat => {
    const btn = document.createElement("button");
    btn.className = "cat-pill";
    btn.textContent = cat;
    btn.onclick = () => selectCategory(cat, btn);
    catBar.appendChild(btn);
  });
}

function selectCategory(cat, btnElement) {
  selectedCategory = cat;
  document.querySelectorAll(".cat-pill").forEach(b => b.classList.remove("active"));
  btnElement.classList.add("active");
  applyFilters();
}

function applyFilters() {
  const searchText = document.getElementById("searchInput").value.trim().toLowerCase();
  const selectedSize = document.getElementById("sizeFilter").value;

  const filtered = allProducts.filter(p => {
    const matchCat = selectedCategory === "ALL"
      || (selectedCategory === "DISCOUNTS" && productHasAnyDiscount(p))
      || p.category === selectedCategory;
    const matchSize = selectedSize === "ALL" || (Array.isArray(p.sizes) && p.sizes.includes(selectedSize));
    const matchText = !searchText
      || (p.name && p.name.toLowerCase().includes(searchText))
      || (p.id && String(p.id).toLowerCase().includes(searchText));
    return matchCat && matchSize && matchText;
  });

  renderProducts(filtered);
}

function renderProducts(products) {
  const grid = document.getElementById("productsGrid");
  if (!products.length) {
    grid.innerHTML = `<div class="empty-msg">لا توجد منتجات مطابقة.</div>`;
    return;
  }

  grid.innerHTML = products.map(p => {
    const inStock = Number(p.stock) > 0;
    const hasAnyDisc = productHasAnyDiscount(p);
    const sizesOptions = (p.sizes && p.sizes.length)
      ? p.sizes.map((s, sIdx) => `<option value="${sIdx}">${s} سم</option>`).join("")
      : `<option value="0">مقاس موحد</option>`;

    const initialInfo = getPriceDetails(p, 0);

    return `
      <div class="product-card" id="card-${p.id}">
        <div class="image-frame" style="position: relative;">
          <span class="badge-cat">${p.category || "عام"}</span>
          ${p.id ? `<span class="badge-id" style="position: absolute; bottom: 8px; right: 8px; background: rgba(15, 23, 42, 0.82); color: #fff; font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 6px; z-index: 2; direction: ltr;">${p.id}</span>` : ""}
          ${hasAnyDisc ? `<span class="badge-discount">خصم 🔥</span>` : ""}
          <img src="${p.image || ''}" alt="${p.name}" loading="lazy" />
        </div>
        <div class="card-content">
          <h3>${p.name}</h3>
          <select class="size-select" id="size-select-${p.id}" onchange="updateCardPrice('${p.id}')">
            ${sizesOptions}
          </select>
          <div class="price-wrap">
            <div>
              <span class="current-price" id="curr-price-${p.id}">${initialInfo.finalPrice} ج.م</span>
              <span class="old-price" id="old-price-${p.id}" style="${!initialInfo.oldPrice ? 'display:none' : ''}">${initialInfo.oldPrice || ''} ج.م</span>
            </div>
          </div>
          <button class="add-to-cart-btn" ${!inStock ? "disabled" : ""} onclick="addProductToCart('${p.id}')">
            ${inStock ? "🛒 إضافة للسلة" : "❌ نفذت الكمية"}
          </button>
        </div>
      </div>
    `;
  }).join("");
}

function updateCardPrice(productId) {
  const product = allProducts.find(p => String(p.id) === String(productId));
  if (!product) return;
  const sIdx = Number(document.getElementById(`size-select-${productId}`).value);
  const info = getPriceDetails(product, sIdx);
  document.getElementById(`curr-price-${productId}`).textContent = `${info.finalPrice} ج.م`;
  const oldElem = document.getElementById(`old-price-${productId}`);
  if (info.oldPrice) {
    oldElem.textContent = `${info.oldPrice} ج.م`;
    oldElem.style.display = "inline";
  } else {
    oldElem.style.display = "none";
  }
}

function addProductToCart(productId) {
  const product = allProducts.find(p => String(p.id) === String(productId));
  if (!product) return;
  const sIdx = Number(document.getElementById(`size-select-${productId}`).value);
  const chosenSize = (product.sizes && product.sizes[sIdx]) ? product.sizes[sIdx] : "قياسي";
  const info = getPriceDetails(product, sIdx);
  const cartKey = `${product.id}_${chosenSize}`;
  const existing = cart.find(item => item.cartKey === cartKey);

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      cartKey, id: product.id, name: product.name, size: chosenSize, price: info.finalPrice, image: product.image, qty: 1
    });
  }
  saveAndSyncCart();
  showToast(`تمت إضافة ${product.name} للسلة!`);
}

function saveAndSyncCart() {
  localStorage.setItem("abusamra_cart_v2", JSON.stringify(cart));
  updateCartUI();
}

function updateCartUI() {
  document.getElementById("cartCount").textContent = cart.reduce((sum, item) => sum + item.qty, 0);
  const container = document.getElementById("cartItemsContainer");
  if (!cart.length) {
    container.innerHTML = `<div style="text-align:center; padding:40px;">السلة فارغة.</div>`;
    document.getElementById("cartTotal").textContent = "0 ج.م";
    return;
  }
  container.innerHTML = cart.map(item => `
    <div class="cart-row">
      <div>
        <h5>${item.name}</h5>
        <p>مقاس: ${item.size} | ${item.price} ج.م</p>
      </div>
      <div style="display:flex; align-items:center; gap:6px;">
        <button class="q-btn" onclick="changeQty('${item.cartKey}', -1)">-</button>
        <span>${item.qty}</span>
        <button class="q-btn" onclick="changeQty('${item.cartKey}', 1)">+</button>
      </div>
    </div>
  `).join("");
  const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  document.getElementById("cartTotal").textContent = `${total} ج.م`;
}

function changeQty(cartKey, delta) {
  const item = cart.find(i => i.cartKey === cartKey);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter(i => i.cartKey !== cartKey);
  saveAndSyncCart();
}

function toggleCart(open) {
  document.getElementById("cartModal").classList.toggle("open", open);
}

function closeCartOnOverlay(e) {
  if (e.target === e.currentTarget) toggleCart(false);
}

function showToast(msg) {
  const toast = document.getElementById("toastMsg");
  toast.textContent = msg;
  toast.style.display = "block";
  setTimeout(() => toast.style.display = "none", 3000);
}

async function submitOrder(e) {
  e.preventDefault();
  if (!cart.length) return;
  const name = document.getElementById("custName").value.trim();
  const phone = document.getElementById("custPhone").value.trim();
  const address = document.getElementById("custAddress").value.trim();
  const paymentMethod = document.getElementById("paymentMethod") ? document.getElementById("paymentMethod").value : "الدفع عند الاستلام";
  const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const btn = document.getElementById("submitOrderBtn");

  btn.disabled = true;
  btn.textContent = "جاري إرسال الطلب...";

  const payload = {
    customer_name: name,
    phone,
    address,
    payment_method: paymentMethod,
    total,
    items: cart.map(i => ({ id: i.id, name: i.name, size: i.size, qty: i.qty, price: i.price, subtotal: i.price * i.qty }))
  };

  try {
    const res = await fetch(API_URL, { method: "POST", body: JSON.stringify(payload) });
    const result = await res.json();
    if (result.status === "success") {
      let waText = `🛒 *طلب جديد - معرض أبو سمرة كاربت*\n`;
      if (result.order_id) waText += `🔖 *رقم الطلب:* ${result.order_id}\n`;
      waText += `👤 *الاسم:* ${name}\n📱 *الموبايل:* ${phone}\n📍 *العنوان:* ${address}\n💳 *الدفع:* ${paymentMethod}\n\n📦 *المنتجات:*\n`;
      cart.forEach((item, idx) => {
        waText += `${idx + 1}. ${item.name} (${item.size}) × ${item.qty} = ${item.price * item.qty} ج.م\n`;
      });
      waText += `\n💰 *الإجمالي:* ${total} ج.م`;

      const rawPhone = storeSettings.store_phone ? storeSettings.store_phone.replace(/\D/g, "") : "";
      const waPhone = rawPhone ? (rawPhone.startsWith("2") ? rawPhone : `2${rawPhone}`) : DEFAULT_WHATSAPP;
      window.open(`https://api.whatsapp.com/send?phone=${waPhone}&text=${encodeURIComponent(waText)}`, "_blank");

      cart = [];
      saveAndSyncCart();
      document.getElementById("checkoutForm").reset();
      toggleCart(false);
      showToast("تم إرسال الطلب بنجاح!");
    } else {
      alert(result.message || "حدث خطأ أثناء حفظ الطلب.");
    }
  } catch (err) {
    alert("خطأ في الاتصال.");
  } finally {
    btn.disabled = false;
    btn.textContent = "تأكيد الطلب";
  }
}

document.addEventListener("DOMContentLoaded", initStore);