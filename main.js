/* main.js
 - Charge les produits depuis data/products.json
 - Gère filtres, affichage, modales et accessibilité
 - Initialise Google Maps via une clé chargée côté serveur (sans l'exposer)
*/

// Simple smooth scroll
window.scrollToSection = (id) => {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
};

// Mobile menu
const mobileBtn = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');
if (mobileBtn && mobileMenu) {
  mobileBtn.addEventListener('click', () => {
    const isOpen = !mobileMenu.classList.contains('hidden');
    mobileMenu.classList.toggle('hidden');
    mobileBtn.setAttribute('aria-expanded', String(!isOpen));
  });
}

// Globals
let PRODUCTS = [];
let FEATURED_COUNT = 4;
let currentZoomIndex = 0;
let currentZoomList = [];

const productsGrid = document.getElementById('products-grid');
const featuredGrid = document.getElementById('featured-products');
const customGrid = document.getElementById('custom-products');

// Fetch products from external JSON
async function loadProducts() {
  try {
    const res = await fetch('./data/products.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Impossible de charger data/products.json');
    PRODUCTS = await res.json();
    renderProducts(PRODUCTS);
    renderFeatured(PRODUCTS.slice(0, FEATURED_COUNT));
    renderCustom(PRODUCTS.filter(p => p.isCustom));
  } catch (e) {
    console.error(e);
    if (productsGrid) productsGrid.innerHTML = '<p class="text-red-600">Erreur de chargement des produits.</p>';
  }
}

function money(val) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(val);
}

function productCard(product) {
  const firstImg = product.images?.[0] || '';
  const alt = `Photo du produit ${product.name} (${product.sku})`;
  return `
    <article class="product-card overflow-hidden bg-white" aria-label="${product.name}">
      <div class="product-image aspect-[4/3]">
        <img src="${firstImg}" alt="${alt}" class="w-full h-full object-cover" loading="lazy" />
      </div>
      <div class="p-4">
        <h3 class="text-lg font-semibold line-clamp-2">${product.name}</h3>
        <p class="text-brand-red font-bold mt-1">${money(product.price)}</p>
        <div class="mt-3 flex items-center gap-2">
          <button class="btn-primary text-white px-4 py-2" onclick='openProduct(${JSON.stringify(product).replace(/'/g,"&#39;")})' aria-label="Voir le produit ${product.name}">Voir</button>
          <button class="btn-secondary text-white px-4 py-2" onclick='addToCart(${JSON.stringify({id:product.id, name:product.name, price:product.price})})' aria-label="Ajouter ${product.name} au panier">Ajouter</button>
        </div>
      </div>
    </article>
  `;
}

function renderProducts(list) {
  if (!productsGrid) return;
  productsGrid.innerHTML = list.map(productCard).join('');
}

function renderFeatured(list) {
  if (!featuredGrid) return;
  featuredGrid.innerHTML = list.map(productCard).join('');
}

function renderCustom(list) {
  if (!customGrid) return;
  if (!list.length) {
    customGrid.innerHTML = '<p class="text-gray-600">Bientôt disponible…</p>';
    return;
  }
  customGrid.innerHTML = list.map(productCard).join('');
}

// Filters
const categoryFilter = document.getElementById('category-filter');
const priceFilter = document.getElementById('price-filter');
const sortFilter = document.getElementById('sort-filter');

function applyFilters() {
  let items = [...PRODUCTS];
  const category = categoryFilter?.value || '';
  const price = priceFilter?.value || '';
  const sort = sortFilter?.value || 'newest';

  if (category) items = items.filter(p => p.category === category);

  if (price) {
    const [minStr, maxStr] = price.replace('+','-').split('-');
    const min = Number(minStr) || 0;
    const max = maxStr ? Number(maxStr) : Infinity;
    items = items.filter(p => p.price >= min && p.price <= max);
  }

  if (sort === 'price-low') items.sort((a,b)=>a.price-b.price);
  if (sort === 'price-high') items.sort((a,b)=>b.price-a.price);
  // 'newest' or 'popular' could use createdAt or sales; here we keep original order

  renderProducts(items);
}

[categoryFilter, priceFilter, sortFilter].forEach(sel => {
  if (sel) sel.addEventListener('change', applyFilters);
});

// Product modal & image zoom
const productModal = document.createElement('div');
productModal.id = 'product-modal';
productModal.className = 'modal-backdrop fixed inset-0 z-50 hidden';
productModal.innerHTML = `
  <div class="flex items-center justify-center min-h-screen p-4">
    <div class="modal-content bg-white max-w-4xl w-full max-h-96 overflow-y-auto rounded-2xl">
      <div class="p-6" id="product-modal-content" role="dialog" aria-modal="true" aria-label="Détails du produit"></div>
    </div>
  </div>`;
document.body.appendChild(productModal);

function openProduct(p) {
  const content = document.getElementById('product-modal-content');
  if (!content) return;
  const thumbs = (p.images||[]).map((src, idx)=>`
    <button class="thumbnail" onclick="openImageZoom(${idx}, ${encodeURIComponent(JSON.stringify(p.images))})" aria-label="Voir l'image ${idx+1} de ${p.name}">
      <img src="${src}" alt="Vue ${idx+1} de ${p.name}" loading="lazy"/>
    </button>`).join('');

  content.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <div class="main-image aspect-[4/3] rounded-xl overflow-hidden bg-white shadow">
          <img src="${p.images?.[0]||''}" alt="Image principale du produit ${p.name}" class="w-full h-full object-cover" loading="lazy"/>
        </div>
        <div class="thumbnail-grid">${thumbs}</div>
      </div>
      <div>
        <h3 class="text-2xl font-bold">${p.name}</h3>
        <p class="text-brand-red font-extrabold text-xl mt-2">${money(p.price)}</p>
        <p class="text-gray-700 mt-4">${p.description||''}</p>
        <div class="mt-4">
          <span class="font-semibold">Tailles :</span>
          <div class="mt-2 flex flex-wrap gap-2">${(p.sizes||[]).map(s=>`<span class="px-3 py-1 rounded-lg border">${s}</span>`).join('')}</div>
        </div>
        <div class="mt-4">
          <span class="font-semibold">Couleurs :</span>
          <div class="mt-2 flex flex-wrap gap-2">${(p.colors||[]).map(c=>`<span class="px-3 py-1 rounded-lg border">${c}</span>`).join('')}</div>
        </div>
        <div class="mt-6 flex gap-3">
          <button class="btn-primary text-white px-5 py-3" onclick='addToCart(${JSON.stringify({id:p.id, name:p.name, price:p.price})})'>Ajouter au panier</button>
          <a class="btn-secondary text-white px-5 py-3" href="https://wa.me/2250712623814?text=Bonjour,%20je%20souhaite%20informations%20sur%20${encodeURIComponent(p.name)}%20(${encodeURIComponent(p.sku||'')})." target="_blank" rel="noopener">WhatsApp</a>
        </div>
      </div>
    </div>
  `;
  productModal.classList.remove('hidden');
  productModal.setAttribute('aria-hidden', 'false');
}
window.openProduct = openProduct;

document.addEventListener('click', (e)=>{
  if (e.target.id === 'product-modal') {
    productModal.classList.add('hidden');
    productModal.setAttribute('aria-hidden', 'true');
  }
});

// Zoom
const zoomModal = document.createElement('div');
zoomModal.id = 'image-zoom-modal';
zoomModal.className = 'image-zoom-modal';
zoomModal.innerHTML = `
  <div class="image-zoom-content">
    <button class="image-zoom-close" aria-label="Fermer" onclick="closeImageZoom()">
      ✕
    </button>
    <button class="image-zoom-nav prev" onclick="previousImage()" id="zoom-prev-btn" aria-label="Image précédente">‹</button>
    <img id="zoom-image" src="" alt="Image agrandie du produit"/>
    <button class="image-zoom-nav next" onclick="nextImage()" id="zoom-next-btn" aria-label="Image suivante">›</button>
    <div class="image-zoom-counter" id="zoom-counter">1 / 1</div>
  </div>`;
document.body.appendChild(zoomModal);

window.openImageZoom = (index, imagesJsonEncoded) => {
  currentZoomList = JSON.parse(decodeURIComponent(imagesJsonEncoded));
  currentZoomIndex = index;
  updateZoomImage();
  zoomModal.classList.add('active');
};
window.closeImageZoom = () => zoomModal.classList.remove('active');
window.previousImage = () => { currentZoomIndex = (currentZoomIndex - 1 + currentZoomList.length) % currentZoomList.length; updateZoomImage(); };
window.nextImage = () => { currentZoomIndex = (currentZoomIndex + 1) % currentZoomList.length; updateZoomImage(); };

function updateZoomImage() {
  const img = document.getElementById('zoom-image');
  const counter = document.getElementById('zoom-counter');
  if (!img || !counter) return;
  const src = currentZoomList[currentZoomIndex];
  img.src = src;
  img.alt = `Agrandissement ${currentZoomIndex+1} / ${currentZoomList.length}`;
  counter.textContent = `${currentZoomIndex+1} / ${currentZoomList.length}`;
}

// Cart (demo only)
const cartCount = document.getElementById('cart-count');
let CART = [];
window.addToCart = (item) => {
  CART.push(item);
  if (cartCount) cartCount.textContent = String(CART.length);
  alert(item.name + ' ajouté au panier.');
};

// Contact form dummy handler
const contactForm = document.getElementById('contact-form');
if (contactForm) {
  contactForm.addEventListener('submit', (e)=>{
    e.preventDefault();
    alert('Merci pour votre message. Nous vous répondrons rapidement.');
    contactForm.reset();
  });
}

// GOOGLE MAPS WITHOUT EXPOSED KEY
// On suppose un endpoint backend /api/google-maps-key qui renvoie la clé depuis un .env côté serveur.
// Si indisponible, on affiche un fallback OpenStreetMap (iframe).
async function initMapSecure() {
  const mapContainer = document.getElementById('map');
  if (!mapContainer) return;
  try {
    const res = await fetch('/api/google-maps-key', { cache: 'no-store' });
    if (!res.ok) throw new Error('endpoint /api/google-maps-key indisponible');
    const { key } = await res.json();
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=__onGoogleMapsReady&libraries=places`;
    script.async = true;
    document.head.appendChild(script);
    window.__onGoogleMapsReady = () => {
      const center = { lat: 5.348, lng: -4.027 }; // Abidjan approx
      const map = new google.maps.Map(mapContainer, { center, zoom: 12 });
      new google.maps.Marker({ position: center, map, title: 'RedGreen Boutik' });
    };
  } catch (err) {
    // Fallback OpenStreetMap (no API key)
    mapContainer.innerHTML = \`
      <iframe title="Carte Abidjan (OpenStreetMap)" aria-label="Carte Abidjan"
        width="100%" height="100%" frameborder="0" scrolling="no" marginheight="0" marginwidth="0"
        src="https://www.openstreetmap.org/export/embed.html?bbox=-4.137%2C5.26%2C-3.93%2C5.4&layer=mapnik&marker=5.348%2C-4.027">
      </iframe>\`;
  }
}

window.openDirections = () => {
  const q = encodeURIComponent("RedGreen Boutik, Abidjan Côte d'Ivoire");
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${q}`,'_blank');
};

// Initialize
loadProducts().then(initMapSecure);
