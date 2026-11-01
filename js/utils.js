/**
 * نسبة الإنجاز بالأوزان (weight).
 * نفس المنطق المستخدم في لوحة العضو، عشان الأرقام تتطابق في كل الصفحات.
 */
function calculateProgress(tasks) {
    if (!Array.isArray(tasks) || tasks.length === 0) return 0;

    let total = 0;
    let done = 0;

    for (const task of tasks) {
        const weight = Number(task.weight) > 0 ? Number(task.weight) : 1;

        total += weight;

        if (task.status === "completed") {
            done += weight;
        }
    }

    return total ? Math.round((done / total) * 100) : 0;
}

function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
}

function debounce(fn, delay = 250) {
    let timer;

    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}