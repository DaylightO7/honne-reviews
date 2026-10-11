/**
 * HonneReviews - Main Portal Client Application
 */

let currentAuthUser = null;
let activeCategory = 'All';
let currentSearchQuery = '';

// DOM Elements
const navAuthContainer = document.getElementById('nav-auth-container');
const productGrid = document.getElementById('product-grid');
const categoryTabs = document.getElementById('category-tabs');
const resultsCount = document.getElementById('results-count');
const navbarSearch = document.getElementById('navbar-search');
const heroSearchInput = document.getElementById('hero-search-input');
const heroSearchBtn = document.getElementById('hero-search-btn');

// Check Current User Session
async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    const data = await res.json();
    if (res.ok && data.success) {
      currentAuthUser = data.user;
    } else {
      currentAuthUser = null;
    }
  } catch (err) {
    currentAuthUser = null;
  }
  renderNavAuth();
}

// Render Top Navbar Auth Controls
function renderNavAuth() {
  if (typeof renderAuthNavbar === 'function') {
    renderAuthNavbar(navAuthContainer, currentAuthUser);
  } else if (navAuthContainer) {
    if (currentAuthUser) {
      navAuthContainer.innerHTML = `<span class="badge badge-dark">👤 ${escapeHtml(currentAuthUser.name)}</span>`;
    } else {
      navAuthContainer.innerHTML = `<a href="login.html" class="btn btn-outline btn-sm">Sign In</a><a href="register.html" class="btn btn-primary btn-sm">Sign Up</a>`;
    }
  }
}

// Fetch and render products with filters
async function loadProducts() {
  if (!productGrid) return;
  productGrid.innerHTML = `
    <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #94a3b8;">
      Fetching gadgets...
    </div>
  `;

  try {
    let url = `/api/products?`;
    if (activeCategory && activeCategory !== 'All') {
      url += `category=${encodeURIComponent(activeCategory)}&`;
    }
    if (currentSearchQuery && currentSearchQuery.trim() !== '') {
      url += `search=${encodeURIComponent(currentSearchQuery.trim())}&`;
    }

    const res = await fetch(url, { credentials: 'include' });
    const data = await res.json();

    if (!res.ok || !data.success || !data.data || data.data.length === 0) {
      productGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 4rem 1rem; color: #64748b;">
          <h3>No gadgets found</h3>
          <p style="margin-top: 0.5rem; color: #94a3b8;">Try adjusting your search terms or selecting another category.</p>
        </div>
      `;
      if (resultsCount) resultsCount.textContent = '0 products found';
      return;
    }

    const products = data.data;
    if (resultsCount) {
      resultsCount.textContent = `Showing ${products.length} product${products.length > 1 ? 's' : ''}`;
    }

    productGrid.innerHTML = '';
    products.forEach(product => {
      productGrid.appendChild(createProductCard(product));
    });
  } catch (err) {
    productGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #ef4444;">
        Unable to load gadgets. Please check if server is active.
      </div>
    `;
  }
}

// Create Product Card DOM Element
function createProductCard(product) {
  const card = document.createElement('div');
  card.className = 'product-card';

  const defaultImg = '/images/default-gadget.svg';
  const imageUrl = product.imageUrl || defaultImg;
  const ratingScore = product.averageRating > 0 ? product.averageRating.toFixed(1) : 'No reviews';
  const starsString = renderStars(product.averageRating);
  const formattedPrice = (product.price !== undefined && product.price !== null)
    ? Number(product.price).toLocaleString('en-IN')
    : '0';

  card.innerHTML = `
    <div class="product-thumb-wrapper">
      <img src="${imageUrl}" alt="${escapeHtml(product.name)}" class="product-thumb" onerror="this.src='${defaultImg}'">
      <div class="product-category-overlay">
        <span class="badge badge-primary">${escapeHtml(product.category)}</span>
      </div>
      <div class="product-price-overlay">
        ₹${formattedPrice}
      </div>
    </div>

    <div class="product-body">
      <div class="product-brand">${escapeHtml(product.brand || 'Tech')}</div>
      <h3 class="product-title">${escapeHtml(product.name)}</h3>

      <div class="product-rating-row">
        <span class="stars">${starsString}</span>
        <span class="rating-score">${ratingScore}</span>
        <span class="rating-count">(${product.totalReviews || 0})</span>
      </div>

      <p class="product-snippet">${escapeHtml(product.snippet || product.description || 'No reviews submitted yet.')}</p>

      <div class="product-card-footer">
        <a href="product.html?id=${product._id}" class="btn btn-outline btn-block">
          Read Reviews &rarr;
        </a>
      </div>
    </div>
  `;

  return card;
}

// Helper: Star symbols
function renderStars(rating) {
  const rounded = Math.round(rating || 0);
  return '★'.repeat(rounded) + '☆'.repeat(5 - rounded);
}

// Helper: Escape HTML
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Fetch Dynamic Review & Platform Stats
async function loadPlatformStats() {
  const heroReviewCount = document.getElementById('hero-review-count');
  if (!heroReviewCount) return;

  try {
    const res = await fetch('/api/stats');
    const data = await res.json();
    if (res.ok && data.success && data.totalReviews !== undefined) {
      heroReviewCount.textContent = `${data.totalReviews.toLocaleString()}`;
    }
  } catch (err) {
    console.error('Error loading platform stats:', err);
  }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Check URL parameters for preset category or search
  const urlParams = new URLSearchParams(window.location.search);
  const initialCategory = urlParams.get('category');
  const initialSearch = urlParams.get('search');

  if (initialCategory) {
    activeCategory = initialCategory;
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.category === activeCategory);
    });
  }

  if (initialSearch) {
    currentSearchQuery = initialSearch;
    if (navbarSearch) navbarSearch.value = initialSearch;
    if (heroSearchInput) heroSearchInput.value = initialSearch;
  }

  checkAuth();
  loadProducts();
  loadPlatformStats();

  // Category Tabs Click
  if (categoryTabs) {
    categoryTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('.tab-btn');
      if (!btn) return;

      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = btn.dataset.category;
      loadProducts();
    });
  }

  // Navbar category links
  document.querySelectorAll('.nav-cat-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const cat = link.dataset.category;
      activeCategory = cat;
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.category === activeCategory);
      });
      loadProducts();
      window.scrollTo({ top: 350, behavior: 'smooth' });
    });
  });

  // Search in Navbar
  if (navbarSearch) {
    let debounceTimer;
    navbarSearch.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        currentSearchQuery = e.target.value;
        loadProducts();
      }, 300);
    });
  }

  // Search in Hero
  if (heroSearchBtn && heroSearchInput) {
    const executeHeroSearch = () => {
      currentSearchQuery = heroSearchInput.value;
      if (navbarSearch) navbarSearch.value = currentSearchQuery;
      loadProducts();
      window.scrollTo({ top: 400, behavior: 'smooth' });
    };

    heroSearchBtn.addEventListener('click', executeHeroSearch);
    heroSearchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') executeHeroSearch();
    });
  }
});
