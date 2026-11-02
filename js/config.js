// ضع بيانات مشروع Supabase هنا.
// لا تضع كلمات مرور المستخدمين هنا.

const SUPABASE_URL = "https://hhehljbbrdhwamqzshwp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_U66Kjbc4nihr3FrTKSYIpg_xDRgL_bU";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

