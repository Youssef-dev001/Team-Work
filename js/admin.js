const $ = (selector) => document.querySelector(selector);

/* =========================================================
   CONSTANTS
========================================================= */

const STATUS = {
    pending: "لم تبدأ",
    in_progress: "قيد التنفيذ",
    completed: "مكتملة",
    review: "قيد المراجعة"
};

const TASK_TYPES = {
    general: "مهمة عامة",
    lecture: "محاضرة",
    video: "مشاهدة فيديو",
    design: "تصميم",
    editing: "مونتاج",
    research: "بحث",
    assignment: "تكليف",
    meeting: "اجتماع"
};

const STORAGE_BUCKET = "task-files";

/* =========================================================
   GLOBAL DATA
========================================================= */

let members = [];
let weeks = [];
let tasks = [];
let modalRoot = null;


/* =========================================================
   HELPERS
========================================================= */

function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}


function showMessage(message) {
    alert(message);
}


function getMemberName(userId) {
    const member = members.find(
        (item) => item.id === userId
    );

    return member?.display_name || "عضو غير معروف";
}


function getWeekName(weekId) {
    const week = weeks.find(
        (item) => item.id === weekId
    );

    return week?.title || "أسبوع غير معروف";
}


/* =========================================================
   INITIALIZE
========================================================= */

async function initialize() {
    try {

        const {
            data: { user },
            error
        } = await supabaseClient.auth.getUser();

        if (error || !user) {
            location.replace("login.html");
            return;
        }


        const {
            data: profile,
            error: profileError
        } = await supabaseClient
            .from("profiles")
            .select("id, username, display_name, role")
            .eq("id", user.id)
            .single();


        if (
            profileError ||
            !profile ||
            profile.role !== "admin"
        ) {
            await supabaseClient.auth.signOut();
            location.replace("login.html");
            return;
        }


        setupInterface();

        await loadDashboard();

    } catch (error) {

        console.error(
            "Initialization error:",
            error
        );

        showMessage(
            "حصل خطأ أثناء تشغيل لوحة التحكم."
        );
    }
}


/* =========================================================
   SETUP INTERFACE
========================================================= */

function setupInterface() {

    /* -----------------------------------------------------
       WEEKS SECTION
    ----------------------------------------------------- */

    const tasksSection =
        $("#admin-tasks")?.closest(".admin-section");


    if (
        tasksSection &&
        !$("#admin-weeks")
    ) {

        const section =
            document.createElement("section");

        section.className = "admin-section";
        section.id = "admin-weeks";

        section.innerHTML = `
            <div class="section-heading">

                <div>
                    <span class="eyebrow">
                        SCHEDULE
                    </span>

                    <h2>
                        الأسابيع
                    </h2>
                </div>

                <button
                    id="add-week-btn"
                    class="primary-btn"
                    type="button"
                >
                    + أسبوع جديد
                </button>

            </div>

            <div
                id="weeks-list"
                class="tasks-list"
            ></div>
        `;

        tasksSection.before(section);
    }


    /* -----------------------------------------------------
       MODAL
    ----------------------------------------------------- */

    if (!modalRoot) {

        modalRoot =
            document.createElement("div");

        modalRoot.id = "admin-modal";
        modalRoot.hidden = true;

        Object.assign(
            modalRoot.style,
            {
                position: "fixed",
                inset: "0",
                zIndex: "9999",
                background: "rgba(0,0,0,.8)",
                display: "none",
                alignItems: "center",
                justifyContent: "center",
                padding: "20px",
                overflowY: "auto"
            }
        );

        document.body.appendChild(
            modalRoot
        );
    }


    /* -----------------------------------------------------
       BUTTONS
    ----------------------------------------------------- */

    $("#add-week-btn")?.addEventListener(
        "click",
        () => openWeekForm()
    );


    $("#add-task-btn")?.addEventListener(
        "click",
        () => openTaskForm()
    );


    /* -----------------------------------------------------
       GLOBAL ACTIONS
    ----------------------------------------------------- */

    document.body.addEventListener(
        "click",
        handleActions
    );


    /* -----------------------------------------------------
       LOGOUT
    ----------------------------------------------------- */

    $("#logout-btn")?.addEventListener(
        "click",
        async () => {

            await supabaseClient.auth.signOut();

            location.replace("login.html");
        }
    );
}


/* =========================================================
   LOAD DASHBOARD
========================================================= */

async function loadDashboard() {

    try {

        const [
            membersResult,
            weeksResult,
            tasksResult
        ] = await Promise.all([

            supabaseClient
                .from("profiles")
                .select(
                    "id, username, display_name, role"
                )
                .eq("role", "member")
                .order("display_name"),

            supabaseClient
                .from("weeks")
                .select("*")
                .order(
                    "start_date",
                    {
                        ascending: false
                    }
                ),

            supabaseClient
                .from("tasks")
                .select("*")
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                )
        ]);


        if (membersResult.error) {
            throw membersResult.error;
        }

        if (weeksResult.error) {
            throw weeksResult.error;
        }

        if (tasksResult.error) {
            throw tasksResult.error;
        }


        members =
            membersResult.data || [];

        weeks =
            weeksResult.data || [];

        tasks =
            tasksResult.data || [];


        renderMembers();
        renderWeeks();
        renderTasks();
        renderStats();

    } catch (error) {

        console.error(
            "Dashboard loading error:",
            error
        );

        showMessage(
            "حصل خطأ أثناء تحميل البيانات."
        );
    }
}


/* =========================================================
   STATS
========================================================= */

function renderStats() {

    const completed =
        tasks.filter(
            (task) =>
                task.status === "completed"
        ).length;


    const progressValues =
        members.map((member) => {

            const memberTasks =
                tasks.filter(
                    (task) =>
                        task.user_id === member.id
                );


            if (!memberTasks.length) {
                return 0;
            }


            const memberCompleted =
                memberTasks.filter(
                    (task) =>
                        task.status === "completed"
                ).length;


            return Math.round(
                (
                    memberCompleted /
                    memberTasks.length
                ) * 100
            );
        });


    const average =
        progressValues.length
            ? Math.round(
                progressValues.reduce(
                    (sum, value) =>
                        sum + value,
                    0
                ) /
                progressValues.length
            )
            : 0;


    if ($("#members-count")) {
        $("#members-count").textContent =
            members.length;
    }


    if ($("#tasks-count")) {
        $("#tasks-count").textContent =
            tasks.length;
    }


    if ($("#completed-count")) {
        $("#completed-count").textContent =
            completed;
    }


    if ($("#average-progress")) {
        $("#average-progress").textContent =
            `${average}%`;
    }
}


/* =========================================================
   MEMBERS
========================================================= */

function renderMembers() {

    const container =
        $("#admin-members");

    if (!container) {
        return;
    }


    if (!members.length) {

        container.innerHTML =
            "<p>لا يوجد أعضاء في الفريق حتى الآن.</p>";

        return;
    }


    container.innerHTML =
        members.map((member) => {

            const memberTasks =
                tasks.filter(
                    (task) =>
                        task.user_id === member.id
                );


            const completed =
                memberTasks.filter(
                    (task) =>
                        task.status === "completed"
                ).length;


            const progress =
                memberTasks.length
                    ? Math.round(
                        (
                            completed /
                            memberTasks.length
                        ) * 100
                    )
                    : 0;


            const displayName = member.display_name || member.username || "عضو";
            const initials = String(displayName).trim().slice(0, 1) || "ع";

            return `
                <article class="admin-member-card">
                    <div class="admin-member-head">
                        <div class="admin-member-avatar" aria-hidden="true">${escapeHTML(initials)}</div>
                        <div class="admin-member-identity">
                            <h3>${escapeHTML(displayName)}</h3>
                            <p>${member.username ? `@${escapeHTML(member.username)}` : "عضو في الفريق"}</p>
                        </div>
                        <span class="admin-member-percent">${progress}%</span>
                    </div>
                    <div class="admin-member-stats">
                        <span>المهام المكتملة</span>
                        <strong>${completed} <small>من ${memberTasks.length}</small></strong>
                    </div>
                    <div class="admin-progress-track" role="progressbar" aria-label="نسبة إنجاز ${escapeHTML(displayName)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}">
                        <span style="width:${progress}%"></span>
                    </div>
                </article>
            `;

        }).join("");
}


/* =========================================================
   WEEKS
========================================================= */

function renderWeeks() {

    const container =
        $("#weeks-list");

    if (!container) {
        return;
    }


    if (!weeks.length) {

        container.innerHTML =
            "<p>لسه مفيش أسابيع.</p>";

        return;
    }


    container.innerHTML =
        weeks.map((week) => `

            <article
                class="stat-card"
                style="margin-bottom:12px"
            >

                <h3>
                    ${escapeHTML(
                        week.title
                    )}
                </h3>

                <p>
                    ${escapeHTML(
                        week.description ||
                        "بدون وصف"
                    )}
                </p>

                <p>
                    ${escapeHTML(
                        week.start_date ||
                        ""
                    )}

                    —

                    ${escapeHTML(
                        week.end_date ||
                        ""
                    )}
                </p>

                ${
                    week.is_current
                        ? `
                            <strong>
                                الأسبوع الحالي
                            </strong>
                        `
                        : ""
                }

                <div
                    style="
                        display:flex;
                        gap:8px;
                        flex-wrap:wrap;
                        margin-top:12px;
                    "
                >

                    <button
                        class="text-btn"
                        type="button"
                        data-action="edit-week"
                        data-id="${week.id}"
                    >
                        تعديل
                    </button>

                    <button
                        class="text-btn"
                        type="button"
                        data-action="delete-week"
                        data-id="${week.id}"
                    >
                        حذف
                    </button>

                </div>

            </article>

        `).join("");
}


/* =========================================================
   TASKS
========================================================= */

function renderTasks() {

    const container =
        $("#admin-tasks");

    if (!container) {
        return;
    }


    if (!tasks.length) {

        container.innerHTML =
            "<p>لا توجد مهام حاليًا.</p>";

        return;
    }


    container.innerHTML =
        tasks.map((task) => {

            const typeLabel =
                TASK_TYPES[
                    task.task_type
                ] ||
                task.task_type ||
                "مهمة عامة";


            const statusLabel =
                STATUS[
                    task.status
                ] ||
                task.status ||
                "لم تبدأ";


            return `

                <article class="admin-task-card">
                    <div class="admin-task-heading">
                        <div>
                            <span class="admin-task-type">${escapeHTML(typeLabel)}</span>
                            <h3>${escapeHTML(task.title)}</h3>
                        </div>
                        <span class="admin-task-status status-${escapeHTML(task.status || "pending")}">${escapeHTML(statusLabel)}</span>
                    </div>
                    <p class="admin-task-description">${escapeHTML(task.description || "بدون وصف")}</p>
                    <div class="admin-task-meta">

                    <p>
                        👤 العضو:
                        ${escapeHTML(
                            getMemberName(
                                task.user_id
                            )
                        )}
                    </p>


                    <p>
                        📅 الأسبوع:
                        ${escapeHTML(
                            getWeekName(
                                task.week_id
                            )
                        )}
                    </p>



                    ${
                        task.due_date
                            ? `
                                <p>
                                    ⏰ الموعد النهائي:
                                    ${escapeHTML(
                                        task.due_date
                                    )}
                                </p>
                            `
                            : ""
                    }


                    ${
                        task.start_time ||
                        task.end_time
                            ? `
                                <p>
                                    🕐 الوقت:
                                    ${escapeHTML(
                                        task.start_time ||
                                        "--"
                                    )}
                                    -
                                    ${escapeHTML(
                                        task.end_time ||
                                        "--"
                                    )}
                                </p>
                            `
                            : ""
                    }


                    ${
                        task.weight !== null &&
                        task.weight !== undefined
                            ? `
                                <p>
                                    ⚖️ وزن المهمة:
                                    ${escapeHTML(
                                        task.weight
                                    )}
                                </p>
                            `
                            : ""
                    }


                    ${(() => { const videos = Array.isArray(task.video_urls) ? task.video_urls : (task.video_url ? [task.video_url] : []); return videos.length ? `<div class="admin-video-chips"><span>🎬 ${videos.length} فيديو</span>${videos.map((url, i) => `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">الفيديو ${i + 1} ↗</a>`).join("")}</div>` : ""; })()}


                    ${
                        task.notes
                            ? `
                                <p>
                                    📝 الملاحظات:
                                    ${escapeHTML(
                                        task.notes
                                    )}
                                </p>
                            `
                            : ""
                    }


                    ${
                        task.requirements
                            ? `
                                <p>
                                    📋 المطلوب:
                                    ${escapeHTML(
                                        task.requirements
                                    )}
                                </p>
                            `
                            : ""
                    }


                    </div>
                    <div class="admin-task-actions">

                        <button
                            class="text-btn"
                            type="button"
                            data-action="edit-task"
                            data-id="${task.id}"
                        >
                            تعديل
                        </button>


                        <button
                            class="text-btn"
                            type="button"
                            data-action="delete-task"
                            data-id="${task.id}"
                        >
                            حذف
                        </button>

                    </div>

                </article>

            `;

        }).join("");
}


/* =========================================================
   MODAL
========================================================= */

function openModal(
    title,
    contents,
    onSubmit
) {

    modalRoot.innerHTML = `

        <form
            id="admin-modal-form"
            class="auth-card"
            style="
                width:min(100%,700px);
                max-height:90vh;
                overflow:auto;
            "
        >

            <h2>
                ${escapeHTML(title)}
            </h2>


            ${contents}


            <div
                style="
                    display:flex;
                    gap:10px;
                    margin-top:25px;
                    flex-wrap:wrap;
                "
            >

                <button
                    class="primary-btn"
                    type="submit"
                >
                    حفظ
                </button>


                <button
                    class="text-btn"
                    type="button"
                    id="cancel-modal"
                >
                    إلغاء
                </button>

            </div>


            <p
                id="modal-error"
                class="error-message"
            ></p>

        </form>
    `;


    modalRoot.hidden = false;
    modalRoot.style.display = "flex";


    $("#cancel-modal").onclick =
        closeModal;


    $("#admin-modal-form").onsubmit =
        async (event) => {

            event.preventDefault();


            const button =
                event.currentTarget.querySelector(
                    'button[type="submit"]'
                );


            button.disabled = true;
            button.textContent =
                "جاري الحفظ...";


            try {

                await onSubmit(
                    new FormData(
                        event.currentTarget
                    )
                );


                closeModal();

                await loadDashboard();

            } catch (error) {

                console.error(
                    "Save error:",
                    error
                );


                const errorBox =
                    $("#modal-error");


                if (errorBox) {

                    errorBox.textContent =
                        error.message ||
                        "تعذر حفظ البيانات.";
                }

            } finally {

                button.disabled = false;
                button.textContent = "حفظ";
            }
        };
}


/* =========================================================
   CLOSE MODAL
========================================================= */

function closeModal() {

    if (!modalRoot) {
        return;
    }

    modalRoot.style.display = "none";
    modalRoot.hidden = true;
    modalRoot.innerHTML = "";
}


/* =========================================================
   FORM HELPERS
========================================================= */

function field(
    label,
    name,
    value = "",
    type = "text",
    required = true
) {

    return `
        <label
            style="
                display:block;
                margin-top:14px;
            "
        >

            ${escapeHTML(label)}


            <input
                name="${escapeHTML(name)}"
                type="${escapeHTML(type)}"
                value="${escapeHTML(
                    value ?? ""
                )}"
                ${required ? "required" : ""}
                style="
                    display:block;
                    width:100%;
                    box-sizing:border-box;
                    margin-top:6px;
                "
            >

        </label>
    `;
}


function textareaField(
    label,
    name,
    value = "",
    required = false,
    placeholder = ""
) {

    return `
        <label
            style="
                display:block;
                margin-top:14px;
            "
        >

            ${escapeHTML(label)}


            <textarea
                name="${escapeHTML(name)}"
                placeholder="${escapeHTML(
                    placeholder
                )}"
                ${required ? "required" : ""}
                style="
                    display:block;
                    width:100%;
                    box-sizing:border-box;
                    margin-top:6px;
                    min-height:100px;
                    resize:vertical;
                "
            >${escapeHTML(
                value ?? ""
            )}</textarea>

        </label>
    `;
}


function selectField(
    label,
    name,
    options,
    required = true
) {

    return `
        <label
            style="
                display:block;
                margin-top:14px;
            "
        >

            ${escapeHTML(label)}


            <select
                name="${escapeHTML(name)}"
                ${required ? "required" : ""}
                style="
                    display:block;
                    width:100%;
                    margin-top:6px;
                "
            >

                ${options}

            </select>

        </label>
    `;
}


/* =========================================================
   WEEK FORM
========================================================= */

function openWeekForm(week = null) {

    const current =
        week || {};


    openModal(

        week
            ? "تعديل الأسبوع"
            : "إنشاء أسبوع جديد",

        `

            ${field(
                "اسم الأسبوع",
                "title",
                current.title || ""
            )}


            ${textareaField(
                "الوصف",
                "description",
                current.description || "",
                false,
                "اكتب وصف الأسبوع..."
            )}


            ${field(
                "تاريخ البداية",
                "start_date",
                current.start_date || "",
                "date"
            )}


            ${field(
                "تاريخ النهاية",
                "end_date",
                current.end_date || "",
                "date"
            )}


            <label
                style="
                    display:block;
                    margin-top:14px;
                "
            >

                <input
                    name="is_current"
                    type="checkbox"
                    ${
                        current.is_current
                            ? "checked"
                            : ""
                    }
                >

                تعيين كالأسبوع الحالي

            </label>

        `,

        async (form) => {

            const title =
                form.get("title")?.trim();


            const startDate =
                form.get("start_date");


            const endDate =
                form.get("end_date");


            if (!title) {

                throw new Error(
                    "اكتب اسم الأسبوع."
                );
            }


            if (
                startDate &&
                endDate &&
                endDate < startDate
            ) {

                throw new Error(
                    "تاريخ النهاية لازم يكون بعد تاريخ البداية."
                );
            }


            const payload = {

                title,

                description:
                    form.get(
                        "description"
                    )?.trim() || null,

                start_date:
                    startDate,

                end_date:
                    endDate,

                is_current:
                    form.get(
                        "is_current"
                    ) === "on"
            };


            /* إزالة current من باقي الأسابيع */

            if (payload.is_current) {

                const {
                    error
                } =
                    await supabaseClient
                        .from("weeks")
                        .update({
                            is_current: false
                        })
                        .neq(
                            "id",
                            week?.id ||
                            "00000000-0000-0000-0000-000000000000"
                        );


                if (error) {
                    throw error;
                }
            }


            let result;


            if (week) {

                result =
                    await supabaseClient
                        .from("weeks")
                        .update(payload)
                        .eq("id", week.id);

            } else {

                result =
                    await supabaseClient
                        .from("weeks")
                        .insert(payload);
            }


            if (result.error) {
                throw result.error;
            }
        }
    );
}


/* =========================================================
   FILE UPLOAD UI
========================================================= */

function fileUploadField() {

    return `

        <div
            style="
                margin-top:18px;
                padding:18px;
                border:1px dashed rgba(255,255,255,.25);
                border-radius:14px;
            "
        >

            <strong>
                📎 الملفات والمرفقات
            </strong>


            <p
                style="
                    opacity:.7;
                    font-size:13px;
                    margin:6px 0 12px;
                "
            >
                اختار ملف أو أكتر من جهازك.
            </p>


            <input
                type="file"
                name="task_files"
                multiple
                style="
                    width:100%;
                    padding:10px;
                    box-sizing:border-box;
                "
            >


            <div
                id="selected-files"
                style="
                    margin-top:10px;
                    font-size:13px;
                "
            ></div>

        </div>
    `;
}


/* =========================================================
   TASK FORM
========================================================= */

function openTaskForm(task = null) {

    if (!members.length) {

        showMessage(
            "أضف عضوًا واحدًا على الأقل قبل إنشاء مهمة."
        );

        return;
    }


    if (!weeks.length) {

        showMessage(
            "أنشئ أسبوعًا واحدًا على الأقل قبل إنشاء مهمة."
        );

        return;
    }


    const current =
        task || {};


    /* -----------------------------------------------------
       MEMBERS OPTIONS
    ----------------------------------------------------- */

    const selectedAssignees = task ? [String(current.user_id)] : [];
    const memberOptions = members.map((member) => `
        <label class="assignee-option">
            <input type="checkbox" name="assignee_ids" value="${escapeHTML(member.id)}" ${selectedAssignees.includes(String(member.id)) ? "checked" : ""}>
            <span class="assignee-avatar">${escapeHTML((member.display_name || member.username || "ع").slice(0, 1))}</span>
            <span class="assignee-name">${escapeHTML(member.display_name || member.username || "عضو")}</span>
            <span class="assignee-check">✓</span>
        </label>
    `).join("");


    /* -----------------------------------------------------
       WEEKS OPTIONS
    ----------------------------------------------------- */

    const weekOptions =
        weeks.map((week) => `

            <option
                value="${week.id}"
                ${
                    current.week_id === week.id
                        ? "selected"
                        : ""
                }
            >
                ${escapeHTML(
                    week.title
                )}
            </option>

        `).join("");


    /* -----------------------------------------------------
       STATUS OPTIONS
    ----------------------------------------------------- */

    const statusOptions =
        Object.entries(STATUS)
            .map(([value, label]) => `

                <option
                    value="${value}"
                    ${
                        (
                            current.status ||
                            "pending"
                        ) === value
                            ? "selected"
                            : ""
                    }
                >
                    ${escapeHTML(label)}
                </option>

            `)
            .join("");


    /* -----------------------------------------------------
       TASK TYPE OPTIONS
    ----------------------------------------------------- */

    const taskTypeOptions =
        Object.entries(TASK_TYPES)
            .map(([value, label]) => `

                <option
                    value="${value}"
                    ${
                        (
                            current.task_type ||
                            "general"
                        ) === value
                            ? "selected"
                            : ""
                    }
                >
                    ${escapeHTML(label)}
                </option>

            `)
            .join("");


    /* -----------------------------------------------------
       OPEN MODAL
    ----------------------------------------------------- */

    openModal(

        task
            ? "تعديل المهمة"
            : "إضافة مهمة جديدة",

        `

            <div
                style="
                    margin-top:10px;
                    color:var(--accent);
                    font-size:12px;
                    font-weight:800;
                "
            >
                بيانات المهمة
            </div>


            ${field(
                "اسم المهمة / المحاضرة",
                "title",
                current.title || ""
            )}


            ${textareaField(
                "وصف المهمة",
                "description",
                current.description || "",
                false,
                "اكتب وصف المهمة..."
            )}


            <section class="form-section-block">
                <div class="form-section-heading"><span class="form-section-icon">♙</span><div><strong>مين هينفّذ المهمة؟</strong><small>اختار عضو واحد أو أكتر، وكل واحد هيتابع إنجازه بشكل مستقل.</small></div></div>
                <div class="assignee-grid">${memberOptions}</div>
            </section>


            ${selectField(
                "الأسبوع",
                "week_id",
                weekOptions
            )}


            ${selectField(
                "نوع المهمة",
                "task_type",
                taskTypeOptions
            )}


            ${selectField(
                "حالة المهمة",
                "status",
                statusOptions
            )}


            <section class="form-section-block video-section">
                <div class="form-section-heading"><span class="form-section-icon">▶</span><div><strong>مصادر المهمة والفيديوهات</strong><small>ضيف كل الروابط اللي العضو محتاجها، مش لازم فيديو واحد بس.</small></div></div>
                <div id="video-links-list">
                    ${(Array.isArray(current.video_urls) && current.video_urls.length ? current.video_urls : (current.video_url ? [current.video_url] : [""])).map((url, i) => `<div class="video-link-row"><span class="video-link-index">${i+1}</span><input name="video_urls" type="url" value="${escapeHTML(url)}" placeholder="https://youtube.com/watch?v=..." aria-label="رابط الفيديو ${i+1}"><button type="button" class="remove-video-link" aria-label="حذف الرابط" ${i === 0 ? "disabled" : ""}>×</button></div>`).join("")}
                </div>
                <button type="button" id="add-video-link" class="add-video-link">＋ إضافة رابط فيديو</button>
            </section>


            ${textareaField(
                "الملاحظات 📝",
                "notes",
                current.notes || "",
                false,
                "اكتب الملاحظات والتعليمات..."
            )}


            ${fileUploadField()}


            ${textareaField(
                "المطلوب من العضو 📋",
                "requirements",
                current.requirements || "",
                false,
                "اكتب المطلوب من العضو..."
            )}


            <div
                style="
                    display:grid;
                    grid-template-columns:1fr 1fr;
                    gap:12px;
                "
            >

                ${field(
                    "موعد البداية 🕐",
                    "start_time",
                    current.start_time
                        ? String(
                            current.start_time
                        ).slice(0, 5)
                        : "",
                    "time",
                    false
                )}


                ${field(
                    "موعد النهاية 🕐",
                    "end_time",
                    current.end_time
                        ? String(
                            current.end_time
                        ).slice(0, 5)
                        : "",
                    "time",
                    false
                )}

            </div>


            <div
                style="
                    display:grid;
                    grid-template-columns:1fr 1fr;
                    gap:12px;
                "
            >

                ${field(
                    "الموعد النهائي 📅",
                    "due_date",
                    current.due_date || "",
                    "date",
                    false
                )}


                ${field(
                    "وزن المهمة ⚖️",
                    "weight",
                    current.weight ??
                    1,
                    "number"
                )}

            </div>

        `,

        async (form) => {

            /* -------------------------------------------------
               BASIC VALIDATION
            ------------------------------------------------- */

            const title =
                form.get("title")?.trim();


            if (!title) {

                throw new Error(
                    "اكتب اسم المهمة."
                );
            }


            const assigneeIds = [...new Set(form.getAll("assignee_ids").map(String).filter(Boolean))];
            if (!assigneeIds.length) throw new Error("اختار عضو واحد على الأقل للمهمة.");

            const videoUrls = [...new Set(form.getAll("video_urls").map(url => String(url || "").trim()).filter(Boolean))];
            if (videoUrls.some(url => !/^https?:\/\//i.test(url))) throw new Error("روابط الفيديو لازم تبدأ بـ https:// أو http://");

            const weight =
                Number(
                    form.get("weight")
                );


            if (
                !Number.isFinite(weight) ||
                weight <= 0
            ) {

                throw new Error(
                    "وزن المهمة لازم يكون أكبر من صفر."
                );
            }


            const startTime =
                form.get(
                    "start_time"
                ) || null;


            const endTime =
                form.get(
                    "end_time"
                ) || null;


            if (
                startTime &&
                endTime &&
                endTime < startTime
            ) {

                throw new Error(
                    "موعد النهاية لازم يكون بعد البداية."
                );
            }


            /* -------------------------------------------------
               TASK PAYLOAD
            ------------------------------------------------- */

            const payload = {

                title,

                description:
                    form.get(
                        "description"
                    )?.trim() || null,

                user_id: (form.getAll("assignee_ids")[0] || current.user_id || ""),

                week_id:
                    form.get(
                        "week_id"
                    ),

                status:
                    form.get(
                        "status"
                    ) || "pending",

                task_type:
                    form.get(
                        "task_type"
                    ) || "general",

                due_date:
                    form.get(
                        "due_date"
                    ) || null,

                weight,

                video_url: (form.getAll("video_urls").map(url => String(url || "").trim()).find(Boolean) || current.video_url || null),
                video_urls: videoUrls,

                notes:
                    form.get(
                        "notes"
                    )?.trim() || null,

                requirements:
                    form.get(
                        "requirements"
                    )?.trim() || null,

                start_time:
                    startTime,

                end_time:
                    endTime
            };


            /* -------------------------------------------------
               SAVE TASK
            ------------------------------------------------- */

            let savedTask;


            if (task) {

                const {
                    data,
                    error
                } =
                    await supabaseClient
                        .from("tasks")
                        .update(payload)
                        .eq(
                            "id",
                            task.id
                        )
                        .select()
                        .single();


                if (error) {
                    throw error;
                }


                savedTask = data;

            } else {
                const rows = assigneeIds.map(userId => ({ ...payload, user_id: userId }));
                const { data, error } = await supabaseClient
                    .from("tasks")
                    .insert(rows)
                    .select();
                if (error) throw error;
                savedTask = data?.[0];
            }


            /* -------------------------------------------------
               FILE UPLOAD
            ------------------------------------------------- */

            const files =
                form.getAll(
                    "task_files"
                );


            const realFiles =
                files.filter(
                    (file) =>
                        file instanceof File &&
                        file.size > 0
                );


            for (
                const file of realFiles
            ) {

                const safeName =
                    file.name
                        .replace(
                            /[^a-zA-Z0-9._-]/g,
                            "_"
                        );


                const path =
                    `${savedTask.id}/${Date.now()}_${safeName}`;


                const {
                    error:
                        uploadError
                } =
                    await supabaseClient
                        .storage
                        .from(
                            STORAGE_BUCKET
                        )
                        .upload(
                            path,
                            file,
                            {
                                upsert: false
                            }
                        );


                if (uploadError) {
                    throw uploadError;
                }


                const {
                    data:
                        publicData
                } =
                    supabaseClient
                        .storage
                        .from(
                            STORAGE_BUCKET
                        )
                        .getPublicUrl(
                            path
                        );


                const {
                    error:
                        fileRecordError
                } =
                    await supabaseClient
                        .from("task_files")
                        .insert({

                            task_id:
                                savedTask.id,

                            file_name:
                                file.name,

                            file_url:
                                publicData.publicUrl,

                            file_path:
                                path
                        });


                if (fileRecordError) {
                    throw fileRecordError;
                }
            }
        }
    );


    /* Repeatable video sources + member selection */
    const videoList = document.getElementById("video-links-list");
    document.getElementById("add-video-link")?.addEventListener("click", () => {
        const index = videoList.querySelectorAll(".video-link-row").length + 1;
        const row = document.createElement("div");
        row.className = "video-link-row";
        row.innerHTML = `<span class="video-link-index">${index}</span><input name="video_urls" type="url" placeholder="https://youtube.com/watch?v=..." aria-label="رابط الفيديو ${index}"><button type="button" class="remove-video-link" aria-label="حذف الرابط">×</button>`;
        videoList.appendChild(row);
        row.querySelector("input").focus();
    });
    videoList?.addEventListener("click", event => {
        const remove = event.target.closest(".remove-video-link");
        if (!remove || remove.disabled) return;
        remove.closest(".video-link-row").remove();
        [...videoList.querySelectorAll(".video-link-row")].forEach((row, i) => {
            row.querySelector(".video-link-index").textContent = i + 1;
            row.querySelector("input").setAttribute("aria-label", `رابط الفيديو ${i + 1}`);
            row.querySelector(".remove-video-link").disabled = i === 0;
        });
    });

    /* =====================================================
       FILE PREVIEW
    ===================================================== */

    const fileInput =
        document.querySelector(
            'input[name="task_files"]'
        );


    const selectedFiles =
        $("#selected-files");


    fileInput?.addEventListener(
        "change",
        () => {

            if (!selectedFiles) {
                return;
            }


            const files =
                Array.from(
                    fileInput.files || []
                );


            if (!files.length) {

                selectedFiles.innerHTML =
                    "";

                return;
            }


            selectedFiles.innerHTML =
                files.map(
                    (file) => `
                        <div
                            style="
                                margin-top:5px;
                            "
                        >
                            📄
                            ${escapeHTML(
                                file.name
                            )}
                        </div>
                    `
                ).join("");
        }
    );
}


/* =========================================================
   ACTIONS
========================================================= */

async function handleActions(event) {

    const button =
        event.target.closest(
            "[data-action]"
        );


    if (!button) {
        return;
    }


    const action =
        button.dataset.action;


    const id =
        button.dataset.id;


    /* -----------------------------------------------------
       EDIT TASK
    ----------------------------------------------------- */

    if (action === "edit-task") {

        const task =
            tasks.find(
                (item) =>
                    item.id === id
            );


        if (task) {
            openTaskForm(task);
        }


        return;
    }


    /* -----------------------------------------------------
       DELETE TASK
    ----------------------------------------------------- */

    if (action === "delete-task") {

        const confirmed =
            confirm(
                "متأكد إنك عايز تحذف المهمة دي؟"
            );


        if (!confirmed) {
            return;
        }


        try {

            const {
                error
            } =
                await supabaseClient
                    .from("tasks")
                    .delete()
                    .eq(
                        "id",
                        id
                    );


            if (error) {
                throw error;
            }


            await loadDashboard();

        } catch (error) {

            console.error(error);

            showMessage(
                "تعذر حذف المهمة."
            );
        }


        return;
    }


    /* -----------------------------------------------------
       EDIT WEEK
    ----------------------------------------------------- */

    if (action === "edit-week") {

        const week =
            weeks.find(
                (item) =>
                    item.id === id
            );


        if (week) {
            openWeekForm(week);
        }


        return;
    }


    /* -----------------------------------------------------
       DELETE WEEK
    ----------------------------------------------------- */

    if (action === "delete-week") {

        const confirmed =
            confirm(
                "هل أنت متأكد من حذف الأسبوع؟"
            );


        if (!confirmed) {
            return;
        }


        try {

            const {
                error
            } =
                await supabaseClient
                    .from("weeks")
                    .delete()
                    .eq(
                        "id",
                        id
                    );


            if (error) {
                throw error;
            }


            await loadDashboard();

        } catch (error) {

            console.error(error);

            showMessage(
                "تعذر حذف الأسبوع."
            );
        }


        return;
    }
}


/* =========================================================
   START
========================================================= */

initialize();

