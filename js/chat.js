// =========================================================
// CHAT — ID لكل شخص، إضافة صحاب، ورسائل لحظية (Supabase Realtime)
// يحتاج تشغيل supabase/migration_chat.sql مرة واحدة.
// =========================================================
(() => {
    const $ = id => document.getElementById(id);
    const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const initial = n => esc((String(n || "?").trim()[0] || "?").toUpperCase());
    const timeOf = d => new Date(d).toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit" });
    const dayKey = d => new Date(d).toLocaleDateString("sv-SE");
    const dayLabel = d => {
        const k = dayKey(d), t = dayKey(new Date()), y = dayKey(new Date(Date.now() - 864e5));
        return k === t ? "النهاردة" : k === y ? "امبارح" : new Date(d).toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" });
    };
    const rpc = async (fn, args) => {
        const { data, error } = await supabaseClient.rpc(fn, args);
        if (error) throw error;
        return data;
    };

    let me = null, myCode = "", friends = [], active = null, msgs = [], built = false, channel = null, found = null;

    // ---------- UI ----------
    function build() {
        if (built) return;
        built = true;
        const root = document.createElement("div");
        root.id = "chat-overlay";
        root.className = "chat-overlay";
        root.hidden = true;
        root.innerHTML = `
        <div class="chat-shell" id="chat-shell" role="dialog" aria-modal="true" aria-label="الرسائل">
            <aside class="chat-side">
                <div class="chat-side-head">
                    <div><span class="eyebrow">MESSAGES</span><h2>الرسائل</h2></div>
                    <button type="button" class="chat-x" id="chat-close" aria-label="إغلاق">×</button>
                </div>
                <div class="chat-id-card">
                    <div><small>الـ ID بتاعك</small><strong id="chat-my-code">········</strong></div>
                    <button type="button" class="chat-copy" id="chat-copy">نسخ</button>
                </div>
                <div class="chat-add">
                    <div class="chat-add-row">
                        <input id="chat-code" maxlength="8" placeholder="ID صاحبك" autocomplete="off" spellcheck="false">
                        <button type="button" class="primary-btn" id="chat-search">بحث</button>
                    </div>
                    <div id="chat-found"></div>
                </div>
                <div class="chat-list" id="chat-list"></div>
            </aside>
            <section class="chat-main">
                <div class="chat-main-head" id="chat-head" hidden>
                    <button type="button" class="chat-back" id="chat-back" aria-label="رجوع">→</button>
                    <div class="chat-avatar" id="chat-head-av"></div>
                    <div class="chat-name"><b id="chat-head-name"></b><span id="chat-head-sub"></span></div>
                </div>
                <div class="chat-stream" id="chat-stream"></div>
                <form class="chat-compose" id="chat-form" hidden>
                    <textarea id="chat-input" rows="1" maxlength="2000" placeholder="اكتب رسالة..." aria-label="رسالة"></textarea>
                    <button type="submit" class="primary-btn chat-send" aria-label="إرسال">➤</button>
                </form>
            </section>
        </div>`;
        document.body.appendChild(root);

        $("chat-close").onclick = close;
        root.addEventListener("mousedown", e => { if (e.target === root) close(); });
        document.addEventListener("keydown", e => { if (e.key === "Escape" && !root.hidden) close(); });
        $("chat-back").onclick = () => { $("chat-shell").classList.remove("is-conv"); active = null; renderFriends(); };
        $("chat-copy").onclick = async () => {
            try { await navigator.clipboard.writeText(myCode); $("chat-copy").textContent = "تم ✓"; }
            catch { $("chat-copy").textContent = myCode; }
            setTimeout(() => ($("chat-copy").textContent = "نسخ"), 1600);
        };
        $("chat-search").onclick = search;
        $("chat-code").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); search(); } });
        $("chat-form").addEventListener("submit", e => { e.preventDefault(); send(); });
        const input = $("chat-input");
        input.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } });
        input.addEventListener("input", () => { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 140) + "px"; });
        $("chat-list").addEventListener("click", e => {
            const b = e.target.closest("[data-fid]");
            if (b) openConv(friends.find(f => f.id === b.dataset.fid));
        });
        $("chat-found").addEventListener("click", e => { if (e.target.closest("[data-add]")) addFriend(); });
    }

    let closing = null;
    function open() {
        build();
        clearTimeout(closing);
        const o = $("chat-overlay");
        o.classList.remove("is-closing");
        $("chat-my-code").textContent = myCode || "········";
        renderFriends();
        renderStream();
        document.body.classList.add("modal-open");
        o.hidden = false;
        setTimeout(loadFriends, 380);
    }

    function close() {
        const o = $("chat-overlay");
        if (o.hidden) return;
        o.classList.add("is-closing");
        closing = setTimeout(() => {
            o.hidden = true;
            o.classList.remove("is-closing");
            document.body.classList.remove("modal-open");
        }, 180);
    }

    // ---------- data ----------
    async function loadFriends() {
        try {
            friends = (await rpc("get_my_friends")) || [];
            if (!myCode) {
                myCode = (await rpc("my_friend_code")) || "";
                if (built) $("chat-my-code").textContent = myCode;
            }
            if (active) active = friends.find(f => f.id === active.id) || active;
        } catch (err) {
            console.error(err);
            if (built) $("chat-list").innerHTML = `<div class="chat-empty">تعذّر تحميل الرسائل. اتأكد إنك شغّلت ملف migration_chat.sql في Supabase.</div>`;
            return;
        }
        updateBadge();
        if (built) renderFriends();
    }

    function updateBadge() {
        const n = friends.reduce((s, f) => s + (f.unread || 0), 0);
        const b = $("chat-badge");
        if (b) {
            b.textContent = n > 99 ? "99+" : n;
            b.hidden = !n;
        }
    }

    function renderFriends() {
        const list = $("chat-list");
        if (!list) return;

        list.innerHTML = friends.length ? friends.map(f => `
            <button type="button" class="chat-item ${active && active.id === f.id ? "is-active" : ""}" data-fid="${esc(f.id)}">
                <span class="chat-avatar">${initial(f.display_name || f.username)}</span>
                <span class="chat-name" style="flex:1">
                    <b>${esc(f.display_name || f.username)}</b>
                    <span>${f.last_body ? (f.last_from_me ? "أنت: " : "") + esc(f.last_body) : "ابدأ المحادثة"}</span>
                </span>
                <span class="chat-item-meta">
                    ${f.last_at ? timeOf(f.last_at) : ""}
                    ${f.unread ? `<span class="chat-badge" style="margin:0">${f.unread}</span>` : ""}
                </span>
            </button>`).join("")
            : `<div class="chat-empty">لسه مفيش صحاب.<br>اكتب الـ ID بتاع صاحبك فوق واضغط «بحث».</div>`;
    }

    // ---------- add friend ----------
    async function search() {
        const code = $("chat-code").value.trim().toUpperCase();
        const out = $("chat-found");
        found = null;

        if (code.length < 4) {
            out.innerHTML = `<p class="chat-msg-line">اكتب الـ ID كامل.</p>`;
            return;
        }

        out.innerHTML = `<p class="chat-msg-line is-ok">جاري البحث...</p>`;

        try {
            const rows = await rpc("search_user_by_code", { p_code: code });

            if (!rows || !rows.length) {
                out.innerHTML = `<p class="chat-msg-line">مفيش حد بالـ ID ده.</p>`;
                return;
            }

            found = rows[0];
            const already = friends.some(f => f.id === found.id);

            out.innerHTML = `
                <div class="chat-found">
                    <span class="chat-avatar">${initial(found.display_name || found.username)}</span>
                    <span class="chat-name">
                        <b>${esc(found.display_name || found.username)}</b>
                        <span>@${esc(found.username)}</span>
                    </span>
                    ${already
                        ? `<span class="chat-msg-line is-ok">صاحبك بالفعل</span>`
                        : `<button type="button" class="primary-btn" data-add>إضافة</button>`}
                </div>`;
        } catch (err) {
            console.error(err);
            out.innerHTML = `<p class="chat-msg-line">حصل خطأ في البحث.</p>`;
        }
    }

    async function addFriend() {
        if (!found) return;

        try {
            const id = await rpc("add_friend_by_code", { p_code: found.friend_code });
            $("chat-code").value = "";
            $("chat-found").innerHTML = `<p class="chat-msg-line is-ok">تمت الإضافة ✓</p>`;

            await loadFriends();
            openConv(friends.find(f => f.id === id));

            setTimeout(() => {
                const el = $("chat-found");
                if (el) el.innerHTML = "";
            }, 2000);
        } catch (err) {
            console.error(err);
            $("chat-found").innerHTML = `<p class="chat-msg-line">مقدرناش نضيفه. جرّب تاني.</p>`;
        }
    }

    // ---------- conversation ----------
    async function openConv(f) {
        if (!f) return;

        active = f;
        msgs = [];

        $("chat-shell").classList.add("is-conv");
        $("chat-head").hidden = false;
        $("chat-form").hidden = false;

        $("chat-head-av").textContent = (String(f.display_name || f.username || "?").trim()[0] || "?").toUpperCase();
        $("chat-head-name").textContent = f.display_name || f.username;
        $("chat-head-sub").textContent = "@" + f.username;

        renderFriends();
        $("chat-stream").innerHTML = `<div class="chat-placeholder">جاري تحميل الرسائل...</div>`;

        const fid = f.id;

        const { data, error } = await supabaseClient.from("messages").select("*")
            .or(`and(sender_id.eq.${me},receiver_id.eq.${fid}),and(sender_id.eq.${fid},receiver_id.eq.${me})`)
            .order("created_at", { ascending: true }).limit(300);

        if (!active || active.id !== fid) return;

        if (error) {
            console.error(error);
            $("chat-stream").innerHTML = `<div class="chat-placeholder">تعذّر تحميل الرسائل.</div>`;
            return;
        }

        msgs = data || [];
        renderStream();
        markRead(fid);

        if (window.matchMedia("(min-width:761px)").matches) {
            $("chat-input").focus();
        }
    }

    function renderStream(animateLast = false) {
        const box = $("chat-stream");
        if (!box) return;

        if (!active) {
            $("chat-head").hidden = true;
            $("chat-form").hidden = true;
            box.innerHTML = `
                <div class="chat-placeholder">
                    <strong>رسائلك هنا</strong>
                    اختار صاحب من القايمة أو ضيف واحد جديد بالـ ID بتاعه.
                </div>`;
            return;
        }

        if (!msgs.length) {
            box.innerHTML = `
                <div class="chat-placeholder">
                    <strong>ابدأ المحادثة</strong>
                    ابعت أول رسالة لـ ${esc(active.display_name || active.username)}.
                </div>`;
            return;
        }

        let last = "", html = "";
        const lastMsg = msgs[msgs.length - 1];

        for (const m of msgs) {
            const k = dayKey(m.created_at);

            if (k !== last) {
                html += `<div class="chat-day">${dayLabel(m.created_at)}</div>`;
                last = k;
            }

            const mine = m.sender_id === me;
            const tick = mine
                ? (m._failed
                    ? "⚠"
                    : m._pending
                        ? "🕓"
                        : `<span class="chat-tick ${m.read_at ? "is-read" : ""}">${m.read_at ? "✓✓" : "✓"}</span>`)
                : "";

            html += `
                <div class="chat-bubble ${mine ? "mine" : "theirs"} ${m._failed ? "is-failed" : ""} ${animateLast && m === lastMsg ? "pop" : ""}">
                    ${esc(m.body)}
                    <time>${timeOf(m.created_at)} ${tick}</time>
                </div>`;
        }

        box.innerHTML = html;
        box.scrollTop = box.scrollHeight;
    }

    async function markRead(fid) {
        try {
            await rpc("mark_read", { p_friend: fid });
        } catch (e) {
            console.error(e);
        }

        const f = friends.find(x => x.id === fid);
        if (f) {
            f.unread = 0;
            updateBadge();
            renderFriends();
        }
    }

    function touchFriend(fid, body, fromMe, at) {
        const f = friends.find(x => x.id === fid);
        if (!f) return false;

        f.last_body = body;
        f.last_from_me = fromMe;
        f.last_at = at;

        friends.sort((a, b) => new Date(b.last_at || 0) - new Date(a.last_at || 0));
        return true;
    }

    async function send() {
        const input = $("chat-input");
        const body = input.value.trim();

        if (!body || !active) return;

        const fid = active.id;

        input.value = "";
        input.style.height = "auto";

        const tmp = {
            id: "t" + Date.now(),
            sender_id: me,
            receiver_id: fid,
            body,
            created_at: new Date().toISOString(),
            read_at: null,
            _pending: true
        };

        msgs.push(tmp);
        touchFriend(fid, body, true, tmp.created_at);

        renderStream(true);
        renderFriends();

        const { data, error } = await supabaseClient.from("messages")
            .insert({ receiver_id: fid, body })
            .select()
            .single();

        const i = msgs.indexOf(tmp);

        if (error) {
            console.error(error);
            if (i > -1) {
                tmp._pending = false;
                tmp._failed = true;
            }
        } else {
            msgs = msgs.filter(m => m.id !== data.id);
            const j = msgs.indexOf(tmp);
            if (j > -1) msgs[j] = data;
        }

        if (active && active.id === fid) {
            renderStream();
        }
    }

    // ---------- realtime ----------
    function subscribe() {
        channel = supabaseClient.channel("chat-" + me)
            .on("postgres_changes", {
                event: "INSERT",
                schema: "public",
                table: "messages"
            }, ({ new: m }) => {
                const mine = m.sender_id === me;

                if (!mine && m.receiver_id !== me) return;

                const fid = mine ? m.receiver_id : m.sender_id;

                if (!touchFriend(fid, m.body, mine, m.created_at)) {
                    loadFriends();
                    return;
                }

                const here = active && active.id === fid;

                if (here && !msgs.some(x => x.id === m.id)) {
                    if (!mine || !msgs.some(x => x._pending && x.body === m.body)) {
                        msgs.push(m);
                    }
                    renderStream(true);
                }

                if (!mine) {
                    const f = friends.find(x => x.id === fid);

                    if (here && !$("chat-overlay").hidden) {
                        markRead(fid);
                    } else if (f) {
                        f.unread = (f.unread || 0) + 1;
                    }
                }

                updateBadge();
                renderFriends();
            })
            .on("postgres_changes", {
                event: "UPDATE",
                schema: "public",
                table: "messages"
            }, ({ new: m }) => {
                const x = msgs.find(v => v.id === m.id);

                if (x && m.read_at) {
                    x.read_at = m.read_at;
                    renderStream();
                }
            })
            .on("postgres_changes", {
                event: "INSERT",
                schema: "public",
                table: "friendships",
                filter: `user_id=eq.${me}`
            }, () => loadFriends())
            .subscribe();
    }

    // ---------- init ----------
    async function init() {
        const btn = $("profile-btn");
        if (!btn) return;

        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return;

        me = user.id;

        // زر الرسائل الجديد
        btn.innerHTML = `
            <svg class="messages-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z"/>
                <path d="M8 12h.01M12 12h.01M16 12h.01"/>
            </svg>
            <span class="messages-label">الرسائل</span>
            <span class="chat-badge" id="chat-badge" hidden>0</span>
        `;

        btn.setAttribute("aria-label", "فتح الرسائل");
        btn.onclick = open;

        await loadFriends();
        subscribe();
    }

    init();
})();
