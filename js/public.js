function renderPublicEmpty(container, message) {
    container.innerHTML = `
        <div class="empty-state">${UI.escapeHTML(message)}</div>
    `;
}

async function loadPublicProgress() {
    const container = document.getElementById("team-list");

    if (!container) return;

    UI.skeleton(container, 3);

    try {
        const [membersResult, tasksResult] = await Promise.all([
            supabaseClient
                .from("profiles")
                .select("id, username, display_name, full_name")
                .eq("role", "member")
                .order("display_name"),

            supabaseClient
                .from("tasks")
                .select("user_id, status, weight")
        ]);

        if (membersResult.error) throw membersResult.error;
        if (tasksResult.error) throw tasksResult.error;

        const members = membersResult.data || [];
        const tasks = tasksResult.data || [];

        if (!members.length) {
            renderPublicEmpty(container, "لسه مفيش أعضاء ظاهرين.");
            return;
        }

        // Aggregate task weights once instead of filtering the entire task list
        // for every member (O(members × tasks) -> O(members + tasks)).
        const progressBuckets = new Map();
        for (const task of tasks) {
            const id = task.user_id;
            if (!id) continue;
            let bucket = progressBuckets.get(id);
            if (!bucket) {
                bucket = { total: 0, done: 0 };
                progressBuckets.set(id, bucket);
            }
            const weight = Number(task.weight) > 0 ? Number(task.weight) : 1;
            bucket.total += weight;
            if (task.status === "completed") bucket.done += weight;
        }

        container.innerHTML = members.map((member) => {
            const name = member.full_name || member.display_name || member.username || "عضو";
            const bucket = progressBuckets.get(member.id);
            const progress = bucket && bucket.total
                ? Math.round((bucket.done / bucket.total) * 100)
                : 0;

            return `
                <div class="team-row">
                    <div class="team-name">${UI.escapeHTML(name)}</div>
                    <div class="progress-track">
                        <div class="progress-bar" style="width:${progress}%" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100" role="progressbar"></div>
                    </div>
                    <div class="progress-number">${progress}%</div>
                </div>
            `;
        }).join("");

    } catch (error) {
        console.error("Public progress error:", error);
        renderPublicEmpty(container, "مش قادر أعرض التقدم دلوقتي.");
    }
}

document.addEventListener("DOMContentLoaded", loadPublicProgress);