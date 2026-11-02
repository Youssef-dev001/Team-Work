
/* =========================================================
   ui.js — طبقة الواجهة المشتركة
   Toasts · Dialogs · Count-up · Progress bars · Stagger ·
   Skeletons · Loading buttons · Ripple · Confetti

   لازم يتحمّل قبل auth.js / admin.js / dashboard.js / public.js
========================================================= */

(function () {
    "use strict";

    const reduceMotion =
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const wait = (ms) =>
        new Promise((resolve) => setTimeout(resolve, reduceMotion ? 0 : ms));


    /* ---------------------------------------------------------
       Helpers
    --------------------------------------------------------- */

    function escapeHTML(value = "") {
        return String(value).replace(/[&<>"']/g, (char) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]);
    }


    /**
     * نسبة الإنجاز بالأوزان — مصدر واحد للحساب
     * (عشان الأدمن والعضو والصفحة العامة يطلعوا نفس الرقم).
     */
    function calcProgress(tasks) {
        if (!Array.isArray(tasks) || !tasks.length) return 0;

        let total = 0;
        let done = 0;

        for (const task of tasks) {
            const weight = Number(task.weight) > 0 ? Number(task.weight) : 1;
            total += weight;
            if (task.status === "completed") done += weight;
        }

        return total ? Math.round((done / total) * 100) : 0;
    }


    /* ---------------------------------------------------------
       Toasts
    --------------------------------------------------------- */

    const TOAST_ICONS = { success: "✓", error: "✕", warning: "!", info: "i" };

    function toastRoot() {
        let root = document.getElementById("toast-root");

        if (!root) {
            root = document.createElement("div");
            root.id = "toast-root";
            root.className = "toast-root";
            root.setAttribute("aria-live", "polite");
            document.body.appendChild(root);
        }

        return root;
    }

    function toast(message, type = "info", duration = 3800) {
        const root = toastRoot();
        const el = document.createElement("div");

        el.className = `toast toast-${type}`;
        el.setAttribute("role", type === "error" ? "alert" : "status");
        el.style.setProperty("--toast-duration", `${duration}ms`);

        const icon = document.createElement("span");
        icon.className = "toast-icon";
        icon.textContent = TOAST_ICONS[type] || TOAST_ICONS.info;

        const text = document.createElement("span");
        text.className = "toast-text";
        text.textContent = message;

        const bar = document.createElement("span");
        bar.className = "toast-bar";

        el.append(icon, text, bar);
        root.appendChild(el);

        while (root.children.length > 4) root.firstElementChild.remove();

        let timer;

        const close = async () => {
            clearTimeout(timer);
            if (!el.isConnected) return;
            el.classList.add("is-leaving");
            await wait(260);
            el.remove();
        };

        el.addEventListener("click", close);
        timer = setTimeout(close, duration);

        return close;
    }


    /* ---------------------------------------------------------
       Confirm dialog (بديل confirm() العادي)
    --------------------------------------------------------- */

    function confirmDialog({
        title = "تأكيد",
        message = "",
        confirmText = "تأكيد",
        cancelText = "إلغاء",
        danger = false
    } = {}) {
        return new Promise((resolve) => {
            const overlay = document.createElement("div");
            overlay.className = "ui-dialog-overlay";

            overlay.innerHTML = `
                <div class="ui-dialog" role="alertdialog" aria-modal="true">
                    <div class="ui-dialog-icon ${danger ? "is-danger" : ""}">
                        ${danger ? "!" : "?"}
                    </div>
                    <h3>${escapeHTML(title)}</h3>
                    <p>${escapeHTML(message)}</p>
                    <div class="ui-dialog-actions">
                        <button type="button" class="text-btn" data-result="cancel">
                            ${escapeHTML(cancelText)}
                        </button>
                        <button type="button" class="primary-btn ${danger ? "is-danger" : ""}" data-result="ok">
                            ${escapeHTML(confirmText)}
                        </button>
                    </div>
                </div>
            `;

            const previousFocus = document.activeElement;

            const finish = async (result) => {
                document.removeEventListener("keydown", onKey);
                overlay.classList.add("is-leaving");
                await wait(200);
                overlay.remove();
                previousFocus?.focus?.();
                resolve(result);
            };

            const onKey = (event) => {
                if (event.key === "Escape") finish(false);
            };

            overlay.addEventListener("click", (event) => {
                if (event.target === overlay) finish(false);

                const button = event.target.closest("[data-result]");
                if (button) finish(button.dataset.result === "ok");
            });

            document.addEventListener("keydown", onKey);
            document.body.appendChild(overlay);

            overlay.querySelector('[data-result="ok"]').focus();
        });
    }


    /* ---------------------------------------------------------
       Numbers & progress bars
    --------------------------------------------------------- */

    function countUp(el, target, { duration = 1000, suffix = "" } = {}) {
        if (!el) return;

        target = Number(target) || 0;

        const from = Number(el.dataset.value || 0);
        el.dataset.value = String(target);

        cancelAnimationFrame(el._raf);

        if (reduceMotion || from === target) {
            el.textContent = `${target}${suffix}`;
            return;
        }

        const start = performance.now();
        const ease = (t) => 1 - Math.pow(1 - t, 4);

        const tick = (now) => {
            const p = Math.min((now - start) / duration, 1);
            const value = Math.round(from + (target - from) * ease(p));

            el.textContent = `${value}${suffix}`;

            if (p < 1) el._raf = requestAnimationFrame(tick);
        };

        el._raf = requestAnimationFrame(tick);
    }


    /** أي عنصر عليه data-progress="70" بيتحرك من 0 لـ 70% */
    function animateBars(root = document) {
        const bars = root.querySelectorAll("[data-progress]");

        requestAnimationFrame(() =>
            requestAnimationFrame(() => {
                bars.forEach((bar) => {
                    const value = Math.max(
                        0,
                        Math.min(100, Number(bar.dataset.progress) || 0)
                    );

                    bar.style.width = `${value}%`;
                });
            })
        );
    }


    /* ---------------------------------------------------------
       Lists
    --------------------------------------------------------- */

    function stagger(container, selector = ":scope > *") {
        if (!container) return;

        container.querySelectorAll(selector).forEach((el, index) => {
            el.style.setProperty("--i", Math.min(index, 14));
            el.classList.add("anim-in");
        });
    }

    function skeleton(container, count = 3) {
        if (!container) return;

        container.innerHTML = Array.from({ length: count }, () => `
            <div class="skeleton-card" aria-hidden="true">
                <div class="skeleton skeleton-line w-40"></div>
                <div class="skeleton skeleton-line w-80"></div>
                <div class="skeleton skeleton-line w-60"></div>
            </div>
        `).join("");
    }


    /* ---------------------------------------------------------
       Buttons
    --------------------------------------------------------- */

    function setLoading(button, loading, label = "") {
        if (!button) return;

        if (loading) {
            if (button.dataset.label === undefined) {
                button.dataset.label = button.innerHTML;
            }

            button.disabled = true;
            button.classList.add("is-loading");
            button.innerHTML = `
                <span class="spinner" aria-hidden="true"></span>
                <span>${escapeHTML(label)}</span>
            `;
        } else {
            button.disabled = false;
            button.classList.remove("is-loading");

            if (button.dataset.label !== undefined) {
                button.innerHTML = button.dataset.label;
                delete button.dataset.label;
            }
        }
    }

    document.addEventListener("pointerdown", (event) => {
        const button = event.target.closest?.(
            ".primary-btn, .secondary-btn, .text-btn"
        );

        if (!button || button.disabled || reduceMotion) return;

        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const ripple = document.createElement("span");

        ripple.className = "ripple";
        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
        ripple.style.top = `${event.clientY - rect.top - size / 2}px`;

        button.appendChild(ripple);
        setTimeout(() => ripple.remove(), 650);
    });


    /* إضاءة بتتبع الماوس على الكروت */
    document.addEventListener(
        "pointermove",
        (event) => {
            const card = event.target.closest?.(
                ".stat-card, .task-card, .team-row"
            );

            if (!card) return;

            const rect = card.getBoundingClientRect();

            card.style.setProperty("--mx", `${event.clientX - rect.left}px`);
            card.style.setProperty("--my", `${event.clientY - rect.top}px`);
        },
        { passive: true }
    );


    /* ---------------------------------------------------------
       Modals & navigation
    --------------------------------------------------------- */

    async function closeAnimated(el, done) {
        if (!el) return;

        el.classList.add("is-closing");
        await wait(220);

        if (done) done();

        el.classList.remove("is-closing");
    }

    function navigate(url, { replace = false } = {}) {
        document.body.classList.add("page-leaving");

        setTimeout(
            () => (replace ? location.replace(url) : (location.href = url)),
            reduceMotion ? 0 : 260
        );
    }


    /* ---------------------------------------------------------
       Celebration
    --------------------------------------------------------- */

    function burst(x, y) {
        if (reduceMotion) return;

        const colors = ["#d7ff3f", "#ffffff", "#7cf5c8", "#ffd84d"];
        const count = 18;

        for (let i = 0; i < count; i++) {
            const piece = document.createElement("span");
            const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
            const distance = 60 + Math.random() * 70;

            piece.className = "confetti";
            piece.style.left = `${x}px`;
            piece.style.top = `${y}px`;
            piece.style.background = colors[i % colors.length];
            piece.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
            piece.style.setProperty("--dy", `${Math.sin(angle) * distance - 30}px`);
            piece.style.setProperty("--rot", `${Math.random() * 540 - 270}deg`);

            document.body.appendChild(piece);
            setTimeout(() => piece.remove(), 900);
        }
    }


    /* ---------------------------------------------------------
       Data formatting & safety
    --------------------------------------------------------- */

    /** يسمح بروابط http/https بس — يمنع javascript: وغيره */
    function safeUrl(value) {
        if (!value) return "";

        try {
            const url = new URL(String(value), location.href);
            return ["http:", "https:"].includes(url.protocol) ? url.href : "";
        } catch {
            return "";
        }
    }

    function formatDate(value) {
        if (!value) return "";

        const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);

        if (Number.isNaN(date.getTime())) return String(value);

        return date.toLocaleDateString("ar-EG", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        });
    }

    function formatTime(value) {
        return value ? String(value).slice(0, 5) : "";
    }

    function isOverdue(task) {
        if (!task || !task.due_date || task.status === "completed") return false;

        return (
            new Date(`${String(task.due_date).slice(0, 10)}T23:59:59`) <
            new Date()
        );
    }


    window.UI = {
        reduceMotion,
        wait,
        safeUrl,
        formatDate,
        formatTime,
        isOverdue,
        escapeHTML,
        calcProgress,
        toast,
        confirm: confirmDialog,
        countUp,
        animateBars,
        stagger,
        skeleton,
        setLoading,
        closeAnimated,
        navigate,
        burst
    };
})();



