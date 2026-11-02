/* Add after supabase/config scripts on dashboard.html and admin.html. */
(() => {
  const db = window.supabaseClient;
  if (!db) return console.error('FLOW Founder: supabaseClient is missing');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const $ = id => document.getElementById(id);
  let me = null, profile = null, founder = null, request = null, requests = [], messages = [], channel = null, mediaRecorder = null, chunks = [];
  const verified = '<span class="flow-verified"><svg viewBox="0 0 16 16"><path d="m3 8 3 3 7-7"/></svg> VERIFIED</span>';

  async function init(){
    const {data:{user}} = await db.auth.getUser(); if(!user) return;
    me = user.id;
    const {data:p,error} = await db.from('profiles').select('id,display_name,role,friend_code').eq('id',me).single();
    if(error || !p) return console.error('FLOW Founder: profile lookup failed',error);
    profile = p;
    const {data:f,error:fe} = await db.rpc('get_flow_founder');
    if(fe || !f?.length) { console.warn('FLOW Founder account YM00 was not found. Run founder_chat.sql and verify the admin profile.'); return; }
    founder = f[0];
    mount();
    if(profile.role === 'admin') await loadRequests();
    subscribe();
  }

  function mount(){
    const header = document.querySelector('.header-actions') || document.querySelector('header');
    if(!header) return;
    const btn=document.createElement('button'); btn.type='button'; btn.className='flow-founder-btn';
    btn.textContent=profile.role==='admin'?'Founder Inbox':'تواصل مع المؤسس'; btn.onclick=openModal; header.appendChild(btn);
    const modal=document.createElement('div'); modal.className='flow-founder-modal'; modal.id='flow-founder-modal'; modal.hidden=true;
    modal.innerHTML=`<section class="flow-founder-panel" role="dialog" aria-modal="true" aria-label="محادثة FLOW Founder">
      <header class="flow-founder-top"><div class="avatar">F</div><div><div class="flow-founder-title">FLOW Founder ${verified}</div><div class="flow-founder-id">YM00 · Platform Founder</div></div><button class="flow-founder-close" id="flow-founder-close">×</button></header>
      <div class="flow-founder-content" id="flow-founder-content"></div></section>`;
    document.body.appendChild(modal);
    $('flow-founder-close').onclick=closeModal; modal.addEventListener('click',e=>{if(e.target===modal)closeModal()});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
  }
  function openModal(){ $('flow-founder-modal').hidden=false; profile.role==='admin'?renderAdmin():renderUser(); }
  function closeModal(){ if($('flow-founder-modal')) $('flow-founder-modal').hidden=true; }

  async function getMyRequest(){
    const {data,error}=await db.from('founder_chat_requests').select('*').eq('requester_id',me).eq('founder_id',founder.id).maybeSingle();
    if(error) throw error; return data;
  }
  async function renderUser(){
    const el=$('flow-founder-content'); el.innerHTML='<div class="flow-founder-status">جاري التحقق من حالة طلب المحادثة...</div>';
    try{request=await getMyRequest();}catch(e){el.innerHTML='<div class="flow-founder-status">تعذر تحميل حالة المحادثة. تأكد من تشغيل ملف SQL وضبط صلاحيات Supabase.</div>';return;}
    if(!request || request.status==='rejected'){
      el.innerHTML=`<div class="flow-founder-card"><b>التواصل مع FLOW Founder ${verified}</b><p class="flow-founder-muted">ابعت طلب محادثة. مش هتقدر تبعت رسائل أو ملفات إلا بعد موافقة المؤسس.</p><button class="flow-founder-action" id="flow-request">إرسال طلب محادثة</button></div>`;
      $('flow-request').onclick=sendRequest; return;
    }
    if(request.status==='pending'){
      el.innerHTML='<div class="flow-founder-status">طلبك وصل للمؤسس وهو قيد المراجعة. المحادثة هتفتح بعد الموافقة.</div>'; return;
    }
    await renderConversation();
  }
  async function sendRequest(){
    const b=$('flow-request'); b.disabled=true; b.textContent='جاري الإرسال...';
    try{
      if(request?.status==='rejected') await db.from('founder_chat_requests').delete().eq('id',request.id);
      const {data,error}=await db.from('founder_chat_requests').insert({requester_id:me,founder_id:founder.id,status:'pending'}).select().single();
      if(error) throw error; request=data; renderUser();
    }catch(e){console.error(e);b.disabled=false;b.textContent='حصل خطأ — حاول تاني';}
  }
  async function loadRequests(){
    const {data,error}=await db.from('founder_chat_requests').select('*').eq('founder_id',me).order('created_at',{ascending:false});
    if(error){console.error(error);return;} requests=data||[];
  }
  async function renderAdmin(){
    await loadRequests(); const el=$('flow-founder-content');
    const pending=requests.filter(r=>r.status==='pending'); const accepted=requests.filter(r=>r.status==='accepted');
    el.innerHTML=`<div class="flow-founder-card"><b>طلبات المحادثة</b><p class="flow-founder-muted">لا يستطيع أي مستخدم مراسلتك قبل قبول طلبه.</p><div class="flow-founder-list" id="flow-pending">${pending.length?pending.map(r=>`<div class="flow-founder-request"><span>${esc('مستخدم · '+r.requester_id.slice(0,8))} <small class="flow-founder-muted">${new Date(r.created_at).toLocaleString('ar-EG')}</small></span><span class="flow-founder-row"><button class="flow-founder-action" data-accept="${r.id}">قبول</button><button class="flow-founder-action danger" data-reject="${r.id}">رفض</button></span></div>`).join(''):'<span class="flow-founder-muted">لا توجد طلبات جديدة.</span>'}</div></div>
      <div class="flow-founder-card"><b>المحادثات المقبولة</b><div class="flow-founder-list" id="flow-accepted">${accepted.length?accepted.map(r=>`<button class="flow-founder-action secondary" data-open="${r.id}">${esc('مستخدم · '+r.requester_id.slice(0,8))} · فتح المحادثة</button>`).join(''):'<span class="flow-founder-muted">لسه مفيش محادثات مقبولة.</span>'}</div></div>`;
    el.querySelectorAll('[data-accept]').forEach(b=>b.onclick=()=>decide(b.dataset.accept,'accepted'));
    el.querySelectorAll('[data-reject]').forEach(b=>b.onclick=()=>decide(b.dataset.reject,'rejected'));
    el.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{request=requests.find(r=>r.id===b.dataset.open);renderConversation(true)});
  }
  async function decide(id,status){
    const {error}=await db.from('founder_chat_requests').update({status,updated_at:new Date().toISOString()}).eq('id',id);
    if(error){alert('تعذر تحديث الطلب.');console.error(error);return;} await renderAdmin();
  }
  async function renderConversation(isAdmin=false){
    const el=$('flow-founder-content');
    el.innerHTML=`<div class="flow-founder-row"><b>محادثة ${isAdmin?esc(request.requester?.display_name||'المستخدم'):'FLOW Founder'}</b><span class="flow-founder-muted">${isAdmin?'':'YM00 · Verified'}</span></div><div class="flow-founder-chat" id="flow-messages">جاري تحميل الرسائل...</div><div class="flow-founder-compose"><button class="flow-founder-icon" id="flow-file" title="إرفاق ملف">＋</button><input type="file" id="flow-file-input" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"><button class="flow-founder-icon" id="flow-record" title="تسجيل رسالة صوتية">🎙</button><textarea id="flow-text" placeholder="اكتب رسالتك..."></textarea><button class="flow-founder-action" id="flow-send">إرسال</button></div><div class="flow-founder-muted" id="flow-record-state">تقدر تبعت نص أو صورة أو فيديو أو ملف، وتسجل رسالة صوتية.</div>`;
    $('flow-file').onclick=()=>$('flow-file-input').click(); $('flow-send').onclick=sendMessage;
    $('flow-text').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage()}});
    $('flow-file-input').onchange=()=>{if($('flow-file-input').files[0])sendMessage($('flow-file-input').files[0]);};
    $('flow-record').onclick=toggleRecording;
    await loadMessages();
  }
  async function loadMessages(){
    const {data,error}=await db.from('founder_chat_messages').select('*').eq('request_id',request.id).order('created_at');
    if(error){console.error(error);$('flow-messages').textContent='تعذر تحميل الرسائل.';return;}
    messages=data||[]; await paintMessages();
  }
  async function paintMessages(){
    const box=$('flow-messages'); if(!box)return;
    if(!messages.length){box.innerHTML='<div class="flow-founder-muted">المحادثة بدأت — ابعت أول رسالة.</div>';return;}
    const html=[];
    for(const m of messages){
      let content=esc(m.body);
      if(m.attachment_path){const {data}=await db.storage.from('founder-chat').createSignedUrl(m.attachment_path,3600);const url=data?.signedUrl;
        if(url){if((m.attachment_type||'').startsWith('image/'))content+=`<br><a href="${url}" target="_blank" rel="noopener"><img src="${url}" alt="مرفق" style="max-width:220px;max-height:190px;border-radius:10px"></a>`;
        else if((m.attachment_type||'').startsWith('video/'))content+=`<br><video controls src="${url}" style="max-width:240px"></video>`;
        else if((m.attachment_type||'').startsWith('audio/'))content+=`<br><audio controls src="${url}"></audio>`;
        else content+=`<br><a href="${url}" target="_blank" rel="noopener">📎 ${esc(m.attachment_name||'تحميل الملف')}</a>`;}}
      html.push(`<div class="flow-founder-msg ${m.sender_id===me?'mine':''}">${content}<small>${new Date(m.created_at).toLocaleString('ar-EG')}</small></div>`);
    }
    box.innerHTML=html.join('');box.scrollTop=box.scrollHeight;
  }
  async function sendMessage(file=null){
    const text=$('flow-text').value.trim(); if(!text&&!file)return;
    $('flow-send').disabled=true;
    try{
      let path=null,name=null,type=null;
      if(file){if(file.size>50*1024*1024)throw new Error('الحد الأقصى لحجم الملف 50MB');
        name=file.name||'voice-message.webm';type=file.type||'audio/webm';
        const safe=name.replace(/[^\w.\-\u0600-\u06FF]/g,'_');path=`${request.id}/${me}/${crypto.randomUUID()}-${safe}`;
        const {error:upErr}=await db.storage.from('founder-chat').upload(path,file,{contentType:type,upsert:false});if(upErr)throw upErr;
      }
      const {data,error}=await db.from('founder_chat_messages').insert({request_id:request.id,sender_id:me,body:text,attachment_path:path,attachment_name:name,attachment_type:type}).select().single();
      if(error)throw error;messages.push(data);$('flow-text').value='';$('flow-file-input').value='';await paintMessages();
    }catch(e){console.error(e);alert(e.message||'تعذر إرسال الرسالة.');}
    finally{$('flow-send').disabled=false;}
  }
  async function toggleRecording(){
    const btn=$('flow-record');
    if(mediaRecorder?.state==='recording'){mediaRecorder.stop();btn.textContent='🎙';$('flow-record-state').textContent='جاري تجهيز التسجيل...';return;}
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){alert('تسجيل الصوت غير مدعوم في المتصفح ده. استخدم HTTPS أو اختار ملف صوتي.');return;}
    try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});chunks=[];mediaRecorder=new MediaRecorder(stream);
      mediaRecorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
      mediaRecorder.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());const blob=new Blob(chunks,{type:mediaRecorder.mimeType||'audio/webm'});const file=new File([blob],`voice-${Date.now()}.webm`,{type:blob.type});$('flow-record-state').textContent='إرسال الرسالة الصوتية...';await sendMessage(file);$('flow-record-state').textContent='تم إرسال التسجيل أو راجع رسالة الخطأ.';};
      mediaRecorder.start();btn.textContent='■';$('flow-record-state').textContent='التسجيل شغال — اضغط ■ للإيقاف والإرسال.';
    }catch(e){console.error(e);alert('اسمح باستخدام الميكروفون من المتصفح أولاً.');}
  }
  function subscribe(){
    channel=db.channel('flow-founder-'+me)
      .on('postgres_changes',{event:'*',schema:'public',table:'founder_chat_requests'},async payload=>{
        const r=payload.new||payload.old;if(r.requester_id!==me&&r.founder_id!==me)return;
        if(profile.role==='admin'&&$('flow-founder-modal')&&!$('flow-founder-modal').hidden)renderAdmin();
        else if(r.requester_id===me&&$('flow-founder-modal')&&!$('flow-founder-modal').hidden)renderUser();
      })
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'founder_chat_messages'},async payload=>{
        if(request&&payload.new.request_id===request.id){messages.push(payload.new);paintMessages();}
      }).subscribe();
  }
  init();
})();
