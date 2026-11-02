async function login(username, password) {
    try {
        const email = `${username.trim().toLowerCase()}@team.local`;

        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            throw error;
        }

        const user = data.user;

        const { data: profile, error: profileError } = await supabaseClient
            .from("profiles")
            .select("id, username, display_name, role")
            .eq("id", user.id)
            .single();

        if (profileError) {
            throw profileError;
        }

        if (profile.role === "admin") {
            window.location.href = "admin.html";
        } else {
            window.location.href = "dashboard.html";
        }

    } catch (error) {
        console.error("Login error:", error);
        throw error;
    }
}