const API = "http://localhost:5000/api";

let currentAdmin = null;
let adminOrders = [];
let adminPayments = [];
let adminRequests = [];
let adminWalletMovements = [];
let adminMembers = [];
let adminTeamData = null;
let adminPendingPlacements = [];
let currentOrderDetail = null;

const loginView = document.querySelector("#adminLoginView");
const panelView = document.querySelector("#adminPanelView");
const loginForm = document.querySelector("#adminLoginForm");
const loginMessage = document.querySelector("#adminLoginMessage");
const adminMessage = document.querySelector("#adminMessage");
const contentArea = document.querySelector("#adminContentArea");
const pageTitle = document.querySelector("#adminPageTitle");
const identity = document.querySelector("#adminIdentity");

function formatMoney(value) {
  return `₺ ${Number(value || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function showAdminMessage(text, type = "success") {
  adminMessage.textContent = text;
  adminMessage.className = `admin-message ${type}`;
}

function showLoginMessage(text) {
  loginMessage.textContent = text;
  loginMessage.classList.remove("hidden");
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.hata || "İşlem sırasında hata oluştu.");
  return data;
}

function paymentLabel(type) {
  const labels = { kart: "Kredi Kartı", havale: "Havale/EFT", kendi_cuzdani: "Cüzdan", sponsor_cuzdani: "Sponsor Cüzdanı" };
  return labels[type] || type || "-";
}

async function openAdminPanel(admin) {
  currentAdmin = admin;
  localStorage.setItem("nova_admin", JSON.stringify(admin));
  loginView.classList.add("hidden");
  panelView.classList.remove("hidden");
  identity.textContent = `${admin.ad} ${admin.soyad} • ${admin.yetki}`;
  await setAdminView("dashboard");
}

async function setAdminView(view) {
  document.querySelectorAll("[data-admin-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.adminView === view);
  });

  const titles = {
    dashboard: "Özet",
    orders: "Tüm Siparişler",
    payments: "Ödeme Onayları",
    wallets: "Hesap Hareketleri",
    requests: "Talepler",
    members: "Üye Yönetimi",
    team: "Takım Ağacı"
  };

  pageTitle.textContent = titles[view] || "Admin";
  contentArea.innerHTML = `<div class="admin-card">Yükleniyor...</div>`;

  if (view === "dashboard") await loadDashboard();
  if (view === "members") await loadMembers();
  if (view === "team") await loadAdminTeamTree();
  if (view === "orders") await loadOrders();
  if (view === "payments") await loadPayments();
  if (view === "wallets") await loadWalletMovements();
  if (view === "requests") await loadRequests();
}

async function loadDashboard() {
  const [summary, payments, requests] = await Promise.all([
    apiRequest("/admin/summary"),
    apiRequest("/admin/payments/pending").catch(() => []),
    apiRequest("/support/admin/all").catch(() => [])
  ]);

  contentArea.innerHTML = `
    <div class="admin-stat-grid">
      <article><span>Toplam Üye</span><strong>${summary.toplam_uye}</strong></article>
      <article><span>Toplam Sipariş</span><strong>${summary.toplam_siparis}</strong></article>
      <article><span>Toplam Satış</span><strong>${formatMoney(summary.toplam_satis)}</strong></article>
      <article><span>Bekleyen Ödeme</span><strong>${payments.length}</strong></article>
      <article><span>Bekleyen Kazanç</span><strong>${formatMoney(summary.bekleyen_kazanc)}</strong></article>
      <article><span>Açık Talep</span><strong>${requests.filter((item) => item.durum === "acik").length}</strong></article>
    </div>
  `;
}

function adminOrderStatusLabel(order) {
  if (!order) return "-";
  if (Number(order.durum_id) === 2 && order.odeme_tipi === "sponsor_cuzdani") return "Sponsor Cüzdan Onayı Bekliyor";
  if (Number(order.durum_id) === 2 && order.odeme_tipi === "havale") return "Havale/EFT Kontrol Bekliyor";
  return order.durum_adi || "-";
}

function isPendingOrderApproval(order) {
  return Number(order.durum_id) === 2 || order.odeme_durumu === "bekliyor";
}
function normalizeText(value) {
  return String(value || "").toLowerCase();
}

function memberSearchMarkup() {
  return `
    <div class="admin-filter-bar">
      <label>Üye Ara
        <input id="memberSearchInput" placeholder="Ad, soyad, üye ID, üye no, telefon veya e-mail" />
      </label>
      <button type="button" onclick="loadMembers()">Ara</button>
      <button class="ghost-btn" type="button" onclick="clearMemberSearch()">Temizle</button>
    </div>
  `;
}

async function loadMembers() {
  const input = document.querySelector("#memberSearchInput");
  const q = input ? input.value.trim() : "";
  adminMembers = await apiRequest(`/admin/members${q ? `?q=${encodeURIComponent(q)}` : ""}`);

  contentArea.innerHTML = `
    <div class="admin-card">
      <div class="admin-card-head">
        <div>
          <h2>Üye Yönetimi</h2>
          <p>İsim, soyisim, üye ID, üye no, telefon veya e-mail ile arama yap.</p>
        </div>
        <span class="count-pill">${adminMembers.length} kayıt</span>
      </div>
      ${memberSearchMarkup()}
      <div class="admin-table-wrap">
        <table>
          <thead><tr><th>Üye</th><th>İletişim</th><th>Ülke</th><th>Kariyer</th><th>Cüzdan</th><th>Sipariş</th><th>İşlem</th></tr></thead>
          <tbody>
            ${adminMembers.map((member) => `
              <tr>
                <td><strong>${member.ad} ${member.soyad}</strong><small>ID: ${member.uye_id} • ${member.uye_no || "-"}</small></td>
                <td>${member.telefon || "-"}<small>${member.email || "-"}</small></td>
                <td>${member.ulke || "-"}<small>${member.il || ""}</small></td>
                <td><span class="status-chip">${member.paket_seviyesi || "standart"}</span><small>Sponsor: ${member.sponsor_uye_no || "-"}</small></td>
                <td>${member.sembol || "₺"} ${Number(member.bakiye || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}<small>${member.para_birimi_kodu || "TRY"}</small></td>
                <td>${member.siparis_sayisi || 0}<small>Ödenen: ${formatMoney(member.toplam_odenen_siparis)}</small></td>
                <td><button type="button" onclick="openMemberDetail(${member.uye_id})">Detay</button><button class="ghost-btn" type="button" onclick="openAdminTeamTree(${member.uye_id})">Ağacı Gör</button><button class="ghost-btn" type="button" onclick="loginAsMember(${member.uye_id})">Hesaba Gir</button></td>
              </tr>
            `).join("") || '<tr><td colspan="7">Üye bulunamadı.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;

  const newInput = document.querySelector("#memberSearchInput");
  if (newInput) {
    newInput.value = q;
    newInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") loadMembers();
    });
  }
}

function clearMemberSearch() {
  const input = document.querySelector("#memberSearchInput");
  if (input) input.value = "";
  loadMembers();
}

async function openMemberDetail(uyeId) {
  const [member, orders, wallet, earnings] = await Promise.all([
    apiRequest(`/admin/members/${uyeId}`),
    apiRequest(`/orders/user/${uyeId}`).catch(() => []),
    apiRequest(`/wallet/${uyeId}`).catch(() => null),
    apiRequest(`/earnings/${uyeId}`).catch(() => null)
  ]);

  const movements = wallet && wallet.hareketler ? wallet.hareketler : [];
  const kazanclar = earnings && earnings.kazanclar ? earnings.kazanclar : [];

  contentArea.innerHTML = `
    <div class="admin-card member-detail-card">
      <div class="admin-card-head">
        <div>
          <h2>${member.ad} ${member.soyad}</h2>
          <p>ID: ${member.uye_id} • Üye No: ${member.uye_no || "-"} • ${member.email || "-"}</p>
        </div>
        <div class="admin-actions">
          <button type="button" onclick="openAdminTeamTree(${member.uye_id})">Ağacı Gör</button><button type="button" onclick="loginAsMember(${member.uye_id})">Hesabına Gir</button>
          <button class="ghost-btn" type="button" onclick="loadMembers()">Üyelere Dön</button>
        </div>
      </div>
      <div class="member-detail-grid">
        <article><span>Kariyer</span><strong>${member.paket_seviyesi || "standart"}</strong></article>
        <article><span>Ülke</span><strong>${member.ulke || "-"}</strong><small>${member.il || ""} ${member.ilce || ""}</small></article>
        <article><span>Cüzdan</span><strong>${member.sembol || "₺"} ${Number(member.bakiye || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</strong><small>${member.para_birimi_kodu || "TRY"}</small></article>
        <article><span>Toplam Alışveriş</span><strong>${formatMoney(member.toplam_alisveris)}</strong></article>
      </div>
    </div>
    <div class="admin-split-grid">
      <div class="admin-card">
        <h2>Siparişleri</h2>
        <div class="admin-list compact-list">
          ${orders.map((order) => `<article class="mini-row"><div><strong>#${order.siparis_id}</strong><p>${order.durum_adi || "-"} • ${order.odeme_durumu || "-"}</p></div><b>${formatMoney(order.odenecek_tutar)}</b><button onclick="openOrderDetail(${order.siparis_id})">Detay</button></article>`).join("") || '<div class="admin-empty">Sipariş yok.</div>'}
        </div>
      </div>
      <div class="admin-card">
        <h2>Kazanç ve Cüzdan</h2>
        <div class="admin-list compact-list">
          ${kazanclar.slice(0, 5).map((item) => `<article class="mini-row"><div><strong>${item.kazanc_durumu}</strong><p>${item.kaynak_ad || ""} ${item.kaynak_soyad || ""}</p></div><b>${formatMoney(item.kazanc_tutari)}</b></article>`).join("") || '<div class="admin-empty">Kazanç kaydı yok.</div>'}
          ${movements.slice(0, 5).map((item) => `<article class="mini-row"><div><strong>${item.islem_tipi}</strong><p>${item.aciklama || ""}</p></div><b>${formatMoney(item.tutar)}</b></article>`).join("")}
        </div>
      </div>
    </div>
  `;
}

async function loginAsMember(uyeId) {
  const member = await apiRequest(`/admin/members/${uyeId}`);
  const appUser = {
    uye_id: member.uye_id,
    uye_no: member.uye_no,
    ad: member.ad,
    soyad: member.soyad,
    email: member.email,
    telefon: member.telefon,
    paket_seviyesi: member.paket_seviyesi,
    sponsor_uye_id: member.sponsor_uye_id,
    toplam_alisveris: member.toplam_alisveris,
    cuzdan_bakiyesi: member.cuzdan_bakiyesi,
    ulke: member.ulke,
    il: member.il,
    ilce: member.ilce,
    adres: member.adres,
    aktif_mi: member.aktif_mi
  };
  localStorage.setItem("nova_user", JSON.stringify(appUser));
  window.open("/app/", "_blank");
}

function orderFilterMarkup() {
  return `
    <div class="admin-filter-bar">
      <label>Sipariş ID
        <input id="adminOrderSearchInput" placeholder="Örn: 7 veya SP-..." />
      </label>
      <button type="button" onclick="renderAdminOrders()">Ara</button>
      <button class="ghost-btn" type="button" onclick="clearOrderSearch()">Temizle</button>
    </div>
  `;
}

function renderAdminOrders() {
  const input = document.querySelector("#adminOrderSearchInput");
  const q = normalizeText(input ? input.value.trim() : "");
  const filtered = q
    ? adminOrders.filter((order) => normalizeText(order.siparis_id).includes(q) || normalizeText(order.siparis_no).includes(q))
    : adminOrders;
  const pendingApprovals = adminOrders.filter(isPendingOrderApproval);

  contentArea.innerHTML = `
    <div class="admin-card">
      <div class="admin-card-head">
        <div>
          <h2>Sipariş Listesi</h2>
          <p>Sipariş ID veya sipariş no ile arama yap, detayını aç.</p>
        </div>
        <span class="count-pill">${filtered.length} kayıt</span>
      </div>
      ${orderFilterMarkup()}
      <div class="admin-pending-orders">
        <div class="admin-card-head compact-head">
          <div>
            <h2>Onay Bekleyen Siparişler</h2>
            <p>Havale/EFT ve sponsor cüzdan onayları buradan tamamlanır.</p>
          </div>
          <span class="count-pill">${pendingApprovals.length} bekleyen</span>
        </div>
        <div class="admin-list compact-list">
          ${pendingApprovals.map((order) => `
            <article class="mini-row pending-order-row">
              <div><strong>#${order.siparis_id} - ${paymentLabel(order.odeme_tipi)}</strong><p>${order.ad} ${order.soyad} - ${adminOrderStatusLabel(order)}</p></div>
              <b>${formatMoney(order.odenecek_tutar)}</b>
              <button type="button" onclick="approveOrderFromOrders(${order.siparis_id})">Onayla</button>
            </article>
          `).join("") || '<div class="admin-empty">Onay bekleyen sipariş yok.</div>'}
        </div>
      </div>
      <div class="admin-table-wrap">
        <table>
          <thead><tr><th>ID</th><th>Üye</th><th>Durum</th><th>Ödeme</th><th>Tutar</th><th>Tarih</th><th>İşlem</th></tr></thead>
          <tbody>
            ${filtered.map((order) => `
              <tr>
                <td>#${order.siparis_id}<small>${order.siparis_no || ""}</small></td>
                <td>${order.ad} ${order.soyad}<small>${order.uye_no}</small></td>
                <td>${adminOrderStatusLabel(order)}</td>
                <td>${paymentLabel(order.odeme_tipi)}<small>${order.odeme_durumu || "-"}</small></td>
                <td>${formatMoney(order.odenecek_tutar)}</td>
                <td>${formatDate(order.siparis_tarihi)}</td>
                <td><button type="button" onclick="openOrderDetail(${order.siparis_id})">Detay</button></td>
              </tr>
            `).join("") || '<tr><td colspan="7">Sipariş bulunamadı.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;

  const newInput = document.querySelector("#adminOrderSearchInput");
  if (newInput) {
    newInput.value = input ? input.value : "";
    newInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") renderAdminOrders();
    });
  }
}

function clearOrderSearch() {
  const input = document.querySelector("#adminOrderSearchInput");
  if (input) input.value = "";
  renderAdminOrders();
}

async function openOrderDetail(orderId) {
  currentOrderDetail = await apiRequest(`/orders/detail/${orderId}`);
  const order = currentOrderDetail.siparis;
  const products = currentOrderDetail.urunler || [];
  const cargo = currentOrderDetail.kargo;

  contentArea.innerHTML = `
    <div class="admin-card order-detail-admin">
      <div class="admin-card-head">
        <div>
          <h2>Sipariş Detayı - #${order.siparis_id}</h2>
          <p>${order.siparis_no || "Sipariş no yok"} • ${formatDate(order.siparis_tarihi)}</p>
        </div>
        <button class="ghost-btn" type="button" onclick="renderAdminOrders()">Siparişlere Dön</button>
      </div>
      <div class="member-detail-grid">
        <article><span>Durum</span><strong>${order.durum_adi || "-"}</strong></article>
        <article><span>Ödeme</span><strong>${order.odeme_durumu || "-"}</strong></article>
        <article><span>Toplam</span><strong>${formatMoney(order.toplam_tutar)}</strong></article>
        <article><span>Ödenecek</span><strong>${formatMoney(order.odenecek_tutar)}</strong><small>İndirim: %${order.indirim_orani || 0}</small></article>
      </div>
    </div>
    <div class="admin-split-grid">
      <div class="admin-card">
        <h2>Ürünler</h2>
        <div class="admin-table-wrap">
          <table>
            <thead><tr><th>Ürün</th><th>Adet</th><th>Birim</th><th>Ara Toplam</th></tr></thead>
            <tbody>
              ${products.map((item) => `<tr><td>${item.urun_adi}<small>Ürün ID: ${item.urun_id}</small></td><td>${item.adet}</td><td>${formatMoney(item.birim_fiyat)}</td><td>${formatMoney(item.ara_toplam)}</td></tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>
      <div class="admin-card">
        <h2>Kargo</h2>
        ${cargo ? `<div class="detail-side"><strong>${cargo.firma_adi || "-"}</strong><p>Takip No: ${cargo.takip_numarasi || "-"}</p><p>Çıkış: ${formatDate(cargo.kargoya_verilis_tarihi)}</p><p>Teslim: ${formatDate(cargo.teslim_tarihi)}</p><small>${cargo.aciklama || ""}</small></div>` : '<div class="admin-empty">Kargo kaydı yok.</div>'}
      </div>
    </div>
  `;
}



function getPendingPlacementHtml(items = []) {
  const rows = items.map((member) => {
    const memberName = (member.ad || "-") + " " + (member.soyad || "");
    const sponsorName = (member.sponsor_ad || "-") + " " + (member.sponsor_soyad || "");
    const phone = member.telefon || "Telefon yok";
    const memberNo = member.uye_no || member.uye_id || "-";
    const sponsorNo = member.sponsor_uye_no || member.sponsor_uye_id || "-";
    const total = formatMoney(member.toplam_siparis_tutari || member.toplam_alisveris);
    const orderCount = member.siparis_sayisi || 0;
    return [
      "<article class=\"admin-placement-item\">",
      "<div class=\"placement-member\">",
      "<strong>" + memberName + "</strong>",
      "<span>#" + memberNo + " - " + phone + "</span>",
      "<small>Sponsor: " + sponsorName + " (#" + sponsorNo + ")</small>",
      "</div>",
      "<div class=\"placement-metrics\"><span>Alışveriş</span><strong>" + total + "</strong><small>" + orderCount + " sipariş</small></div>",
      "<div class=\"placement-actions\">",
      "<button type=\"button\" onclick=\"placeAdminPendingMember(" + member.uye_id + ", " + member.sponsor_uye_id + ", 0)\">Sol Kola Al</button>",
      "<button type=\"button\" onclick=\"placeAdminPendingMember(" + member.uye_id + ", " + member.sponsor_uye_id + ", 1)\">Sağ Kola Al</button>",
      "</div>",
      "</article>"
    ].join("");
  }).join("") || "<div class=\"admin-empty\">Yerleşim bekleyen bayi yok.</div>";

  return [
    "<div class=\"admin-card admin-placement-card\" id=\"adminPendingPlacementArea\">",
    "<div class=\"admin-card-head\"><div><h2>Yerleşim Bekleyen Bayiler</h2><p>Sponsoruyla kayıt olmuş ama henüz sol/sağ kola yerleştirilmemiş üyeler.</p></div>",
    "<button class=\"ghost-btn\" type=\"button\" onclick=\"loadAdminPendingPlacements()\">Yenile</button></div>",
    "<div class=\"admin-placement-list\">" + rows + "</div>",
    "</div>"
  ].join("");
}

async function loadAdminPendingPlacements() {
  const container = document.querySelector("#adminPendingPlacementArea");
  if (container) {
    container.outerHTML = '<div class="admin-card" id="adminPendingPlacementArea">Yerleşim bekleyen bayiler yükleniyor...</div>';
  }

  adminPendingPlacements = await apiRequest("/admin/team/pending").catch(() => []);
  const freshContainer = document.querySelector("#adminPendingPlacementArea");
  if (freshContainer) {
    freshContainer.outerHTML = getPendingPlacementHtml(adminPendingPlacements);
  }
}

async function placeAdminPendingMember(memberId, sponsorId, leg) {
  await apiRequest("/team/place", {
    method: "POST",
    body: JSON.stringify({ sponsor_uye_id: sponsorId, alt_uye_id: memberId, seviye: leg })
  });

  showAdminMessage(leg === 0 ? "Bayi sol kola yerleştirildi." : "Bayi sağ kola yerleştirildi.");

  if (adminTeamData && adminTeamData.uye && Number(adminTeamData.uye.uye_id) === Number(sponsorId)) {
    await openAdminTeamTree(sponsorId);
    return;
  }

  await loadAdminPendingPlacements();
}

function getAdminTeamNode(member, role = "Ana Üye", level = 0) {
  const paidTotal = Number(member.toplam_siparis_tutari || member.toplam_alisveris || 0);
  const isActive = paidTotal >= 3000;
  return `
    <article class="admin-team-node ${level === 0 ? "root" : ""} ${isActive ? "active" : "passive"}">
      <div>
        <strong>${member.ad || "-"} ${member.soyad || ""}</strong>
        <small>#${member.uye_no || member.uye_id || "-"}</small>
        <span>${role}</span>
      </div>
      <b>${isActive ? "✓" : "×"}</b>
      <em>${formatMoney(paidTotal)}</em>
    </article>
  `;
}

function renderAdminTeamTree(data) {
  const root = data.uye || {};
  const bayiler = data.bayiler || [];
  const ozet = data.ozet || {};
  const firstLevel = bayiler.slice(0, 2);
  const otherMembers = bayiler.slice(2);

  contentArea.innerHTML = `
    <div class="admin-team-page">
      <div class="admin-card admin-team-header">
        <div>
          <h2>Takım Ağacı</h2>
          <p>${root.ad || ""} ${root.soyad || ""} - #${root.uye_no || root.uye_id || "-"}</p>
        </div>
        <div class="admin-filter-bar compact">
          <label>Üye No / ID
            <input id="adminTeamInput" value="${root.uye_no || root.uye_id || ""}" placeholder="Üye no veya ID" />
          </label>
          <button type="button" onclick="searchAdminTeamTree()">Ağacı Getir</button>
          <button class="ghost-btn" type="button" onclick="loadMembers()">Üyelere Dön</button>
        </div>
      </div>

      ${getPendingPlacementHtml(adminPendingPlacements)}

      <div class="admin-team-stats">
        <article><span>Sol Kol</span><strong>${ozet.sol_kol_bayi || 0}</strong><small>${formatMoney(ozet.sol_kol_alisveris)}</small></article>
        <article><span>Sağ Kol</span><strong>${ozet.sag_kol_bayi || 0}</strong><small>${formatMoney(ozet.sag_kol_alisveris)}</small></article>
        <article><span>Toplam Bayi</span><strong>${ozet.toplam_bayi || 0}</strong><small>Referans ağı</small></article>
        <article><span>2+2 Bonus</span><strong>${ozet.bonus_2_2_hazir ? "Hazır" : "Bekliyor"}</strong><small>3.000 TL şartı</small></article>
      </div>

      <div class="admin-team-canvas admin-card">
        <div class="admin-team-root">${getAdminTeamNode(root, "Ana Üye", 0)}</div>
        <div class="admin-team-branches">
          ${firstLevel.map((member, index) => `
            <div class="admin-team-branch">
              ${getAdminTeamNode(member, member.kol || (index === 0 ? "Sol Kol" : "Sağ Kol"), 1)}
              <div class="admin-team-subnodes">
                ${(member.alt_bayiler || []).map((child) => getAdminTeamNode(child, "Alt Bayi", 2)).join("") || '<div class="admin-team-empty">Alt bayi yok</div>'}
              </div>
            </div>
          `).join("") || '<div class="admin-team-empty wide">Bu üyenin altında bayi bulunmuyor.</div>'}
        </div>
        ${otherMembers.length ? `<div class="admin-team-extra"><h3>Ek Bayiler</h3>${otherMembers.map((member) => getAdminTeamNode(member, member.kol || "Ek Kol", 1)).join("")}</div>` : ""}
      </div>
    </div>
  `;

  const input = document.querySelector("#adminTeamInput");
  if (input) {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") searchAdminTeamTree();
    });
  }
}

async function loadAdminTeamTree() {
  pageTitle.textContent = "Takım Ağacı";
  adminTeamData = null;
  adminPendingPlacements = await apiRequest("/admin/team/pending").catch(() => []);

  contentArea.innerHTML = `
    <div class="admin-team-page">
      <div class="admin-card admin-team-header">
        <div>
          <h2>Takım Ağacı</h2>
          <p>Üye ID veya üye no yazarak kişinin bayi ağacını görüntüle.</p>
        </div>
        <div class="admin-filter-bar compact">
          <label>Üye No / ID
            <input id="adminTeamInput" placeholder="Örn: 900011 veya 7" />
          </label>
          <button type="button" onclick="searchAdminTeamTree()">Ağacı Getir</button>
        </div>
      </div>
      ${getPendingPlacementHtml(adminPendingPlacements)}
      <div class="admin-card admin-team-empty-state">
        <strong>Ağaç görüntülemek için üye seç.</strong>
        <p>Üye no, üye ID, isim, soyisim, telefon veya e-mail ile arama yapabilirsin.</p>
      </div>
    </div>
  `;

  const input = document.querySelector("#adminTeamInput");
  if (input) {
    input.focus();
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") searchAdminTeamTree();
    });
  }
}

async function openAdminTeamTree(uyeId) {
  pageTitle.textContent = "Takım Ağacı";
  document.querySelectorAll("[data-admin-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.adminView === "team");
  });
  contentArea.innerHTML = `<div class="admin-card">Takım ağacı yükleniyor...</div>`;
  adminTeamData = await apiRequest(`/team/${uyeId}`);
  renderAdminTeamTree(adminTeamData);
}

async function searchAdminTeamTree() {
  const input = document.querySelector("#adminTeamInput");
  const value = input ? input.value.trim() : "";
  if (!value) return;

  let member = adminMembers.find((item) => String(item.uye_id) === value || String(item.uye_no) === value);
  if (!member) {
    const q = encodeURIComponent(value);
    const results = await apiRequest(`/admin/members?q=${q}`);
    member = results.find((item) => String(item.uye_id) === value || String(item.uye_no) === value) || results[0];
  }

  if (!member) {
    showAdminMessage("Üye bulunamadı.", "error");
    return;
  }

  await openAdminTeamTree(member.uye_id);
}

async function loadOrders() {
  adminOrders = await apiRequest("/admin/orders");
  renderAdminOrders();
}

async function approveOrderFromOrders(siparisId) {
  await apiRequest(`/payments/approve-transfer/${siparisId}`, { method: "PUT" });
  showAdminMessage("Sipariş ödemesi onaylandı.");
  await loadOrders();
}
async function loadPayments() {
  adminPayments = await apiRequest("/admin/payments/pending");
  contentArea.innerHTML = `
    <div class="admin-card">
      <h2>Bekleyen Ödeme Onayları</h2>
      <div class="admin-list">
        ${adminPayments.map((payment) => `
          <article class="admin-row-card">
            <div>
              <strong>${paymentLabel(payment.odeme_tipi)} • Sipariş #${payment.siparis_id}</strong>
              <p>Sipariş veren: ${payment.siparis_veren_ad} ${payment.siparis_veren_soyad} (${payment.siparis_veren_uye_no})</p>
              <p>Ödeyen: ${payment.odeme_yapan_ad} ${payment.odeme_yapan_soyad} (${payment.odeme_yapan_uye_no})</p>
              <small>${formatDate(payment.odeme_tarihi)}</small>
            </div>
            <div>
              <b>${formatMoney(payment.odeme_tutari)}</b>
              <button onclick="approvePayment(${payment.siparis_id})">Onayla</button>
            </div>
          </article>
        `).join("") || `<div class="admin-empty">Bekleyen ödeme yok.</div>`}
      </div>
    </div>
  `;
}

async function approvePayment(siparisId) {
  await apiRequest(`/payments/approve-transfer/${siparisId}`, { method: "PUT" });
  showAdminMessage("Ödeme onaylandı.");
  await loadPayments();
}

async function loadWalletMovements() {
  adminWalletMovements = await apiRequest("/admin/wallet-movements").catch(() => []);
  contentArea.innerHTML = `
    <div class="admin-card">
      <h2>Hesap Hareketleri</h2>
      <div class="admin-table-wrap">
        <table>
          <thead><tr><th>Üye</th><th>İşlem</th><th>Sipariş</th><th>Tutar</th><th>Bakiye</th><th>Tarih</th></tr></thead>
          <tbody>
            ${adminWalletMovements.map((item) => `
              <tr>
                <td>${item.ad} ${item.soyad}<small>${item.uye_no}</small></td>
                <td>${item.islem_tipi}</td>
                <td>#${item.siparis_id || "-"}</td>
                <td>${formatMoney(item.tutar)}</td>
                <td>${formatMoney(item.onceki_bakiye)} → ${formatMoney(item.sonraki_bakiye)}</td>
                <td>${formatDate(item.hareket_tarihi)}</td>
              </tr>
            `).join("") || `<tr><td colspan="6">Hesap hareketi yok.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function loadRequests() {
  adminRequests = await apiRequest("/support/admin/all");
  contentArea.innerHTML = `
    <div class="admin-card">
      <h2>Bayi Talepleri</h2>
      <div class="admin-list">
        ${adminRequests.map((request) => `
          <article class="admin-row-card request-card">
            <div>
              <strong>${request.konu}</strong>
              <p>${request.mesaj}</p>
              <small>${request.ad} ${request.soyad} (${request.uye_no}) • ${formatDate(request.olusturma_tarihi)}</small>
              ${request.admin_cevap ? `<div class="admin-answer">Yanıt: ${request.admin_cevap}</div>` : ""}
            </div>
            <form onsubmit="replyRequest(event, ${request.talep_id})">
              <textarea name="admin_cevap" placeholder="Yanıt yaz..." required>${request.admin_cevap || ""}</textarea>
              <button type="submit">Yanıtla</button>
            </form>
          </article>
        `).join("") || `<div class="admin-empty">Talep bulunmuyor.</div>`}
      </div>
    </div>
  `;
}

async function replyRequest(event, talepId) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  await apiRequest(`/support/admin/reply/${talepId}`, {
    method: "PUT",
    body: JSON.stringify({ admin_cevap: formData.get("admin_cevap"), durum: "yanitlandi" })
  });
  showAdminMessage("Talep yanıtlandı.");
  await loadRequests();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);

  try {
    const data = await apiRequest("/admin/login", {
      method: "POST",
      body: JSON.stringify({ email: formData.get("email"), sifre: formData.get("sifre") })
    });
    await openAdminPanel(data.admin);
  } catch (error) {
    showLoginMessage(error.message);
  }
});

document.querySelectorAll("[data-admin-view]").forEach((button) => {
  button.addEventListener("click", () => setAdminView(button.dataset.adminView));
});

document.querySelector("#adminLogoutBtn").addEventListener("click", () => {
  localStorage.removeItem("nova_admin");
  currentAdmin = null;
  panelView.classList.add("hidden");
  loginView.classList.remove("hidden");
});

const savedAdmin = localStorage.getItem("nova_admin");
if (savedAdmin) {
  openAdminPanel(JSON.parse(savedAdmin));
}




window.placeAdminPendingMember = placeAdminPendingMember;
window.loadAdminPendingPlacements = loadAdminPendingPlacements;

window.approveOrderFromOrders = approveOrderFromOrders;




