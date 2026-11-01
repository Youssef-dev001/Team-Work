// =========================================================
// MEMBER DASHBOARD
// =========================================================


const STATUS = {

    pending: "لم تبدأ",

    in_progress: "قيد التنفيذ",

    review: "قيد المراجعة",

    completed: "مكتملة"

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


let currentUser = null;

let currentProfile = null;

let tasks = [];

let weeks = [];



// =========================================================
// ESCAPE HTML
// =========================================================

function escapeHTML(value = "") {

    return String(value).replace(
        /[&<>"']/g,
        char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]
    );

}



// =========================================================
// INITIALIZE
// =========================================================

async function loadMemberDashboard() {

    try {

        // -------------------------------------------------
        // 1. المستخدم الحالي
        // -------------------------------------------------

        const {
            data: {
                user
            },
            error: userError
        } = await supabaseClient.auth.getUser();


        if (userError || !user) {

            window.location.replace(
                "login.html"
            );

            return;
        }


        currentUser = user;



        // -------------------------------------------------
        // 2. بيانات العضو
        // -------------------------------------------------

        const {
            data: profile,
            error: profileError
        } = await supabaseClient
            .from("profiles")
            .select(
                "id, username, display_name, full_name, role"
            )
            .eq(
                "id",
                user.id
            )
            .single();


        if (profileError || !profile) {

            console.error(
                "Profile error:",
                profileError
            );

            throw new Error(
                "مش قادر أجيب بيانات الحساب."
            );
        }


        currentProfile = profile;



        // -------------------------------------------------
        // 3. اسم العضو
        // -------------------------------------------------

        const memberName =
            profile.full_name ||
            profile.display_name ||
            profile.username ||
            "العضو";


        const memberNameElement =
            document.getElementById(
                "member-name"
            );


        if (memberNameElement) {

            memberNameElement.textContent =
                memberName;

        }



        // -------------------------------------------------
        // 4. تجهيز الملف الشخصي
        // -------------------------------------------------

        setupProfile();



        // -------------------------------------------------
        // 5. تسجيل الخروج
        // -------------------------------------------------

        document
            .getElementById("logout-btn")
            ?.addEventListener(
                "click",
                logout
            );



        // -------------------------------------------------
        // 6. تحميل الأسابيع
        // -------------------------------------------------

        await loadWeeks();



        // -------------------------------------------------
        // 7. تحميل المهام
        // -------------------------------------------------

        await loadTasks();



        // -------------------------------------------------
        // 8. تجهيز الـ Modal
        // -------------------------------------------------

        setupTaskModal();


    } catch (error) {

        console.error(
            "Member dashboard error:",
            error
        );


        const tasksList =
            document.getElementById(
                "tasks-list"
            );


        if (tasksList) {

            tasksList.innerHTML = `

                <div class="empty-state error-state">

                    حصلت مشكلة وإحنا بنحمل الداشبورد.

                    <br><br>

                    ${escapeHTML(
                        error.message ||
                        "خطأ غير معروف"
                    )}

                </div>

            `;

        }

    }

}



// =========================================================
// PROFILE
// =========================================================

function setupProfile() {

    const profileButton =
        document.getElementById(
            "profile-btn"
        );


    const modal =
        document.getElementById(
            "profile-modal"
        );


    const overlay =
        document.getElementById(
            "profile-modal-overlay"
        );


    const closeButton =
        document.getElementById(
            "close-profile-modal"
        );


    const saveButton =
        document.getElementById(
            "save-profile-btn"
        );


    if (!profileButton || !modal) {

        console.warn(
            "Profile elements not found."
        );

        return;
    }



    // فتح الملف الشخصي

    profileButton.addEventListener(
        "click",
        openProfileModal
    );



    // إغلاق عند الضغط على الخلفية

    overlay?.addEventListener(
        "click",
        closeProfileModal
    );



    // إغلاق بزر X

    closeButton?.addEventListener(
        "click",
        closeProfileModal
    );



    // حفظ الاسم

    saveButton?.addEventListener(
        "click",
        saveProfile
    );



    // إغلاق بالـ Escape

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape" &&
                !modal.hidden
            ) {

                closeProfileModal();

            }

        }
    );

}



// =========================================================
// OPEN PROFILE MODAL
// =========================================================

function openProfileModal() {

    const modal =
        document.getElementById(
            "profile-modal"
        );


    const nameInput =
        document.getElementById(
            "profile-name-input"
        );


    const emailInput =
        document.getElementById(
            "profile-email-input"
        );


    if (!modal) return;



    // الاسم الحالي

    if (nameInput) {

        nameInput.value =
            currentProfile.full_name ||
            currentProfile.display_name ||
            currentProfile.username ||
            "";

    }



    // الإيميل

    if (emailInput) {

        emailInput.value =
            currentUser.email ||
            "";

    }



    // مسح رسالة الحالة

    const message =
        document.getElementById(
            "profile-message"
        );


    if (message) {

        message.textContent = "";

    }



    // فتح النافذة

    modal.hidden = false;


    document.body.classList.add(
        "modal-open"
    );

}



// =========================================================
// CLOSE PROFILE MODAL
// =========================================================

function closeProfileModal() {

    const modal =
        document.getElementById(
            "profile-modal"
        );


    if (!modal) return;


    modal.hidden = true;


    document.body.classList.remove(
        "modal-open"
    );

}



// =========================================================
// SAVE PROFILE
// =========================================================

async function saveProfile() {

    const nameInput =
        document.getElementById(
            "profile-name-input"
        );


    const saveButton =
        document.getElementById(
            "save-profile-btn"
        );


    const message =
        document.getElementById(
            "profile-message"
        );


    if (!nameInput) return;


    const newName =
        nameInput.value.trim();



    // -------------------------------------------------
    // التحقق من الاسم
    // -------------------------------------------------

    if (!newName) {

        alert(
            "اكتب اسمك الأول."
        );

        nameInput.focus();

        return;
    }


    if (newName.length < 2) {

        alert(
            "الاسم لازم يكون حرفين على الأقل."
        );

        nameInput.focus();

        return;
    }



    try {

        if (saveButton) {

            saveButton.disabled = true;

            saveButton.textContent =
                "جاري الحفظ...";

        }


        if (message) {

            message.textContent = "";

        }



        // -------------------------------------------------
        // تحديث الاسم في قاعدة البيانات
        // -------------------------------------------------

        const {
            error: updateError
        } = await supabaseClient
            .from("profiles")
            .update({

                full_name: newName,

                display_name: newName

            })
            .eq(
                "id",
                currentUser.id
            );


        if (updateError) {

            console.error(
                "Profile update error:",
                updateError
            );

            throw updateError;

        }



        // -------------------------------------------------
        // تحديث البيانات المحلية
        // -------------------------------------------------

        currentProfile.full_name =
            newName;

        currentProfile.display_name =
            newName;



        // -------------------------------------------------
        // تحديث الاسم في الصفحة
        // -------------------------------------------------

        const memberNameElement =
            document.getElementById(
                "member-name"
            );


        if (memberNameElement) {

            memberNameElement.textContent =
                newName;

        }



        // -------------------------------------------------
        // رسالة النجاح
        // -------------------------------------------------

        if (message) {

            message.textContent =
                "تم حفظ اسمك بنجاح ✓";

        }



        // -------------------------------------------------
        // إغلاق النافذة
        // -------------------------------------------------

        setTimeout(
            closeProfileModal,
            800
        );


    } catch (error) {

        console.error(
            "Save profile error:",
            error
        );


        if (message) {

            message.textContent =
                "حصل خطأ أثناء حفظ الاسم.";

        }


        alert(
            error.message ||
            "مش قادر أحفظ اسمك دلوقتي."
        );


    } finally {

        if (saveButton) {

            saveButton.disabled = false;

            saveButton.textContent =
                "حفظ التغييرات";

        }

    }

}



// =========================================================
// LOAD WEEKS
// =========================================================

async function loadWeeks() {

    const {
        data,
        error
    } = await supabaseClient
        .from("weeks")
        .select(
            "id, title, start_date, end_date, is_current"
        )
        .order(
            "start_date",
            {
                ascending: false
            }
        );


    if (error) {

        console.error(
            "Weeks error:",
            error
        );

        throw new Error(
            "مش قادر أجيب الأسابيع."
        );

    }


    weeks = data || [];


    const currentWeek =
        weeks.find(
            week => week.is_current
        );


    const weekLabel =
        document.getElementById(
            "week-label"
        );


    if (weekLabel) {

        weekLabel.textContent =
            currentWeek
                ? `الأسبوع الحالي: ${currentWeek.title}`
                : "مفيش أسبوع حالي محدد دلوقتي.";

    }

}



// =========================================================
// LOAD TASKS
// =========================================================

async function loadTasks() {

    const {
        data,
        error
    } = await supabaseClient
        .from("tasks")
        .select("*, task_files(*)")
        .eq(
            "user_id",
            currentUser.id
        )
        .order(
            "created_at",
            {
                ascending: false
            }
        );


    if (error) {

        console.error(
            "Tasks error:",
            error
        );

        throw new Error(
            "مش قادر أجيب مهامك."
        );

    }


    tasks = data || [];


    updateProgress();

    renderTasks();

}



// =========================================================
// UPDATE PROGRESS
// =========================================================

function updateProgress() {

    const totalWeight =
        tasks.reduce(
            (sum, task) =>
                sum +
                Number(
                    task.weight || 0
                ),
            0
        );


    const completedWeight =
        tasks
            .filter(
                task =>
                    task.status ===
                    "completed"
            )
            .reduce(
                (sum, task) =>
                    sum +
                    Number(
                        task.weight || 0
                    ),
                0
            );


    const progress =
        totalWeight > 0
            ? Math.round(
                (
                    completedWeight /
                    totalWeight
                ) * 100
            )
            : 0;


    const progressElement =
        document.getElementById(
            "progress-value"
        );


    if (progressElement) {

        progressElement.textContent =
            `${progress}%`;

    }

}



// =========================================================
// RENDER TASKS
// =========================================================

function renderTasks() {

    const container =
        document.getElementById(
            "tasks-list"
        );


    if (!container) return;


    if (!tasks.length) {

        container.innerHTML = `

            <div class="empty-state">

                مفيش مهام متسجلة ليك لحد دلوقتي.

            </div>

        `;

        return;
    }


    container.innerHTML =
        tasks
            .map(
                task =>
                    renderTaskCard(task)
            )
            .join("");

}



// =========================================================
// TASK CARD
// =========================================================

function renderTaskCard(task) {

    const week =
        weeks.find(
            item =>
                item.id ===
                task.week_id
        );


    const statusText =
        STATUS[
            task.status
        ] ||
        "غير محدد";


    const typeText =
        TASK_TYPES[
            task.task_type
        ] ||
        task.task_type ||
        "مهمة";


    return `

        <article
            class="task-card"
            data-task-id="${escapeHTML(
                task.id
            )}"
        >

            <div class="task-card-top">

                <span class="task-type">

                    ${escapeHTML(
                        typeText
                    )}

                </span>


                <span
                    class="task-status status-${escapeHTML(
                        task.status ||
                        "pending"
                    )}"
                >

                    ${escapeHTML(
                        statusText
                    )}

                </span>

            </div>



            <h3>

                ${escapeHTML(
                    task.title ||
                    "مهمة بدون اسم"
                )}

            </h3>



            ${
                week
                    ? `
                        <div class="task-card-week">

                            📅

                            ${escapeHTML(
                                week.title
                            )}

                        </div>
                    `
                    : ""
            }



            ${
                task.description
                    ? `
                        <p class="task-card-description">

                            ${escapeHTML(
                                task.description
                            )}

                        </p>
                    `
                    : ""
            }



            <div class="task-card-actions">

                <button
                    type="button"
                    class="primary-btn task-details-btn"
                    data-task-id="${escapeHTML(
                        task.id
                    )}"
                >

                    عرض التفاصيل

                </button>


                ${
                    task.status !==
                    "completed"

                        ? `

                            <button
                                type="button"
                                class="secondary-btn complete-task-btn"
                                data-task-id="${escapeHTML(
                                    task.id
                                )}"
                            >

                                ✓ تم إنجاز المهمة

                            </button>

                        `

                        : `

                            <span class="completed-label">

                                ✓ المهمة مكتملة

                            </span>

                        `
                }

            </div>


        </article>

    `;

}



// =========================================================
// TASK MODAL
// =========================================================

function setupTaskModal() {

    const modal =
        document.getElementById(
            "task-modal"
        );


    const overlay =
        document.getElementById(
            "task-modal-overlay"
        );


    const closeButton =
        document.getElementById(
            "close-task-modal"
        );


    if (!modal) return;


    document.body.addEventListener(
        "click",
        event => {

            const detailsButton =
                event.target.closest(
                    ".task-details-btn"
                );


            if (detailsButton) {

                const task =
                    tasks.find(
                        item =>
                            item.id ===
                            detailsButton.dataset.taskId
                    );


                if (task) {

                    openTaskModal(task);

                }

                return;

            }



            const completeButton =
                event.target.closest(
                    ".complete-task-btn"
                );


            if (completeButton) {

                updateTaskStatus(
                    completeButton.dataset.taskId,
                    "completed"
                );

            }

        }
    );


    overlay?.addEventListener(
        "click",
        closeTaskModal
    );


    closeButton?.addEventListener(
        "click",
        closeTaskModal
    );


    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Escape" &&
                !modal.hidden
            ) {

                closeTaskModal();

            }

        }
    );

}



// =========================================================
// OPEN TASK MODAL
// =========================================================

function openTaskModal(task) {

    const modal =
        document.getElementById(
            "task-modal"
        );


    const body =
        document.getElementById(
            "task-modal-body"
        );


    if (!modal || !body) return;


    const week =
        weeks.find(
            item =>
                item.id ===
                task.week_id
        );


    const statusText =
        STATUS[
            task.status
        ] ||
        "غير محدد";


    const typeText =
        TASK_TYPES[
            task.task_type
        ] ||
        task.task_type ||
        "مهمة";


    body.innerHTML = `

        <span class="eyebrow">
            TASK DETAILS
        </span>


        <h2 id="task-modal-title">

            ${escapeHTML(
                task.title ||
                "مهمة بدون اسم"
            )}

        </h2>



        <div class="task-modal-status-row">

            <span class="task-type">

                ${escapeHTML(
                    typeText
                )}

            </span>


            <span
                class="task-status status-${escapeHTML(
                    task.status ||
                    "pending"
                )}"
            >

                ${escapeHTML(
                    statusText
                )}

            </span>

        </div>



        ${
            week
                ? `
                    <div class="detail-box">

                        <strong>
                            الأسبوع
                        </strong>

                        <span>
                            ${escapeHTML(
                                week.title
                            )}
                        </span>

                    </div>
                `
                : ""
        }



        ${
            task.description
                ? `
                    <div class="detail-box">

                        <strong>
                            وصف المهمة
                        </strong>

                        <p>
                            ${escapeHTML(
                                task.description
                            )}
                        </p>

                    </div>
                `
                : ""
        }



        ${
            task.requirements
                ? `
                    <div class="detail-box">

                        <strong>
                            المطلوب منك
                        </strong>

                        <p>
                            ${escapeHTML(
                                task.requirements
                            )}
                        </p>

                    </div>
                `
                : ""
        }



        ${
            task.notes
                ? `
                    <div class="detail-box">

                        <strong>
                            ملاحظات
                        </strong>

                        <p>
                            ${escapeHTML(
                                task.notes
                            )}
                        </p>

                    </div>
                `
                : ""
        }



        ${(() => { const videos = Array.isArray(task.video_urls) ? task.video_urls : (task.video_url ? [task.video_url] : []); return videos.length ? `<div class="detail-box video-resources-box"><strong>الفيديوهات والمصادر <span class="resource-count">${videos.length}</span></strong><div class="resource-link-list">${videos.map((url, i) => `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer" class="task-link"><span class="resource-play">▶</span><span>الفيديو ${i + 1}<small>فتح المصدر في تبويب جديد</small></span><span class="resource-arrow">↗</span></a>`).join("")}</div></div>` : ""; })()}



        ${(() => { const tf = Array.isArray(task.task_files) ? task.task_files : []; return tf.length ? `<div class="detail-box video-resources-box"><strong>الملفات والمرفقات <span class="resource-count">${tf.length}</span></strong><div class="resource-link-list">${tf.map((f) => `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><a href="${escapeHTML(f.file_url || "#")}" target="_blank" rel="noopener noreferrer" class="task-link" style="flex:1"><span class="resource-play">📎</span><span>${escapeHTML(f.file_name || "ملف")}<small>فتح الملف</small></span><span class="resource-arrow">↗</span></a><a href="${escapeHTML(f.file_url || "#")}" download="${escapeHTML(f.file_name || "file")}" target="_blank" rel="noopener noreferrer" class="task-link">⬇ تحميل</a></div>`).join("")}</div></div>` : ""; })()}

        ${
            task.attachments
                ? `
                    <div class="detail-box">

                        <strong>
                            الملفات والمرفقات
                        </strong>

                        <a
                            href="${escapeHTML(
                                task.attachments
                            )}"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="task-link"
                        >

                            📎 فتح الملفات

                        </a>

                    </div>
                `
                : ""
        }



        <div class="task-details-grid">


            ${
                task.start_time
                    ? `
                        <div class="detail-box">

                            <strong>
                                موعد البداية
                            </strong>

                            <span>
                                ${escapeHTML(
                                    task.start_time
                                )}
                            </span>

                        </div>
                    `
                    : ""
            }



            ${
                task.end_time
                    ? `
                        <div class="detail-box">

                            <strong>
                                موعد النهاية
                            </strong>

                            <span>
                                ${escapeHTML(
                                    task.end_time
                                )}
                            </span>

                        </div>
                    `
                    : ""
            }



            ${
                task.due_date
                    ? `
                        <div class="detail-box">

                            <strong>
                                الموعد النهائي
                            </strong>

                            <span>
                                ${escapeHTML(
                                    task.due_date
                                )}
                            </span>

                        </div>
                    `
                    : ""
            }



            ${
                task.weight
                    ? `
                        <div class="detail-box">

                            <strong>
                                وزن المهمة
                            </strong>

                            <span>
                                ${escapeHTML(
                                    task.weight
                                )}
                            </span>

                        </div>
                    `
                    : ""
            }


        </div>



        <div class="task-status-control">

            <label for="task-status-select">

                حالة المهمة

            </label>


            <select
                id="task-status-select"
                data-task-id="${escapeHTML(
                    task.id
                )}"
            >

                ${Object.entries(
                    STATUS
                )
                    .map(
                        ([value, label]) => `

                            <option
                                value="${value}"
                                ${
                                    task.status ===
                                    value
                                        ? "selected"
                                        : ""
                                }
                            >

                                ${label}

                            </option>

                        `
                    )
                    .join("")}

            </select>


            <button
                type="button"
                class="primary-btn"
                id="save-task-status"
                data-task-id="${escapeHTML(
                    task.id
                )}"
            >

                حفظ حالة المهمة

            </button>

        </div>

    `;


    modal.hidden = false;

    document.body.classList.add(
        "modal-open"
    );


    document
        .getElementById(
            "save-task-status"
        )
        ?.addEventListener(
            "click",
            async () => {

                const select =
                    document.getElementById(
                        "task-status-select"
                    );


                if (!select) return;


                await updateTaskStatus(
                    task.id,
                    select.value,
                    true
                );

            }
        );

}



// =========================================================
// CLOSE TASK MODAL
// =========================================================

function closeTaskModal() {

    const modal =
        document.getElementById(
            "task-modal"
        );


    if (!modal) return;


    modal.hidden = true;


    document.body.classList.remove(
        "modal-open"
    );

}



// =========================================================
// UPDATE TASK STATUS
// =========================================================

async function updateTaskStatus(
    taskId,
    newStatus,
    fromModal = false
) {

    const task =
        tasks.find(
            item =>
                item.id === taskId
        );


    if (!task) return;


    const allowedStatuses =
        Object.keys(STATUS);


    if (
        !allowedStatuses.includes(
            newStatus
        )
    ) {

        alert(
            "حالة المهمة غير صحيحة."
        );

        return;

    }


    try {

        const {
            error
        } = await supabaseClient
            .from("tasks")
            .update({
                status: newStatus
            })
            .eq(
                "id",
                taskId
            )
            .eq(
                "user_id",
                currentUser.id
            );


        if (error) {

            console.error(
                "Update task error:",
                error
            );

            throw error;

        }


        task.status =
            newStatus;


        updateProgress();

        renderTasks();


        if (fromModal) {

            openTaskModal(task);

        }


    } catch (error) {

        console.error(
            "Task status update error:",
            error
        );


        alert(
            "مش قادر أغير حالة المهمة دلوقتي. حاول تاني."
        );

    }

}



// =========================================================
// LOGOUT
// =========================================================

async function logout() {

    try {

        await supabaseClient.auth.signOut();

    } finally {

        window.location.replace(
            "login.html"
        );

    }

}



// =========================================================
// START
// =========================================================

document.addEventListener(
    "DOMContentLoaded",
    loadMemberDashboard
);