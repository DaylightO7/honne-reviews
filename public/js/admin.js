/**
 * HonneReviews - Admin Moderation Desk Client Logic
 * Multi-Admin Flagging Protocol (Flagged by >= 3 Admins -> Auto-removed)
 * Master Admin & Sub-Admin Provisioning System
 */

let currentAdminUser = null;
let currentView = 'all'; // Default to all submitted reviews

const adminUserDisplay = document.getElementById('admin-user-display');
const adminBadgeLabel = document.getElementById('admin-badge-label');
const adminLogoutBtn = document.getElementById('admin-logout-btn');
const adminAlert = document.getElementById('admin-alert');
const refreshModerationBtn = document.getElementById('refresh-moderation-btn');
const moderationTableBody = document.getElementById('moderation-table-body');

const masterAdminSection = document.getElementById('master-admin-section');
const createSubadminForm = document.getElementById('create-subadmin-form');

const statProducts = document.getElementById('stat-products');
const statReviews = document.getElementById('stat-reviews');
const statFlagged = document.getElementById('stat-flagged');
const statRemoved = document.getElementById('stat-removed');

const filterFlaggedBtn = document.getElementById('filter-flagged-btn');
const filterAllBtn = document.getElementById('filter-all-btn');

function showAdminAlert(msg, type = 'success') {
  if (!adminAlert) return;
  adminAlert.className = `alert alert-${type}`;
  adminAlert.textContent = msg;
  adminAlert.classList.remove('hidden');

  setTimeout(() => {
    adminAlert.classList.add('hidden');
  }, 4500);
}

// 1. Enforce Admin Session & Check for Master Admin
async function verifyAdminAuth() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    const data = await res.json();

    if (!res.ok || !data.success || !data.user || (data.user.role !== 'admin' && data.user.role !== 'master_admin')) {
      window.location.href = 'admin-login.html';
      return false;
    }

    currentAdminUser = data.user;
    const isMaster = currentAdminUser.role === 'master_admin';

    if (adminUserDisplay) {
      adminUserDisplay.textContent = `${isMaster ? '👑 Master Admin' : '🛡️ Moderator'}: ${currentAdminUser.name}`;
    }

    if (adminBadgeLabel) {
      adminBadgeLabel.textContent = isMaster ? 'Master Desk' : 'Moderator Desk';
    }

    // Only master_admin can see the Add Sub-Admin form
    if (isMaster && masterAdminSection) {
      masterAdminSection.classList.remove('hidden');
    }

    return true;
  } catch (err) {
    window.location.href = 'admin-login.html';
    return false;
  }
}

// 2. Fetch Admin Metrics
async function loadAdminStats() {
  try {
    const res = await fetch('/api/admin/stats', { credentials: 'include' });
    const data = await res.json();
    if (res.ok && data.success && data.stats) {
      statProducts.textContent = data.stats.totalProducts;
      statReviews.textContent = data.stats.totalReviews;
      statFlagged.textContent = data.stats.flaggedReviews;
      statRemoved.textContent = data.stats.removedReviews;
    }
  } catch (err) {
    console.error('Error fetching admin stats:', err);
  }
}

// 3. Load Moderation Queue (All reviews or Flagged reviews)
async function loadModerationQueue() {
  moderationTableBody.innerHTML = `
    <tr>
      <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2.5rem;">
        Fetching reviews...
      </td>
    </tr>
  `;

  try {
    const endpoint = currentView === 'all'
      ? '/api/admin/reviews/all'
      : '/api/admin/reviews/flagged';

    const res = await fetch(endpoint, { credentials: 'include' });
    const data = await res.json();

    if (!res.ok || !data.success) {
      moderationTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: #ef4444; padding: 2rem;">
            Failed to load moderation data.
          </td>
        </tr>
      `;
      return;
    }

    const reviews = data.data || [];
    if (reviews.length === 0) {
      moderationTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 3rem;">
            ${currentView === 'flagged' ? '✨ Moderation inbox zero! No reported reviews.' : 'No reviews recorded in database.'}
          </td>
        </tr>
      `;
      return;
    }

    renderModerationRows(reviews);
  } catch (err) {
    moderationTableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: #ef4444; padding: 2rem;">
          Network error fetching moderation queue.
        </td>
      </tr>
    `;
  }
}

// 4. Render Moderation Table Rows
function renderModerationRows(reviews) {
  moderationTableBody.innerHTML = '';

  reviews.forEach(review => {
    const tr = document.createElement('tr');

    const productName = review.product ? `${review.product.brand || ''} ${review.product.name}` : 'Unknown Product';
    const authorName = review.user?.name || 'Anonymous';
    const authorEmail = review.user?.email || 'N/A';
    const flagsCount = review.flaggedBy ? review.flaggedBy.length : 0;
    const isAutoRemoved = review.isRemoved || flagsCount >= 3;

    const likesCount = review.likes ? review.likes.length : 0;
    const dislikesCount = review.dislikes ? review.dislikes.length : 0;

    // Check if the current logged-in admin has already flagged this review
    const hasCurrentAdminFlagged = review.flaggedBy && review.flaggedBy.some(adminObj => {
      const adminId = adminObj._id ? adminObj._id.toString() : adminObj.toString();
      return adminId === currentAdminUser.id;
    });

    // Formatting flagging admin names
    const flaggingAdminsList = review.flaggedBy && review.flaggedBy.length > 0
      ? review.flaggedBy.map(a => a.name || 'Admin').join(', ')
      : 'None';

    // Photos preview
    let imagesThumbHtml = '';
    if (review.images && review.images.length > 0) {
      imagesThumbHtml = `
        <div style="display: flex; gap: 4px; margin-top: 6px; flex-wrap: wrap;">
          ${review.images.map(img => `
            <a href="${img}" target="_blank">
              <img src="${img}" style="width: 32px; height: 32px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border);">
            </a>
          `).join('')}
        </div>
      `;
    }

    tr.innerHTML = `
      <td>
        <strong style="color: var(--text-primary); font-size: 0.95rem;">${escapeHtml(productName)}</strong>
      </td>
      <td style="max-width: 300px;">
        <div style="font-size: 0.8rem; color: #f59e0b; margin-bottom: 0.25rem;">
          ${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}
        </div>
        ${review.heading ? `<div style="font-weight: 700; font-size: 0.85rem; color: var(--text-primary); margin-bottom: 2px;">${escapeHtml(review.heading)}</div>` : ''}
        <div style="font-size: 0.825rem; color: var(--text-secondary); line-height: 1.4;">
          "${escapeHtml(review.comment)}"
        </div>
        ${imagesThumbHtml}
      </td>
      <td>
        <div><strong>${escapeHtml(authorName)}</strong></div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(authorEmail)}</div>
      </td>
      <td>
        <span style="font-size: 0.85rem; font-weight: 600; white-space: nowrap;">
          👍 ${likesCount} &nbsp;|&nbsp; 👎 ${dislikesCount}
        </span>
      </td>
      <td>
        <div class="flag-badge ${isAutoRemoved ? 'flag-removed' : 'flag-pending'}">
          🚩 ${flagsCount} / 3 Flags
        </div>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">
          Endorsed by: <span title="${escapeHtml(flaggingAdminsList)}">${escapeHtml(flaggingAdminsList)}</span>
        </div>
      </td>
      <td>
        ${isAutoRemoved
          ? `<span class="badge badge-danger">🚫 Auto-Removed</span>`
          : `<span class="badge badge-primary">🌐 Active on Feed</span>`
        }
      </td>
      <td>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
          ${hasCurrentAdminFlagged
            ? `<span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">✓ Flagged by you</span>`
            : `<button class="btn btn-outline btn-sm action-flag-btn" data-id="${review._id}">
                 🚩 Flag Review
               </button>`
          }

          ${flagsCount > 0 || isAutoRemoved
            ? `<button class="btn btn-outline btn-sm action-dismiss-btn" data-id="${review._id}" style="color: #10b981; border-color: #a7f3d0;" title="Clear flags and restore">
                 🛡️ Dismiss
               </button>`
            : ''
          }

          <button class="btn btn-outline btn-sm action-delete-btn" data-id="${review._id}" style="color: #ef4444;" title="Delete review">
            🗑️
          </button>
        </div>
      </td>
    `;

    // Action: Flag
    tr.querySelector('.action-flag-btn')?.addEventListener('click', async () => {
      try {
        const res = await fetch(`/api/admin/reviews/${review._id}/flag`, {
          method: 'POST',
          credentials: 'include'
        });
        const d = await res.json();
        if (res.ok && d.success) {
          showAdminAlert(d.message, d.isRemoved ? 'danger' : 'info');
          loadAdminStats();
          loadModerationQueue();
        } else {
          showAdminAlert(d.message || 'Error flagging review', 'danger');
        }
      } catch (err) {
        showAdminAlert('Network error flagging review', 'danger');
      }
    });

    // Action: Dismiss Flags
    tr.querySelector('.action-dismiss-btn')?.addEventListener('click', async () => {
      try {
        const res = await fetch(`/api/admin/reviews/${review._id}/dismiss`, {
          method: 'POST',
          credentials: 'include'
        });
        const d = await res.json();
        if (res.ok && d.success) {
          showAdminAlert(d.message, 'success');
          loadAdminStats();
          loadModerationQueue();
        } else {
          showAdminAlert(d.message || 'Error dismissing flags', 'danger');
        }
      } catch (err) {
        showAdminAlert('Network error dismissing flags', 'danger');
      }
    });

    // Action: Delete
    tr.querySelector('.action-delete-btn')?.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to permanently delete this review?')) return;
      try {
        const res = await fetch(`/api/admin/reviews/${review._id}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        const d = await res.json();
        if (res.ok && d.success) {
          showAdminAlert('Review permanently deleted.', 'info');
          loadAdminStats();
          loadModerationQueue();
        } else {
          showAdminAlert(d.message || 'Error deleting review', 'danger');
        }
      } catch (err) {
        showAdminAlert('Network error deleting review', 'danger');
      }
    });

    moderationTableBody.appendChild(tr);
  });
}

// 5. Handle Sub-Admin Creation Form (Master Admin Only)
if (createSubadminForm) {
  createSubadminForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('subadmin-name').value.trim();
    const email = document.getElementById('subadmin-email').value.trim();
    const password = document.getElementById('subadmin-password').value;

    try {
      const res = await fetch('/api/admin/create-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, email, password })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showAdminAlert(data.message || 'New moderator account created successfully!', 'success');
        createSubadminForm.reset();
        loadAdminStats();
      } else {
        showAdminAlert(data.message || 'Failed to create moderator account.', 'danger');
      }
    } catch (err) {
      showAdminAlert('Network error while provisioning admin account.', 'danger');
    }
  });
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
  const isAuth = await verifyAdminAuth();
  if (!isAuth) return;

  loadAdminStats();
  loadModerationQueue();

  // Logout
  adminLogoutBtn?.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = 'admin-login.html';
  });

  // Refresh
  refreshModerationBtn?.addEventListener('click', () => {
    loadAdminStats();
    loadModerationQueue();
  });

  // Filter Tabs
  filterAllBtn?.addEventListener('click', () => {
    currentView = 'all';
    filterAllBtn.classList.add('active');
    filterFlaggedBtn.classList.remove('active');
    loadModerationQueue();
  });

  filterFlaggedBtn?.addEventListener('click', () => {
    currentView = 'flagged';
    filterFlaggedBtn.classList.add('active');
    filterAllBtn.classList.remove('active');
    loadModerationQueue();
  });
});
