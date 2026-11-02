/* FLOW Founder private chat add-on. Load after config.js and the page's main scripts. */
(() => {
  'use strict';

  const db = (typeof supabaseClient !== 'undefined' && supabaseClient) || window.supabaseClient;
  if (!db) {
    console.error('FLOW Founder: supabaseClient is missing. Load js/config.js first.');
    return;
  }

  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  let me = null;
  let profile = null;
  let founder = null;
  let isFounder = false;
  let currentRequest = null;
  let requests = [];
  let messages = [];
  let channel = null;
  let mediaRecorder = null;
  let recordingStream = null;
  let recordingChunks = [];
  let adminView = 'inbox';

  const verified = '<span class="flow-verified"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7"/></svg> VERIFIED</span>';

  async function init() {
    try {
      const { data: { user }, error: authError } = await db.auth.getUser();
      if (authError || !user) return;
      me = user.id;

      const { data: currentProfile, error: profileError } = await db
        .from('profiles')
        .select('id, display_name, role, friend_code')
        .eq('id', me)
        .single();
      if (profileError || !currentProfile) {
        console.error('FLOW Founder: profile lookup failed', profileError);
        return;
      }
      profile = currentProfile;

      const { data: founderRows, error: founderError } = await db.rpc('get_flow_founder');
      if (founderError || !founderRows?.length) {
        console.warn('FLOW Founder: account YM00 was not found. Run supabase/founder_chat.sql and verify the founder profile.', founderError);
        return;
      }
      founder = founderRows[0];
      isFounder = profile.id === founder.id;

      mount();
      if (isFounder) await renderAdminInbox();
      subscribe();
    } catch (error) {
      console.error('FLOW Founder initialization failed:', error);
    }
  }

  function mount() {
    const header = document.querySelector('.header-actions') || document.querySelector('.site-header') || document.querySelector('header');
    if (header && !$('flow-founder-launch')) {
      const button = document.createElement('button');
      button.id = 'flow-founder-launch';
      button.type = 'button';
      button.className = 'flow-founder-btn';
      button.textContent = isFounder ? 'صندوق المؤسس' : 'تواصل مع المؤسس';
      button.addEventListener('click', () => {
        if (isFounder && $('flow-founder-inbox')) {
          $('flow-founder-inbox').scrollIntoView({ behavior: 'smooth', block: 'start' });
          renderAdminInbox();
        } else {
          openModal();
        }
      });
      header.appendChild(button);
    }

    if (isFounder && document.querySelector('.admin-page') && !$('flow-founder-inbox')) {
      const section = document.createElement('section');
      section.id = 'flow-founder-inbox';
      section.className = 'admin-section flow-founder-admin-section';
      section.innerHTML = `
        <div class="section-heading">
          <div>
            <span class="eyebrow">FOUNDER MESSAGES</span>
            <h2>صندوق محادثات FLOW Founder ${verified}</h2>
            <p class="flow-founder-muted">راجع طلبات التواصل، اقبل أو ارفض، وافتح المحادثات المقبولة.</p>
          </div>
          <button type="button" class="flow-founder-action secondary" id="flow-founder-refresh">تحديث الطلبات</button>
        </div>
        <div id="flow-founder-inline"><div class="flow-founder-status">جاري تحميل الطلبات...</div></div>`;
      const anchor = document.querySelector('.admin-page .dashboard-header');
      if (anchor) anchor.after(section);
      else document.querySelector('.admin-page').prepend(section);
      $('flow-founder-refresh').addEventListener('click', renderAdminInbox);
    }

    if (!$('flow-founder-modal')) {
      const modal = document.createElement('div');
      modal.className = 'flow-founder-modal';
      modal.id = 'flow-founder-modal';
      modal.hidden = true;
      modal.innerHTML = `
        <section class="flow-founder-panel" role="dialog" aria-modal="true" aria-label="محادثة FLOW Founder">
          <header class="flow-founder-top">
            <div class="avatar">F</div>
            <div><div class="flow-founder-title">FLOW Founder ${verified}</div><div class="flow-founder-id">YM00 · Platform Founder</div></div>
            <button class="flow-founder-close" id="flow-founder-close" type="button" aria-label="إغلاق">×</button>
          </header>
          <div class="flow-founder-content" id="flow-founder-content"></div>
        </section>`;
      document.body.appendChild(modal);
      $('flow-founder-close').addEventListener('click', closeModal);
      modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
      document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeModal(); });
    }
  }

  function openModal() {
    const modal = $('flow-founder-modal');
    if (!modal) return;
    modal.hidden = false;
    if (isFounder) renderAdminInbox(true);
    else renderUserView();
  }

  function closeModal() {
    const modal = $('flow-founder-modal');
    if (modal) modal.hidden = true;
    if (mediaRecorder?.state === 'recording') mediaRecorder.stop();
  }

  async function getMyRequest() {
    const { data, error } = await db.from('founder_chat_requests')
      .select('*').eq('requester_id', me).eq('founder_id', founder.id).maybeSingle();
    if (error) throw error;
    return data;
  }

  async function renderUserView() {
    const content = $('flow-founder-content');
    if (!content) return;
    content.innerHTML = '<div class="flow-founder-status">جاري التحقق من حالة طلب المحادثة...</div>';
    try {
      currentRequest = await getMyRequest();
    } catch (error) {
      console.error(error);
      content.innerHTML = '<div class="flow-founder-status">تعذر تحميل حالة المحادثة. تأكد من تشغيل ملف SQL وضبط صلاحيات Supabase.</div>';
      return;
    }

    if (!currentRequest || currentRequest.status === 'rejected') {
      content.innerHTML = `<div class="flow-founder-card">
        <b>التواصل مع FLOW Founder ${verified}</b>
        <p class="flow-founder-muted">ابعت طلب محادثة. مش هتقدر تبعت رسائل أو ملفات إلا بعد موافقة المؤسس.</p>
        <button class="flow-founder-action" id="flow-request" type="button">إرسال طلب محادثة</button>
      </div>`;
      $('flow-request').addEventListener('click', sendRequest);
      return;
    }

    if (currentRequest.status === 'pending') {
      content.innerHTML = '<div class="flow-founder-status">طلبك وصل للمؤسس وهو قيد المراجعة. المحادثة هتفتح بعد الموافقة.</div>';
      return;
    }

    if (currentRequest.status === 'accepted') await renderConversation(false);
  }

  async function sendRequest() {
    const button = $('flow-request');
    if (!button) return;
    button.disabled = true;
    button.textContent = 'جاري الإرسال...';
    try {
      if (currentRequest?.status === 'rejected') {
        const { error: deleteError } = await db.from('founder_chat_requests').delete().eq('id', currentRequest.id);
        if (deleteError) throw deleteError;
      }
      const { data, error } = await db.from('founder_chat_requests')
        .insert({ requester_id: me, founder_id: founder.id, status: 'pending' }).select().single();
      if (error) throw error;
      currentRequest = data;
      await renderUserView();
    } catch (error) {
      console.error(error);
      button.disabled = false;
      button.textContent = error.code === '23505' ? 'عندك طلب موجود بالفعل' : 'حصل خطأ — حاول تاني';
    }
  }

  async function loadRequests() {
    const { data, error } = await db.from('founder_chat_requests')
      .select('*').eq('founder_id', founder.id).order('created_at', { ascending: false });
    if (error) throw error;
    requests = data || [];
  }

  async function renderAdminInbox(inModal = false) {
    if (!isFounder) return;
    const target = inModal ? $('flow-founder-content') : $('flow-founder-inline');
    if (!target) return;
    target.innerHTML = '<div class="flow-founder-status">جاري تحميل الطلبات...</div>';
    try {
      await loadRequests();
    } catch (error) {
      console.error(error);
      target.innerHTML = '<div class="flow-founder-status">تعذر تحميل الطلبات. راجع صلاحيات وسياسات Supabase في ملف SQL.</div>';
      return;
    }

    const pending = requests.filter((item) => item.status === 'pending');
    const accepted = requests.filter((item) => item.status === 'accepted');
    target.innerHTML = `
      <div class="flow-founder-card">
        <b>طلبات المحادثة <span class="flow-founder-count">${pending.length}</span></b>
        <p class="flow-founder-muted">لا يستطيع أي مستخدم مراسلتك قبل قبول طلبه.</p>
        <div class="flow-founder-list">
          ${pending.length ? pending.map((item) => `
            <div class="flow-founder-request">
              <span>مستخدم · ${esc(item.requester_id.slice(0, 8))}<small class="flow-founder-muted">${new Date(item.created_at).toLocaleString('ar-EG')}</small></span>
              <span class="flow-founder-row">
                <button class="flow-founder-action" type="button" data-accept="${esc(item.id)}">قبول</button>
                <button class="flow-founder-action danger" type="button" data-reject="${esc(item.id)}">رفض</button>
              </span>
            </div>`).join('') : '<span class="flow-founder-muted">لا توجد طلبات جديدة.</span>'}
        </div>
      </div>
      <div class="flow-founder-card">
        <b>المحادثات المقبولة (${accepted.length})</b>
        <div class="flow-founder-list">
          ${accepted.length ? accepted.map((item) => `
            <div class="flow-founder-request">
              <span>مستخدم · ${esc(item.requester_id.slice(0, 8))}<small class="flow-founder-muted">طلب بتاريخ ${new Date(item.created_at).toLocaleDateString('ar-EG')}</small></span>
              <button class="flow-founder-action secondary" type="button" data-open="${esc(item.id)}">فتح المحادثة</button>
            </div>`).join('') : '<span class="flow-founder-muted">لسه مفيش محادثات مقبولة.</span>'}
        </div>
      </div>`;

    target.querySelectorAll('[data-accept]').forEach((button) => button.addEventListener('click', () => decideRequest(button.dataset.accept, 'accepted', button)));
    target.querySelectorAll('[data-reject]').forEach((button) => button.addEventListener('click', () => decideRequest(button.dataset.reject, 'rejected', button)));
    target.querySelectorAll('[data-open]').forEach((button) => button.addEventListener('click', async () => {
      currentRequest = requests.find((item) => item.id === button.dataset.open);
      adminView = 'conversation';
      $('flow-founder-modal').hidden = false;
      await renderConversation(true);
    }));
  }

  async function decideRequest(id, status, button) {
    button.disabled = true;
    const { error } = await db.from('founder_chat_requests')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id).eq('founder_id', founder.id);
    if (error) {
      console.error(error);
      alert('تعذر تحديث الطلب. راجع صلاحيات Supabase.');
      button.disabled = false;
      return;
    }
    await renderAdminInbox();
  }

  async function renderConversation(adminMode = false) {
    const content = $('flow-founder-content');
    if (!content || !currentRequest) return;
    content.innerHTML = `
      <div class="flow-founder-row flow-founder-conversation-heading">
        ${adminMode ? '<button type="button" class="flow-founder-action secondary" id="flow-back-inbox">رجوع للصندوق</button>' : ''}
        <b>محادثة ${adminMode ? 'المستخدم · ' + esc(currentRequest.requester_id.slice(0, 8)) : 'FLOW Founder'}</b>
        <span class="flow-founder-muted">${adminMode ? 'محادثة مقبولة' : 'YM00 · Verified'}</span>
      </div>
      <div class="flow-founder-chat" id="flow-messages"><div class="flow-founder-muted">جاري تحميل الرسائل...</div></div>
      <div class="flow-founder-compose">
        <button class="flow-founder-icon" id="flow-file" type="button" title="إرفاق ملف" aria-label="إرفاق ملف">＋</button>
        <input type="file" id="flow-file-input" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip">
        <button class="flow-founder-icon" id="flow-record" type="button" title="تسجيل رسالة صوتية" aria-label="تسجيل رسالة صوتية">🎙</button>
        <textarea id="flow-text" placeholder="اكتب رسالتك..." aria-label="نص الرسالة"></textarea>
        <button class="flow-founder-action" id="flow-send" type="button">إرسال</button>
      </div>
      <div class="flow-founder-muted" id="flow-record-state">تقدر تبعت نص أو صورة أو فيديو أو ملف، وتسجل رسالة صوتية.</div>`;

    $('flow-file').addEventListener('click', () => $('flow-file-input').click());
    $('flow-send').addEventListener('click', () => sendMessage());
    $('flow-text').addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); }
    });
    $('flow-file-input').addEventListener('change', () => {
      const file = $('flow-file-input').files?.[0];
      if (file) sendMessage(file);
    });
    $('flow-record').addEventListener('click', toggleRecording);
    if (adminMode) $('flow-back-inbox').addEventListener('click', () => { adminView = 'inbox'; renderAdminInbox(true); });
    await loadMessages();
  }

  async function loadMessages() {
    const { data, error } = await db.from('founder_chat_messages')
      .select('*').eq('request_id', currentRequest.id).order('created_at', { ascending: true });
    if (error) {
      console.error(error);
      const box = $('flow-messages');
      if (box) box.textContent = 'تعذر تحميل الرسائل. تأكد أن الطلب مقبول وأن صلاحيات القراءة مضبوطة.';
      return;
    }
    messages = data || [];
    await paintMessages();
  }

  async function paintMessages() {
    const box = $('flow-messages');
    if (!box) return;
    if (!messages.length) {
      box.innerHTML = '<div class="flow-founder-muted">المحادثة بدأت — ابعت أول رسالة.</div>';
      return;
    }
    const rendered = [];
    for (const message of messages) {
      let content = esc(message.body).replace(/\n/g, '<br>');
      if (message.attachment_path) {
        const { data, error } = await db.storage.from('founder-chat').createSignedUrl(message.attachment_path, 3600);
        const url = data?.signedUrl;
        if (!error && url) {
          const safeUrl = esc(url);
          const type = message.attachment_type || '';
          if (type.startsWith('image/')) content += `<br><a href="${safeUrl}" target="_blank" rel="noopener noreferrer"><img src="${safeUrl}" alt="مرفق" loading="lazy"></a>`;
          else if (type.startsWith('video/')) content += `<br><video controls preload="metadata" src="${safeUrl}"></video>`;
          else if (type.startsWith('audio/')) content += `<br><audio controls preload="metadata" src="${safeUrl}"></audio>`;
          else content += `<br><a href="${safeUrl}" target="_blank" rel="noopener noreferrer" download>📎 ${esc(message.attachment_name || 'تحميل الملف')}</a>`;
        } else {
          content += '<br><span class="flow-founder-muted">تعذر فتح المرفق أو انتهت صلاحيته.</span>';
        }
      }
      rendered.push(`<div class="flow-founder-msg ${message.sender_id === me ? 'mine' : ''}">${content}<small>${new Date(message.created_at).toLocaleString('ar-EG')}</small></div>`);
    }
    box.innerHTML = rendered.join('');
    box.scrollTop = box.scrollHeight;
  }

  async function sendMessage(file = null) {
    const textInput = $('flow-text');
    const sendButton = $('flow-send');
    if (!textInput || !sendButton || !currentRequest) return;
    const body = textInput.value.trim();
    if (!body && !file) return;
    sendButton.disabled = true;
    try {
      let attachmentPath = null;
      let attachmentName = null;
      let attachmentType = null;
      if (file) {
        if (file.size > 50 * 1024 * 1024) throw new Error('الحد الأقصى لحجم الملف 50MB.');
        attachmentName = file.name || 'voice-message.webm';
        attachmentType = file.type || 'application/octet-stream';
        const safeName = attachmentName.replace(/[^\w.\-\u0600-\u06FF]/g, '_');
        attachmentPath = `${currentRequest.id}/${me}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await db.storage.from('founder-chat').upload(attachmentPath, file, {
          contentType: attachmentType,
          upsert: false
        });
        if (uploadError) throw uploadError;
      }
      const { data, error } = await db.from('founder_chat_messages').insert({
        request_id: currentRequest.id,
        sender_id: me,
        body,
        attachment_path: attachmentPath,
        attachment_name: attachmentName,
        attachment_type: attachmentType
      }).select().single();
      if (error) throw error;
      if (!messages.some((item) => item.id === data.id)) messages.push(data);
      textInput.value = '';
      const fileInput = $('flow-file-input');
      if (fileInput) fileInput.value = '';
      await paintMessages();
    } catch (error) {
      console.error(error);
      alert(error.message || 'تعذر إرسال الرسالة.');
    } finally {
      sendButton.disabled = false;
    }
  }

  async function toggleRecording() {
    const button = $('flow-record');
    if (!button) return;
    if (mediaRecorder?.state === 'recording') {
      mediaRecorder.stop();
      button.textContent = '🎙';
      $('flow-record-state').textContent = 'جاري تجهيز التسجيل...';
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      alert('تسجيل الصوت غير مدعوم في المتصفح ده. استخدم HTTPS أو اختار ملف صوتي.');
      return;
    }
    try {
      recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingChunks = [];
      const preferredMime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported?.(type));
      mediaRecorder = new MediaRecorder(recordingStream, preferredMime ? { mimeType: preferredMime } : undefined);
      mediaRecorder.addEventListener('dataavailable', (event) => { if (event.data.size) recordingChunks.push(event.data); });
      mediaRecorder.addEventListener('stop', async () => {
        recordingStream?.getTracks().forEach((track) => track.stop());
        recordingStream = null;
        const blob = new Blob(recordingChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
        const extension = blob.type.includes('mp4') ? 'm4a' : 'webm';
        const voiceFile = new File([blob], `voice-${Date.now()}.${extension}`, { type: blob.type });
        $('flow-record-state').textContent = 'إرسال الرسالة الصوتية...';
        await sendMessage(voiceFile);
        if ($('flow-record-state')) $('flow-record-state').textContent = 'انتهى التسجيل.';
      }, { once: true });
      mediaRecorder.start();
      button.textContent = '■';
      $('flow-record-state').textContent = 'التسجيل شغال — اضغط ■ للإيقاف والإرسال.';
    } catch (error) {
      console.error(error);
      recordingStream?.getTracks().forEach((track) => track.stop());
      recordingStream = null;
      alert('اسمح باستخدام الميكروفون من المتصفح أولاً.');
    }
  }

  function subscribe() {
    if (channel) db.removeChannel(channel);
    channel = db.channel(`flow-founder-${me}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'founder_chat_requests' }, async (payload) => {
        const row = payload.new || payload.old;
        if (!row || (row.requester_id !== me && row.founder_id !== founder.id)) return;
        if (isFounder) {
          await renderAdminInbox();
          if ($('flow-founder-modal') && !$('flow-founder-modal').hidden && adminView === 'inbox') await renderAdminInbox(true);
        } else if (row.requester_id === me && $('flow-founder-modal') && !$('flow-founder-modal').hidden) {
          await renderUserView();
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'founder_chat_messages' }, async (payload) => {
        if (!currentRequest || payload.new.request_id !== currentRequest.id) return;
        if (!messages.some((item) => item.id === payload.new.id)) {
          messages.push(payload.new);
          await paintMessages();
        }
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') console.warn('FLOW Founder realtime connection:', status);
      });
  }

  init();
})();
