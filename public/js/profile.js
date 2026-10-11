/**
 * HonneReviews - User Self-Profile & Review Management Logic
 */

let currentUser = null;
let userReviews = [];

const navAuthContainer = document.getElementById('nav-auth-container');
const pageAlert = document.getElementById('page-alert');

const profileAvatar = document.getElementById('profile-avatar');
const avatarFileInput = document.getElementById('avatar-file-input');
const profileDisplayName = document.getElementById('profile-display-name');
const profileDisplayEmail = document.getElementById('profile-display-email');
const profileDisplayRole = document.getElementById('profile-display-role');

const statLikesCount = document.getElementById('stat-likes-count');
const statDislikesCount = document.getElementById('stat-dislikes-count');
const statReviewsCount = document.getElementById('stat-reviews-count');

const usernameInput = document.getElementById('username-input');
const emailInput = document.getElementById('email-input');
const bioInput = document.getElementById('bio-input');
const profileForm = document.getElementById('profile-form');
const saveBioBtn = document.getElementById('save-bio-btn');

const myReviewsContainer = document.getElementById('my-reviews-container');

// Edit Review Modal Elements
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

function showPageAlert(msg, type = 'success') {
  if (!pageAlert) return;
  pageAlert.className = `alert alert-${type}`;
  pageAlert.textContent = msg;
  pageAlert.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => {
    pageAlert.classList.add('hidden');
  }, 4000);
}

// 1. Load User Session and Profile Data
async function loadUserProfile() {
  try {
    const res = await fetch('/api/users/profile', { credentials: 'include' });
    const data = await res.json();

    if (!res.ok || !data.success || !data.user) {
      window.location.href = 'login.html?redirect=profile.html';
      return;
    }

    currentUser = data.user;
    if (typeof renderAuthNavbar === 'function') {
      renderAuthNavbar(navAuthContainer, currentUser);
    }

    // Populate profile display
    profileDisplayName.textContent = currentUser.name;
    profileDisplayEmail.textContent = currentUser.email;
    profileAvatar.src = currentUser.avatarUrl || '/images/default-avatar.svg';
    profileAvatar.onerror = () => { profileAvatar.src = '/images/default-avatar.svg'; };

    if (currentUser.role === 'master_admin') {
      profileDisplayRole.textContent = '👑 Master Admin';
    } else if (currentUser.role === 'admin') {
      profileDisplayRole.textContent = '🛡️ Moderator';
    } else {
      profileDisplayRole.textContent = 'Verified Buyer';
    }

    // Populate reputation stats
    statLikesCount.textContent = data.stats.totalLikes || 0;
    statDislikesCount.textContent = data.stats.totalDislikes || 0;
    statReviewsCount.textContent = data.stats.reviewCount || 0;

    // Populate form fields
    usernameInput.value = currentUser.name;
    emailInput.value = currentUser.email;
    bioInput.value = currentUser.bio || '';

    // Load user reviews
    await loadMyReviews();
  } catch (err) {
    console.error('Error loading profile:', err);
    window.location.href = 'login.html?redirect=profile.html';
  }
}

// 2. Handle Avatar Picture Upload
avatarFileInput?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    alert('Please select an image file (PNG, JPG, WEBP).');
    return;
  }

  const formData = new FormData();
  formData.append('avatar', file);

  try {
    showPageAlert('Uploading new profile avatar...', 'primary');
    const res = await fetch('/api/users/avatar', {
      method: 'POST',
      credentials: 'include',
      body: formData
    });

    const data = await res.json();
    if (res.ok && data.success) {
      profileAvatar.src = data.avatarUrl;
      currentUser.avatarUrl = data.avatarUrl;
      if (typeof renderAuthNavbar === 'function') {
        renderAuthNavbar(navAuthContainer, currentUser);
      }
      showPageAlert('Profile avatar updated successfully!', 'success');
    } else {
      showPageAlert(data.message || 'Failed to upload avatar.', 'danger');
    }
  } catch (err) {
    showPageAlert('Network error uploading avatar.', 'danger');
  }
});

// 3. Handle Bio Description Update
profileForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  saveBioBtn.disabled = true;
  saveBioBtn.textContent = 'Saving...';

  const updatedBio = bioInput.value.trim();

  try {
    const res = await fetch('/api/users/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ bio: updatedBio })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      currentUser.bio = updatedBio;
      showPageAlert('Bio description saved successfully!', 'success');
    } else {
      showPageAlert(data.message || 'Failed to update bio.', 'danger');
    }
  } catch (err) {
    showPageAlert('Network error saving bio.', 'danger');
  } finally {
    saveBioBtn.disabled = false;
    saveBioBtn.textContent = 'Save Bio Description';
  }
});

// 4. Load & Render My Authored Reviews
async function loadMyReviews() {
  if (!myReviewsContainer) return;
  myReviewsContainer.innerHTML = `
    <div style="text-align: center; padding: 2.5rem; color: #94a3b8;">
      Loading your reviews...
    </div>
  `;

  try {
    const res = await fetch('/api/users/my-reviews', { credentials: 'include' });
    const data = await res.json();

    if (!res.ok || !data.success || !data.data || data.data.length === 0) {
      myReviewsContainer.innerHTML = `
        <div style="text-align: center; padding: 3.5rem 1rem; color: #64748b; background: #f8fafc; border-radius: var(--radius-md); border: 1px dashed var(--border);">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">✍️</div>
          <h3 style="font-size: 1.15rem; color: var(--text-primary); margin-bottom: 0.35rem;">No Reviews Authored Yet</h3>
          <p style="color: var(--text-muted); font-size: 0.875rem; margin-bottom: 1.25rem;">
            Share your hands-on feedback on smartphones, audio, laptops, and wearables.
          </p>
          <a href="write-review.html" class="btn btn-primary btn-sm">+ Write Your First Review</a>
        </div>
      `;
      statReviewsCount.textContent = '0';
      return;
    }

    userReviews = data.data;
    statReviewsCount.textContent = userReviews.length;

    // Recalculate live likes/dislikes
    const totalLikes = userReviews.reduce((sum, r) => sum + (r.likesCount || 0), 0);
    const totalDislikes = userReviews.reduce((sum, r) => sum + (r.dislikesCount || 0), 0);
    statLikesCount.textContent = totalLikes;
    statDislikesCount.textContent = totalDislikes;

    myReviewsContainer.innerHTML = '';
    userReviews.forEach(rev => {
      myReviewsContainer.appendChild(createReviewCard(rev));
    });
  } catch (err) {
    myReviewsContainer.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: #ef4444;">
        Unable to load reviews. Please refresh.
      </div>
    `;
  }
}

function createReviewCard(review) {
  const card = document.createElement('div');
  card.className = 'review-item-card';
  card.id = `review-item-${review._id}`;
  card.style.marginBottom = '1.25rem';

  const product = review.product || {};
  const productName = escapeHtml(product.name || 'View Product');
  const formattedDate = new Date(review.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  // Determine thumbnail in order of priority: product image -> product.images[0] -> review.images[0]
  const thumbnailCandidate = review.product?.image || (review.product?.images && review.product.images[0]) || review.product?.imageUrl || (review.images && review.images[0]) || null;
  const thumbnail = (thumbnailCandidate && thumbnailCandidate !== '/images/default-gadget.svg' && String(thumbnailCandidate).trim() !== '') ? thumbnailCandidate : null;

  const badgeContent = thumbnail
    ? `<img src="${thumbnail}" alt="${productName}" class="product-badge-thumb" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;" onerror="this.onerror=null; this.parentElement.innerHTML='<span class=\\'fallback-icon\\'>💻</span>';">`
    : `<span class="fallback-icon">💻</span>`;

  // Images gallery
  let photosHtml = '';
  if (review.images && review.images.length > 0) {
    photosHtml = `
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.75rem;">
        ${review.images.map(img => `
          <a href="${img}" target="_blank" title="View image">
            <img src="${img}" alt="Review photo" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border);">
          </a>
        `).join('')}
      </div>
    `;
  }

  card.innerHTML = `
    <!-- Product Header Link -->
    <div class="review-product-header">
      <div class="product-badge-container">
        ${badgeContent}
      </div>
      <div style="flex: 1; min-width: 0;">
        <div style="font-size: 0.75rem; color: var(--primary); font-weight: 700; text-transform: uppercase;">${escapeHtml(product.category || 'Gadget')}</div>
        <a href="product.html?id=${product._id}" style="font-weight: 700; color: var(--text-primary); font-size: 1rem; text-decoration: none;" onmouseover="this.style.color='var(--primary)'" onmouseout="this.style.color='var(--text-primary)'">
          ${productName}
        </a>
      </div>
      <div class="review-action-btns">
        <button type="button" class="btn btn-outline btn-sm btn-edit" data-id="${review._id}">
          ✏️ Edit
        </button>
        <button type="button" class="btn btn-outline btn-sm btn-delete" data-id="${review._id}" style="border-color: #fca5a5; color: #ef4444;">
          🗑️ Delete
        </button>
      </div>
    </div>

    <!-- Review Rating & Date -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
      <div class="stars" style="font-size: 1.05rem;">
        ${renderStars(review.rating)}
      </div>
      <div style="font-size: 0.8rem; color: var(--text-muted);">
        Posted on ${formattedDate}
      </div>
    </div>

    <!-- Review Content -->
    ${review.heading ? `<h4 style="font-size: 1rem; font-weight: 700; margin-bottom: 0.35rem;">${escapeHtml(review.heading)}</h4>` : ''}
    <div style="color: var(--text-secondary); line-height: 1.6; font-size: 0.95rem;">
      ${escapeHtml(review.comment)}
    </div>

    ${photosHtml}

    <!-- Community Feedback Badges -->
    <div style="display: flex; gap: 1rem; align-items: center; margin-top: 1rem; font-size: 0.85rem; color: var(--text-muted); border-top: 1px solid var(--border); padding-top: 0.75rem;">
      <span>👍 <strong>${review.likesCount || 0}</strong> Likes</span>
      <span>👎 <strong>${review.dislikesCount || 0}</strong> Dislikes</span>
      <span style="margin-left: auto; font-weight: 600; color: ${(review.netScore || 0) >= 0 ? '#10b981' : '#ef4444'};">
        Net Score: ${(review.netScore || 0) > 0 ? '+' : ''}${review.netScore || 0}
      </span>
    </div>
  `;

  // Attach Edit Listener
  card.querySelector('.btn-edit').addEventListener('click', () => {
    openEditModal(review);
  });

  // Attach Delete Listener
  card.querySelector('.btn-delete').addEventListener('click', async () => {
    const confirmDelete = confirm(`Are you sure you want to permanently delete your review for "${product.name || 'this product'}"?`);
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/reviews/${review._id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showPageAlert('Review deleted successfully.', 'success');
        card.remove();
        // Reload list to sync reputation stats
        await loadMyReviews();
      } else {
        alert(data.message || 'Failed to delete review.');
      }
    } catch (err) {
      alert('Network error deleting review.');
    }
  });

  return card;
}

// 5. Inline Edit Review Modal & Image Management
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

  // Initialize images
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

    // Append remaining existing images
    editKeptImages.forEach((img) => {
      formData.append('existingImages', img);
    });

    // Append newly added image files via multer
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
      showPageAlert('Review updated successfully!', 'success');
      await loadMyReviews();
    } else {
      editModalAlert.className = 'alert alert-danger';
      editModalAlert.textContent = data.message || 'Failed to update review.';
      editModalAlert.classList.remove('hidden');
    }
  } catch (err) {
    editModalAlert.className = 'alert alert-danger';
    editModalAlert.textContent = 'Network error saving changes.';
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
  await loadUserProfile();

  // Check if URL has #reviews hash to scroll to reviews
  if (window.location.hash === '#reviews') {
    setTimeout(() => {
      myReviewsContainer?.scrollIntoView({ behavior: 'smooth' });
    }, 600);
  }
});
