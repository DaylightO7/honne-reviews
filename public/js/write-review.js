/**
 * HonneReviews - Write Review & Multi-Image Upload (Up to 8 Images) Logic
 */

let currentUser = null;
let selectedImagesBase64 = []; // Stores up to 8 base64 strings

const navAuthContainer = document.getElementById('nav-auth-container');
const writeReviewForm = document.getElementById('write-review-form');
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const previewGrid = document.getElementById('image-preview-grid');
const alertBox = document.getElementById('alert-box');
const submitBtn = document.getElementById('submit-btn');

function showAlert(msg, type = 'danger') {
  if (!alertBox) return;
  alertBox.className = `alert alert-${type}`;
  alertBox.textContent = msg;
  alertBox.classList.remove('hidden');
  window.scrollTo({ top: 100, behavior: 'smooth' });
}

// 1. Verify User Session
async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    const data = await res.json();
    if (res.ok && data.success && data.user) {
      currentUser = data.user;
      renderNavbar();
    } else {
      window.location.href = 'login.html?redirect=write-review.html';
    }
  } catch (err) {
    window.location.href = 'login.html?redirect=write-review.html';
  }
}

function renderNavbar() {
  if (typeof renderAuthNavbar === 'function') {
    renderAuthNavbar(navAuthContainer, currentUser);
  } else if (navAuthContainer && currentUser) {
    navAuthContainer.innerHTML = `<span class="badge badge-dark">👤 ${escapeHtml(currentUser.name)}</span>`;
  }
}

let checkTimeout = null;
async function checkExistingReview(prodName) {
  if (!prodName || prodName.trim() === '') return;
  try {
    const res = await fetch(`/api/reviews/check-user-review?productName=${encodeURIComponent(prodName.trim())}`, { credentials: 'include' });
    const data = await res.json();
    if (res.ok && data.hasReviewed) {
      showAlreadyReviewedBanner();
    } else {
      hideAlreadyReviewedBanner();
    }
  } catch (err) {}
}

function showAlreadyReviewedBanner() {
  let banner = document.getElementById('already-reviewed-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'already-reviewed-banner';
    banner.style.cssText = 'background: #fef2f2; border: 1px solid #f87171; border-radius: var(--radius-md); padding: 1.25rem; margin-bottom: 1.5rem; text-align: center;';
    banner.innerHTML = `
      <div style="font-size: 1.6rem; margin-bottom: 0.25rem;">⚠️</div>
      <strong style="color: #991b1b; display: block; font-size: 1.05rem;">You Have Already Reviewed This Product</strong>
      <p style="color: #b91c1c; font-size: 0.9rem; margin-top: 0.25rem; margin-bottom: 0.85rem;">
        You have already posted a review for this product. You can edit your existing submission from your profile.
      </p>
      <a href="profile.html#reviews" class="btn btn-primary btn-sm" style="font-weight: 600;">
        ✏️ Edit Your Review in Profile &rarr;
      </a>
    `;
    writeReviewForm.parentNode.insertBefore(banner, writeReviewForm);
  }
  banner.classList.remove('hidden');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Already Reviewed — Manage in Profile';
  }
}

function hideAlreadyReviewedBanner() {
  const banner = document.getElementById('already-reviewed-banner');
  if (banner) {
    banner.classList.add('hidden');
  }
  if (submitBtn && submitBtn.textContent === 'Already Reviewed — Manage in Profile') {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Publish Community Review';
  }
}

// 2. Handle File Selection & Conversion to Base64 (Max 8 Images)
dropzone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  handleFiles(e.target.files);
});

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.style.borderColor = 'var(--primary)';
});

dropzone.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dropzone.style.borderColor = 'var(--border)';
});

dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.style.borderColor = 'var(--border)';
  if (e.dataTransfer.files) {
    handleFiles(e.dataTransfer.files);
  }
});

function handleFiles(files) {
  if (!files || files.length === 0) return;

  const remainingSlots = 8 - selectedImagesBase64.length;
  if (remainingSlots <= 0) {
    showAlert('You have reached the maximum limit of 8 images.', 'warning');
    return;
  }

  const filesToProcess = Array.from(files).slice(0, remainingSlots);

  filesToProcess.forEach(file => {
    if (!file.type.startsWith('image/')) {
      showAlert(`Skipped "${file.name}" because it is not an image.`, 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (selectedImagesBase64.length < 8) {
        selectedImagesBase64.push(event.target.result);
        renderImagePreviews();
      }
    };
    reader.readAsDataURL(file);
  });
}

function renderImagePreviews() {
  previewGrid.innerHTML = '';
  selectedImagesBase64.forEach((base64Str, idx) => {
    const box = document.createElement('div');
    box.className = 'preview-thumb-box';

    box.innerHTML = `
      <img src="${base64Str}" alt="Preview ${idx + 1}">
      <button type="button" class="preview-remove-btn" data-index="${idx}" title="Remove image">&times;</button>
      ${idx === 0 ? `<span style="position:absolute; bottom:2px; left:2px; background:rgba(0,0,0,0.7); color:#fff; font-size:9px; padding:1px 4px; border-radius:3px;">Card Thumbnail</span>` : ''}
    `;

    box.querySelector('.preview-remove-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const removeIdx = Number(e.target.dataset.index);
      selectedImagesBase64.splice(removeIdx, 1);
      renderImagePreviews();
    });

    previewGrid.appendChild(box);
  });
}

// 3. Form Submission
writeReviewForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const productName = document.getElementById('product-name').value.trim();
  const category = document.getElementById('product-category').value;
  const priceInput = document.getElementById('price');
  const price = priceInput ? Number(priceInput.value) : 0;
  const heading = document.getElementById('review-heading').value.trim();
  const rating = Number(document.getElementById('review-rating').value);
  const comment = document.getElementById('review-content').value.trim();

  if (!productName || !heading || !comment || isNaN(price) || price < 0) {
    showAlert('Please fill in all required fields and provide a valid price.', 'danger');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Publishing Review & Uploading Photos...';

  try {
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        productName,
        category,
        price,
        heading,
        comment,
        rating,
        images: selectedImagesBase64
      })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      showAlert('Review published successfully! Redirecting...', 'success');
      setTimeout(() => {
        if (data.productId) {
          window.location.href = `product.html?id=${data.productId}`;
        } else {
          window.location.href = 'index.html';
        }
      }, 1000);
    } else {
      const errMsg = data.error || data.message || 'Failed to submit review.';
      showAlert(errMsg, 'danger');
      if (errMsg.includes('already posted a review')) {
        showAlreadyReviewedBanner();
      } else {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Publish Community Review';
      }
    }
  } catch (err) {
    showAlert('Network error while publishing review.', 'danger');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Publish Community Review';
  }
});

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', () => {
  // Check if a pre-filled product name was passed in query params
  const urlParams = new URLSearchParams(window.location.search);
  const prefillName = urlParams.get('product');
  const prefillCategory = urlParams.get('category');
  const prefillPrice = urlParams.get('price');
  if (prefillName) {
    document.getElementById('product-name').value = prefillName;
    checkExistingReview(prefillName);
  }
  if (prefillCategory) {
    document.getElementById('product-category').value = prefillCategory;
  }
  if (prefillPrice && document.getElementById('price')) {
    document.getElementById('price').value = prefillPrice;
  }

  document.getElementById('product-name')?.addEventListener('input', (e) => {
    clearTimeout(checkTimeout);
    checkTimeout = setTimeout(() => {
      checkExistingReview(e.target.value);
    }, 400);
  });

  checkAuth();
});
