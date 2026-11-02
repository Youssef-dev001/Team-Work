// =========================================================
// PERSONAL TASKS — مهام شخصية لكل مستخدم (جدول personal_tasks)
// =========================================================
(() => {
    const STATUS = { pending: "لم تبدأ", in_progress: "قيد التنفيذ", review: "قيد المراجعة", completed: "مكتملة" };
    const TYPES = { general: "مهمة عامة", lecture: "محاضرة", video: "مشاهدة فيديو", design: "تصميم",
        editing: "مونتاج", research: "بحث", assignment: "تكليف", meeting: "اجتماع" };

    const $ = id => document.getElementById(id);
    const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const opts = (map, sel) => Object.entries(map).map(([k, v]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${v}</option>`).join("");
    const videosOf = t => Array.isArray(t.video_urls) ? t.video_urls : [];
    const today = () => new Date().toLocaleDateString("sv-SE");
    const fmtDate = d => new Date(d + "T00:00:00").toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" });

    let uid = null, items = [], filter = "all", loaded = false;

    // ---------- tabs ----------
    function setupTabs() {
        document.querySelectorAll(".dash-tab").forEach(btn => btn.addEventListener("click", () => {
            const personal = btn.dataset.tab === "personal";
            document.querySelectorAll(".dash-tab").forEach(b => b.classList.toggle("is-active", b === btn));
            $("tab-team").hidden = personal;
            $("tab-personal").hidden = !personal;
            if (personal && !loaded) load();
        }));
    }

    // ---------- data ----------
    async function load() {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return;
        uid = user.id;
        const { data, error } = await supabaseClient.from("personal_tasks").select("*");
        if (error) {
            console.error(error);
            $("pt-list").innerHTML = `<div class="empty-state">تعذّر تحميل مهامك. اتأكد إنك شغّلت ملف migration_personal_tasks.sql في Supabase.</div>`;
            return;
        }
        loaded = true;
        items = data || [];
        render();
    }

    function sorted(list) {
        return [...list].sort((a, b) => {
            const ad = a.status === "completed", bd = b.status === "completed";
            if (ad !== bd) return ad ? 1 : -1;
            const ak = (a.due_date || "9999") + (a.due_time || ""), bk = (b.due_date || "9999") + (b.due_time || "");
            return ak < bk ? -1 : ak > bk ? 1 : 0;
        });
    }

    // ---------- render ----------
    function render() {
        $("pt-filters").innerHTML = [["all", "الكل"], ...Object.entries(STATUS)].map(([k, v]) => {
            const n = k === "all" ? items.length : items.filter(t => t.status === k).length;
            return `<button type="button" class="pt-chip ${filter === k ? "is-active" : ""}" data-filter="${k}">${v} · ${n}</button>`;
        }).join("");

        const list = sorted(filter === "all" ? items : items.filter(t => t.status === filter));
        $("pt-list").innerHTML = list.length ? list.map(card).join("")
            : `<div class="empty-state">${items.length ? "مفيش مهام بالحالة دي." : "لسه مضفتش أي مهمة شخصية. اضغط «مهمة جديدة» وابدأ."}</div>`;
    }

    function card(t) {
        const overdue = t.due_date && t.due_date < today() && t.status !== "completed";
        const vids = videosOf(t).length;
        return `<article class="task-card ${t.status === "completed" ? "is-done" : ""}" data-id="${t.id}">
            <div class="task-card-top">
                <span class="task-type">${esc(TYPES[t.task_type] || "مهمة")}</span>
                <span class="task-status status-${esc(t.status)}">${esc(STATUS[t.status] || "")}</span>
            </div>
            <h3>${esc(t.title)}</h3>
            <div class="pt-meta">
                ${t.due_date ? `<span class="${overdue ? "is-overdue" : ""}">📅 ${fmtDate(t.due_date)}${overdue ? " · متأخرة" : ""}</span>` : ""}
                ${t.due_time ? `<span>⏰ ${esc(t.due_time.slice(0, 5))}</span>` : ""}
                ${vids ? `<span>🎬 ${vids} فيديو</span>` : ""}
            </div>
            ${t.description ? `<p class="task-card-description">${esc(t.description)}</p>` : ""}
            <div class="task-card-actions pt-card-actions">
                <button type="button" class="primary-btn" data-act="view">عرض التفاصيل</button>
                <button type="button" class="secondary-btn" data-act="toggle">${t.status === "completed" ? "↺ إعادة فتح" : "✓ تم الإنجاز"}</button>
                <span class="pt-spacer"></span>
                <button type="button" class="text-btn" data-act="edit">تعديل</button>
                <button type="button" class="text-btn pt-danger" data-act="delete">حذف</button>
            </div>
        </article>`;
    }

    // ---------- modal ----------
    const modal = () => $("pt-modal");
    const body = () => $("pt-modal-body");
    function open(html) { body().innerHTML = html; modal().hidden = false; document.body.style.overflow = "hidden"; }
    function close() { modal().hidden = true; document.body.style.overflow = ""; }

    function viewTask(t) {
        const vids = videosOf(t);
        open(`<span class="eyebrow">${esc(TYPES[t.task_type] || "مهمة")}</span>
            <h2>${esc(t.title)}</h2>
            <div class="pt-meta">
                <span class="task-status status-${esc(t.status)}">${esc(STATUS[t.status])}</span>
                ${t.due_date ? `<span>📅 ${fmtDate(t.due_date)}</span>` : ""}
                ${t.due_time ? `<span>⏰ ${esc(t.due_time.slice(0, 5))}</span>` : ""}
            </div>
            ${t.description ? `<div class="detail-box"><strong>التفاصيل</strong><p class="pt-detail-desc">${esc(t.description)}</p></div>` : ""}
            ${vids.length ? `<div class="detail-box video-resources-box"><strong>الفيديوهات والمصادر <span class="resource-count">${vids.length}</span></strong>
                <div class="resource-link-list">${vids.map((u, i) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer" class="task-link"><span class="resource-play">▶</span><span>الفيديو ${i + 1}<small>فتح المصدر في تبويب جديد</small></span><span class="resource-arrow">↗</span></a>`).join("")}</div></div>` : ""}`);
    }

    const videoRow = (url = "") => `<div class="pt-video-row"><input type="url" name="video_urls" value="${esc(url)}" placeholder="https://youtube.com/watch?v=..." aria-label="رابط فيديو"><button type="button" data-rm aria-label="حذف الرابط">×</button></div>`;

    function formTask(t) {
        const c = t || { task_type: "general", status: "pending" };
        const vids = videosOf(c);
        open(`<form id="pt-form" class="pt-form" novalidate data-id="${c.id || ""}">
            <div><span class="eyebrow">${t ? "EDIT TASK" : "NEW TASK"}</span><h2>${t ? "تعديل المهمة" : "مهمة جديدة"}</h2></div>
            <label>عنوان المهمة<input name="title" required maxlength="120" value="${esc(c.title)}" placeholder="مثلاً: مراجعة محاضرة الفيزياء"></label>
            <div class="pt-row">
                <label>النوع<select name="task_type">${opts(TYPES, c.task_type)}</select></label>
                <label>الحالة<select name="status">${opts(STATUS, c.status)}</select></label>
            </div>
            <div class="pt-row">
                <label>تاريخ الموعد<input type="date" name="due_date" value="${esc(c.due_date)}"></label>
                <label>الساعة<input type="time" name="due_time" value="${esc((c.due_time || "").slice(0, 5))}"></label>
            </div>
            <label>التفاصيل<textarea name="description" rows="4" placeholder="اكتب أي ملاحظات أو خطوات...">${esc(c.description)}</textarea></label>
            <div>
                <div class="pt-videos-head">روابط الفيديوهات والمصادر</div>
                <div id="pt-videos">${(vids.length ? vids : [""]).map(videoRow).join("")}</div>
                <button type="button" class="pt-add-video" id="pt-add-video">＋ إضافة رابط فيديو</button>
            </div>
            <p class="pt-error" id="pt-error" hidden></p>
            <div class="pt-form-actions">
                <button type="submit" class="primary-btn">${t ? "حفظ التعديلات" : "إضافة المهمة"}</button>
                <button type="button" class="secondary-btn" data-close>إلغاء</button>
            </div>
        </form>`);
        body().querySelector("[name=title]").focus();
    }

    async function save(form) {
        const f = new FormData(form), err = $("pt-error"), btn = form.querySelector("[type=submit]");
        const title = String(f.get("title") || "").trim();
        const urls = [...new Set(f.getAll("video_urls").map(u => String(u).trim()).filter(Boolean))];
        const fail = m => { err.textContent = m; err.hidden = false; };
        if (!title) return fail("اكتب عنوان المهمة.");
        if (urls.some(u => !/^https?:\/\//i.test(u))) return fail("روابط الفيديو لازم تبدأ بـ https:// أو http://");

        const payload = {
            title, task_type: f.get("task_type"), status: f.get("status"),
            description: String(f.get("description") || "").trim() || null,
            due_date: f.get("due_date") || null, due_time: f.get("due_time") || null, video_urls: urls
        };
        const id = form.dataset.id;
        btn.disabled = true;
        const q = id ? supabaseClient.from("personal_tasks").update(payload).eq("id", id)
                     : supabaseClient.from("personal_tasks").insert({ ...payload, user_id: uid });
        const { data, error } = await q.select().single();
        btn.disabled = false;
        if (error) { console.error(error); return fail("حصلت مشكلة أثناء الحفظ، جرّب تاني."); }
        items = id ? items.map(t => String(t.id) === String(id) ? data : t) : [...items, data];
        close(); render();
    }

    async function toggle(t) {
        const status = t.status === "completed" ? "pending" : "completed";
        const { data, error } = await supabaseClient.from("personal_tasks").update({ status }).eq("id", t.id).select().single();
        if (error) return alert("تعذّر تحديث الحالة.");
        items = items.map(x => x.id === t.id ? data : x); render();
    }

    async function remove(t) {
        if (!confirm(`حذف «${t.title}» نهائياً؟`)) return;
        const { error } = await supabaseClient.from("personal_tasks").delete().eq("id", t.id);
        if (error) return alert("تعذّر الحذف.");
        items = items.filter(x => x.id !== t.id); render();
    }

    // ---------- events ----------
    function init() {
        if (!$("tab-personal")) return;
        setupTabs();
        $("pt-add").addEventListener("click", () => { if (uid || loaded) formTask(null); else load().then(() => formTask(null)); });
        $("pt-filters").addEventListener("click", e => {
            const b = e.target.closest("[data-filter]"); if (!b) return; filter = b.dataset.filter; render();
        });
        $("pt-list").addEventListener("click", e => {
            const b = e.target.closest("[data-act]"); if (!b) return;
            const t = items.find(x => String(x.id) === b.closest(".task-card").dataset.id); if (!t) return;
            ({ view: viewTask, edit: formTask, toggle, delete: remove })[b.dataset.act](t);
        });
        modal().addEventListener("click", e => {
            if (e.target.closest("[data-close]") || e.target.id === "pt-modal-overlay" || e.target.closest(".task-modal-close")) close();
            if (e.target.id === "pt-add-video") $("pt-videos").insertAdjacentHTML("beforeend", videoRow());
            const rm = e.target.closest("[data-rm]");
            if (rm) { const rows = $("pt-videos").children; rows.length > 1 ? rm.parentElement.remove() : (rm.parentElement.querySelector("input").value = ""); }
        });
        modal().addEventListener("submit", e => { e.preventDefault(); save(e.target); });
        document.addEventListener("keydown", e => { if (e.key === "Escape" && !modal().hidden) close(); });
    }
    document.addEventListener("DOMContentLoaded", init);
})();
