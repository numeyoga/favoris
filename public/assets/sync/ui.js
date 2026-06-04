// ============================================================
// UI de synchronisation : bouton topbar + modale de configuration
// ============================================================
// Réutilise les classes CSS existantes (.scrim/.modal/.field/.btn) et le
// conteneur #modal-root. Volontairement découplée du moteur : ne connaît
// que l'API publique de `sync`.

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

export function initUI(sync) {
  const btn = document.getElementById('sync-btn');
  if (!btn) return;
  const icon = btn.querySelector('i');

  function paint(s) {
    if (!s.configured) {
      btn.title = 'Synchronisation : non configurée';
      icon.className = 'ph ph-cloud-slash';
    } else if (s.error && !s.user) {
      btn.title = 'Erreur de synchronisation : ' + s.error;
      icon.className = 'ph ph-cloud-warning';
    } else if (s.user) {
      btn.title = 'Synchronisé : ' + s.user.email + (s.pending ? ' · envoi en cours…' : '');
      icon.className = s.pending ? 'ph ph-cloud-arrow-up' : 'ph ph-cloud-check';
    } else {
      btn.title = 'Synchronisation configurée — connexion requise';
      icon.className = 'ph ph-cloud';
    }
  }

  sync.on(paint);
  paint(sync.status());
  btn.onclick = () => openModal(sync);
}

function openModal(sync) {
  const root = document.getElementById('modal-root');
  root.innerHTML = '';
  const scrim = el('div', 'scrim');
  scrim.onclick = (e) => {
    if (e.target === scrim) close();
  };
  const m = el('div', 'modal');
  scrim.appendChild(m);
  root.appendChild(scrim);

  function close() {
    root.innerHTML = '';
  }
  function toast(msg) {
    if (typeof window.toast === 'function') window.toast(msg);
  }

  // État local du formulaire (provider sélectionné quand non configuré).
  const status0 = sync.status();
  let pickedProvider = status0.provider || (status0.adapters[0] && status0.adapters[0].id) || null;

  function render() {
    const s = sync.status();
    m.innerHTML = '';

    const head = el('header');
    head.appendChild(el('h3', null, 'Synchronisation'));
    const x = el('button', 'btn ghost icon-only', '<i class="ph ph-x"></i>');
    x.onclick = close;
    head.appendChild(x);
    m.appendChild(head);

    const body = el('div', 'body');
    m.appendChild(body);

    if (!s.configured) {
      renderConfigForm(s, body, render);
    } else if (!s.user) {
      renderSignIn(s, body, render, close, toast);
    } else {
      renderConnected(s, body, render, close, toast);
    }
  }

  // ---- Écran 1 : choix du provider + configuration -----------
  function renderConfigForm(s, body, rerender) {
    body.appendChild(
      el(
        'p',
        null,
        '<span style="color:var(--cv-fg-muted);font-size:12px">Choisissez un backend et renseignez ses identifiants ' +
          '<strong>publics</strong> (endpoint, IDs de projet). ' +
          '<span style="color:var(--cv-fg-danger)">Ne collez jamais de clé secrète / admin ici.</span></span>'
      )
    );

    const provField = el('div', 'field');
    provField.appendChild(el('label', null, 'Backend'));
    const sel = el('select');
    s.adapters.forEach((a) => {
      const o = el('option', null, a.label);
      o.value = a.id;
      if (a.id === pickedProvider) o.selected = true;
      sel.appendChild(o);
    });
    sel.onchange = () => {
      pickedProvider = sel.value;
      rerender();
    };
    provField.appendChild(sel);
    body.appendChild(provField);

    const adapter = sync.adapters[pickedProvider];
    const prev = sync.config && sync.config.provider === pickedProvider ? sync.config.settings : {};
    const inputs = {};
    (adapter.configFields || []).forEach((f) => {
      const field = el('div', 'field');
      field.appendChild(el('label', null, f.label));
      const ip = el('input');
      ip.placeholder = f.placeholder || '';
      ip.value = prev[f.key] || '';
      field.appendChild(ip);
      inputs[f.key] = ip;
      body.appendChild(field);
    });

    const foot = el('footer');
    const cancel = el('button', 'btn', 'Annuler');
    cancel.onclick = close;
    const ok = el('button', 'btn primary', 'Enregistrer');
    ok.onclick = async () => {
      const settings = {};
      let missing = false;
      (adapter.configFields || []).forEach((f) => {
        settings[f.key] = inputs[f.key].value.trim();
        if (!settings[f.key]) missing = true;
      });
      if (missing) {
        toast('Tous les champs sont requis');
        return;
      }
      ok.disabled = true;
      ok.textContent = 'Connexion…';
      try {
        await sync.applyConfig({ provider: pickedProvider, settings, app: sync.app });
        toast('Backend configuré');
        render();
      } catch (e) {
        console.warn(e);
        toast(e.message || 'Échec : vérifiez les identifiants');
        ok.disabled = false;
        ok.textContent = 'Enregistrer';
      }
    };
    foot.appendChild(cancel);
    foot.appendChild(ok);
    m.appendChild(foot);
  }

  // ---- Écran 2 : connexion (magic-link) ----------------------
  function renderSignIn(s, body, rerender, close, toast) {
    if (s.error) {
      body.appendChild(
        el(
          'p',
          null,
          '<span style="color:var(--cv-fg-danger);font-size:12px">Erreur : ' +
            s.error +
            '</span>'
        )
      );
    }
    body.appendChild(
      el(
        'p',
        null,
        '<span style="color:var(--cv-fg-muted);font-size:12px">Backend : <strong>' +
          s.provider +
          '</strong>. Connectez-vous par lien magique pour activer la synchronisation.</span>'
      )
    );

    const field = el('div', 'field');
    field.appendChild(el('label', null, 'Email'));
    const ip = el('input');
    ip.type = 'email';
    ip.placeholder = 'vous@exemple.fr';
    field.appendChild(ip);
    body.appendChild(field);

    const foot = el('footer');
    const reconf = el('button', 'btn ghost', 'Reconfigurer');
    reconf.style.marginRight = 'auto';
    reconf.onclick = async () => {
      await sync.forget();
      render();
    };
    const send = el('button', 'btn primary', 'Recevoir le lien');
    send.onclick = async () => {
      const email = ip.value.trim();
      if (!email) {
        ip.focus();
        return;
      }
      send.disabled = true;
      send.textContent = 'Envoi…';
      try {
        await sync.connect(email);
        toast('Lien envoyé — vérifiez votre email');
        close();
      } catch (e) {
        console.warn(e);
        toast(e.message || ‘Échec de l\’envoi’);
        send.disabled = false;
        send.textContent = ‘Recevoir le lien’;
      }
    };
    foot.appendChild(reconf);
    foot.appendChild(send);
    m.appendChild(foot);
  }

  // ---- Écran 3 : connecté ------------------------------------
  function renderConnected(s, body, rerender, close, toast) {
    body.appendChild(
      el(
        'p',
        null,
        '<span style="font-size:13px">Connecté : <strong>' +
          s.user.email +
          '</strong>' +
          '<br><span style="color:var(--cv-fg-muted);font-size:12px">Backend : ' +
          s.provider +
          (s.pending ? ' · envoi en cours…' : ' · à jour') +
          '</span></span>'
      )
    );

    const row = el('div', 'field');
    const syncBtn = el(
      'button',
      'btn',
      '<i class="ph ph-arrows-clockwise"></i> Synchroniser maintenant'
    );
    syncBtn.onclick = async () => {
      syncBtn.disabled = true;
      try {
        await sync.syncNow();
        toast('Synchronisé');
      } catch (e) {
        toast(e.message || 'Échec de la sync');
      }
      syncBtn.disabled = false;
      render();
    };
    row.appendChild(syncBtn);
    body.appendChild(row);

    const foot = el('footer');
    const forget = el('button', 'btn ghost', 'Oublier la config');
    forget.style.marginRight = 'auto';
    forget.style.color = 'var(--cv-fg-danger)';
    forget.onclick = async () => {
      await sync.forget();
      render();
    };
    const out = el('button', 'btn', 'Se déconnecter');
    out.onclick = async () => {
      await sync.signOut();
      render();
    };
    const done = el('button', 'btn primary', 'Fermer');
    done.onclick = close;
    foot.appendChild(forget);
    foot.appendChild(out);
    foot.appendChild(done);
    m.appendChild(foot);
  }

  render();
}
