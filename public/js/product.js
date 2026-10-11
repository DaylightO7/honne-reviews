/**
 * HonneReviews - Product Details, Specifications Management & Review Feed Logic
 */

let currentAuthUser = null;
let currentProductId = null;
let currentProductData = null;
let allReviews = [];

// DOM Elements
const navAuthContainer = document.getElementById('nav-auth-container');
const navbarSearch = document.getElementById('navbar-search');

const detailImage = document.getElementById('detail-image');
const detailBrand = document.getElementById('detail-brand');
const detailTitle = document.getElementById('detail-title');
const detailCategory = document.getElementById('detail-category');
const detailStars = document.getElementById('detail-stars');
const detailScore = document.getElementById('detail-score');
const detailCount = document.getElementById('detail-count');
const detailPrice = document.getElementById('detail-price');
const detailDescription = document.getElementById('detail-description');
const specsTable = document.getElementById('specs-table');
const editSpecsBtn = document.getElementById('edit-specs-btn');

// Specs Modal Elements
const specsModal = document.getElementById('specs-modal');
const closeSpecsModal = document.getElementById('close-specs-modal');
const cancelSpecsModalBtn = document.getElementById('cancel-specs-modal-btn');
const specsModalForm = document.getElementById('specs-modal-form');
const specsRowsContainer = document.getElementById('specs-rows-container');
const addSpecRowBtn = document.getElementById('add-spec-row-btn');
const specsModalAlert = document.getElementById('specs-modal-alert');

const bcCategory = document.getElementById('bc-category');
const bcName = document.getElementById('bc-name');

const breakdownScore = document.getElementById('breakdown-overall-score');
const breakdownStars = document.getElementById('breakdown-overall-stars');
const breakdownTotal = document.getElementById('breakdown-total-reviews');

const writeReviewContainer = document.getElementById('write-review-container');
const reviewsFeed = document.getElementById('reviews-feed');
const reviewsCountBadge = document.getElementById('reviews-count-badge');
const reviewSortSelect = document.getElementById('review-sort-select');

// 1. Check Session & Render Navbar
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
  updateAdminControls();
}

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

function updateAdminControls() {
  const isAdmin = currentAuthUser && (currentAuthUser.role === 'admin' || currentAuthUser.role === 'master_admin');
  if (editSpecsBtn) {
    if (isAdmin) {
      editSpecsBtn.classList.remove('hidden');
    } else {
      editSpecsBtn.classList.add('hidden');
    }
  }
}

// 2. Fetch Product Details and Reviews
async function loadProductDetails() {
  const urlParams = new URLSearchParams(window.location.search);
  currentProductId = urlParams.get('id');

  if (!currentProductId) {
    window.location.href = 'index.html';
    return;
  }

  try {
    const res = await fetch(`/api/products/${currentProductId}`, { credentials: 'include' });
    const data = await res.json();

    if (!res.ok || !data.success) {
      document.querySelector('main').innerHTML = `
        <div style="text-align: center; padding: 4rem 1rem;">
          <h2>Product Not Found</h2>
          <p style="color: #64748b; margin: 1rem 0;">The requested gadget may have been unlisted or removed.</p>
          <a href="index.html" class="btn btn-primary">Back to Catalog</a>
        </div>
      `;
      return;
    }

    currentProductData = data.data;
    allReviews = data.reviews || [];

    renderProductInfo(data.data);
    renderRatingBreakdown(data.data);
    renderWriteReviewBox();
    sortAndRenderReviews();
    updateAdminControls();
  } catch (err) {
    console.error('Error fetching product:', err);
  }
}

// 3. Render Core Product Information & Specifications
function renderProductInfo(product) {
  document.title = `${product.name} Reviews — HonneReviews`;

  const fallbackImg = '/images/default-gadget.svg';
  detailImage.src = product.imageUrl || fallbackImg;
  detailImage.onerror = () => { detailImage.src = fallbackImg; };
  detailImage.alt = product.name;

  detailBrand.textContent = product.brand || 'Tech';
  detailTitle.textContent = product.name;
  detailCategory.textContent = product.category;
  detailPrice.textContent = product.price ? `₹${Number(product.price).toLocaleString('en-IN')}` : '₹0';
  detailDescription.textContent = product.description || product.featuredDescription || 'No reviews submitted yet.';

  bcCategory.textContent = product.category;
  bcName.textContent = product.name;

  const avg = product.averageRating || 0;
  detailScore.textContent = avg > 0 ? avg.toFixed(1) : '0.0';
  detailStars.textContent = renderStars(avg);
  detailCount.textContent = `(${product.totalReviews || 0} reviews)`;

  renderSpecificationsTable(product.specifications || []);
}

function renderSpecificationsTable(specs) {
  const tbody = specsTable.querySelector('tbody');
  tbody.innerHTML = '';

  let specItems = [];
  if (Array.isArray(specs) && specs.length > 0) {
    specItems = specs;
  } else if (currentProductData?.specs && typeof currentProductData.specs === 'object') {
    specItems = Object.entries(currentProductData.specs).map(([key, value]) => ({ key, value }));
  }

  if (specItems.length > 0) {
    specItems.forEach(item => {
      if (!item.key && !item.value) return;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight: 600; width: 35%; color: var(--text-primary);">${escapeHtml(item.key)}</td>
        <td style="color: var(--text-secondary);">${escapeHtml(item.value)}</td>
      `;
      tbody.appendChild(tr);
    });
  } else {
    const isAdmin = currentAuthUser && (currentAuthUser.role === 'admin' || currentAuthUser.role === 'master_admin');
    tbody.innerHTML = `
      <tr>
        <td colspan="2" style="color: #94a3b8; text-align: center; padding: 1rem;">
          No technical specifications added yet. ${isAdmin ? 'Click "⚙️ Edit Specs" above to add key specs.' : ''}
        </td>
      </tr>
    `;
  }
}

// 4. Inline Admin Specifications Management
function createSpecRowElement(key = '', value = '') {
  const row = document.createElement('div');
  row.className = 'spec-row';
  row.style.cssText = 'display: flex; gap: 0.5rem; align-items: center;';

  row.innerHTML = `
    <input type="text" class="spec-key-input" placeholder="Key (e.g. Processor)" value="${escapeHtml(key)}" style="flex: 1; padding: 0.45rem 0.6rem; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 0.85rem;" required>
    <input type="text" class="spec-val-input" placeholder="Value (e.g. Snapdragon 8 Gen 3)" value="${escapeHtml(value)}" style="flex: 2; padding: 0.45rem 0.6rem; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 0.85rem;" required>
    <button type="button" class="btn-remove-spec-row" title="Delete spec" style="background: #fee2e2; color: #ef4444; border: 1px solid #fca5a5; border-radius: var(--radius-sm); width: 32px; height: 32px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1rem;">&times;</button>
  `;

  row.querySelector('.btn-remove-spec-row').addEventListener('click', () => {
    row.remove();
  });

  return row;
}

function openSpecsModal() {
  if (!specsModal) return;
  document.body.classList.add('modal-open');
  specsModalAlert?.classList.add('hidden');
  specsRowsContainer.innerHTML = '';

  const existingSpecs = currentProductData?.specifications || [];
  if (existingSpecs.length > 0) {
    existingSpecs.forEach(item => {
      specsRowsContainer.appendChild(createSpecRowElement(item.key, item.value));
    });
  } else {
    // Default starter specs
    const defaultTemplates = [
      { key: 'Processor', value: '' },
      { key: 'Display', value: '' },
      { key: 'Battery', value: '' },
      { key: 'Camera', value: '' }
    ];
    defaultTemplates.forEach(item => {
      specsRowsContainer.appendChild(createSpecRowElement(item.key, item.value));
    });
  }

  specsModal.classList.remove('hidden');
}

function closeSpecsModalFn() {
  if (specsModal) {
    specsModal.classList.add('hidden');
    document.body.classList.remove('modal-open');
  }
}

editSpecsBtn?.addEventListener('click', openSpecsModal);
closeSpecsModal?.addEventListener('click', closeSpecsModalFn);
cancelSpecsModalBtn?.addEventListener('click', closeSpecsModalFn);
specsModal?.addEventListener('click', (e) => {
  if (e.target === specsModal) closeSpecsModalFn();
});

addSpecRowBtn?.addEventListener('click', () => {
  specsRowsContainer.appendChild(createSpecRowElement('', ''));
});

specsModalForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const saveBtn = document.getElementById('save-specs-modal-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving Specs...';

  const rowEls = specsRowsContainer.querySelectorAll('.spec-row');
  const specsList = [];

  rowEls.forEach(r => {
    const key = r.querySelector('.spec-key-input')?.value.trim();
    const val = r.querySelector('.spec-val-input')?.value.trim();
    if (key && val) {
      specsList.push({ key, value: val });
    }
  });

  try {
    const res = await fetch(`/api/products/${currentProductId}/specs`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ specifications: specsList })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      if (currentProductData) {
        currentProductData.specifications = data.data.specifications;
      }
      renderSpecificationsTable(data.data.specifications);
      closeSpecsModalFn();
    } else {
      specsModalAlert.className = 'alert alert-danger';
      specsModalAlert.textContent = data.message || 'Failed to update specifications.';
      specsModalAlert.classList.remove('hidden');
    }
  } catch (err) {
    specsModalAlert.className = 'alert alert-danger';
    specsModalAlert.textContent = 'Network error saving specifications.';
    specsModalAlert.classList.remove('hidden');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Specifications';
  }
});

// 5. Render Rating Distribution Bars
function renderRatingBreakdown(product) {
  const avg = product.averageRating || 0;
  const total = product.totalReviews || 0;
  const breakdown = product.ratingBreakdown || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  breakdownScore.textContent = avg > 0 ? avg.toFixed(1) : '0.0';
  breakdownStars.textContent = renderStars(avg);
  breakdownTotal.textContent = `Based on ${total} verified community review${total === 1 ? '' : 's'}`;

  for (let star = 1; star <= 5; star++) {
    const count = breakdown[star] || 0;
    const pct = total > 0 ? ((count / total) * 100).toFixed(0) : 0;

    const barEl = document.getElementById(`bar-${star}`);
    const countEl = document.getElementById(`count-${star}`);
    if (barEl) barEl.style.width = `${pct}%`;
    if (countEl) countEl.textContent = count;
  }
}

// 6. Review Sorting Controls & Filter
function sortAndRenderReviews() {
  const sortMode = reviewSortSelect ? reviewSortSelect.value : 'newest';
  const reviewsCopy = [...allReviews];

  if (sortMode === 'net_likes' || sortMode === 'net_upvotes') {
    reviewsCopy.sort((a, b) => {
      const scoreA = (a.likesCount || 0) - (a.dislikesCount || 0);
      const scoreB = (b.likesCount || 0) - (b.dislikesCount || 0);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  } else if (sortMode === 'most_disliked') {
    reviewsCopy.sort((a, b) => {
      const disA = a.dislikesCount || 0;
      const disB = b.dislikesCount || 0;
      if (disB !== disA) return disB - disA;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  } else if (sortMode === 'oldest') {
    reviewsCopy.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  } else {
    // newest first
    reviewsCopy.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  renderReviews(reviewsCopy);
}

reviewSortSelect?.addEventListener('change', sortAndRenderReviews);

// 7. Render Active Public Reviews Feed
function renderReviews(reviews) {
  reviewsCountBadge.textContent = reviews.length;

  if (reviews.length === 0) {
    reviewsFeed.innerHTML = `
      <div style="text-align: center; padding: 3rem 1rem; color: #94a3b8; background: #fff; border-radius: var(--radius-md); border: 1px solid var(--border);">
        <p style="font-size: 1.1rem; font-weight: 600; color: #475569;">No reviews yet for this product</p>
        <p style="font-size: 0.875rem; margin-top: 0.25rem;">Be the first verified buyer to share your hands-on feedback!</p>
      </div>
    `;
    return;
  }

  reviewsFeed.innerHTML = '';
  reviews.forEach(review => {
    const card = document.createElement('div');
    card.className = 'review-item-card';

    const reviewerName = review.user?.name || 'Verified Buyer';
    const initial = reviewerName.charAt(0).toUpperCase();
    const dateFormatted = new Date(review.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    const likesCount = review.likesCount || 0;
    const dislikesCount = review.dislikesCount || 0;

    // Image gallery thumbnails (up to 8 images)
    let imagesGalleryHtml = '';
    if (review.images && review.images.length > 0) {
      imagesGalleryHtml = `
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.85rem;">
          ${review.images.map(img => `
            <a href="${img}" target="_blank" title="View full photo" style="display:block;">
              <img src="${img}" alt="Review photo" style="width: 72px; height: 72px; object-fit: cover; border-radius: 6px; border: 1px solid var(--border); transition: transform 0.15s ease;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
            </a>
          `).join('')}
        </div>
      `;
    }

    card.innerHTML = `
      <div class="review-card-top">
        <div class="reviewer-meta">
          <a href="user.html?id=${review.user?._id || ''}" class="review-author-link" style="display:flex; align-items:center; gap:0.65rem;" title="View ${escapeHtml(reviewerName)}'s public profile">
            <img src="${review.user?.avatarUrl || '/images/default-avatar.svg'}" alt="${escapeHtml(reviewerName)}" class="nav-avatar-mini" style="width: 36px; height: 36px;" onerror="this.onerror=null; this.src='/images/default-avatar.svg';">
            <div>
              <div class="reviewer-name" style="font-weight: 700;">${escapeHtml(reviewerName)}</div>
              <div class="review-date">Reviewed on ${dateFormatted}</div>
            </div>
          </a>
        </div>
        <div class="stars" style="font-size: 1.1rem;">
          ${renderStars(review.rating)}
        </div>
      </div>

      <div class="review-card-body">
        ${review.heading ? `<h4 style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.35rem;">${escapeHtml(review.heading)}</h4>` : ''}
        <div style="color: var(--text-secondary); line-height: 1.6;">${escapeHtml(review.comment)}</div>
        ${imagesGalleryHtml}
      </div>

      <div class="review-card-footer">
        <!-- Likes & Dislikes System -->
        <div style="display: flex; align-items: center; gap: 0.6rem;">
          <button class="btn-helpful like-btn ${review.hasLiked ? 'active' : ''}" data-review-id="${review._id}" title="Like review">
            <span>👍</span>
            <span class="like-count">${likesCount}</span>
          </button>
          <button class="btn-helpful dislike-btn ${review.hasDisliked ? 'active' : ''}" data-review-id="${review._id}" title="Dislike review">
            <span>👎</span>
            <span class="dislike-count">${dislikesCount}</span>
          </button>
        </div>
      </div>
    `;

    // Like Button Event Listener
    const likeBtn = card.querySelector('.like-btn');
    const dislikeBtn = card.querySelector('.dislike-btn');

    likeBtn.addEventListener('click', async () => {
      if (!currentAuthUser) {
        alert('Please sign in to like this review.');
        return;
      }

      try {
        const res = await fetch(`/api/reviews/${review._id}/like`, {
          method: 'POST',
          credentials: 'include'
        });
        const data = await res.json();
        if (res.ok && data.success) {
          likeBtn.classList.toggle('active', data.hasLiked);
          likeBtn.querySelector('.like-count').textContent = data.likesCount;
          dislikeBtn.classList.toggle('active', data.hasDisliked);
          dislikeBtn.querySelector('.dislike-count').textContent = data.dislikesCount;

          // Sync state in allReviews
          const target = allReviews.find(r => r._id === review._id);
          if (target) {
            target.likesCount = data.likesCount;
            target.dislikesCount = data.dislikesCount;
            target.netScore = data.likesCount - data.dislikesCount;
            target.hasLiked = data.hasLiked;
            target.hasDisliked = data.hasDisliked;
          }
        }
      } catch (err) {
        console.error('Like error:', err);
      }
    });

    // Dislike Button Event Listener
    dislikeBtn.addEventListener('click', async () => {
      if (!currentAuthUser) {
        alert('Please sign in to dislike this review.');
        return;
      }

      try {
        const res = await fetch(`/api/reviews/${review._id}/dislike`, {
          method: 'POST',
          credentials: 'include'
        });
        const data = await res.json();
        if (res.ok && data.success) {
          dislikeBtn.classList.toggle('active', data.hasDisliked);
          dislikeBtn.querySelector('.dislike-count').textContent = data.dislikesCount;
          likeBtn.classList.toggle('active', data.hasLiked);
          likeBtn.querySelector('.like-count').textContent = data.likesCount;

          // Sync state in allReviews
          const target = allReviews.find(r => r._id === review._id);
          if (target) {
            target.likesCount = data.likesCount;
            target.dislikesCount = data.dislikesCount;
            target.netScore = data.likesCount - data.dislikesCount;
            target.hasLiked = data.hasLiked;
            target.hasDisliked = data.hasDisliked;
          }
        }
      } catch (err) {
        console.error('Dislike error:', err);
      }
    });

    reviewsFeed.appendChild(card);
  });
}

// 8. Render Inline Review Form for Authenticated Users
function renderWriteReviewBox() {
  if (!writeReviewContainer) return;

  if (currentAuthUser) {
    if (currentProductData?.hasUserReviewed) {
      writeReviewContainer.innerHTML = `
        <div class="review-item-card" style="background: #f0fdf4; border: 1px solid #86efac; padding: 1.75rem; text-align: center; border-radius: var(--radius-md);">
          <div style="font-size: 2rem; margin-bottom: 0.35rem;">✅</div>
          <h3 style="color: #166534; font-size: 1.2rem; margin-bottom: 0.5rem; font-weight: 700;">You Have Already Reviewed This Gadget</h3>
          <p style="color: #15803d; font-size: 0.95rem; margin-bottom: 1.25rem; max-width: 520px; margin-left: auto; margin-right: auto; line-height: 1.5;">
            You have already posted a review for this product. You can edit your existing submission from your profile.
          </p>
          <a href="profile.html#reviews" class="btn btn-primary" style="font-weight: 600; padding: 0.6rem 1.25rem;">
            ✏️ Edit Your Review in Profile &rarr;
          </a>
        </div>
      `;
      return;
    }

    writeReviewContainer.innerHTML = `
      <div class="review-item-card" style="border: 1px solid var(--border-focus); background: #fafbfc;">
        <h3 style="font-size: 1.15rem; margin-bottom: 0.5rem;">Write an Unbiased Review</h3>
        <p style="color: #64748b; font-size: 0.875rem; margin-bottom: 1.25rem;">
          Sharing your real-world hands-on usage as <strong>${escapeHtml(currentAuthUser.name)}</strong>.
        </p>

        <div id="review-alert" class="alert hidden"></div>

        <form id="submit-review-form">
          <div class="form-group">
            <label for="review-rating-select">Your Rating</label>
            <select id="review-rating-select" required style="max-width: 280px;">
              <option value="5">★★★★★ (5 Stars - Exceptional)</option>
              <option value="4">★★★★☆ (4 Stars - Recommended)</option>
              <option value="3">★★★☆☆ (3 Stars - Average / Mixed)</option>
              <option value="2">★★☆☆☆ (2 Stars - Disappointing)</option>
              <option value="1">★☆☆☆☆ (1 Star - Avoid)</option>
            </select>
          </div>

          <div class="form-group">
            <label for="review-heading-input">Review Heading</label>
            <input type="text" id="review-heading-input" placeholder="e.g. Great display and battery life" style="width: 100%;">
          </div>

          <div class="form-group">
            <label for="review-comment-text">Detailed Review</label>
            <textarea id="review-comment-text" rows="4" required placeholder="What are the pros and cons? How is real-world performance, build quality, and battery life?"></textarea>
          </div>

          <div style="display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap;">
            <button type="submit" class="btn btn-primary">
              Publish Community Review
            </button>
            <a href="write-review.html?product=${encodeURIComponent(currentProductData?.name || '')}&category=${encodeURIComponent(currentProductData?.category || '')}&price=${encodeURIComponent(currentProductData?.price || 0)}" class="btn btn-outline">
              📸 Upload Photos & Full Review &rarr;
            </a>
          </div>
        </form>
      </div>
    `;

    document.getElementById('submit-review-form').addEventListener('submit', handleReviewSubmit);
  } else {
    writeReviewContainer.innerHTML = `
      <div class="review-item-card" style="background: var(--bg-alt); text-align: center; padding: 2rem;">
        <h3 style="font-size: 1.1rem; margin-bottom: 0.35rem;">Own this gadget?</h3>
        <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.25rem;">
          Sign in to contribute your hands-on impressions and help potential buyers.
        </p>
        <a href="login.html?redirect=product.html?id=${currentProductId}" class="btn btn-primary btn-sm">
          Sign In to Write a Review
        </a>
      </div>
    `;
  }
}

async function handleReviewSubmit(e) {
  e.preventDefault();
  const rating = Number(document.getElementById('review-rating-select').value);
  const heading = document.getElementById('review-heading-input')?.value.trim() || '';
  const comment = document.getElementById('review-comment-text').value.trim();
  const alertEl = document.getElementById('review-alert');

  try {
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        productId: currentProductId,
        rating,
        heading,
        comment
      })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      alertEl.className = 'alert alert-success';
      alertEl.textContent = 'Review published successfully! Refreshing...';
      alertEl.classList.remove('hidden');

      setTimeout(() => {
        loadProductDetails();
      }, 800);
    } else {
      const errMsg = data.error || data.message || 'Failed to submit review.';
      alertEl.className = 'alert alert-danger';
      alertEl.textContent = errMsg;
      alertEl.classList.remove('hidden');

      if (errMsg.includes('already posted a review')) {
        currentProductData.hasUserReviewed = true;
        setTimeout(() => {
          renderWriteReviewBox();
        }, 2200);
      }
    }
  } catch (err) {
    alertEl.className = 'alert alert-danger';
    alertEl.textContent = 'Network error submitting review.';
    alertEl.classList.remove('hidden');
  }
}

function renderStars(rating) {
  const rounded = Math.round(rating || 0);
  return '★'.repeat(rounded) + '☆'.repeat(5 - rounded);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  await loadProductDetails();

  if (navbarSearch) {
    navbarSearch.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && e.target.value.trim() !== '') {
        window.location.href = `index.html?search=${encodeURIComponent(e.target.value.trim())}`;
      }
    });
  }
});
