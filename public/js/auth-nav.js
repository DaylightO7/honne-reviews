/**
 * HonneReviews - Shared Navbar Authentication & Google-style Profile Dropdown
 */

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderAuthNavbar(container, user) {
  if (!container) return;

  if (user) {
    const isAdmin = user.role === 'admin' || user.role === 'master_admin';
    const avatar = user.avatarUrl || '/images/default-avatar.svg';

    container.innerHTML = `
      <div style="display:flex; align-items:center; gap: 0.75rem;">
        <a href="write-review.html" class="btn btn-primary btn-sm" style="font-weight: 700;">+ Write Review</a>
        ${isAdmin ? `<a href="admin.html" class="btn btn-outline btn-sm" style="border-color: #ef4444; color: #ef4444;">🛡️ Admin Desk</a>` : ''}

        <!-- Google-Style Profile Dropdown Trigger -->
        <div class="nav-profile-wrapper">
          <button type="button" class="btn-profile-trigger" id="profile-dropdown-btn" aria-haspopup="true" aria-expanded="false">
            <img src="${avatar}" alt="Avatar" class="nav-avatar-mini" onerror="this.onerror=null; this.src='/images/default-avatar.svg';">
            <span>${escapeHtml(user.name)}</span>
            <span class="dropdown-arrow">▾</span>
          </button>

          <!-- Floating Dropdown Card -->
          <div class="profile-dropdown-card hidden" id="profile-dropdown-menu">
            <div class="dropdown-account-header">
              <img src="${avatar}" alt="Avatar" class="dropdown-account-avatar" onerror="this.onerror=null; this.src='/images/default-avatar.svg';">
              <div style="overflow: hidden;">
                <div class="dropdown-account-name">${escapeHtml(user.name)}</div>
                <div class="dropdown-account-email">${escapeHtml(user.email)}</div>
              </div>
            </div>

            <div class="dropdown-menu-list">
              <a href="profile.html" class="dropdown-menu-item">
                <span style="font-size: 1.1rem;">👤</span>
                <span>My Profile</span>
              </a>
              <a href="profile.html#reviews" class="dropdown-menu-item">
                <span style="font-size: 1.1rem;">📝</span>
                <span>My Reviews</span>
              </a>
              ${isAdmin ? `
              <a href="admin.html" class="dropdown-menu-item" style="color: #ef4444;">
                <span style="font-size: 1.1rem;">🛡️</span>
                <span>Admin Portal</span>
              </a>` : ''}
              <button type="button" class="dropdown-menu-item logout-item" id="dropdown-logout-btn">
                <span style="font-size: 1.1rem;">🚪</span>
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Dropdown toggle listener
    const trigger = document.getElementById('profile-dropdown-btn');
    const menu = document.getElementById('profile-dropdown-menu');
    const logoutBtn = document.getElementById('dropdown-logout-btn');

    trigger?.addEventListener('click', (e) => {
      e.stopPropagation();
      menu?.classList.toggle('hidden');
    });

    logoutBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      } catch (err) {}
      window.location.href = 'index.html';
    });

    document.addEventListener('click', (e) => {
      if (menu && !menu.contains(e.target) && !trigger?.contains(e.target)) {
        menu.classList.add('hidden');
      }
    });
  } else {
    container.innerHTML = `
      <a href="login.html" class="btn btn-outline btn-sm">Sign In</a>
      <a href="register.html" class="btn btn-primary btn-sm">Sign Up</a>
    `;
  }
}
