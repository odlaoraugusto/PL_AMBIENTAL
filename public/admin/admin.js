(function () {
  'use strict';
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  var loginScreen = $('#login-screen');
  var app = $('#app');

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function showApp() {
    loginScreen.hidden = true;
    app.hidden = false;
    loadPosts();
  }
  function showLogin() {
    app.hidden = true;
    loginScreen.hidden = false;
  }

  fetch('/api/admin/session').then(function (r) { return r.json(); }).then(function (d) {
    if (d.authenticated) showApp(); else showLogin();
  }).catch(showLogin);

  $('#login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var password = $('#login-password').value;
    var errEl = $('#login-error');
    errEl.hidden = true;
    fetch('/api/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: password }),
    }).then(function (r) {
      if (r.ok) { showApp(); } else { errEl.hidden = false; }
    }).catch(function () { errEl.hidden = false; });
  });

  $('#logout-btn').addEventListener('click', function () {
    fetch('/api/admin/logout', { method: 'POST' }).then(showLogin);
  });

  /* ---------------- posts list ---------------- */
  var listEl = $('#posts-list');

  function renderRow(post) {
    var wrap = document.createElement('div');
    wrap.className = 'post-row' + (post.active ? '' : ' is-inactive');
    wrap.dataset.id = post.id;
    wrap.innerHTML =
      '<img class="thumb" src="' + escapeHtml(post.image) + '" alt="">' +
      '<div class="info">' +
        '<p>' + escapeHtml(post.caption) + '</p>' +
        (post.link ? '<a href="' + escapeHtml(post.link) + '" target="_blank" rel="noopener noreferrer">Ver link ↗</a>' : '') +
      '</div>' +
      '<div class="actions">' +
        '<label class="toggle-label"><input type="checkbox" class="js-active" ' + (post.active ? 'checked' : '') + '> ativo</label>' +
        '<button class="icon-btn js-up" title="Mover para cima">↑</button>' +
        '<button class="icon-btn js-down" title="Mover para baixo">↓</button>' +
        '<button class="icon-btn js-edit" title="Editar">✎</button>' +
        '<button class="icon-btn danger js-delete" title="Excluir">🗑</button>' +
      '</div>';
    return wrap;
  }

  var currentPosts = [];

  function loadPosts() {
    fetch('/api/admin/posts').then(function (r) { return r.json(); }).then(function (data) {
      currentPosts = data.posts || [];
      listEl.innerHTML = '';
      if (!currentPosts.length) {
        listEl.innerHTML = '<div class="empty-state">Nenhum post publicado ainda.</div>';
        return;
      }
      currentPosts.forEach(function (p) { listEl.appendChild(renderRow(p)); });
    });
  }

  listEl.addEventListener('change', function (e) {
    if (!e.target.classList.contains('js-active')) return;
    var row = e.target.closest('.post-row');
    var id = row.dataset.id;
    var fd = new FormData();
    fd.append('active', e.target.checked ? 'true' : 'false');
    fetch('/api/admin/posts/' + id, { method: 'PUT', body: fd }).then(loadPosts);
  });

  listEl.addEventListener('click', function (e) {
    var row = e.target.closest('.post-row');
    if (!row) return;
    var id = row.dataset.id;

    if (e.target.classList.contains('js-delete')) {
      if (!confirm('Remover este post do site?')) return;
      fetch('/api/admin/posts/' + id, { method: 'DELETE' }).then(loadPosts);
    }

    if (e.target.classList.contains('js-up') || e.target.classList.contains('js-down')) {
      var ids = currentPosts.map(function (p) { return p.id; });
      var idx = ids.indexOf(id);
      var swapWith = e.target.classList.contains('js-up') ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= ids.length) return;
      var tmp = ids[idx]; ids[idx] = ids[swapWith]; ids[swapWith] = tmp;
      fetch('/api/admin/posts/reorder', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order: ids }),
      }).then(loadPosts);
    }

    if (e.target.classList.contains('js-edit')) {
      var post = currentPosts.find(function (p) { return p.id === id; });
      if (post) openEditModal(post);
    }
  });

  /* ---------------- create post ---------------- */
  var createForm = $('#create-form');
  var createStatus = $('#create-status');
  createForm.addEventListener('submit', function (e) {
    e.preventDefault();
    createStatus.textContent = 'Publicando...';
    createStatus.className = 'form-status';
    var fd = new FormData(createForm);
    fetch('/api/admin/posts', { method: 'POST', body: fd }).then(function (r) {
      if (!r.ok) throw new Error();
      return r.json();
    }).then(function () {
      createStatus.textContent = 'Post publicado!';
      createStatus.className = 'form-status ok';
      createForm.reset();
      loadPosts();
    }).catch(function () {
      createStatus.textContent = 'Erro ao publicar. Verifique a imagem e tente novamente.';
      createStatus.className = 'form-status err';
    });
  });

  /* ---------------- edit modal ---------------- */
  var editModal = $('#edit-modal');
  var editForm = $('#edit-form');
  var editStatus = $('#edit-status');

  function openEditModal(post) {
    editForm.reset();
    editForm.id.value = post.id;
    editForm.caption.value = post.caption;
    editForm.link.value = post.link || '';
    $('#edit-preview').src = post.image;
    editStatus.textContent = '';
    editModal.hidden = false;
  }
  $('#edit-close').addEventListener('click', function () { editModal.hidden = true; });
  editModal.addEventListener('click', function (e) { if (e.target === editModal) editModal.hidden = true; });

  editForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var id = editForm.id.value;
    editStatus.textContent = 'Salvando...';
    editStatus.className = 'form-status';
    var fd = new FormData(editForm);
    fd.delete('id');
    fetch('/api/admin/posts/' + id, { method: 'PUT', body: fd }).then(function (r) {
      if (!r.ok) throw new Error();
      editModal.hidden = true;
      loadPosts();
    }).catch(function () {
      editStatus.textContent = 'Erro ao salvar alterações.';
      editStatus.className = 'form-status err';
    });
  });

  /* ---------------- settings (change password) ---------------- */
  var settingsModal = $('#settings-modal');
  $('#settings-btn').addEventListener('click', function () { settingsModal.hidden = false; });
  $('#settings-close').addEventListener('click', function () { settingsModal.hidden = true; });
  settingsModal.addEventListener('click', function (e) { if (e.target === settingsModal) settingsModal.hidden = true; });

  var passwordForm = $('#password-form');
  var passwordStatus = $('#password-status');
  passwordForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var fd = new FormData(passwordForm);
    fetch('/api/admin/change-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: fd.get('currentPassword'), newPassword: fd.get('newPassword') }),
    }).then(function (r) {
      if (!r.ok) throw new Error();
      passwordStatus.textContent = 'Senha atualizada!';
      passwordStatus.className = 'form-status ok';
      passwordForm.reset();
    }).catch(function () {
      passwordStatus.textContent = 'Não foi possível trocar a senha. Confira a senha atual.';
      passwordStatus.className = 'form-status err';
    });
  });
})();
