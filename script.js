// =======================================================================
// SCRIPT.JS - VERSIÓN FINAL CON SINTAXIS CORREGIDA
// =======================================================================

// --- 1. CONFIGURACIÓN Y CONSTANTES GLOBALES ---
const SUPABASE_URL = 'https://msphufzcveevphkbhkop.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zcGh1ZnpjdmVldnBoa2Joa29wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1NjkyNTYsImV4cCI6MjA2NTE0NTI1Nn0.Rt-fpZDhXLQ3p018JN730LKEkTTqmo1p_hqAugSSsaE';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const WHATSAPP_PHONE_NUMBER = '5492612643519';
const LOCAL_STORAGE_CART_KEY = 'nutriForceCart';

// --- 2. ESTADO DE LA APLICACIÓN ---
let products = [];
let cart = [];
let toastTimeout;
let touchStartY = 0;
let touchCurrentY = 0;
let isDragging = false;
let currentProductInModal = null; // Para saber qué producto estamos viendo
let currentImageIndex = 0;      // Para saber qué imagen se está mostrando

// --- 3. FUNCIONES DE LÓGICA (EL "CEREBRO") ---

function findProductById(id) { return products.find(p => p.id === Number(id)); }
function findVariantById(id) { for (const p of products) { if (p.variants && Array.isArray(p.variants)) { const v = p.variants.find(v => v.id === Number(id)); if (v) return { product: p, variant: v }; } } return null; }
function saveCart() { localStorage.setItem(LOCAL_STORAGE_CART_KEY, JSON.stringify(cart)); }
function loadCart() { try { const d = localStorage.getItem(LOCAL_STORAGE_CART_KEY); cart = d ? JSON.parse(d) : []; } catch { cart = []; } }

function addToCart(variantDBId, quantity) {
    const vInfo = findVariantById(variantDBId);
    if (!vInfo) return;
    const itemInCart = cart.find(item => item.variantId === variantDBId);
    if (vInfo.variant.stock < (itemInCart?.quantity || 0) + quantity) return showToast(`Stock insuficiente.`, 'error');
    if (itemInCart) itemInCart.quantity += quantity;
    else cart.push({ variantId: variantDBId, quantity });
    saveCart(); renderCart(); showToast(`${vInfo.product.name} añadido!`);
    const cartButton = document.querySelector('.cart-button');
    cartButton?.classList.add('added-to-cart');
    cartButton?.addEventListener('animationend', () => cartButton.classList.remove('added-to-cart'), { once: true });
}

function handleTouchStart(e) {
    const cartPanel = document.getElementById('cart-panel');
    // Solo nos importa el inicio del toque si el carrito está abierto
    if (cartPanel.classList.contains('open')) {
        touchStartY = e.touches[0].clientY;
        isDragging = true;
        // Quitar la transición para que el panel siga el dedo instantáneamente
        cartPanel.style.transition = 'none';
    }
}

function handleTouchMove(e) {
    if (!isDragging) return;
    
    const cartPanel = document.getElementById('cart-panel');
    touchCurrentY = e.touches[0].clientY;
    const diffY = touchCurrentY - touchStartY;
    
    // Solo permitir deslizar hacia abajo (diffY > 0)
    if (diffY > 0) {
        // Mover el panel junto con el dedo
        cartPanel.style.bottom = `-${diffY}px`;
    }
}

function handleTouchEnd(e) {
    if (!isDragging) return;

    const cartPanel = document.getElementById('cart-panel');
    const diffY = touchCurrentY - touchStartY;
    const panelHeight = cartPanel.offsetHeight;

    // Volver a aplicar la transición para que el cierre sea suave
    cartPanel.style.transition = 'bottom 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    
    // Si se deslizó más de un tercio del panel, cerrarlo. Si no, vuelve a su sitio.
    if (diffY > panelHeight / 3) {
        togglePanel(cartPanel); // togglePanel se encarga de quitar la clase 'open'
    } else {
        // Vuelve a la posición original
        cartPanel.style.bottom = '0';
    }
    
    // Resetear las variables
    isDragging = false;
    touchStartY = 0;
    touchCurrentY = 0;
}

function increaseQuantity(id) {
    const item = cart.find(i => i.variantId === id);
    const vInfo = findVariantById(id);
    if (item && vInfo && item.quantity < vInfo.variant.stock) {
        item.quantity++;
        saveCart();
        renderCart();
    }
}
function decreaseQuantity(id) {
    const idx = cart.findIndex(i => i.variantId === id);
    if (idx > -1) {
        if (cart[idx].quantity > 1) {
            cart[idx].quantity--;
        } else {
            cart.splice(idx, 1);
        }
        saveCart();
        renderCart();
    }
}
function clearCart() {
    cart = [];
    saveCart();
    renderCart();
    showToast('Carrito vaciado.');
}

function applyFilters() {
    // Obtener el término de búsqueda (con una salvaguarda si el input no existe)
    const searchInput = document.getElementById('search-input');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

    // Obtener los valores de los checkboxes de filtros
    const selectedCats = Array.from(document.querySelectorAll('.category-filter:checked')).map(cb => cb.value);
    const selectedTags = Array.from(document.querySelectorAll('.tag-filter:checked')).map(cb => cb.value);

    // Filtrar el array 'products' que ya tenemos en memoria
    const filteredProducts = products.filter(product => {
        // Condición 1: El producto debe coincidir con la búsqueda por texto
        const matchesSearch = product.name.toLowerCase().includes(searchTerm) || 
                              product.description.toLowerCase().includes(searchTerm);

        // Condición 2: El producto debe coincidir con la categoría seleccionada (si hay alguna)
        const matchesCategory = selectedCats.length === 0 || selectedCats.includes(product.category);

        // Condición 3: El producto debe coincidir con al menos una de las etiquetas seleccionadas (si hay alguna)
        const matchesTags = selectedTags.length === 0 || (product.tags && product.tags.some(tag => selectedTags.includes(tag)));

        // Un producto se muestra solo si cumple TODAS las condiciones
        return matchesSearch && matchesCategory && matchesTags;
    });

    // Volver a dibujar la grilla de productos con los resultados filtrados
    renderProductCards(filteredProducts);
}

// --- 4. RENDERIZADO Y MANIPULACIÓN DEL DOM (LA "VISTA") ---
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast-notification');
    if (!toast) return;
    toast.textContent = message; toast.className = 'toast show'; toast.style.backgroundColor = type === 'error' ? '#c0392b' : '#333';
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => { toast.className = 'toast'; }, 3000);
}

function populateFilters() {
    const catContainer = document.getElementById('category-filters');
    const tagContainer = document.getElementById('tag-filters');
    if (!catContainer || !tagContainer) return;
    const cats = new Set(products.map(p => p.category).filter(Boolean));
    const tags = new Set(products.flatMap(p => p.tags || []));
    catContainer.innerHTML = [...cats].sort().map(c => `<div><input type="checkbox" id="cat-${c.replace(/\s/g, '-')}" value="${c}" class="category-filter"><label for="cat-${c.replace(/\s/g, '-')}">${c}</label></div>`).join('');
    tagContainer.innerHTML = [...tags].sort().map(t => `<div><input type="checkbox" id="tag-${t.replace(/\s/g, '-')}" value="${t}" class="tag-filter"><label for="tag-${t.replace(/\s/g, '-')}">${t}</label></div>`).join('');
}

function renderProductCards(productsToRender) {
    const container = document.getElementById("productos-grid");
    if (!container) return;
    container.innerHTML = '';
    if (!productsToRender || productsToRender.length === 0) return container.innerHTML = '<p class="no-results">No se encontraron productos.</p>';
    productsToRender.forEach(p => {
        if (!Array.isArray(p.variants) || p.variants.length === 0) return;
        const cheapest = p.variants.reduce((min, v) => v.price < min.price ? v : min, p.variants[0]);
        container.innerHTML += `<div class="card" data-product-id="${p.id}"><img src="${p.images?.[0] || ''}" alt="${p.name}"><h3>${p.name}</h3><p>Desde $${cheapest.price.toLocaleString('es-AR')}</p><button class="cta-button">Ver Opciones</button></div>`;
    });
}

function renderCart() {
    const list = document.getElementById("cart-items");
    const totalEl = document.getElementById("cart-total");
    const link = document.getElementById("whatsapp-link");
    if (!list || !totalEl || !link) return;
    list.innerHTML = "";
    let total = 0;
    if (cart.length === 0) { list.innerHTML = "<li>El carrito está vacío.</li>"; }
    else {
        cart.forEach(item => {
            const vInfo = findVariantById(item.variantId);
            if (vInfo) {
                const { product, variant } = vInfo;
                total += variant.price * item.quantity;
                list.innerHTML += `<li><div class="item-info"><span>${product.name} (${variant.value}${variant.unit})</span><span>$${variant.price.toLocaleString('es-AR')} x ${item.quantity}</span></div><div class="item-quantity-controls"><button class="quantity-btn" data-action="decrease" data-variant-id="${variant.id}">-</button><span>${item.quantity}</span><button class="quantity-btn" data-action="increase" data-variant-id="${variant.id}">+</button></div></li>`;
            }
        });
    }
    totalEl.innerHTML = `<strong>Total:</strong> $${total.toLocaleString('es-AR')}`;
    let msg = cart.length > 0 ? `Pedido:\n${cart.map(item => { const vInfo = findVariantById(item.variantId); return vInfo ? `- ${vInfo.product.name} (${vInfo.variant.value}${vInfo.variant.unit}) x${item.quantity}` : ''; }).join('\n')}\n\nTotal: $${total.toLocaleString('es-AR')}` : "Consulta";
    link.href = `https://wa.me/${WHATSAPP_PHONE_NUMBER}?text=${encodeURIComponent(msg)}`;
}

function togglePanel(panel, button, openClass = 'open') {
    if (!panel) return;
    const isOpen = panel.classList.toggle(openClass);
    document.body.style.overflow = isOpen ? 'hidden' : 'auto';
    if (button) button.classList.toggle('is-active', isOpen);
    if (isOpen && panel.id === 'cart-panel') renderCart();
}

// --- Añade estas NUEVAS funciones de ayuda para el carrusel ---

// Función para cambiar a la imagen anterior o siguiente
function navigateCarousel(direction) {
    if (!currentProductInModal || !currentProductInModal.images) return;
    
    const totalImages = currentProductInModal.images.length;
    // La fórmula (índice + dirección + total) % total asegura que el índice siempre sea válido y dé la vuelta
    currentImageIndex = (currentImageIndex + direction + totalImages) % totalImages;
    
    updateCarouselDisplay();
}

// Función central que actualiza qué imagen se ve
function updateCarouselDisplay() {
    if (!currentProductInModal || !currentProductInModal.images) return;
    
    const images = currentProductInModal.images;
    const modal = document.getElementById('product-modal');
    
    // 1. Actualizar la imagen principal
    const mainImage = modal.querySelector('#modal-carousel-main-img');
    mainImage.src = images[currentImageIndex];
    mainImage.alt = `${currentProductInModal.name} - Imagen ${currentImageIndex + 1}`;
    
    // 2. Resaltar la miniatura activa
    const thumbnails = modal.querySelectorAll('.carousel-thumbnails img');
    thumbnails.forEach((thumb, index) => {
        if (index === currentImageIndex) {
            thumb.classList.add('selected');
        } else {
            thumb.classList.remove('selected');
        }
    });

    // 3. Ocultar/mostrar flechas si solo hay una imagen
    const prevBtn = modal.querySelector('#carousel-prev-btn');
    const nextBtn = modal.querySelector('#carousel-next-btn');
    if (images.length <= 1) {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
    } else {
        prevBtn.style.display = 'flex';
        nextBtn.style.display = 'flex';
    }
}

// --- Reemplaza tu función openModal con esta ---
function openModal(productId) {
    const product = findProductById(productId);
    if (!product) return showToast('Producto no encontrado.', 'error');

    currentProductInModal = product; // Guardamos el producto actual
    currentImageIndex = 0; // Siempre empezamos por la primera imagen

    const modal = document.getElementById('product-modal');
    if (!modal) return;
    
    // --- Lógica de la Galería y Carrusel ---
    const gallery = modal.querySelector('.modal-product-gallery');
    const thumbnailsContainer = modal.querySelector('#modal-carousel-thumbnails');
    
    if (gallery && Array.isArray(product.images) && product.images.length > 0) {
        // Limpiamos las miniaturas anteriores
        thumbnailsContainer.innerHTML = '';
        
        // Creamos una miniatura por cada imagen en el array
        product.images.forEach((imgSrc, index) => {
            const thumb = document.createElement('img');
            thumb.src = imgSrc;
            thumb.alt = `Miniatura ${index + 1}`;
            thumb.dataset.index = index; // Guardamos el índice para saber a cuál cambiar
            thumbnailsContainer.appendChild(thumb);
        });

        // Llamamos a la función que sincroniza todo el carrusel
        updateCarouselDisplay();

    } else {
        // Si no hay imágenes, ocultamos la galería
        if(gallery) gallery.style.display = 'none';
    }

    // --- Lógica para el resto del contenido (sin cambios) ---
    modal.querySelector('#modal-name').textContent = product.name;
    modal.querySelector('#modal-description').textContent = product.description;
    modal.querySelector('#modal-tags').innerHTML = product.tags ? product.tags.map(tag => `<span class="product-tag">${tag}</span>`).join('') : '';
    
    const variantSelect = modal.querySelector('#product-variant-select');
    if (Array.isArray(product.variants) && product.variants.length > 0) {
        variantSelect.innerHTML = product.variants.map(v => `<option value="${v.id}">${v.value}${v.unit}</option>`).join('');
        variantSelect.dispatchEvent(new Event('change'));
    } else {
        variantSelect.innerHTML = '<option>No disponible</option>';
    }
    
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeModal(modalId) { const modal = document.getElementById(modalId); if (modal) modal.style.display = 'none'; if (!document.querySelector('.modal[style*="display: block"]')) { document.body.style.overflow = 'auto'; } }

// --- 5. PUNTO DE INICIO Y EVENT LISTENERS (EL "CONTROLADOR") ---

function setupEventListeners() {
    document.body.addEventListener('click', (e) => {
        const cartButton = e.target.closest('.cart-button');
        const clearCartButton = e.target.closest('.cart-actions .cta-button.small');
        const quantityBtn = e.target.closest('.quantity-btn');
        const productCard = e.target.closest('.card');
        const addToCartBtnModal = e.target.closest('#add-to-cart-modal-btn');
        const closeModalBtn = e.target.matches('.close-modal');
        const modalBackground = e.target.matches('.modal');
        const toggleFiltersBtn = e.target.closest('#toggle-filters-btn');
        const resetFiltersBtn = e.target.closest('#reset-filters-btn');
        const hamburgerBtn = e.target.closest('#hamburger-menu');
        const faqQuestion = e.target.matches('.faq-question');
        const cartPanel = document.getElementById('cart-panel');
        const modal = document.getElementById('product-modal');

        
        cartPanel.addEventListener('touchstart', handleTouchStart, { passive: true });
        cartPanel.addEventListener('touchmove', handleTouchMove, { passive: true });
        cartPanel.addEventListener('touchend', handleTouchEnd);

        if (cartButton) togglePanel(document.getElementById('cart-panel'));
        if (clearCartButton) clearCart();
        if (quantityBtn) {
            const id = Number(quantityBtn.dataset.variantId);
            if (quantityBtn.dataset.action === 'increase') increaseQuantity(id);
            if (quantityBtn.dataset.action === 'decrease') decreaseQuantity(id);
        }
        if (productCard) openModal(productCard.dataset.productId);
        if (addToCartBtnModal) {
            const modal = document.getElementById('product-modal');
            const vId = Number(modal.querySelector('#product-variant-select').value);
            const qty = parseInt(modal.querySelector('#modal-quantity-input').value, 10);
            if (vId && qty > 0) { addToCart(vId, qty); closeModal('product-modal'); }
        }
            if (modal) {
        // Listener para las flechas del carrusel
        modal.addEventListener('click', (e) => {
            if (e.target.closest('#carousel-prev-btn')) {
                navigateCarousel(-1); // -1 para ir a la anterior
            }
            if (e.target.closest('#carousel-next-btn')) {
                navigateCarousel(1); // 1 para ir a la siguiente
            }
        });

        // Listener para las miniaturas
        const thumbnailsContainer = modal.querySelector('#modal-carousel-thumbnails');
        thumbnailsContainer.addEventListener('click', (e) => {
            // Si el clic fue en una imagen de miniatura
            if (e.target.tagName === 'IMG' && e.target.dataset.index) {
                currentImageIndex = Number(e.target.dataset.index);
                updateCarouselDisplay();
            }
        });
    }

            const searchInput = document.getElementById('search-input');
    if (searchInput) {
        // Cada vez que el usuario escribe ('input'), se llama a la función applyFilters
        searchInput.addEventListener('input', applyFilters);
    }

        if (closeModalBtn) closeModal(e.target.closest('.modal').id);
        if (modalBackground) closeModal(e.target.id);
        if (toggleFiltersBtn) {
            const container = document.getElementById('filters-container');
            const isExpanded = container.classList.toggle('expanded');
            toggleFiltersBtn.innerHTML = isExpanded ? 'Ocultar Filtros <i class="fas fa-chevron-up"></i>' : 'Mostrar Filtros <i class="fas fa-chevron-down"></i>';
            container.style.maxHeight = isExpanded ? container.scrollHeight + "px" : "0px";
        }
        if (resetFiltersBtn) {
            const search = document.getElementById('search-input');
            if (search) search.value = '';
            document.querySelectorAll('.category-filter, .tag-filter').forEach(cb => cb.checked = false);
            applyFilters();
        }
        if (hamburgerBtn) togglePanel(document.getElementById('mobile-nav-menu'), hamburgerBtn, 'is-open');
        if (faqQuestion) {
            const parent = e.target.parentNode;
            const isActive = parent.classList.contains('active');
            document.querySelectorAll('.faq-item.active').forEach(item => item.classList.remove('active'));
            if (!isActive) parent.classList.add('active');
        }
    });
    
    // Listeners para eventos que no son 'click'
    const searchInput = document.getElementById('search-input');
    const filtersContainer = document.getElementById('filters-container');
    const variantSelect = document.getElementById('product-variant-select');

    if (searchInput) searchInput.addEventListener('input', applyFilters);
    if (filtersContainer) filtersContainer.addEventListener('change', (e) => { if (e.target.matches('.category-filter, .tag-filter')) applyFilters(); });
    if (variantSelect) variantSelect.addEventListener('change', (e) => {
        const vInfo = findVariantById(e.target.value);
        const modal = document.getElementById('product-modal');
        if (vInfo && modal) {
            modal.querySelector('#modal-price').textContent = `$${vInfo.variant.price.toLocaleString('es-AR')}`;
            modal.querySelector('#modal-stock-info').textContent = `(${vInfo.variant.stock} disponibles)`;
            modal.querySelector('#modal-quantity-input').max = vInfo.variant.stock;
        }
    });
}

async function main() {
    loadCart();
    const grid = document.getElementById("productos-grid");
    if (!grid) return console.error('Contenedor de productos no encontrado. Abortando.');
    
    // Asignar listeners básicos que no dependen de los datos de productos
    setupEventListeners();
    grid.innerHTML = '<p>Cargando...</p>';
    
    const { data, error } = await supabaseClient.from('products_with_variants').select('*');
    if (error) {
        grid.innerHTML = `<p>Error al cargar productos: ${error.message}</p>`;
        return;
    }

    products = data;
    console.log("Productos cargados OK", products);
    
    populateFilters();
    applyFilters();
    renderCart(); 
}

document.addEventListener('DOMContentLoaded', main);