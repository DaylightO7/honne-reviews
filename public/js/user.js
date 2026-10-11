/**
 * HonneReviews - Public User Profile & Review Feed Logic (user.html?id=...)
 */

let currentAuthUser = null;
let profileUserId = null;
let isProfileOwner = false;
let authorReviews = [];

const navAuthContainer = document.getElementById('nav-auth-container');
const bcAuthorName = document.getElementById('bc-author-name');
const authorAvatar = document.getElementById('author-avatar');
const authorName = document.getElementById('author-name');
const authorMetaSub = document.getElementById('author-meta-sub');
const authorBioText = document.getElementById('author-bio-text');
const authorOwnerBadge = document.getElementById('author-owner-badge');

const authorLikes = document.getElementById('author-likes');
const authorDislikes = document.getElementById('author-dislikes');
const authorReviewsCount = document.getElementById('author-reviews-count');
const authorFeedTitle = document.getElementById('author-feed-title');
const authorReviewsFeed = document.getElementById('author-reviews-feed');

// Edit Modal Elements (for profile owner)
const editReviewModal = document.getElementById('edit-review-modal');
const editReviewForm = document.getElementById('edit-review-form');
const editReviewId = document.getElementById('edit-review-id');
const editRatingSelect = document.getElementById('edit-rating-select');
const editHeadingInput = document.getElementById('edit-heading-input');
const editCommentTextarea = document.getElementById('edit-comment-textarea');
const editModalAlert = document.getElementById('edit-modal-alert');
const closeEditModal = document.getElementById('close-edit-modal');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const saveEditBtn = document.getElementById('save-edit-btn');
const pageAlert = document.getElementById('author-page-alert');

function showAlert(msg, type = 'success') {
  if (!pageAlert) return;
  pageAlert.className = `alert alert-${type}`;
  pageAlert.textContent = msg;
  pageAlert.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => {
    pageAlert.classList.add('hidden');
  }, 4000);
}

// 1. Verify Viewer Session
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
  if (typeof renderAuthNavbar === 'function') {
    renderAuthNavbar(navAuthContainer, currentAuthUser);
  }
}

// 2. Load Public Profile
async function loadPublicProfile() {
  const urlParams = new URLSearchParams(window.location.search);
  profileUserId = urlParams.get('id');

  if (!profileUserId) {
    window.location.href = 'index.html';
    return;
  }

  try {
    const res = await fetch(`/api/users/${profileUserId}`, { credentials: 'include' });
    const data = await res.json();

    if (!res.ok || !data.success || !data.user) {
      document.querySelector('main').innerHTML = `
        <div style="text-align: center; padding: 4rem 1rem;">
          <h2>Author Profile Not Found</h2>
          <p style="color: #64748b; margin: 1rem 0;">The requested reviewer profile could not be located.</p>
          <a href="index.html" class="btn btn-primary">Return to Catalog</a>
        </div>
      `;
      return;
    }

    const u = data.user;
    isProfileOwner = Boolean(data.isOwner);
    authorReviews = data.reviews || [];

    document.title = `${u.name} — Reviewer Profile | HonneReviews`;
    bcAuthorName.textContent = u.name;
    authorName.textContent = u.name;
    authorAvatar.src = u.avatarUrl || '/images/default-avatar.svg';
    authorAvatar.onerror = () => { authorAvatar.src = '/images/default-avatar.svg'; };

    const joinedDate = new Date(u.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short'
    });
    authorMetaSub.textContent = `Active Reviewer • Member since ${joinedDate}`;

    if (u.bio && u.bio.trim() !== '') {
      authorBioText.textContent = u.bio;
    } else {
      authorBioText.innerHTML = '<em>This reviewer has not added a bio yet.</em>';
    }

    // Owner controls
    if (isProfileOwner) {
      authorOwnerBadge.classList.remove('hidden');
    } else {
      authorOwnerBadge.classList.add('hidden');
    }

    // Reputation Stats
    authorLikes.textContent = data.stats.totalLikes || 0;
    authorDislikes.textContent = data.stats.totalDislikes || 0;
    authorReviewsCount.textContent = data.stats.reviewCount || 0;

    authorFeedTitle.textContent = `Published Reviews (${authorReviews.length})`;

    renderReviewsList(authorReviews);
  } catch (err) {
    console.error('Error loading public author:', err);
  }
}

// 3. Render Public Reviews
function renderReviewsList(reviews) {
  if (!authorReviewsFeed) return;

  if (reviews.length === 0) {
    authorReviewsFeed.innerHTML = `
      <div style="text-align: center; padding: 3rem 1rem; color: #94a3b8; background: #ffffff; border-radius: var(--radius-md); border: 1px solid var(--border);">
        <p style="font-size: 1.1rem; font-weight: 600; color: #475569;">No published reviews yet</p>
        <p style="font-size: 0.875rem; margin-top: 0.25rem;">This author has not published any public reviews yet.</p>
      </div>
    `;
    return;
  }

  authorReviewsFeed.innerHTML = '';
  reviews.forEach(review => {
    const card = document.createElement('div');
    card.className = 'review-item-card';
    card.id = `author-review-${review._id}`;
    card.style.marginBottom = '1.25rem';

    const product = review.product || {};
    const dateFormatted = new Date(review.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    let photosHtml = '';
    if (review.images && review.images.length > 0) {
      photosHtml = `
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.75rem;">
          ${review.images.map(img => `
            <a href="${img}" target="_blank" title="View full photo">
              <img src="${img}" alt="Review photo" style="width: 64px; height: 64px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border);">
            </a>
          `).join('')}
        </div>
      `;
    }

    // Action buttons only visible if logged-in viewer owns this profile
    const actionButtonsHtml = isProfileOwner ? `
      <div style="display: flex; gap: 0.5rem; margin-left: auto;">
        <button type="button" class="btn btn-outline btn-sm btn-edit" data-id="${review._id}">✏️ Edit</button>
        <button type="button" class="btn btn-outline btn-sm btn-delete" data-id="${review._id}" style="border-color: #fca5a5; color: #ef4444;">🗑️ Delete</button>
      </div>
    ` : '';

    card.innerHTML = `
      <!-- Product Header -->
      <div class="author-product-card">
        <img src="${product.imageUrl || '/images/default-gadget.svg'}" alt="${escapeHtml(product.name)}" class="author-product-thumb" onerror="this.src='/images/default-gadget.svg'">
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: 0.75rem; color: var(--primary); font-weight: 700; text-transform: uppercase;">
            ${escapeHtml(product.category || 'Gadget')}
          </div>
          <a href="product.html?id=${product._id}" style="font-weight: 700; color: var(--text-primary); font-size: 1.05rem; text-decoration: none;" onmouseover="this.style.color='var(--primary)'" onmouseout="this.style.color='var(--text-primary)'">
            ${escapeHtml(product.name || 'View Product')}
          </a>
        </div>
        ${actionButtonsHtml}
      </div>

      <!-- Rating & Date -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
        <div class="stars" style="font-size: 1.1rem;">
          ${renderStars(review.rating)}
        </div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">
          Reviewed on ${dateFormatted}
        </div>
      </div>

      <!-- Review Body -->
      ${review.heading ? `<h4 style="font-size: 1.05rem; font-weight: 700; margin-bottom: 0.35rem;">${escapeHtml(review.heading)}</h4>` : ''}
      <div style="color: var(--text-secondary); line-height: 1.6;">${escapeHtml(review.comment)}</div>
      ${photosHtml}

      <!-- Likes & Dislikes -->
      <div style="display: flex; gap: 1rem; align-items: center; margin-top: 1rem; font-size: 0.85rem; color: var(--text-muted); border-top: 1px solid var(--border); padding-top: 0.75rem;">
        <span>👍 <strong>${review.likesCount || 0}</strong> Likes</span>
        <span>👎 <strong>${review.dislikesCount || 0}</strong> Dislikes</span>
        <span style="margin-left: auto; font-weight: 600; color: ${(review.netScore || 0) >= 0 ? '#10b981' : '#ef4444'};">
          Net Score: ${(review.netScore || 0) > 0 ? '+' : ''}${review.netScore || 0}
        </span>
      </div>
    `;

    // Attach owner-only edit/delete listeners
    if (isProfileOwner) {
      card.querySelector('.btn-edit')?.addEventListener('click', () => {
        openEditModal(review);
      });

      card.querySelector('.btn-delete')?.addEventListener('click', async () => {
        const confirmDelete = confirm(`Are you sure you want to permanently delete your review for "${product.name || 'this product'}"?`);
        if (!confirmDelete) return;

        try {
          const res = await fetch(`/api/reviews/${review._id}`, {
            method: 'DELETE',
            credentials: 'include'
          });
          const data = await res.json();
          if (res.ok && data.success) {
            showAlert('Review deleted successfully.', 'success');
            await loadPublicProfile();
          } else {
            alert(data.message || 'Failed to delete review.');
          }
        } catch (err) {
          alert('Network error deleting review.');
        }
      });
    }

    authorReviewsFeed.appendChild(card);
  });
}

// 4. Modal Edit Handlers & Image Management (Profile Owner)
const editImagesPreviewGrid = document.getElementById('edit-images-preview-grid');
const editImagesCounter = document.getElementById('edit-images-counter');
const editImagesInput = document.getElementById('edit-images-input');
const editAddPhotosBtn = document.getElementById('edit-add-photos-btn');

let editKeptImages = [];
let editNewFiles = [];

function renderEditImagePreviews() {
  if (!editImagesPreviewGrid) return;
  editImagesPreviewGrid.innerHTML = '';

  const totalCount = editKeptImages.length + editNewFiles.length;
  if (editImagesCounter) {
    editImagesCounter.textContent = `${totalCount} / 8`;
  }

  // Render existing review images
  editKeptImages.forEach((src, idx) => {
    const box = document.createElement('div');
    box.className = 'preview-thumb-box';

    const img = document.createElement('img');
    img.src = src;
    img.alt = `Existing Photo ${idx + 1}`;

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'preview-remove-btn';
    delBtn.title = 'Remove photo';
    delBtn.innerHTML = '&times;';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      editKeptImages.splice(idx, 1);
      renderEditImagePreviews();
    });

    box.appendChild(img);
    box.appendChild(delBtn);
    editImagesPreviewGrid.appendChild(box);
  });

  // Render newly selected files
  editNewFiles.forEach((file, idx) => {
    const box = document.createElement('div');
    box.className = 'preview-thumb-box';

    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.alt = `New Photo ${idx + 1}`;

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'preview-remove-btn';
    delBtn.title = 'Remove photo';
    delBtn.innerHTML = '&times;';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      try { URL.revokeObjectURL(img.src); } catch (err) {}
      editNewFiles.splice(idx, 1);
      renderEditImagePreviews();
    });

    box.appendChild(img);
    box.appendChild(delBtn);
    editImagesPreviewGrid.appendChild(box);
  });

  if (editAddPhotosBtn) {
    if (totalCount >= 8) {
      editAddPhotosBtn.style.opacity = '0.5';
      editAddPhotosBtn.style.pointerEvents = 'none';
    } else {
      editAddPhotosBtn.style.opacity = '1';
      editAddPhotosBtn.style.pointerEvents = 'auto';
    }
  }
}

editImagesInput?.addEventListener('change', (e) => {
  const files = Array.from(e.target.files || []);
  const availableSlots = 8 - (editKeptImages.length + editNewFiles.length);

  if (availableSlots <= 0) {
    alert('Maximum 8 photos limit reached.');
    e.target.value = '';
    return;
  }

  const toAdd = files.slice(0, availableSlots);
  if (files.length > availableSlots) {
    alert(`Only ${availableSlots} more photo(s) can be added (max 8 allowed).`);
  }

  editNewFiles.push(...toAdd);
  e.target.value = '';
  renderEditImagePreviews();
});

function openEditModal(review) {
  editReviewId.value = review._id;
  editRatingSelect.value = String(review.rating);
  editHeadingInput.value = review.heading || '';
  editCommentTextarea.value = review.comment || '';

  editKeptImages = Array.isArray(review.images) ? [...review.images] : [];
  editNewFiles = [];
  if (editImagesInput) editImagesInput.value = '';
  renderEditImagePreviews();

  editModalAlert.classList.add('hidden');
  document.body.classList.add('modal-open');
  editReviewModal.classList.remove('hidden');
}

function closeEditModalFn() {
  editReviewModal.classList.add('hidden');
  document.body.classList.remove('modal-open');
}

closeEditModal?.addEventListener('click', closeEditModalFn);
cancelEditBtn?.addEventListener('click', closeEditModalFn);
editReviewModal?.addEventListener('click', (e) => {
  if (e.target === editReviewModal) closeEditModalFn();
});

editReviewForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = editReviewId.value;
  const rating = Number(editRatingSelect.value);
  const heading = editHeadingInput.value.trim();
  const comment = editCommentTextarea.value.trim();

  saveEditBtn.disabled = true;
  saveEditBtn.textContent = 'Saving...';

  try {
    const formData = new FormData();
    formData.append('rating', rating);
    formData.append('heading', heading);
    formData.append('comment', comment);

    editKeptImages.forEach((img) => {
      formData.append('existingImages', img);
    });

    editNewFiles.forEach((file) => {
      formData.append('images', file);
    });

    const res = await fetch(`/api/reviews/${id}`, {
      method: 'PUT',
      credentials: 'include',
      body: formData
    });

    const data = await res.json();
    if (res.ok && data.success) {
      closeEditModalFn();
      showAlert('Review updated successfully!', 'success');
      await loadPublicProfile();
    } else {
      editModalAlert.className = 'alert alert-danger';
      editModalAlert.textContent = data.message || 'Failed to update review.';
      editModalAlert.classList.remove('hidden');
    }
  } catch (err) {
    editModalAlert.className = 'alert alert-danger';
    editModalAlert.textContent = 'Network error saving review.';
    editModalAlert.classList.remove('hidden');
  } finally {
    saveEditBtn.disabled = false;
    saveEditBtn.textContent = 'Save Changes';
  }
});

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
  await loadPublicProfile();
});
