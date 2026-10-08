const API = "http://localhost:5000/api";

let currentUser = null;
let selectedAddressId = null;
let currentCartTotal = 0;
let currentCartPayableTotal = 0;
let productCartState = {};
let allProducts = [];
let activeCategory = 'all';
let productSearchTerm = '';
let addressState = [];
let allOrders = [];
let bankAccountState = [];
let teamTreeData = null;
let teamTreeZoom = 1;
let supportRequests = [];

const authView = document.querySelector("#authView");
const appView = document.querySelector("#appView");
const loginForm = document.querySelector("#loginForm");
const registerForm = document.querySelector("#registerForm");
const logoutBtn = document.querySelector("#logoutBtn");
const messageBox = document.querySelector("#message");

function getCurrencyProfile() {
  const country = String((currentUser && currentUser.ulke) || "").toLocaleLowerCase("tr-TR");

  if (country.includes("azerbaycan") || country.includes("azərbaycan")) {
    return { symbol: "₼", code: "AZN", locale: "az-AZ", rate: 0.054 };
  }

  if (country.includes("amerika") || country.includes("abd") || country.includes("united") || country.includes("usa")) {
    return { symbol: "$", code: "USD", locale: "en-US", rate: 0.031 };
  }

  return { symbol: "₺", code: "TRY", locale: "tr-TR", rate: 1 };
}

function formatMoney(value) {
  const currency = getCurrencyProfile();
  const convertedValue = Number(value || 0) * currency.rate;

  return `${currency.symbol} ${convertedValue.toLocaleString(currency.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function showMessage(text, type = "success") {
  messageBox.textContent = text;
  messageBox.classList.remove("hidden", "error");

  if (type === "error") {
    messageBox.classList.add("error");
  }
}

function hideMessage() {
  messageBox.textContent = "";
  messageBox.classList.add("hidden");
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.hata || "İşlem sırasında hata oluştu.");
  }

  return data;
}

function getDiscountRate(packageName) {
  if (packageName === "sapphire") return 20;
  if (packageName === "emerald") return 35;
  if (packageName === "diamond") return 50;
  return 0;
}

function getRankLabel(packageName) {
  if (packageName === "sapphire") return "Sapphire Paket";
  if (packageName === "emerald") return "Emerald Paket";
  if (packageName === "diamond") return "Diamond Paket";
  return "Standart Paket";
}

function getRankLetter(packageName) {
  if (packageName === "sapphire") return "S";
  if (packageName === "emerald") return "E";
  if (packageName === "diamond") return "D";
  return "N";
}

function isAdminUser(user) {
  if (!user) return false;

  const adminEmails = ["admin@nova.com", "havva@nova.com", "havva@nova.com.tr"];
  return Number(user.uye_id) === 7 || adminEmails.includes(String(user.email || "").toLowerCase());
}

function syncAdminVisibility() {
  const adminButton = document.querySelector('[data-view="admin"]');
  const adminAllowed = isAdminUser(currentUser);

  if (adminButton) {
    adminButton.classList.toggle("hidden", !adminAllowed);
  }

  if (!adminAllowed && document.body.dataset.view === "admin") {
    setView("dashboard");
  }
}
function formatShortDate(value) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function getActiveDaysLeft(user) {
  const activityPeriod = 30;
  const startDate = user && user.kayit_tarihi ? new Date(user.kayit_tarihi) : new Date();

  if (Number.isNaN(startDate.getTime())) {
    return { startDate: null, daysLeft: activityPeriod };
  }

  const today = new Date();
  const elapsedDays = Math.max(0, Math.floor((today - startDate) / 86400000));
  const daysLeft = Math.max(0, activityPeriod - elapsedDays);

  return { startDate, daysLeft };
}

function updateActiveDays(user) {
  const activeDaysEl = document.querySelector("#activeDays");
  const activeTextEl = document.querySelector("#activeDayText");
  const activeCard = document.querySelector(".activity-day-card");
  const activity = getActiveDaysLeft(user);

  if (activeDaysEl) {
    activeDaysEl.textContent = activity.daysLeft;
  }

  if (activeTextEl) {
    const startText = activity.startDate ? formatShortDate(activity.startDate) : "bugün";
    activeTextEl.textContent = `Başlangıç: ${startText} • Aktiflik korunmazsa alt bayi alışverişlerinden kazanç oluşmaz.`;
  }

  if (activeCard) {
    activeCard.classList.toggle("expired", activity.daysLeft === 0);
  }
}
function setAuthTab(tabName) {
  document.querySelectorAll("[data-auth-tab]").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.authTab === tabName);
  });

  loginForm.classList.toggle("hidden", tabName !== "login");
  registerForm.classList.toggle("hidden", tabName !== "register");
}
function setView(viewName) {
  if (viewName === "admin" && !isAdminUser(currentUser)) {
    showMessage("Admin paneli sadece yetkili kullanıcılar içindir.", "error");
    viewName = "dashboard";
  }

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === viewName);
  });

  document.querySelectorAll(".view-section").forEach((section) => {
    section.classList.add("hidden");
  });

  document.querySelector(`#${viewName}View`).classList.remove("hidden");

  const titles = {
    dashboard: "Panel",
    products: "Ürünler",
    cart: "Sepet",
    orders: "Siparişler",
    orderDetail: "Sipariş Detayı",
    wallet: "Cüzdan",
    earnings: "Kazançlar",
    team: "Takım Ağacı",
    support: "Talepler",
    admin: "Admin"
  };

  document.querySelector("#pageTitle").textContent = titles[viewName];
  document.body.dataset.view = viewName;

  if (viewName === "dashboard") loadDashboardStats();
  if (viewName === "products") loadProducts();
  if (viewName === "cart") {
    hideMessage();
    loadCart(true);
    loadAddresses();
  }
  if (viewName === "orders") loadOrders();
  if (viewName === "wallet") loadWallet();
  if (viewName === "earnings") loadEarnings();
  if (viewName === "team") loadTeamTree();
  if (viewName === "support") loadSupportRequests();
  if (viewName === "admin") loadAdmin();
}
function openPanel(user) {
  currentUser = user;
  authView.classList.add("hidden");
  appView.classList.remove("hidden");

  document.querySelector("#userName").textContent = `${user.ad} ${user.soyad}`;
  document.querySelector("#userPackage").textContent = user.paket_seviyesi || "standart";
  document.querySelector("#memberNo").textContent = user.uye_no || "Bayi";
  syncAdminVisibility();

  document.querySelector("#welcomeName").textContent = `${user.ad} ${user.soyad}`;
  document.querySelector("#welcomeId").textContent = user.uye_no || user.uye_id;
  updateActiveDays(user);

  const rankVisual = document.querySelector("#rankVisual");
  const rankClass = `rank-${user.paket_seviyesi || "standart"}`;

  rankVisual.className = `rank-visual ${rankClass}`;
  rankVisual.innerHTML = "";

  setView("dashboard");
}
function closePanel() {
  localStorage.removeItem("nova_user");
  currentUser = null;
  selectedAddressId = null;
  currentCartTotal = 0;
  currentCartPayableTotal = 0;
  appView.classList.add("hidden");
  authView.classList.remove("hidden");
  hideMessage();
}

async function refreshProfile() {
  if (!currentUser) return;

  const data = await apiRequest(`/auth/profile/${currentUser.uye_id}`);
  currentUser = data.uye || data;
  localStorage.setItem("nova_user", JSON.stringify(currentUser));
}


function updateProductSummary(cartItems = []) {
  const itemCount = cartItems.reduce((sum, item) => sum + Number(item.adet || 0), 0);
  const total = cartItems.reduce((sum, item) => {
    return sum + Number(item.fiyat || item.birim_fiyat || 0) * Number(item.adet || 0);
  }, 0);

  const discountRate = getDiscountRate(currentUser.paket_seviyesi);
  const discountedTotal = total - total * (discountRate / 100);
  const packageName = getRankLabel(currentUser.paket_seviyesi).replace(" Paket", "");

  const countEl = document.querySelector("#productTotalAmount");
  const payableEl = document.querySelector("#productDiscountedAmount");
  const rateTextEl = document.querySelector("#productDiscountRate");
  const discountPercentEl = document.querySelector("#productDiscountPercent");
  const packageEl = document.querySelector("#productActivePackage");
  const buttonTotalEl = document.querySelector("#productCartButtonTotal");

  if (countEl) countEl.textContent = `${itemCount} ürün`;
  if (payableEl) payableEl.textContent = formatMoney(discountedTotal);
  if (rateTextEl) rateTextEl.textContent = `${packageName} paketi`;
  if (discountPercentEl) discountPercentEl.textContent = `%${discountRate}`;
  if (packageEl) packageEl.textContent = `${packageName} indirimi uygulanır.`;
  if (buttonTotalEl) buttonTotalEl.textContent = formatMoney(discountedTotal);
}
async function loadProducts() {
  const grid = document.querySelector("#productsGrid");
  grid.innerHTML = `<div class="panel-card">Ürünler yükleniyor...</div>`;

  try {
    const [products, cart] = await Promise.all([
      apiRequest("/products"),
      apiRequest(`/cart/${currentUser.uye_id}`).catch(() => [])
    ]);

    allProducts = products || [];
    productCartState = {};

    const cartItems = cart.urunler || cart || [];
    updateProductSummary(cartItems);

    cartItems.forEach((item) => {
      productCartState[item.urun_id] = {
        sepet_id: item.sepet_id,
        adet: Number(item.adet || 0)
      };
    });

    renderProducts();
  } catch (error) {
    grid.innerHTML = `<div class="panel-card">${error.message}</div>`;
  }
}

function renderProducts() {
  const grid = document.querySelector("#productsGrid");
  const discountRate = getDiscountRate(currentUser.paket_seviyesi);
  let visibleProducts = activeCategory === "all"
    ? allProducts
    : allProducts.filter((product) => product.kategori_adi === activeCategory);

  if (productSearchTerm) {
    const search = productSearchTerm.toLocaleLowerCase("tr-TR");
    visibleProducts = visibleProducts.filter((product) => {
      return `${product.urun_adi} ${product.aciklama || ""} ${product.kategori_adi || ""}`
        .toLocaleLowerCase("tr-TR")
        .includes(search);
    });
  }

  if (!visibleProducts || visibleProducts.length === 0) {
    grid.innerHTML = `<div class="panel-card">Bu kategoride aktif ürün bulunamadı.</div>`;
    return;
  }

  grid.innerHTML = visibleProducts.map((product) => {
    const price = Number(product.fiyat || 0);
    const discountedPrice = price - price * (discountRate / 100);
    const cartInfo = productCartState[product.urun_id] || { adet: 0 };
    const visibleStock = Math.max(Number(product.stok_adedi || 0) - Number(cartInfo.adet || 0), 0);
    const category = product.kategori_adi || "Nova";
    const oldPrice = discountRate > 0 ? `<del>${formatMoney(price)}</del>` : "";
    const discountTag = discountRate > 0 ? `<span class="discount-tag">%${discountRate} indirim</span>` : "";

    return `
      <article class="product-card shop-product-card">
        <div class="product-image product-placeholder">
          <span class="product-badge left">Stok ${visibleStock}</span>
          <span class="product-badge right">${category}</span>
          <img src="./assets/products/product-${product.urun_id}.png" alt="${product.urun_adi}" />
        </div>

        <div class="product-body shop-product-body">
          <h4>${product.urun_adi}</h4>
          <p>${product.aciklama || "Nova Global ürünü"}</p>

          <div class="product-price-line">
            <span class="price-side old-price-slot">${oldPrice}</span>
            <strong>${formatMoney(discountedPrice)}</strong>
            <span class="price-side discount-slot">${discountTag}</span>
          </div>

          <div class="quantity-row product-quantity-row">
            <button type="button" onclick="changeProductQuantity(${product.urun_id}, -1)">-</button>
            <span id="productQty-${product.urun_id}">${cartInfo.adet}</span>
            <button type="button" onclick="changeProductQuantity(${product.urun_id}, 1)">+</button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}async function changeProductQuantity(productId, delta) {
  const current = productCartState[productId] || { adet: 0, sepet_id: null };
  const nextQuantity = current.adet + delta;

  if (nextQuantity < 0) return;

  try {
    if (delta > 0 && !current.sepet_id) {
      await apiRequest("/cart/add", {
        method: "POST",
        body: JSON.stringify({
          uye_id: currentUser.uye_id,
          urun_id: productId,
          adet: 1
        })
      });
    } else if (delta > 0) {
      await apiRequest(`/cart/update/${current.sepet_id}`, {
        method: "PUT",
        body: JSON.stringify({ adet: nextQuantity })
      });
    } else if (nextQuantity === 0 && current.sepet_id) {
      await apiRequest(`/cart/remove/${current.sepet_id}`, {
        method: "DELETE"
      });
    } else if (current.sepet_id) {
      await apiRequest(`/cart/update/${current.sepet_id}`, {
        method: "PUT",
        body: JSON.stringify({ adet: nextQuantity })
      });
    }

    await loadProducts();
    showMessage("Sepet güncellendi.");
  } catch (error) {
    showMessage(error.message, "error");
  }
}

async function addToCart(productId, quantity) {
  try {
    await apiRequest("/cart/add", {
      method: "POST",
      body: JSON.stringify({
        uye_id: currentUser.uye_id,
        urun_id: productId,
        adet: quantity
      })
    });

    showMessage("Ürün sepete eklendi.");
    loadCart(true);
  } catch (error) {
    showMessage(error.message, "error");
  }
}
async function loadCart(silent = false) {
  const cartItems = document.querySelector("#cartItems");
  const cartSummary = document.querySelector("#cartSummary");

  if (!cartItems || !cartSummary) return;

  try {
    const cart = await apiRequest(`/cart/${currentUser.uye_id}`);
    const items = cart.urunler || cart;

    currentCartTotal = 0;
    currentCartPayableTotal = 0;

    if (!items || items.length === 0) {
      cartItems.innerHTML = `<div class="cart-empty">Sepetiniz şu an boş.</div>`;
      cartSummary.innerHTML = `
        <div class="price-row"><span>Toplam Tutar</span><strong>${formatMoney(0)}</strong></div>
        <div class="price-row"><span>Paket İndirimi</span><strong>%0</strong></div>
        <div class="price-row"><span>Kargo</span><strong>${formatMoney(0)}</strong></div>
        <div class="price-row total"><span>Ödenecek Tutar</span><strong>${formatMoney(0)}</strong></div>
      `;
      return;
    }

    const discountRate = getDiscountRate(currentUser.paket_seviyesi);

    cartItems.innerHTML = items.map((item) => {
      const unitPrice = Number(item.fiyat || item.birim_fiyat || 0);
      const itemTotal = unitPrice * Number(item.adet || 0);
      const itemDiscount = itemTotal * (discountRate / 100);
      const itemDiscountedTotal = itemTotal - itemDiscount;
      currentCartTotal += itemTotal;

      return `
        <div class="cart-line-item">
          <img src="./assets/products/product-${item.urun_id}.png" alt="${item.urun_adi}" />
          <div class="cart-line-main">
            <strong>${item.urun_adi}</strong>
            <span>Birim fiyat: ${formatMoney(unitPrice)}</span>
            <span class="cart-discount-note">%${discountRate} indirim: -${formatMoney(itemDiscount)}</span>
            <div class="cart-quantity-control">
              <button type="button" onclick="changeCartQuantity(${item.sepet_id}, ${item.adet}, -1)">-</button>
              <span>${item.adet}</span>
              <button type="button" onclick="changeCartQuantity(${item.sepet_id}, ${item.adet}, 1)">+</button>
            </div>
          </div>
          <div class="cart-line-actions">
            <del class="cart-line-old-price">${formatMoney(itemTotal)}</del>
            <strong class="cart-line-price">${formatMoney(itemDiscountedTotal)}</strong>
            <button class="remove-cart-btn" type="button" onclick="removeCartItem(${item.sepet_id})">Çıkar</button>
          </div>
        </div>
      `;
    }).join("");

    const discountAmount = currentCartTotal * (discountRate / 100);
    const discountedTotal = currentCartTotal - discountAmount;
    const shippingLimit = 2500;
    const shippingFee = 150;
    const isShippingFree = discountedTotal >= shippingLimit;
    const payableTotal = discountedTotal + (isShippingFree ? 0 : shippingFee);
    currentCartPayableTotal = payableTotal;

    const shippingText = isShippingFree
      ? `<span class="shipping-free">${formatMoney(shippingFee)}</span>`
      : formatMoney(shippingFee);

    cartSummary.innerHTML = `
      <div class="price-row"><span>Toplam Tutar</span><strong>${formatMoney(currentCartTotal)}</strong></div>
      <div class="price-row"><span>Paket İndirimi</span><strong>%${discountRate}</strong></div>
      <div class="price-row"><span>İndirim Tutarı</span><strong>${formatMoney(discountAmount)}</strong></div>
      <div class="price-row"><span>Kargo</span><strong>${shippingText}</strong></div>
      <div class="shipping-note">${isShippingFree ? "2.500 TL üzeri alışverişte kargo ücretsiz." : "2.500 TL altı siparişlerde kargo ücreti eklenir."}</div>
      <div class="price-row total"><span>Ödenecek Tutar</span><strong>${formatMoney(payableTotal)}</strong></div>
    `;

    renderPaymentDetails();
  } catch (error) {
    if (!silent) showMessage(error.message, "error");
  }
}
async function changeCartQuantity(sepetId, currentQuantity, delta) {
  const nextQuantity = Number(currentQuantity) + Number(delta);

  try {
    if (nextQuantity < 1) {
      await apiRequest(`/cart/remove/${sepetId}`, {
        method: "DELETE"
      });
    } else {
      await apiRequest(`/cart/update/${sepetId}`, {
        method: "PUT",
        body: JSON.stringify({ adet: nextQuantity })
      });
    }

    await loadCart(true);
    if (document.body.dataset.view === "products") {
      await loadProducts();
    }
  } catch (error) {
    showMessage(error.message, "error");
  }
}

async function removeCartItem(sepetId) {
  try {
    await apiRequest(`/cart/remove/${sepetId}`, {
      method: "DELETE"
    });

    await loadCart(true);
    if (document.body.dataset.view === "products") {
      await loadProducts();
    }
  } catch (error) {
    showMessage(error.message, "error");
  }
}
function fillAddressForm(adresId) {
  const form = document.querySelector("#addressForm");
  if (!form) return;

  const address = addressState.find((item) => Number(item.adres_id) === Number(adresId));
  if (!address) return;

  form.elements.adres_id.value = address.adres_id || "";
  form.elements.teslim_alacak_ad.value = address.teslim_alacak_ad || "";
  form.elements.teslim_alacak_soyad.value = address.teslim_alacak_soyad || "";
  form.elements.teslim_alacak_telefon.value = address.teslim_alacak_telefon || "";
  form.elements.adres_basligi.value = address.adres_basligi || "";
  form.elements.ulke_id.value = address.ulke_id || "1";
  form.elements.il.value = address.il || "";
  form.elements.ilce.value = address.ilce || "";
  form.elements.posta_kodu.value = address.posta_kodu || "";
  form.elements.acik_adres.value = address.acik_adres || address.adres || "";

  selectedAddressId = Number(adresId);
  document.querySelectorAll("input[name='address']").forEach((input) => {
    input.checked = Number(input.value) === selectedAddressId;
  });
}

async function saveAddressForm(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const formData = new FormData(form);
  const adresId = formData.get("adres_id");
  const addressPath = adresId ? `/addresses/update/${adresId}` : "/addresses/add";
  const addressMethod = adresId ? "PUT" : "POST";

  try {
    await apiRequest(addressPath, {
      method: addressMethod,
      body: JSON.stringify({
        uye_id: currentUser.uye_id,
        ulke_id: Number(formData.get("ulke_id") || 1),
        teslim_alacak_ad: formData.get("teslim_alacak_ad"),
        teslim_alacak_soyad: formData.get("teslim_alacak_soyad"),
        teslim_alacak_telefon: formData.get("teslim_alacak_telefon"),
        adres_basligi: formData.get("adres_basligi") || "Teslimat Adresi",
        il: formData.get("il"),
        ilce: formData.get("ilce"),
        posta_kodu: formData.get("posta_kodu") || null,
        acik_adres: formData.get("acik_adres")
      })
    });

    form.reset();
    showMessage(adresId ? "Adres güncellendi." : "Adres kaydedildi.");
    loadAddresses();
  } catch (error) {
    showMessage(error.message, "error");
  }
}
async function loadAddresses() {
  const addressList = document.querySelector("#addressList");
  if (!addressList) return;

  addressList.innerHTML = `<div class="address-item muted-address">Adresler yükleniyor...</div>`;

  try {
    const addresses = await apiRequest(`/addresses/${currentUser.uye_id}`);
    addressState = addresses || [];

    if (addressState.length === 0) {
      selectedAddressId = null;
      addressList.innerHTML = `<div class="address-item muted-address">Kayıtlı adres bulunamadı. Üstteki formdan yeni teslimat adresi ekleyebilirsin.</div>`;
      return;
    }

    selectedAddressId = selectedAddressId || addressState[0].adres_id;

    addressList.innerHTML = addressState.map((address) => {
      const fullName = `${address.teslim_alacak_ad || ""} ${address.teslim_alacak_soyad || ""}`.trim() || "Alıcı bilgisi yok";
      const fullAddress = address.acik_adres || address.adres || "Adres bilgisi yok";
      const cityLine = [address.ilce, address.il].filter(Boolean).join(" / ");

      return `
        <div class="address-item saved-address">
          <label class="address-choice">
            <input type="radio" name="address" value="${address.adres_id}" ${Number(address.adres_id) === Number(selectedAddressId) ? "checked" : ""} />
            <span>
              <strong>${address.adres_basligi || "Teslimat Adresi"}</strong>
              <small>${fullName} ${address.teslim_alacak_telefon ? `- ${address.teslim_alacak_telefon}` : ""}</small>
              <small>${fullAddress}</small>
              <small>${cityLine}</small>
            </span>
          </label>
          <button class="mini-edit-btn" type="button" onclick="fillAddressForm(${address.adres_id})">Düzenle</button>
        </div>
      `;
    }).join("");

    document.querySelectorAll("input[name='address']").forEach((input) => {
      input.addEventListener("change", () => {
        selectedAddressId = Number(input.value);
      });
    });
  } catch (error) {
    addressList.innerHTML = `<div class="address-item muted-address">${error.message}</div>`;
  }
}

async function loadBankAccounts() {
  if (bankAccountState.length > 0) return bankAccountState;

  try {
    bankAccountState = await apiRequest("/payments/bank-accounts");
  } catch (error) {
    bankAccountState = [];
  }

  return bankAccountState;
}

async function renderPaymentDetails() {
  const panel = document.querySelector("#paymentDetailPanel");
  const selectedPayment = document.querySelector("input[name='paymentType']:checked");
  if (!panel) return;

  if (!selectedPayment) {
    panel.innerHTML = `<div class="payment-empty-note">Ödeme yöntemini seç, gerekli bilgiler burada açılacak.</div>`;
    return;
  }

  const type = selectedPayment.value;

  if (type === "kart") {
    panel.innerHTML = `
      <div class="card-payment-box premium-card-payment">
        <div class="mini-card-preview">
          <span>Nova Global</span>
          <strong>••••  ••••  ••••  2026</strong>
          <small>Güvenli kart ödeme simülasyonu</small>
        </div>
        <label>Kart Üzerindeki İsim<input id="cardHolderName" placeholder="Ad Soyad" autocomplete="cc-name" /></label>
        <label>Kart Numarası<input id="cardNumber" inputmode="numeric" maxlength="19" placeholder="0000 0000 0000 0000" autocomplete="cc-number" /></label>
        <div class="two-col compact-fields">
          <label>Son Kullanma<input id="cardExpiry" maxlength="5" placeholder="AA/YY" autocomplete="cc-exp" /></label>
          <label>CVV<input id="cardCvv" inputmode="numeric" maxlength="3" placeholder="123" autocomplete="cc-csc" /></label>
        </div>
        <div class="payment-info-banner">Kart ödemesi test modundadır. Bilgiler yalnızca ekranda doğrulanır.</div>
      </div>
    `;
    bindCardInputs();
    return;
  }

  if (type === "havale") {
    panel.innerHTML = `<div class="payment-empty-note">Banka hesapları yükleniyor...</div>`;
    loadBankAccounts().then((accounts) => {
      panel.innerHTML = `
        <div class="bank-transfer-box">
          <div class="payment-info-banner">Havale/EFT siparişi ödeme kontrol bekliyor olarak oluşur. Admin onaylayınca sipariş ödeme onaylandı olur.</div>
          ${accounts.map((account) => `
            <div class="bank-account-row">
              <strong>${account.banka_adi}</strong>
              <span>${account.hesap_sahibi}</span>
              <code>${account.iban}</code>
              <small>${account.para_birimi_kodu || "TRY"}</small>
            </div>
          `).join("") || `<div class="payment-empty-note">Aktif banka hesabı bulunamadı.</div>`}
        </div>
      `;
    });
    return;
  }

  if (type === "kendi_cuzdani") {
    panel.innerHTML = `<div class="payment-empty-note">Cüzdan bakiyesi kontrol ediliyor...</div>`;

    try {
      const data = await apiRequest(`/wallet/${currentUser.uye_id}`);
      const wallet = data.cuzdan || {};
      const balance = Number(wallet.bakiye || 0);
      const payable = Number(currentCartPayableTotal || 0);
      const enough = balance >= payable && payable > 0;

      panel.innerHTML = `
        <div class="wallet-payment-box ${enough ? "wallet-ok" : "wallet-warning"}">
          <strong>Cüzdan ile ödeme</strong>
          <p>${enough ? "Bakiye yeterli. Sipariş oluşturulunca tutar otomatik düşer." : "Bakiye yetersizse sipariş oluşturulmaz. Sepet tutarını veya ödeme yöntemini kontrol et."}</p>
          <div class="payment-balance-grid">
            <span>Cüzdan Bakiyesi: <b>${formatMoney(balance)}</b></span>
            <span>Ödenecek: <b>${formatMoney(payable)}</b></span>
            <span>Kalan: <b>${formatMoney(balance - payable)}</b></span>
          </div>
        </div>
      `;
    } catch (error) {
      panel.innerHTML = `<div class="payment-empty-note error-note">Cüzdan bilgisi okunamadı: ${error.message}</div>`;
    }
    return;
  }

  if (type === "sponsor_cuzdani") {
    panel.innerHTML = `
      <div class="sponsor-payment-box">
        <strong>Sponsor cüzdan onayı</strong>
        <p>Sipariş oluşturulur fakat ödeme onay bekliyor durumunda kalır. Admin/sponsor onayı tamamlanınca ödeme onaylanır.</p>
        <div class="payment-balance-grid">
          <span>Sponsor Üye ID: <b>${currentUser.sponsor_uye_id || "Sponsor bulunamadı"}</b></span>
          <span>Talep Tutarı: <b>${formatMoney(currentCartPayableTotal)}</b></span>
          <span>Durum: <b>Onay bekliyor</b></span>
        </div>
      </div>
    `;
  }
}

function bindCardInputs() {
  const number = document.querySelector("#cardNumber");
  const expiry = document.querySelector("#cardExpiry");
  const cvv = document.querySelector("#cardCvv");

  if (number) {
    number.addEventListener("input", () => {
      const digits = number.value.replace(/\D/g, "").slice(0, 16);
      number.value = digits.replace(/(.{4})/g, "$1 ").trim();
    });
  }

  if (expiry) {
    expiry.addEventListener("input", () => {
      const digits = expiry.value.replace(/\D/g, "").slice(0, 4);
      expiry.value = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
    });
  }

  if (cvv) {
    cvv.addEventListener("input", () => {
      cvv.value = cvv.value.replace(/\D/g, "").slice(0, 3);
    });
  }
}

async function walletHasEnoughBalance() {
  const data = await apiRequest(`/wallet/${currentUser.uye_id}`);
  const balance = Number((data.cuzdan || {}).bakiye || 0);
  const payable = Number(currentCartPayableTotal || 0);

  if (balance < payable) {
    showMessage(`Cüzdan bakiyesi yetersiz. Bakiye: ${formatMoney(balance)}, gerekli tutar: ${formatMoney(payable)}.`, "error");
    return false;
  }

  return true;
}

function validateSelectedPayment(paymentType) {
  if (paymentType !== "kart") return true;

  const name = document.querySelector("#cardHolderName")?.value.trim();
  const number = document.querySelector("#cardNumber")?.value.replace(/\s/g, "");
  const expiry = document.querySelector("#cardExpiry")?.value.trim();
  const cvv = document.querySelector("#cardCvv")?.value.trim();

  if (!name || !/^\d{16}$/.test(number || "") || !/^\d{2}\/\d{2}$/.test(expiry || "") || !/^\d{3}$/.test(cvv || "")) {
    showMessage("Kart bilgilerini eksiksiz girmelisin.", "error");
    return false;
  }

  return true;
}
async function createOrder() {
  if (!selectedAddressId) {
    showMessage("Önce adres seçmelisin.", "error");
    return;
  }

  const selectedPayment = document.querySelector("input[name='paymentType']:checked");

  if (!selectedPayment) {
    showMessage("Ödeme yöntemi seçmelisin.", "error");
    return;
  }

  const paymentType = selectedPayment.value;

  if (paymentType === "sponsor_cuzdani") {
    await refreshProfile();
  }

  if (!validateSelectedPayment(paymentType)) return;

  if (paymentType === "kendi_cuzdani" && !(await walletHasEnoughBalance())) return;

  if (paymentType === "sponsor_cuzdani" && !currentUser.sponsor_uye_id) {
    showMessage("Sponsor cüzdanı için kayıtlı sponsor bulunamadı.", "error");
    return;
  }

  try {
    const order = await apiRequest("/orders/create", {
      method: "POST",
      body: JSON.stringify({
        uye_id: currentUser.uye_id,
        adres_id: selectedAddressId
      })
    });

    const payerId = paymentType === "sponsor_cuzdani"
      ? currentUser.sponsor_uye_id
      : currentUser.uye_id;

    await apiRequest("/payments/create", {
      method: "POST",
      body: JSON.stringify({
        siparis_id: order.siparis_id,
        siparis_veren_uye_id: currentUser.uye_id,
        odeme_yapan_uye_id: payerId,
        odeme_tipi: paymentType,
        odeme_tutari: currentCartPayableTotal || order.odenecek_tutar,
        aciklama: "Frontend üzerinden ödeme oluşturuldu."
      })
    });

    await refreshProfile();
    openPanel(currentUser);
    setView("orders");
    const successMessage = paymentType === "havale"
      ? "Sipariş oluşturuldu. Havale/EFT ödeme kontrol bekliyor."
      : paymentType === "sponsor_cuzdani"
        ? "Sipariş oluşturuldu. Sponsor cüzdan onayı bekleniyor."
        : "Sipariş ve ödeme oluşturuldu.";
    showMessage(successMessage);
  } catch (error) {
    showMessage(error.message, "error");
  }
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getPaymentLabel(type) {
  const labels = {
    kart: "Kredi Kartı",
    havale: "Havale/EFT",
    kendi_cuzdani: "Cüzdan",
    sponsor_cuzdani: "Sponsor Cüzdanı"
  };

  return labels[type] || "-";
}

function getDisplayOrderStatus(order) {
  if (!order) return "-";
  if (Number(order.durum_id) === 2 && order.odeme_tipi === "sponsor_cuzdani") {
    return "Sponsor Cüzdan Onayı Bekliyor";
  }
  if (Number(order.durum_id) === 2 && order.odeme_tipi === "havale") {
    return "Havale/EFT Kontrol Bekliyor";
  }
  return order.durum_adi || "Durum yok";
}

async function loadDashboardStats() {
  if (!currentUser) return;

  try {
    const teamPath = "/team/" + currentUser.uye_id;
    const ordersPath = "/orders/user/" + currentUser.uye_id;
    const earningsPath = "/earnings/" + currentUser.uye_id;
    const [teamData, ordersResponse, earnings] = await Promise.all([
      apiRequest(teamPath).catch(() => null),
      apiRequest(ordersPath).catch(() => []),
      apiRequest(earningsPath).catch(() => null)
    ]);

    const orders = Array.isArray(ordersResponse) ? ordersResponse : (ordersResponse && ordersResponse.value ? ordersResponse.value : []);
    const ozet = teamData && teamData.ozet ? teamData.ozet : {};
    const leftCount = Number(ozet.sol_kol_bayi || 0);
    const rightCount = Number(ozet.sag_kol_bayi || 0);
    const now = new Date();
    const monthlyOrders = orders.filter((order) => {
      if (!order.siparis_tarihi) return false;
      const date = new Date(order.siparis_tarihi);
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).length;

    const earningSummary = earnings && earnings.ozet ? earnings.ozet : {};
    const pendingBonus = Number(earningSummary.toplam_bekleyen || 0);
    const paidBonus = Number(earningSummary.toplam_odenen || 0);
    const approvedBonus = Number(earningSummary.toplam_onaylanan || 0);
    const totalBonus = pendingBonus + paidBonus + approvedBonus;
    const activeLeftCount = Number(ozet.sol_aktif_bayi || 0);
    const activeRightCount = Number(ozet.sag_aktif_bayi || 0);
    const giftCount = Math.min(15, (teamData && teamData.bayiler ? teamData.bayiler : []).filter((member) => Number(member.toplam_siparis_tutari || 0) > 0).length);

    const setText = (selector, value) => {
      const el = document.querySelector(selector);
      if (el) el.textContent = value;
    };
    const setWidth = (selector, value) => {
      const el = document.querySelector(selector);
      if (el) el.style.width = Math.max(0, Math.min(100, value)) + "%";
    };

    setText("#dashboardLeftCount", leftCount);
    setText("#dashboardRightCount", rightCount);
    setText("#dashboardMonthlyOrders", monthlyOrders);
    setText("#dashboardPendingBonus", formatMoney(pendingBonus));
    setText("#dashboardLeftBonusText", "Sol kol: " + activeLeftCount + " / 2 aktif bayi");
    setText("#dashboardRightBonusText", "Sağ kol: " + activeRightCount + " / 2 aktif bayi");
    setWidth("#dashboardLeftBonusLine", (activeLeftCount / 2) * 100);
    setWidth("#dashboardRightBonusLine", (activeRightCount / 2) * 100);
    setText("#dashboardMonthlyBonus", formatMoney(pendingBonus));
    setText("#dashboardTotalBonus", formatMoney(totalBonus));
    setText("#dashboardGiftText", giftCount + " / 15");
    setWidth("#dashboardGiftLine", (giftCount / 15) * 100);
  } catch (error) {
    console.log(error);
  }
}
function getOrderStatusClass(statusId) {
  const id = Number(statusId);
  if (id === 6) return "success";
  if (id === 7 || id === 8) return "danger";
  if (id === 1 || id === 2) return "warning";
  return "info";
}

function getFilteredOrders() {
  const idValue = document.querySelector("#orderFilterId")?.value.trim().replace("#", "") || "";
  const paymentValue = document.querySelector("#orderFilterPayment")?.value || "";
  const statusValue = document.querySelector("#orderFilterStatus")?.value || "";
  const startValue = document.querySelector("#orderFilterStart")?.value || "";
  const endValue = document.querySelector("#orderFilterEnd")?.value || "";
  const searchValue = (document.querySelector("#orderFilterSearch")?.value || "").toLowerCase().trim();

  return allOrders.filter((order) => {
    const orderDate = order.siparis_tarihi ? new Date(order.siparis_tarihi) : null;
    const haystack = `${order.siparis_id} ${order.siparis_no || ""} ${order.durum_adi || ""} ${getPaymentLabel(order.odeme_tipi)}`.toLowerCase();

    if (idValue && !String(order.siparis_id).includes(idValue) && !(order.siparis_no || "").includes(idValue)) return false;
    if (paymentValue && order.odeme_tipi !== paymentValue) return false;
    if (statusValue && Number(order.durum_id) !== Number(statusValue)) return false;
    if (searchValue && !haystack.includes(searchValue)) return false;
    if (startValue && orderDate && orderDate < new Date(`${startValue}T00:00:00`)) return false;
    if (endValue && orderDate && orderDate > new Date(`${endValue}T23:59:59`)) return false;

    return true;
  });
}

function renderOrders() {
  const ordersList = document.querySelector("#ordersList");
  if (!ordersList) return;

  const filteredOrders = getFilteredOrders();

  if (filteredOrders.length === 0) {
    ordersList.innerHTML = `<tr><td colspan="6" class="orders-empty">Sipariş bulunamadı.</td></tr>`;
    return;
  }

  ordersList.innerHTML = filteredOrders.map((order) => `
    <tr>
      <td><strong>#${order.siparis_id}</strong></td>
      <td>${formatDateTime(order.siparis_tarihi)}</td>
      <td>${getPaymentLabel(order.odeme_tipi)}</td>
      <td><span class="status-pill ${getOrderStatusClass(order.durum_id)}">${getDisplayOrderStatus(order)}</span></td>
      <td><strong>${formatMoney(order.odenecek_tutar)}</strong></td>
      <td>
        <div class="order-actions">
          <button class="detail-btn" type="button" onclick="loadOrderDetail(${order.siparis_id})">Detay</button>
          ${Number(order.durum_id) <= 2 ? `<button class="pay-btn" type="button" onclick="setView('cart')">Ödeme Adımına Geç</button>` : ""}
        </div>
      </td>
    </tr>
  `).join("");
}

async function loadOrders() {
  const ordersList = document.querySelector("#ordersList");
  if (!ordersList) return;

  ordersList.innerHTML = `<tr><td colspan="6" class="orders-empty">Siparişler yükleniyor...</td></tr>`;

  try {
    allOrders = await apiRequest(`/orders/user/${currentUser.uye_id}`);
    renderOrders();
  } catch (error) {
    ordersList.innerHTML = `<tr><td colspan="6" class="orders-empty">${error.message}</td></tr>`;
  }
}

function renderOrderSteps(siparis) {
  const currentStatus = Number(siparis.durum_id || 1);
  const steps = [
    { id: 1, label: "Sipariş Alındı" },
    { id: 3, label: "Ödeme Onaylandı" },
    { id: 4, label: "Hazırlanıyor" },
    { id: 5, label: "Kargoya Verildi" },
    { id: 6, label: "Teslim Edildi" }
  ];

  return `
    <div class="order-steps">
      ${steps.map((step) => `
        <div class="order-step ${currentStatus >= step.id ? "active" : ""}">
          <span>${currentStatus >= step.id ? "✓" : ""}</span>
          <strong>${step.label}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

async function loadOrderDetail(orderId) {
  const detailPanel = document.querySelector("#orderDetailPanel");
  if (!detailPanel) return;

  setView("orderDetail");
  detailPanel.innerHTML = `<div class="orders-empty">Sipariş detayı yükleniyor...</div>`;

  try {
    const data = await apiRequest(`/orders/detail/${orderId}`);
    const siparis = data.siparis;
    const urunler = data.urunler || [];
    const adres = data.adres || {};
    const kargo = data.kargo || null;
    const discountRate = Number(siparis.indirim_orani || 0);
    const shippingFee = 150;
    const shippingFree = Number(siparis.odenecek_tutar || 0) >= 2500;
    const shippingDisplay = shippingFree ? `<span class="shipping-free">${formatMoney(shippingFee)}</span>` : formatMoney(shippingFee);
    const generalTotal = Number(siparis.odenecek_tutar || 0) + (shippingFree ? 0 : shippingFee);

    detailPanel.innerHTML = `
      <div class="order-detail-head">
        <button class="detail-back-btn" type="button" onclick="closeOrderDetail()">← Siparişlerime Dön</button>
        <h3>Siparişlerim - #${siparis.siparis_id}</h3>
        <span>${formatDateTime(siparis.siparis_tarihi)}</span>
      </div>

      ${renderOrderSteps(siparis)}

      <div class="detail-summary-grid">
        <article><span>Toplam Tutar</span><strong>${formatMoney(siparis.toplam_tutar)}</strong></article>
        <article><span>Ödeme Durumu</span><strong>${siparis.odeme_durumu || "-"}</strong></article>
        <article><span>Kargo Durumu</span><strong>${kargo ? "Kargoya Verildi" : "-"}</strong></article>
        <article><span>Paket İndirimi</span><strong>%${discountRate}</strong></article>
      </div>

      <div class="order-detail-grid">
        <div class="order-products-card">
          <div class="section-head compact">
            <h3>Ürünler</h3>
            <span class="order-chip">#${siparis.siparis_id}</span>
          </div>

          <div class="order-product-table-wrap">
            <table class="order-product-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Ürün</th>
                  <th>Ürün Adı</th>
                  <th>Miktar</th>
                  <th>Birim Fiyat</th>
                  <th>Ara Toplam</th>
                </tr>
              </thead>
              <tbody>
                ${urunler.map((item) => `
                  <tr>
                    <td>${item.urun_id}</td>
                    <td><img src="./assets/products/product-${item.urun_id}.png" alt="${item.urun_adi}" /></td>
                    <td><strong>${item.urun_adi}</strong><small>${item.aciklama || ""}</small></td>
                    <td>${item.adet}</td>
                    <td>${formatMoney(item.birim_fiyat)}</td>
                    <td>${formatMoney(item.ara_toplam)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>

          <div class="detail-total-lines">
            <div><span>Toplam Tutar</span><strong>${formatMoney(siparis.toplam_tutar)}</strong></div>
            <div><span>İndirim</span><strong>-${formatMoney(siparis.indirim_tutari)}</strong></div>
            <div><span>Kargo</span><strong>${shippingDisplay}</strong></div>
            <div><span>Genel Toplam</span><strong>${formatMoney(generalTotal)}</strong></div>
          </div>
        </div>

        <aside class="order-address-card">
          <h3>Adres & Fatura Bilgileri</h3>
          <span class="address-badge">Teslimat Adresi</span>
          <strong>${adres.teslim_alacak_ad || ""} ${adres.teslim_alacak_soyad || ""}</strong>
          <p>${adres.teslim_alacak_telefon || ""}</p>
          <p>${adres.il || ""} / ${adres.ilce || ""}</p>
          <p>${adres.acik_adres || "Adres bilgisi yok"}</p>

          <div class="cargo-mini-card">
            <strong>Kargo</strong>
            <span>${kargo ? `${kargo.firma_adi || ""} - ${kargo.takip_numarasi || "Takip no yok"}` : "Henüz kargo bilgisi yok"}</span>
          </div>
        </aside>
      </div>
    `;
  } catch (error) {
    detailPanel.innerHTML = `<div class="orders-empty">${error.message}</div>`;
  }
}

function closeOrderDetail() {
  const detailPanel = document.querySelector("#orderDetailPanel");
  if (!detailPanel) return;

  detailPanel.innerHTML = "";
  setView("orders");
}
function getWalletMovementLabel(type) {
  const labels = {
    komisyon: "Komisyon kazancı",
    sponsor_odeme: "Sponsor cüzdan ödemesi",
    cikis: "Cüzdan ödemesi",
    giris: "Cüzdan yükleme",
    iade: "İade"
  };

  return labels[type] || type || "Cüzdan hareketi";
}

function getWalletMovementClass(type) {
  const value = String(type || "");
  if (value.includes("odeme") || value === "cikis") return "negative";
  return "positive";
}

function getEarningStatusLabel(status) {
  const labels = {
    bekliyor: "Onay bekliyor",
    onaylandi: "Onaylandı",
    odendi: "Cüzdana aktarıldı"
  };

  return labels[status] || status || "Durum yok";
}

function getInitials(firstName, lastName) {
  return `${String(firstName || "").charAt(0)}${String(lastName || "").charAt(0)}`.toUpperCase() || "NG";
}

async function loadWallet(silent = false) {
  const walletArea = document.querySelector("#walletArea");
  if (!walletArea) return;

  walletArea.innerHTML = `<div class="wallet-loading-card">Cüzdan bilgileri hazırlanıyor...</div>`;

  try {
    const [walletData, earningData, sponsorPendingPayments] = await Promise.all([
      apiRequest(`/wallet/${currentUser.uye_id}`).catch(() => ({ cuzdan: null, hareketler: [] })),
      apiRequest(`/earnings/${currentUser.uye_id}`).catch(() => ({
        ozet: { toplam_bekleyen: 0, toplam_onaylanan: 0, toplam_odenen: 0 },
        kazanclar: []
      })),
      apiRequest(`/payments/sponsor-pending/${currentUser.uye_id}`).catch(() => [])
    ]);

    const wallet = walletData.cuzdan;
    const movements = walletData.hareketler || [];
    const earnings = earningData.kazanclar || [];
    const earningSummary = earningData.ozet || { toplam_bekleyen: 0, toplam_onaylanan: 0, toplam_odenen: 0 };
    const sponsorApprovals = Array.isArray(sponsorPendingPayments) ? sponsorPendingPayments : [];
    const balance = Number(wallet ? wallet.bakiye : 0);
    const blockedBalance = Number(wallet ? wallet.blokeli_bakiye : 0);
    const pendingEarning = Number(earningSummary.toplam_bekleyen || 0);
    const paidEarning = Number(earningSummary.toplam_odenen || 0);
    const approvedEarning = Number(earningSummary.toplam_onaylanan || 0);
    const memberNo = currentUser.uye_no || "900000";

    walletArea.innerHTML = `
      <div class="wallet-hero-grid">
        <article class="nova-wallet-card">
          <div class="wallet-card-orbit"></div>
          <div class="wallet-card-top">
            <div class="wallet-compass-logo" aria-hidden="true">
              <span class="compass-needle vertical"></span>
              <span class="compass-needle horizontal"></span>
              <span class="compass-core">NG</span>
            </div>
            <div>
              <span>Nova Global Ticaret</span>
              <strong>Premium Cüzdan</strong>
            </div>
          </div>

          <div class="wallet-card-chip" aria-hidden="true">
            <span></span><span></span><span></span><span></span>
          </div>

          <div class="wallet-card-balance">
            <span>Kullanılabilir Bakiye</span>
            <strong>${formatMoney(balance)}</strong>
          </div>

          <div class="wallet-card-number">NV • ${String(memberNo).slice(0, 3)} ${String(memberNo).slice(3, 6)} • ${wallet ? wallet.para_birimi_kodu || "TRY" : "TRY"}</div>

          <div class="wallet-card-footer">
            <span>${currentUser.ad} ${currentUser.soyad}</span>
            <span>${getRankLabel(currentUser.paket_seviyesi)}</span>
          </div>
        </article>

        <section class="wallet-balance-panel">
          <div class="wallet-panel-head">
            <div>
              <p class="eyebrow dark">Finans merkezi</p>
              <h3>Cüzdan Özeti</h3>
            </div>
            <button id="refreshWalletBtn" class="secondary-btn" type="button">Yenile</button>
          </div>

          <div class="wallet-stat-grid">
            <article class="wallet-stat-card">
              <span>Bakiye</span>
              <strong>${formatMoney(balance)}</strong>
              <small>${wallet ? wallet.para_birimi_kodu || "TRY" : "TRY"}</small>
            </article>
            <article class="wallet-stat-card">
              <span>Blokeli</span>
              <strong>${formatMoney(blockedBalance)}</strong>
              <small>Bekleyen işlem</small>
            </article>
            <article class="wallet-stat-card">
              <span>Bekleyen Kazanç</span>
              <strong>${formatMoney(pendingEarning)}</strong>
              <small>Admin onayı bekler</small>
            </article>
            <article class="wallet-stat-card">
              <span>Aktarılan Kazanç</span>
              <strong>${formatMoney(paidEarning + approvedEarning)}</strong>
              <small>Cüzdana geçen</small>
            </article>
          </div>
        </section>
      </div>

      <section class="wallet-section-card sponsor-approval-card">
        <div class="wallet-section-head">
          <div>
            <p class="eyebrow dark">Sponsor cüzdanı</p>
            <h3>Onay Bekleyen Ödemeler</h3>
          </div>
          <span>${sponsorApprovals.length} bekleyen</span>
        </div>

        <div class="sponsor-approval-list">
          ${sponsorApprovals.map((payment) => `
            <article class="sponsor-approval-row">
              <div>
                <strong>#${payment.siparis_id} - ${payment.siparis_veren_ad || ""} ${payment.siparis_veren_soyad || ""}</strong>
                <p>Üye No: ${payment.siparis_veren_uye_no || "-"} • ${payment.siparis_no || "Sipariş no yok"}</p>
                <small>${formatDateTime(payment.odeme_tarihi)} tarihinde sponsor cüzdan onayı istedi.</small>
              </div>
              <div class="sponsor-approval-side">
                <strong>${formatMoney(payment.odeme_tutari)}</strong>
                <button class="pay-btn" type="button" onclick="approveSponsorWalletPayment(${payment.siparis_id})">Onayla</button>
              </div>
            </article>
          `).join("") || `<div class="wallet-empty-state">Sponsor cüzdanından onay bekleyen ödeme yok.</div>`}
        </div>
      </section>

      <div class="wallet-content-grid">
        <section class="wallet-section-card">
          <div class="wallet-section-head">
            <div>
              <p class="eyebrow dark">Para akışı</p>
              <h3>Cüzdan Hareketleri</h3>
            </div>
            <span>${movements.length} hareket</span>
          </div>

          <div class="wallet-movement-list">
            ${movements.map((item) => {
              const movementClass = getWalletMovementClass(item.islem_tipi);
              const prefix = movementClass === "negative" ? "-" : "+";

              return `
                <article class="wallet-movement-row">
                  <div class="movement-icon ${movementClass}">₺</div>
                  <div class="movement-main">
                    <strong>${getWalletMovementLabel(item.islem_tipi)}</strong>
                    <span>Sipariş #${item.siparis_id || "-"} • ${formatDateTime(item.hareket_tarihi)}</span>
                    <p>${item.aciklama || "Açıklama bulunmuyor."}</p>
                  </div>
                  <div class="movement-amount ${movementClass}">${prefix} ${formatMoney(item.tutar)}</div>
                </article>
              `;
            }).join("") || `<div class="wallet-empty-state">Henüz cüzdan hareketi yok.</div>`}
          </div>
        </section>

        <section class="wallet-section-card">
          <div class="wallet-section-head">
            <div>
              <p class="eyebrow dark">Network kazancı</p>
              <h3>Kazanç Detayları</h3>
            </div>
            <span>${earnings.length} kayıt</span>
          </div>

          <div class="wallet-earning-list">
            ${earnings.map((item) => `
              <article class="wallet-earning-row">
                <div class="earning-avatar">${getInitials(item.kaynak_ad, item.kaynak_soyad)}</div>
                <div class="earning-main">
                  <strong>${item.kaynak_ad || ""} ${item.kaynak_soyad || ""}</strong>
                  <span>Üye No: ${item.kaynak_uye_no || "-"} • Sipariş #${item.siparis_id || "-"}</span>
                  <p>%${Number(item.kazanc_orani || 0).toLocaleString("tr-TR")} komisyon • ${formatDateTime(item.kazanc_tarihi)}</p>
                </div>
                <div class="earning-side">
                  <strong>${formatMoney(item.kazanc_tutari)}</strong>
                  <span class="earning-status ${item.kazanc_durumu || "bekliyor"}">${getEarningStatusLabel(item.kazanc_durumu)}</span>
                </div>
              </article>
            `).join("") || `<div class="wallet-empty-state">Henüz kazanç kaydı yok.</div>`}
          </div>
        </section>
      </div>
    `;

    const refreshButton = document.querySelector("#walletArea #refreshWalletBtn");
    if (refreshButton) {
      refreshButton.addEventListener("click", () => loadWallet());
    }

    if (!silent) showMessage("Cüzdan güncellendi.");
  } catch (error) {
    walletArea.innerHTML = `<div class="wallet-loading-card error">${error.message}</div>`;
    if (!silent) showMessage(error.message, "error");
  }
}
async function approveSponsorWalletPayment(siparisId) {
  try {
    await apiRequest(`/payments/approve-transfer/${siparisId}`, {
      method: "PUT"
    });

    showMessage("Sponsor cüzdan ödemesi onaylandı.");
    await refreshProfile();
    await loadWallet();
  } catch (error) {
    showMessage(error.message, "error");
  }
}
async function loadEarnings() {
  const earningsArea = document.querySelector("#earningsArea");
  earningsArea.innerHTML = `<div class="earning-item">Kazançlar yükleniyor...</div>`;

  try {
    const data = await apiRequest(`/earnings/${currentUser.uye_id}`);
    const earnings = data.kazanclar || [];

    earningsArea.innerHTML = `
      <div class="summary-grid">
        <article class="summary-card"><span>Bekleyen</span><strong>${formatMoney(data.ozet.toplam_bekleyen)}</strong></article>
        <article class="summary-card"><span>Onaylanan</span><strong>${formatMoney(data.ozet.toplam_onaylanan)}</strong></article>
        <article class="summary-card"><span>Ödenen</span><strong>${formatMoney(data.ozet.toplam_odenen)}</strong></article>
      </div>
      <div class="data-list">
        ${earnings.map((item) => `
          <div class="earning-item">
            <strong>${item.kaynak_ad} ${item.kaynak_soyad}</strong>
            <p>${item.kazanc_durumu} - %${item.kazanc_orani}</p>
            <span>${formatMoney(item.kazanc_tutari)}</span>
          </div>
        `).join("") || "<div class='earning-item'>Kazanç kaydı yok.</div>"}
      </div>
    `;
  } catch (error) {
    earningsArea.innerHTML = `<div class="earning-item">${error.message}</div>`;
  }
}


async function approveAdminEarning(kazancId) {
  try {
    await apiRequest(`/admin/earnings/approve/${kazancId}`, {
      method: "PUT"
    });

    showMessage("Kazanç cüzdana aktarıldı.");
    await loadAdmin();
  } catch (error) {
    showMessage(error.message, "error");
  }
}
function getAdminPaymentActionLabel(type) {
  if (type === "havale") return "Havaleyi Onayla";
  if (type === "sponsor_cuzdani") return "Sponsor Onayla";
  return "Ödemeyi Onayla";
}

async function approvePendingPayment(siparisId) {
  try {
    await apiRequest(`/payments/approve-transfer/${siparisId}`, {
      method: "PUT"
    });

    showMessage("Bekleyen ödeme onaylandı.");
    await loadAdmin();
  } catch (error) {
    showMessage(error.message, "error");
  }
}


function getTeamLegClass(label) {
  if (label === "Sol Kol") return "left";
  if (label === "Sağ Kol") return "right";
  return "extra";
}

function renderTeamMemberCard(member, options = {}) {
  if (!member) return "";
  const leg = member.kol || options.kol || "Merkez";
  const active = member.aktiflik || Number(member.toplam_siparis_tutari || 0) >= 3000;
  const legClass = getTeamLegClass(leg);

  return `
    <article class="team-node ${options.root ? "root" : ""} ${legClass}">
      <div>
        <strong>${member.ad || ""} ${member.soyad || ""}</strong>
        <span>#${member.uye_no || member.uye_id || "-"}</span>
      </div>
      <b class="team-check ${active ? "active" : "passive"}">${active ? "✓" : "×"}</b>
      <em>${leg}</em>
      <small>${formatMoney(member.toplam_siparis_tutari || member.toplam_alisveris || 0)} alışveriş</small>
    </article>
  `;
}

function renderPendingTeamMembers(data) {
  const list = document.querySelector("#pendingTeamList");
  if (!list) return;

  const pending = data.bekleyen_bayiler || [];

  if (pending.length === 0) {
    list.innerHTML = `<div class="pending-empty">Yerleşim bekleyen bayi bulunmuyor.</div>`;
    return;
  }

  list.innerHTML = pending.map((member) => `
    <article class="pending-team-item">
      <div>
        <strong>${member.ad || ""} ${member.soyad || ""}</strong>
        <span>#${member.uye_no || member.uye_id} • ${member.telefon || "Telefon yok"}</span>
        <small>${formatMoney(member.toplam_siparis_tutari || 0)} alışveriş • ${member.paket_seviyesi || "standart"}</small>
      </div>
      <div class="pending-team-actions">
        <button type="button" onclick="placeTeamMember(${member.uye_id}, 0)">Sol Kola Yerleştir</button>
        <button type="button" onclick="placeTeamMember(${member.uye_id}, 1)">Sağ Kola Yerleştir</button>
      </div>
    </article>
  `).join("");
}

async function placeTeamMember(memberId, leg) {
  if (!currentUser) return;

  try {
    await apiRequest("/team/place", {
      method: "POST",
      body: JSON.stringify({
        sponsor_uye_id: currentUser.uye_id,
        alt_uye_id: memberId,
        seviye: leg
      })
    });

    showMessage(leg === 0 ? "Bayi sol kola yerleştirildi." : "Bayi sağ kola yerleştirildi.");
    await loadTeamTree();
  } catch (error) {
    showMessage(error.message, "error");
  }
}
function renderTeamTree(data, filteredMembers = null) {
  const canvas = document.querySelector("#teamTreeCanvas");
  if (!canvas || !data) return;

  const root = data.uye;
  const members = filteredMembers || data.bayiler || [];
  const left = members.filter((item, index) => item.kol === "Sol Kol" || (!item.kol && index % 2 === 0));
  const right = members.filter((item, index) => item.kol === "Sağ Kol" || (!item.kol && index % 2 === 1));

  document.querySelector("#teamRootTitle").textContent = `${root.ad} ${root.soyad} - #${root.uye_no || root.uye_id}`;
  document.querySelector("#teamRootMeta").textContent = `${members.length} bayi • ${root.paket_seviyesi || "standart"} kariyer`;
  document.querySelector("#teamLeftCount").textContent = data.ozet.sol_kol_bayi;
  document.querySelector("#teamRightCount").textContent = data.ozet.sag_kol_bayi;
  document.querySelector("#teamTotalCount").textContent = data.ozet.toplam_bayi;
  document.querySelector("#teamLeftVolume").textContent = formatMoney(data.ozet.sol_kol_alisveris);
  document.querySelector("#teamRightVolume").textContent = formatMoney(data.ozet.sag_kol_alisveris);
  document.querySelector("#teamBonusStatus").textContent = data.ozet.bonus_2_2_hazir ? "Hazır" : "Bekliyor";
  renderPendingTeamMembers(data);

  canvas.style.setProperty("--team-scale", teamTreeZoom);
  canvas.innerHTML = `
    <div class="team-tree-stage">
      <div class="team-root-row">
        ${renderTeamMemberCard(root, { root: true, kol: "Merkez" })}
      </div>
      <div class="team-connectors"><span></span><i></i><span></span></div>
      <div class="team-children-row">
        <div class="team-branch left-branch">
          ${left.slice(0, 1).map((item) => renderTeamMemberCard(item)).join("") || `<article class="team-node empty"><strong>Sol Kol Boş</strong><span>Yeni bayi bekleniyor</span><em>Sol Kol</em></article>`}
        </div>
        <div class="team-branch right-branch">
          ${right.slice(0, 1).map((item) => renderTeamMemberCard(item)).join("") || `<article class="team-node empty"><strong>Sağ Kol Boş</strong><span>Yeni bayi bekleniyor</span><em>Sağ Kol</em></article>`}
        </div>
      </div>
      <div class="team-extra-row">
        ${members.slice(2).map((item) => renderTeamMemberCard(item)).join("")}
      </div>
    </div>
  `;
}

async function loadTeamTree() {
  const canvas = document.querySelector("#teamTreeCanvas");
  if (!canvas || !currentUser) return;
  canvas.innerHTML = `<div class="team-loading">Takım ağacı yükleniyor...</div>`;

  try {
    teamTreeData = await apiRequest(`/team/${currentUser.uye_id}`);
    renderTeamTree(teamTreeData);
  } catch (error) {
    canvas.innerHTML = `<div class="team-loading error">${error.message}</div>`;
  }
}

function searchTeamTree() {
  if (!teamTreeData) return;
  const input = document.querySelector("#teamSearchInput");
  const term = String(input ? input.value : "").trim().toLowerCase();
  if (!term) {
    renderTeamTree(teamTreeData);
    return;
  }

  const filtered = (teamTreeData.bayiler || []).filter((item) => {
    const text = `${item.ad} ${item.soyad} ${item.uye_no} ${item.uye_id}`.toLowerCase();
    return text.includes(term);
  });

  renderTeamTree(teamTreeData, filtered);
}

function bindTeamTreeControls() {
  const searchBtn = document.querySelector("#teamSearchBtn");
  const resetBtn = document.querySelector("#teamResetBtn");
  const searchInput = document.querySelector("#teamSearchInput");
  const zoomIn = document.querySelector("#teamZoomIn");
  const zoomOut = document.querySelector("#teamZoomOut");
  const zoomReset = document.querySelector("#teamZoomReset");

  if (searchBtn) searchBtn.addEventListener("click", searchTeamTree);
  if (resetBtn) resetBtn.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    loadTeamTree();
  });
  if (searchInput) searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") searchTeamTree();
  });
  if (zoomIn) zoomIn.addEventListener("click", () => {
    teamTreeZoom = Math.min(1.25, teamTreeZoom + 0.1);
    renderTeamTree(teamTreeData);
  });
  if (zoomOut) zoomOut.addEventListener("click", () => {
    teamTreeZoom = Math.max(0.75, teamTreeZoom - 0.1);
    renderTeamTree(teamTreeData);
  });
  if (zoomReset) zoomReset.addEventListener("click", () => {
    teamTreeZoom = 1;
    renderTeamTree(teamTreeData);
  });
}
async function loadSupportRequests() {
  const supportList = document.querySelector("#supportList");
  if (!supportList || !currentUser) return;

  supportList.innerHTML = `<div class="support-item">Talepler yükleniyor...</div>`;

  try {
    supportRequests = await apiRequest(`/support/user/${currentUser.uye_id}`);

    if (!supportRequests.length) {
      supportList.innerHTML = `<div class="support-item empty">Henüz talep gönderilmedi.</div>`;
      return;
    }

    supportList.innerHTML = supportRequests.map((item) => `
      <article class="support-item">
        <div class="support-item-head">
          <strong>${item.konu}</strong>
          <span class="support-status status-${item.durum}">${item.durum}</span>
        </div>
        <p>${item.mesaj}</p>
        ${item.admin_cevap ? `<div class="support-answer"><b>Admin yanıtı:</b> ${item.admin_cevap}</div>` : `<div class="support-answer muted">Admin yanıtı bekleniyor.</div>`}
      </article>
    `).join("");
  } catch (error) {
    supportList.innerHTML = `<div class="support-item error">${error.message}</div>`;
  }
}

async function submitSupportRequest(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const formData = new FormData(form);

  try {
    await apiRequest("/support/create", {
      method: "POST",
      body: JSON.stringify({
        uye_id: currentUser.uye_id,
        konu: formData.get("konu"),
        mesaj: formData.get("mesaj")
      })
    });

    form.reset();
    showMessage("Talebin admin paneline gönderildi.");
    await loadSupportRequests();
  } catch (error) {
    showMessage(error.message, "error");
  }
}

async function loadAdmin() {
  const adminArea = document.querySelector("#adminArea");
  adminArea.innerHTML = `<div class="admin-item">Admin verileri yükleniyor...</div>`;

  try {
    const [summary, pendingPayments, pendingEarnings] = await Promise.all([
      apiRequest("/admin/summary"),
      apiRequest("/admin/payments/pending").catch(() => []),
      apiRequest("/admin/earnings/pending").catch(() => [])
    ]);

    adminArea.innerHTML = `
      <div class="admin-dashboard-grid">
        <article class="summary-card"><span>Toplam Üye</span><strong>${summary.toplam_uye}</strong></article>
        <article class="summary-card"><span>Toplam Sipariş</span><strong>${summary.toplam_siparis}</strong></article>
        <article class="summary-card"><span>Toplam Satış</span><strong>${formatMoney(summary.toplam_satis)}</strong></article>
        <article class="summary-card"><span>Bekleyen Kazanç</span><strong>${formatMoney(summary.bekleyen_kazanc)}</strong></article>
      </div>

      <section class="admin-panel-section">
        <div class="admin-section-head">
          <div>
            <p class="eyebrow dark">Ödeme kontrolü</p>
            <h3>Bekleyen Ödemeler</h3>
          </div>
          <span>${pendingPayments.length} kayıt</span>
        </div>

        <div class="admin-payment-list">
          ${pendingPayments.map((payment) => `
            <article class="admin-payment-row">
              <div>
                <strong>${getPaymentLabel(payment.odeme_tipi)} - #${payment.siparis_id}</strong>
                <p>Sipariş veren: ${payment.siparis_veren_ad} ${payment.siparis_veren_soyad} (${payment.siparis_veren_uye_no})</p>
                <p>Ödeyen: ${payment.odeme_yapan_ad} ${payment.odeme_yapan_soyad} (${payment.odeme_yapan_uye_no})</p>
                <small>${payment.durum_adi || "Kontrol bekliyor"} • ${formatDateTime(payment.odeme_tarihi)}</small>
              </div>
              <div class="admin-payment-side">
                <strong>${formatMoney(payment.odeme_tutari)}</strong>
                <button class="pay-btn" type="button" onclick="approvePendingPayment(${payment.siparis_id})">${getAdminPaymentActionLabel(payment.odeme_tipi)}</button>
              </div>
            </article>
          `).join("") || `<div class="admin-empty-state">Bekleyen ödeme yok.</div>`}
        </div>
      </section>

      <section class="admin-panel-section">
        <div class="admin-section-head">
          <div>
            <p class="eyebrow dark">Kazanç kontrolü</p>
            <h3>Bekleyen Kazançlar</h3>
          </div>
          <span>${pendingEarnings.length} kayıt</span>
        </div>

        <div class="admin-payment-list">
          ${pendingEarnings.slice(0, 8).map((earning) => `
            <article class="admin-payment-row compact">
              <div>
                <strong>${earning.kazanan_ad} ${earning.kazanan_soyad}</strong>
                <p>${earning.kaynak_ad} ${earning.kaynak_soyad} siparişinden %${earning.kazanc_orani} kazanç</p>
                <small>Sipariş #${earning.siparis_id} • ${formatDateTime(earning.kazanc_tarihi)}</small>
              </div>
              <div class="admin-payment-side">
                <strong>${formatMoney(earning.kazanc_tutari)}</strong>
                <button class="detail-btn" type="button" onclick="approveAdminEarning(${earning.kazanc_id})">Kazancı Onayla</button>
              </div>
            </article>
          `).join("") || `<div class="admin-empty-state">Bekleyen kazanç yok.</div>`}
        </div>
      </section>
    `;
  } catch (error) {
    adminArea.innerHTML = `<div class="admin-item">${error.message}</div>`;
  }
}
document.querySelectorAll("[data-auth-tab]").forEach((tab) => {
  tab.addEventListener("click", () => setAuthTab(tab.dataset.authTab));
});

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(loginForm);

  try {
    const data = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: formData.get("email"),
        sifre: formData.get("sifre")
      })
    });

    localStorage.setItem("nova_user", JSON.stringify(data.uye));
    openPanel(data.uye);
  } catch (error) {
    alert(error.message);
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(registerForm);

  try {
    const data = await apiRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        ad: formData.get("ad"),
        soyad: formData.get("soyad"),
        email: formData.get("email"),
        telefon: formData.get("telefon"),
        ulke: formData.get("ulke"),
        sifre: formData.get("sifre"),
        sponsor_uye_no: formData.get("sponsor_uye_no") || null
      })
    });

    alert(`Kayıt başarılı. Üye no: ${data.uye.uye_no}`);
    registerForm.reset();
    setAuthTab("login");
  } catch (error) {
    alert(error.message);
  }
});

logoutBtn.addEventListener("click", closePanel);

document.querySelector("#refreshProductsBtn").addEventListener("click", loadProducts);
document.querySelector("#refreshCartBtn").addEventListener("click", () => loadCart());
document.querySelector("#refreshAddressesBtn").addEventListener("click", loadAddresses);
document.querySelector("#refreshOrdersBtn").addEventListener("click", loadOrders);
const applyOrderFiltersBtn = document.querySelector("#applyOrderFiltersBtn");
if (applyOrderFiltersBtn) {
  applyOrderFiltersBtn.addEventListener("click", renderOrders);
}
const clearOrderFiltersBtn = document.querySelector("#clearOrderFiltersBtn");
if (clearOrderFiltersBtn) {
  clearOrderFiltersBtn.addEventListener("click", () => {
    ["#orderFilterId", "#orderFilterPayment", "#orderFilterStatus", "#orderFilterStart", "#orderFilterEnd", "#orderFilterSearch"].forEach((selector) => {
      const input = document.querySelector(selector);
      if (input) input.value = "";
    });
    renderOrders();
  });
}
const refreshWalletButton = document.querySelector("#refreshWalletBtn");
if (refreshWalletButton) {
  refreshWalletButton.addEventListener("click", () => loadWallet());
}
document.querySelector("#refreshEarningsBtn").addEventListener("click", loadEarnings);
const refreshAdminBtn = document.querySelector("#refreshAdminBtn");
if (refreshAdminBtn) {
  refreshAdminBtn.addEventListener("click", loadAdmin);
}
document.querySelector("#createOrderBtn").addEventListener("click", createOrder);
document.querySelectorAll("input[name='paymentType']").forEach((input) => {
  input.addEventListener("change", renderPaymentDetails);
});
const addressForm = document.querySelector("#addressForm");
if (addressForm) {
  addressForm.addEventListener("submit", saveAddressForm);
}

function bindProductScreenControls() {
  const goCartBtn = document.querySelector("#goCartBtn");
  if (goCartBtn) {
    goCartBtn.addEventListener("click", () => setView("cart"));
  }

  const productSearchInput = document.querySelector("#productSearchInput");
  if (productSearchInput) {
    productSearchInput.addEventListener("input", () => {
      productSearchTerm = productSearchInput.value.trim();
      renderProducts();
    });
  }

  document.querySelectorAll("[data-category]").forEach((button) => {
    button.addEventListener("click", () => {
      activeCategory = button.dataset.category;

      document.querySelectorAll("[data-category]").forEach((item) => {
        item.classList.toggle("active", item === button);
      });

      renderProducts();
    });
  });
}

bindProductScreenControls();
bindTeamTreeControls();
const supportForm = document.querySelector("#supportForm");
if (supportForm) {
  supportForm.addEventListener("submit", submitSupportRequest);
}
const refreshSupportBtn = document.querySelector("#refreshSupportBtn");
if (refreshSupportBtn) {
  refreshSupportBtn.addEventListener("click", loadSupportRequests);
}

const savedUser = localStorage.getItem("nova_user");

if (savedUser) {
  openPanel(JSON.parse(savedUser));
}




























































