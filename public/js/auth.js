/**
 * HonneReviews - Authentication Forms Handler (Consumer & Admin)
 */

document.addEventListener('DOMContentLoaded', () => {
  const alertBox = document.getElementById('alert-box');
  const urlParams = new URLSearchParams(window.location.search);
  const redirectTarget = urlParams.get('redirect') || 'index.html';

  function showAlert(msg, type = 'danger') {
    if (!alertBox) return;
    alertBox.className = `alert alert-${type}`;
    alertBox.textContent = msg;
    alertBox.classList.remove('hidden');
  }

  // 1. Consumer Login Form
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, password })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          showAlert('Signed in successfully! Redirecting...', 'success');
          setTimeout(() => {
            window.location.href = redirectTarget;
          }, 600);
        } else {
          showAlert(data.message || 'Invalid email or password.');
        }
      } catch (err) {
        showAlert('Network error while signing in. Please check server.');
      }
    });
  }

  // 2. Consumer Register Form
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('name').value.trim();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name, email, password, role: 'user' })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          showAlert('Account created successfully! Welcome to HonneReviews.', 'success');
          setTimeout(() => {
            window.location.href = redirectTarget;
          }, 800);
        } else {
          showAlert(data.message || 'Registration failed.');
        }
      } catch (err) {
        showAlert('Network error during registration.');
      }
    });
  }

  // 3. Dedicated Admin Portal Login Form
  const adminLoginForm = document.getElementById('admin-login-form');
  if (adminLoginForm) {
    adminLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('admin-email').value.trim();
      const password = document.getElementById('admin-password').value;

      try {
        const res = await fetch('/api/auth/admin-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, password })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          showAlert('Admin credentials verified. Opening Moderation Desk...', 'success');
          setTimeout(() => {
            window.location.href = 'admin.html';
          }, 600);
        } else {
          showAlert(data.message || 'Access denied: Invalid administrator credentials.');
        }
      } catch (err) {
        showAlert('Network error during admin authentication.');
      }
    });
  }
});
