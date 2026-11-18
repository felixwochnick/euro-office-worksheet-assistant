/*
 * Panel UI: chat view, manual ABC editor, settings.
 */
(function (window) {
  'use strict';

  var Abc = window.MusicAbc;
  var I18n = window.MusicI18n;
  var Settings = window.MusicSettings;
  var Renderer = window.MusicRenderer;
  var Editor = window.MusicEditor;
  var t = I18n.t;

  var TEMPLATES = {
    emptyTreble: function () { return Abc.emptyStavesAbc({ clef: 'treble', count: 1 }); },
    emptyBass: function () { return Abc.emptyStavesAbc({ clef: 'bass', count: 1 }); },
    // "Alle meine Entchen" – traditional German children's song (public domain)
    melody: function () {
      return 'X:1\nT:Alle meine Entchen\nM:4/4\nL:1/4\nK:C clef=treble\n' +
        'C D E F | G2 G2 | A A A A | G4 | A A A A | G4 |\n' +
        'w: Al-le mei-ne Ent-chen schwim-men auf dem See, schwim-men auf dem See,\n' +
        'F F F F | E2 E2 | D D D D | C4 |]\n' +
        "w: Köpf-chen in das Was-ser, Schwänz-chen in die Höh'.";
    },
    scale: function () { return 'X:1\nM:none\nL:1/4\nK:C clef=treble\nC D E F G A B c |]'; },
    bassScale: function () { return 'X:1\nM:none\nL:1/4\nK:C clef=bass\nC, D, E, F, G, A, B, C |]'; }
  };

  var settings = Settings.load();
  var agent = null;
  var bridge = null;
  // GET /v1/meta of the configured proxy (auth mode, MCP, chat available); null = unknown / old proxy.
  var meta = null;
  var login = null;
  var chatGeneration = 0;
  var started = false;

  function $(id) { return document.getElementById(id); }

  function show(el, text, kind) {
    el.textContent = text;
    el.className = 'message' + (kind ? ' ' + kind : '');
  }

  function errorText(err) {
    if (err && err.name === 'ProxyError') {
      if (err.kind === 'auth') return t('error.auth');
      if (err.kind === 'rateLimit') return t('error.rateLimit');
      if (err.kind === 'network') return t('error.network', { detail: err.detail });
      if (err.kind === 'maxRounds') return t('error.maxRounds');
      if (err.kind === 'aborted') return t('chat.stopped');
      return t('error.server', { detail: err.detail });
    }
    return String(err && err.message ? err.message : err);
  }

  // ---------------------------------------------------------------------------
  // Tabs
  // ---------------------------------------------------------------------------
  function initTabs() {
    document.querySelectorAll('.tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var name = btn.getAttribute('data-tab');
        document.querySelectorAll('.tab').forEach(function (b) { b.classList.toggle('active', b === btn); });
        document.querySelectorAll('.view').forEach(function (v) { v.classList.toggle('active', v.id === 'view-' + name); });
        if (name === 'manual') loadOutlineOptions();
        // Messages added while the chat was hidden (e.g. MCP calls) did not scroll the log.
        if (name === 'chat') { var log = $('chat-log'); log.scrollTop = log.scrollHeight; }
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Chat
  // ---------------------------------------------------------------------------
  function addChat(cls, text) {
    var log = $('chat-log');
    var div = document.createElement('div');
    div.className = 'msg ' + cls;
    div.textContent = text;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }

  function toolLabel(call) {
    var label = t('tool.' + call.name);
    if (call.name === 'insert_staff') {
      var title = /^T:(.*)$/m.exec(call.arguments.abc || '');
      if (title) label += ' „' + title[1].trim() + '“';
    }
    return label;
  }

  function fallbackNote(result) {
    if (!result || !result.method || result.method === 'api') return '';
    var extra = '';
    if (result.alt_text_set === false) extra += t('warning.noAlt');
    if (result.note) extra += t('warning.cursorInstead');
    return ' ' + t('warning.fallback', { method: result.method, extra: extra });
  }

  function confirmInsert(call, rendered, abc, signal) {
    return new Promise(function (resolve) {
      if (signal && signal.aborted) { resolve(false); return; }
      var log = $('chat-log');
      var card = document.createElement('div');
      card.className = 'card';
      var title = document.createElement('div');
      title.className = 'title';
      var replacing = call.name === 'replace_staff' || call.name === 'replace_elements';
      var deleting = call.name === 'delete_elements';
      title.textContent = t(deleting ? 'preview.titleDelete' : replacing ? 'preview.titleReplace' : 'preview.title') + ' – ' + toolLabel(call);
      var preview = document.createElement('div');
      preview.className = rendered.element ? 'preview-doc' : 'preview';
      if (rendered.element) {
        // Worksheet blocks (DOM built with textContent, no HTML from the model) or the text to delete.
        preview.appendChild(rendered.element);
      } else {
        var img = document.createElement('img');
        img.src = rendered.dataUrl;
        img.alt = 'preview';
        preview.appendChild(img);
      }
      var row = document.createElement('div');
      row.className = 'row';
      var yes = document.createElement('button');
      yes.className = 'primary';
      yes.textContent = t(deleting ? 'preview.delete' : replacing ? 'preview.replace' : 'preview.insert');
      if (deleting) yes.className = 'danger';
      var no = document.createElement('button');
      no.className = 'secondary';
      no.textContent = t('preview.discard');
      row.appendChild(yes);
      row.appendChild(no);
      card.appendChild(title);
      card.appendChild(preview);
      card.appendChild(row);
      log.appendChild(card);
      log.scrollTop = log.scrollHeight;
      // The loading bar (with the Stop button) stays visible: Stop and "Neuer Chat"
      // abort the run and thereby discard the open preview.
      var settled = false;
      function done(v) {
        if (settled) return;
        settled = true;
        yes.disabled = true;
        no.disabled = true;
        card.classList.add(v ? 'accepted' : 'rejected');
        resolve(v);
      }
      yes.addEventListener('click', function () { done(true); });
      no.addEventListener('click', function () { done(false); });
      if (signal) signal.addEventListener('abort', function () { done(false); });
    });
  }

  /** Short status text of an executed tool call (chat and MCP). */
  function toolStatus(call, result) {
    var status;
    if (!result || !result.ok) return t('tool.failed', { error: (result && result.error) || '?' });
    if (result.inserted === false || result.replaced === false || result.deleted === false) status = t('tool.rejected');
    else if (call.name === 'get_document_outline') status = '✓';
    else if (call.name === 'insert_blocks' || call.name === 'replace_elements') status = t('tool.blocksAt', { count: result.count, from: result.first_index, to: result.last_index });
    else if (call.name === 'delete_elements') status = t('tool.deletedRange', { count: result.removed_count });
    else if (call.name === 'get_elements') status = t('tool.read');
    else if (result.replaced) status = t('tool.replacedAt', { index: result.index });
    else if (result.index != null) status = t('tool.insertedAt', { index: result.index });
    else status = t('tool.inserted');
    return status + fallbackNote(result);
  }

  function setLoading(on) {
    $('chat-loading').classList.toggle('hidden', !on);
    $('chat-send').disabled = on;
  }

  function initChat() {
    agent = new window.MusicAgent.ChatAgent({
      getSettings: function () { return settings; },
      onMessage: function (m) { addChat('assistant', m.content); },
      onServerTool: function (m) {
        if (m.name !== 'convert_german_notes') return;
        var r = null;
        try { r = JSON.parse(m.content); } catch (e) { r = null; }
        if (!r || !r.notes) { addChat('tool', t('tool.convert_german_notes')); return; }
        // Show how the notes were read (digits, meter, warnings) so the user can correct it.
        addChat(r.errors && r.errors.length ? 'error' : 'tool', t('tool.convert_german_notes') + ': ' + conversionSummary({
          errors: r.errors || [],
          warnings: r.warnings || [],
          notes: r.notes.map(function (n) { return { input: n.german, duration: r.digits === 'duration' }; }),
          digits: r.digits,
          meter: r.meter,
          bars: r.bars
        }).join('\n'));
      },
      onToolStart: function () {},
      onToolDone: function (call, result) {
        if (call.name === 'get_document_outline') { addChat('tool', t('tool.get_document_outline')); return; }
        addChat(result.ok ? 'tool' : 'error', toolLabel(call) + ': ' + toolStatus(call, result));
      },
      confirmInsert: confirmInsert
    });

    $('chat-auto').checked = settings.autoInsert;
    $('chat-auto').addEventListener('change', function () {
      settings = Settings.save({ autoInsert: $('chat-auto').checked });
      $('s-auto').checked = settings.autoInsert;
    });

    function send() {
      var text = $('chat-text').value.trim();
      if (!text || agent.busy) return;
      if (!settings.proxyUrl || !settings.token) {
        addChat('error', t('chat.notConfigured'));
        return;
      }
      if (meta && meta.chat === false) {
        addChat('error', meta.settings_url ? t('chat.disabledLocal', { url: meta.settings_url }) : t('chat.disabled'));
        return;
      }
      $('chat-text').value = '';
      addChat('user', text);
      setLoading(true);
      var gen = chatGeneration;
      agent.send(text).then(function () {
        if (gen === chatGeneration) setLoading(false);
      }, function (err) {
        if (gen !== chatGeneration) return; // chat was reset meanwhile
        setLoading(false);
        addChat(err && err.kind === 'aborted' ? 'tool' : 'error', errorText(err));
      });
    }

    $('chat-send').addEventListener('click', send);
    $('chat-text').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
    });
    $('chat-stop').addEventListener('click', function () { agent.abort(); });
    $('chat-new').addEventListener('click', function () {
      chatGeneration++;
      agent.reset();
      setLoading(false);
      $('chat-log').innerHTML = '';
      addChat('assistant', t('chat.welcome'));
    });
    addChat('assistant', t('chat.welcome'));
  }

  // ---------------------------------------------------------------------------
  // Manual mode
  // ---------------------------------------------------------------------------
  var previewTimer = null;

  function manualErrors(abc) {
    var v = Abc.validateAbc(abc, { requireClef: false });
    var box = $('m-errors');
    var lyricIssues = v.warnings.filter(function (w) { return w.code === 'lyrics_mismatch'; });
    if (v.valid && lyricIssues.length) {
      // Not blocking: the text is shown, but some notes have no / too many syllables.
      box.classList.remove('hidden');
      box.textContent = lyricIssues.map(function (w) { return t('lyrics.mismatch', w); }).join('\n');
    } else if (v.valid) {
      box.classList.add('hidden');
    } else {
      box.classList.remove('hidden');
      box.textContent = t('error.invalidAbc', { detail: Abc.formatValidationErrors(v) });
    }
    return v;
  }

  function updatePreview() {
    var abc = $('m-abc').value;
    var target = $('m-preview');
    if (!abc.trim()) { target.innerHTML = ''; $('m-errors').classList.add('hidden'); return; }
    var v = manualErrors(abc);
    if (!v.valid) return;
    try {
      var r = Renderer.renderSvg(v.normalized, { widthCm: Number($('m-width').value) || settings.widthCm });
      target.innerHTML = r.svg;
      if (r.warnings.length) {
        $('m-errors').classList.remove('hidden');
        $('m-errors').textContent = r.warnings.slice(0, 3).join('\n');
      }
    } catch (e) {
      target.textContent = t('error.render', { detail: e.message });
    }
  }

  function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(updatePreview, 250);
  }

  function loadOutlineOptions() {
    var sel = $('m-position');
    var keep = sel.value;
    Editor.getOutline().then(function (o) {
      while (sel.options.length > 1) sel.remove(1);
      (o.elements || []).forEach(function (el) {
        var text = (el.text || '').replace(/\s+/g, ' ').trim();
        if (!text && !el.has_image) return;
        var opt = document.createElement('option');
        opt.value = 'after:' + el.index;
        opt.textContent = '↳ [' + el.index + '] ' + (el.is_heading ? '§ ' : '') + (text ? text.slice(0, 40) : (el.abc ? '♪ ABC' : '🖼'));
        sel.appendChild(opt);
      });
      if (keep && Array.prototype.some.call(sel.options, function (op) { return op.value === keep; })) sel.value = keep;
    }).catch(function () { /* editor not ready – keep "cursor" only */ });
  }

  function manualRender() {
    var v = manualErrors($('m-abc').value);
    if (!v.valid) return Promise.reject(new Error(t('error.invalidAbc', { detail: Abc.formatValidationErrors(v) })));
    return Renderer.renderPng(v.normalized, { widthCm: Number($('m-width').value) || settings.widthCm, dpi: settings.dpi })
      .then(function (r) { r.abc = v.normalized; return r; });
  }

  /** Human-readable (translated) summary of a germanToAbc() result. */
  function formatNumber(n) {
    try { return Number(n).toLocaleString(I18n.getLanguage()); } catch (e) { return String(n); }
  }

  function conversionIssue(issue) {
    var key = 'conv.' + issue.code;
    var params = {};
    Object.keys(issue).forEach(function (k) { params[k] = typeof issue[k] === 'number' ? formatNumber(issue[k]) : issue[k]; });
    var text = t(key, params);
    return text === key ? (issue.token ? issue.token + ': ' : '') + issue.error : text;
  }

  function conversionSummary(r) {
    var lines = [];
    if (r.errors.length) {
      lines.push(t('conv.notConverted'));
      r.errors.forEach(function (e) { lines.push('• ' + conversionIssue(e)); });
      return lines;
    }
    var head = t('manual.converted', { count: r.notes.length });
    if (r.notes.some(function (n) { return n.duration || /\d/.test(n.input); })) {
      head += ' ' + t(r.digits === 'duration' ? 'conv.digitsDuration' : 'conv.digitsOctave');
    }
    if (r.meter) head += ' ' + t('conv.meter', { meter: r.meter, bars: formatNumber(r.bars) });
    lines.push(head);
    r.warnings.forEach(function (w) { lines.push('⚠ ' + conversionIssue(w)); });
    return lines;
  }

  function initManual() {
    $('m-width').value = settings.widthCm;
    $('m-abc').value = TEMPLATES.emptyTreble();
    $('m-abc').addEventListener('input', schedulePreview);
    $('m-width').addEventListener('input', schedulePreview);
    $('m-template').addEventListener('change', function () {
      var tpl = TEMPLATES[$('m-template').value];
      if (tpl) { $('m-abc').value = tpl(); updatePreview(); }
    });
    $('m-convert').addEventListener('click', function () {
      var clef = $('m-clef').value;
      var r = Abc.germanToAbc($('m-german').value, { clef: clef, digits: $('m-digits').value });
      var lines = conversionSummary(r);
      if (r.errors.length) {
        // Never replace the ABC with a partial result: show what could not be read.
        show($('m-status'), lines.join('\n'), 'error');
        return;
      }
      if (r.notes.length) {
        $('m-abc').value = r.tune;
        updatePreview();
      }
      show($('m-status'), lines.join('\n'), r.warnings.length ? 'warn' : 'ok');
    });
    $('m-add-lyrics').addEventListener('click', function () {
      var text = $('m-lyrics').value.trim();
      if (!text) { show($('m-status'), t('lyrics.no_text'), 'error'); return; }
      var r = Abc.addLyrics($('m-abc').value, text, { mode: $('m-verse').checked ? 'verse' : 'replace' });
      if (!r.ok) {
        show($('m-status'), r.errors.map(function (e) { return conversionIssue(Object.assign({}, e, { code: 'lyrics_' + e.code })); }).join('\n'), 'error');
        return;
      }
      $('m-abc').value = r.abc;
      updatePreview();
      var lines = [t('lyrics.added', { syllables: r.syllables, notes: r.notes })];
      r.warnings.forEach(function (w) { lines.push('⚠ ' + conversionIssue(Object.assign({}, w, { code: 'lyrics_' + w.code }))); });
      show($('m-status'), lines.join('\n'), r.warnings.length ? 'warn' : 'ok');
    });
    $('m-outline').addEventListener('click', loadOutlineOptions);

    $('m-insert').addEventListener('click', function () {
      var btn = $('m-insert');
      btn.disabled = true;
      var posVal = $('m-position').value;
      var position = posVal === 'cursor' ? 'cursor' : { after_paragraph_index: Number(posVal.split(':')[1]) };
      manualRender().then(function (r) {
        return Editor.insertImage({ dataUrl: r.dataUrl, widthMm: r.widthMm, heightMm: r.heightMm, abc: r.abc, position: position, method: settings.insertMethod });
      }).then(function (res) {
        if (!res.ok) throw new Error(t('error.editor', { detail: res.error }));
        var note = res.method !== 'api' ? '\n' + t('warning.fallback', { method: res.method, extra: res.warnings.indexOf('alt') !== -1 ? t('warning.noAlt') : '' }) : '';
        show($('m-status'), t('manual.inserted') + note, 'ok');
        loadOutlineOptions();
      }).catch(function (e) {
        show($('m-status'), e.message, 'error');
      }).then(function () { btn.disabled = false; });
    });

    $('m-load').addEventListener('click', function () {
      Editor.getSelectedStaff().then(function (r) {
        if (!r || !r.found || !Abc.looksLikeAbc(r.abc)) { show($('m-status'), t('manual.noSelection'), 'error'); return; }
        $('m-abc').value = r.abc;
        if (r.width_mm) $('m-width').value = Math.round(r.width_mm / 10 * 2) / 2;
        updatePreview();
        show($('m-status'), t('manual.loaded'), 'ok');
      }).catch(function (e) { show($('m-status'), e.message, 'error'); });
    });

    $('m-replace').addEventListener('click', function () {
      manualRender().then(function (r) {
        return Editor.replaceSelected({ dataUrl: r.dataUrl, widthMm: r.widthMm, heightMm: r.heightMm, abc: r.abc });
      }).then(function (res) {
        if (!res || !res.ok) throw new Error(t('error.editor', { detail: (res && res.error) || '?' }));
        show($('m-status'), t('manual.replaced'), 'ok');
      }).catch(function (e) { show($('m-status'), e.message, 'error'); });
    });

    updatePreview();
  }

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------
  function fillSettings() {
    $('s-url').value = settings.proxyUrl;
    $('s-token').value = settings.token;
    $('s-auto').checked = settings.autoInsert;
    $('s-width').value = settings.widthCm;
    $('s-dpi').value = settings.dpi;
    $('s-method').value = settings.insertMethod;
    $('s-lang').value = settings.language;
    $('s-mcp').checked = settings.mcpEnabled;
    updateAuthUi();
  }

  function readSettingsForm() {
    return {
      proxyUrl: $('s-url').value,
      token: $('s-token').value.trim(),
      autoInsert: $('s-auto').checked,
      widthCm: Number($('s-width').value),
      dpi: Number($('s-dpi').value),
      insertMethod: $('s-method').value,
      language: $('s-lang').value,
      mcpEnabled: $('s-mcp').checked
    };
  }

  // ---------------------------------------------------------------------------
  // Proxy capabilities, Nextcloud sign-in and MCP bridge
  // ---------------------------------------------------------------------------
  function isNextcloud() { return !!(meta && meta.auth_mode === 'nextcloud'); }

  function updateAuthUi() {
    var nc = isNextcloud();
    $('s-nc').classList.toggle('hidden', !nc);
    $('s-token-field').classList.toggle('hidden', nc);
    var signedIn = nc && !!settings.token;
    $('s-nc-user').textContent = signedIn ? t('settings.ncSignedIn', { name: settings.userName || '?' }) : '';
    $('s-nc-login').classList.toggle('hidden', signedIn);
    $('s-nc-logout').classList.toggle('hidden', !signedIn);
    var url = settings.proxyUrl ? ((meta && meta.mcp && meta.mcp.url) || settings.proxyUrl + '/mcp') : '–';
    $('s-mcp-url').textContent = url;
    $('s-mcp').disabled = !!(meta && !meta.mcp);
  }

  /** Read GET /v1/meta (public) of the proxy. Proxies before 0.3 do not have it (token mode, no MCP). */
  function refreshMeta(proxyUrl) {
    if (!proxyUrl) { meta = null; updateAuthUi(); return Promise.resolve(null); }
    return window.MusicAgent.request({ proxyUrl: proxyUrl, token: '' }, '/v1/meta', null, null).then(function (m) {
      meta = m;
    }, function (err) {
      meta = err && err.status === 404 ? { auth_mode: 'token', chat: true, mcp: null } : null;
    }).then(function () {
      updateAuthUi();
      return meta;
    });
  }

  function showMcpStatus(status, detail) {
    var el = $('s-mcp-status');
    var name = detail && typeof detail === 'object' ? (detail.display_name || detail.id || '') : '';
    el.textContent = t('settings.mcpStatus.' + status, { detail: typeof detail === 'string' ? detail : name });
    el.className = 'hint' + (status === 'connected' ? ' ok' : status === 'auth' || status === 'origin' || status === 'error' ? ' bad' : '');
  }

  function initBridge() {
    if (!window.WorksheetBridge) return;
    // Executes MCP calls with the chat's tool code, without previews (the AI client asks the user).
    var executor = new window.MusicAgent.ChatAgent({
      getSettings: function () { return Object.assign({}, settings, { autoInsert: true }); },
      onMessage: function () {},
      onToolStart: function () {},
      onToolDone: function () {},
      confirmInsert: function () { return Promise.resolve(true); }
    });
    bridge = new window.WorksheetBridge.Bridge({
      getSettings: function () { return settings; },
      executor: executor,
      onStatus: showMcpStatus,
      onCall: function (call, result) {
        var text = call.name === 'get_document_outline' && result && result.ok ? toolLabel(call) : toolLabel(call) + ': ' + toolStatus(call, result);
        addChat((result && result.ok ? 'tool' : 'error') + ' mcp', t('mcp.call', { label: text }));
      }
    });
    bridge.update();
  }

  function stopLogin() {
    if (login) { clearTimeout(login.timer); login = null; }
  }

  function startNextcloudLogin() {
    stopLogin();
    var proxyUrl = String($('s-url').value || '').trim().replace(/\/+$/, '');
    var status = $('s-nc-status');
    show(status, '…', '');
    // Open the window right away (popup blockers allow it only during the click).
    var win = null;
    try { win = window.open('about:blank', '_blank'); } catch (e) { win = null; }
    window.MusicAgent.request({ proxyUrl: proxyUrl, token: '' }, '/v1/auth/login', {}, null).then(function (r) {
      if (win) { try { win.location.href = r.login_url; } catch (e) { win = null; } }
      status.textContent = '';
      status.className = 'message';
      status.appendChild(document.createTextNode(t('settings.ncWaiting') + ' '));
      var a = document.createElement('a');
      a.href = r.login_url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = t('settings.ncOpenLink');
      status.appendChild(a);
      var me = login = { flowId: r.flow_id, until: Date.now() + 20 * 60000, timer: null };
      (function poll() {
        if (login !== me) return;
        if (Date.now() > me.until) { stopLogin(); show(status, t('settings.ncExpired'), 'error'); return; }
        window.MusicAgent.request({ proxyUrl: proxyUrl, token: '' }, '/v1/auth/login/poll', { flow_id: me.flowId }, null).then(function (p) {
          if (login !== me) return;
          if (!p || !p.done) { me.timer = setTimeout(poll, 2000); return; }
          stopLogin();
          try { if (win && !win.closed) win.close(); } catch (e) {}
          settings = Settings.save({ proxyUrl: proxyUrl, token: p.token, userName: (p.user && (p.user.display_name || p.user.id)) || '' });
          fillSettings();
          show(status, t('settings.ncDone'), 'ok');
          if (bridge) bridge.update();
        }, function (err) {
          if (login !== me) return;
          // Rate limit or a short network problem: keep waiting.
          if (err && (err.status === 429 || err.kind === 'network')) { me.timer = setTimeout(poll, 5000); return; }
          stopLogin();
          show(status, err && err.status === 404 ? t('settings.ncExpired') : errorText(err), 'error');
        });
      })();
    }, function (err) {
      try { if (win) win.close(); } catch (e) {}
      show(status, errorText(err), 'error');
    });
  }

  function nextcloudLogout() {
    stopLogin();
    var old = { proxyUrl: settings.proxyUrl, token: settings.token };
    settings = Settings.save({ token: '', userName: '' });
    fillSettings();
    if (bridge) bridge.update();
    if (old.proxyUrl && old.token) window.MusicAgent.request(old, '/v1/auth/logout', {}, null).catch(function () {});
    $('s-nc-status').className = 'message hidden';
  }

  function initSettings() {
    fillSettings();
    // The origin the plugin runs on (= the Document Server's) – needed for the proxy's CORS_ORIGINS.
    $('s-origin').textContent = window.location.origin;
    $('s-save').addEventListener('click', function () {
      var langBefore = settings.language;
      settings = Settings.save(readSettingsForm());
      fillSettings();
      $('chat-auto').checked = settings.autoInsert;
      $('m-width').value = settings.widthCm;
      if (settings.language !== langBefore) { I18n.setLanguage(settings.language); I18n.apply(); }
      show($('s-status'), Settings.isPersistent() ? t('settings.saved') : t('settings.storageWarning'), Settings.isPersistent() ? 'ok' : 'error');
      refreshMeta(settings.proxyUrl).then(function () { if (bridge) bridge.update(); });
    });
    $('s-url').addEventListener('change', function () {
      refreshMeta(String($('s-url').value || '').trim().replace(/\/+$/, ''));
    });
    $('s-mcp').addEventListener('change', function () {
      settings = Settings.save({ mcpEnabled: $('s-mcp').checked });
      if (bridge) bridge.update();
    });
    $('s-nc-login').addEventListener('click', startNextcloudLogin);
    $('s-nc-logout').addEventListener('click', nextcloudLogout);
    $('s-test').addEventListener('click', function () {
      var candidate = readSettingsForm();
      candidate.proxyUrl = String(candidate.proxyUrl || '').trim().replace(/\/+$/, '');
      show($('s-status'), '…', '');
      refreshMeta(candidate.proxyUrl).then(function () {
        if (isNextcloud()) candidate.token = settings.token;
        return window.MusicAgent.testConnection(candidate);
      }).then(function (info) {
        show($('s-status'), t('settings.testOk', { model: info.model || '–', provider: info.provider }), 'ok');
      }, function (err) {
        show($('s-status'), errorText(err), 'error');
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Theme & start-up
  // ---------------------------------------------------------------------------
  function applyTheme(theme) {
    if (!theme) return;
    var map = {
      '--bg': theme['background-normal'],
      '--bg-alt': theme['background-toolbar'],
      '--text': theme['text-normal'],
      '--text-muted': theme['text-secondary'],
      '--border': theme['border-regular-control'],
      '--accent': theme['background-accent-button'] || theme['highlight-button-pressed'],
      '--user-bubble': theme['highlight-button-hover']
    };
    Object.keys(map).forEach(function (k) {
      if (map[k]) document.documentElement.style.setProperty(k, map[k]);
    });
  }

  function start() {
    if (started) return;
    started = true;
    I18n.setLanguage(settings.language);
    I18n.apply();
    initTabs();
    initChat();
    initManual();
    initSettings();
    refreshMeta(settings.proxyUrl).then(initBridge, initBridge);
  }

  var plugin = window.Asc && window.Asc.plugin;
  if (plugin) {
    plugin.init = function () {
      start();
      try { applyTheme(plugin.theme); } catch (e) {}
    };
    plugin.button = function () {
      // Panel plugins have no buttons; the editor calls this when the panel is closed.
      try { plugin.executeCommand('close', ''); } catch (e) {}
    };
    plugin.onThemeChanged = function (theme) {
      try { if (plugin.onThemeChangedBase) plugin.onThemeChangedBase(theme); } catch (e) {}
      applyTheme(theme);
    };
    plugin.onTranslate = function () {
      if (settings.language === 'auto') { I18n.setLanguage('auto'); I18n.apply(); }
    };
  }

  // Exposed for the local test harness.
  window.MusicApp = { start: start, applyTheme: applyTheme, _bridge: function () { return bridge; } };
})(window);
