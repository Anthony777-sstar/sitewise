const SUPABASE_URL = "https://bqjppvjosomtphhqkxug.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxanBwdmpvc29tdHBoaHFreHVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5ODU3NjQsImV4cCI6MjA5ODU2MTc2NH0.kFxQJafEC-xripN3ZaWbB_Yh3jzQ3Tc3cav0RZOrTyE";

let _supabase = null;
let _initError = null;

try {
    if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
        _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else if (typeof supabase !== 'undefined' && supabase.createClient) {
        _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
        _initError = 'Supabase library not loaded. Check your internet connection and refresh.';
    }
} catch (e) {
    _initError = 'Failed to initialize Supabase: ' + e.message;
}

function checkInit() {
    if (_initError) return _initError;
    if (!_supabase) return 'Supabase client not initialized.';
    return null;
}

// ─── Auth ────────────────────────────────────────────────

async function signUp(email, password) {
    const err = checkInit();
    if (err) return { error: new Error(err) };
    const { data, error } = await _supabase.auth.signUp({ email, password });
    return { data, error };
}

async function signIn(email, password) {
    const err = checkInit();
    if (err) return { error: new Error(err) };
    const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
    return { data, error };
}

async function signOut() {
    const err = checkInit();
    if (err) return { error: new Error(err) };
    const { error } = await _supabase.auth.signOut();
    return { error };
}

function onAuthStateChange(callback) {
    const err = checkInit();
    if (err) return { error: new Error(err) };
    return _supabase.auth.onAuthStateChange((event, session) => {
        callback(event, session);
    });
}

async function getCurrentUser() {
    const err = checkInit();
    if (err) return null;
    const { data: { user } } = await _supabase.auth.getUser();
    return user;
}

// ─── Assessments CRUD ────────────────────────────────────

async function saveAssessment({ projectName, budget, timeline, safety, resources, score, riskLabel, executiveSummary, originConversationId }) {
    const err = checkInit();
    if (err) return { error: new Error(err) };

    const user = await getCurrentUser();
    if (!user) return { error: new Error("Not authenticated") };

    const payload = {
        user_id: user.id,
        project_name: projectName,
        budget, timeline, safety, resources,
        score, risk_label: riskLabel,
        executive_summary: executiveSummary
    };
    if (originConversationId) {
        payload.origin_conversation_id = originConversationId;
    }

    const { data, error } = await _supabase
        .from("assessments")
        .insert([payload])
        .select();

    return { data, error };
}

async function getAssessments() {
    const err = checkInit();
    if (err) return { data: [], error: new Error(err) };

    const user = await getCurrentUser();
    if (!user) return { data: [], error: new Error("Not authenticated") };

    const { data, error } = await _supabase
        .from("assessments")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

    return { data, error };
}

async function getAssessmentById(id) {
    const err = checkInit();
    if (err) return { data: null, error: new Error(err) };

    const { data, error } = await _supabase
        .from("assessments")
        .select("*")
        .eq("id", id)
        .single();

    return { data, error };
}

async function deleteAssessment(id) {
    const err = checkInit();
    if (err) return { error: new Error(err) };

    const { error } = await _supabase
        .from("assessments")
        .delete()
        .eq("id", id);

    return { error };
}

function getSupabaseClient() {
    return _supabase;
}

async function linkAssessmentToConversation(conversationId, assessmentId) {
    const err = checkInit();
    if (err) return { error: new Error(err) };

    const { error } = await _supabase
        .from("buying_conversations")
        .update({ linked_assessment_id: assessmentId })
        .eq("id", conversationId);

    return { error };
}
