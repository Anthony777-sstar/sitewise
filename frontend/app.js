// ═══════════════════════════════════════════════════════════════
// SITEWISE — App Shell Logic + Risk Assessment (bridge flow)
// ═══════════════════════════════════════════════════════════════

// ─── State ────────────────────────────────────────────────────
let currentUser = null;
let fromConversationId = null;
let lastResult = null;
let conversations = [];
let selectedConversationId = null;

// ─── DOM References ───────────────────────────────────────────
const sidebar = document.getElementById('appSidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebarClose = document.getElementById('sidebarClose');
const logoutBtn = document.getElementById('logoutBtn');
const userNameEl = document.getElementById('userName');
const userEmailEl = document.getElementById('userEmail');
const userAvatarEl = document.getElementById('userAvatar');
const topbarTitle = document.getElementById('topbarTitle');
const emptyState = document.getElementById('emptyState');
const sidebarHistory = document.getElementById('appSidebarHistory');
const conversationViewer = document.getElementById('conversationViewer');
const cvTitle = document.getElementById('cvTitle');
const cvMessages = document.getElementById('cvMessages');
const cvBackBtn = document.getElementById('cvBackBtn');
const cvContinueBtn = document.getElementById('cvContinueBtn');

const assessmentSection = document.getElementById('assessmentSection');
const assessmentForm = document.getElementById('assessmentForm');
const assessmentResult = document.getElementById('assessmentResult');
const bridgeBanner = document.getElementById('assessmentBridgeBanner');
const bridgeConvoTitle = document.getElementById('bridgeConvoTitle');
const bridgeBackLink = document.getElementById('bridgeBackLink');
const afProjectName = document.getElementById('afProjectName');
const afBudget = document.getElementById('afBudget');
const afTimeline = document.getElementById('afTimeline');
const afSafety = document.getElementById('afSafety');
const afResources = document.getElementById('afResources');
const afBudgetVal = document.getElementById('afBudgetVal');
const afTimelineVal = document.getElementById('afTimelineVal');
const afSafetyVal = document.getElementById('afSafetyVal');
const afResourcesVal = document.getElementById('afResourcesVal');
const afSubmitBtn = document.getElementById('afSubmitBtn');
const afCancelBtn = document.getElementById('afCancelBtn');

const arScoreCircle = document.getElementById('arScoreCircle');
const arProjectName = document.getElementById('arProjectName');
const arRiskLabel = document.getElementById('arRiskLabel');
const arBudget = document.getElementById('arBudget');
const arTimeline = document.getElementById('arTimeline');
const arSafety = document.getElementById('arSafety');
const arResources = document.getElementById('arResources');
const arSummary = document.getElementById('arSummary');
const arSaveBtn = document.getElementById('arSaveBtn');
const arPdfBtn = document.getElementById('arPdfBtn');
const arNewBtn = document.getElementById('arNewBtn');

// ─── Sidebar Conversations ────────────────────────────────────
async function loadConversations() {
    const user = await getCurrentUser();
    if (!user) return;

    const sb = getSupabaseClient();
    const { data, error } = await sb
        .from('buying_conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

    if (error) {
        console.error('Failed to load conversations:', error);
        return;
    }

    conversations = data || [];
    renderSidebarConversations();
}

function renderSidebarConversations() {
    if (!sidebarHistory) return;

    sidebarHistory.innerHTML = '<div class="history-group-label">Recent Conversations</div>';

    if (conversations.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'history-item';
        empty.style.cursor = 'default';
        empty.style.color = 'rgba(255,255,255,0.35)';
        empty.style.fontSize = '0.75rem';
        empty.style.padding = '10px 20px';
        empty.textContent = 'No conversations yet';
        sidebarHistory.appendChild(empty);
        return;
    }

    conversations.slice(0, 10).forEach(c => {
        const el = document.createElement('div');
        el.className = 'history-item';

        const name = document.createElement('div');
        name.className = 'history-item-name';
        name.textContent = c.title || 'New conversation';

        const meta = document.createElement('div');
        meta.className = 'history-item-preview';
        const intentLabel = c.intent_type === 'BUY_HOUSE' ? 'Buy'
                          : c.intent_type === 'BUILD_HOUSE' ? 'Build'
                          : 'Land';
        const loc = c.location || 'NIGERIA';
        meta.textContent = `${intentLabel} · ${loc}`;

        el.appendChild(name);
        el.appendChild(meta);
        el.addEventListener('click', () => {
            showConversation(c.id);
        });
        sidebarHistory.appendChild(el);
    });
}

// ─── Init ─────────────────────────────────────────────────────
async function init() {
    currentUser = await getCurrentUser();
    if (!currentUser) {
        window.location.href = 'auth.html';
        return;
    }

    onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
            window.location.href = 'auth.html';
        }
    });

    renderUserInfo();
    await loadConversations();
    setupEventListeners();

    // Check for bridge flow
    const params = new URLSearchParams(window.location.search);
    fromConversationId = params.get('from_conversation');
    if (fromConversationId) {
        await handleBridgeFlow(fromConversationId);
    }
}

// ─── Conversation Viewer ──────────────────────────────────────
async function showConversation(id) {
    selectedConversationId = id;
    emptyState.classList.add('hidden');
    assessmentSection.classList.add('hidden');
    conversationViewer.classList.remove('hidden');

    const convo = conversations.find(c => c.id === id);
    cvTitle.textContent = convo ? convo.title || 'Conversation' : 'Conversation';
    cvContinueBtn.href = `buying-assistant.html?conversation=${id}`;

    cvMessages.innerHTML = '<div class="cv-empty">Loading messages...</div>';

    const sb = getSupabaseClient();
    const { data, error } = await sb
        .from('buying_messages')
        .select('*')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true });

    if (error) {
        cvMessages.innerHTML = '<div class="cv-empty">Failed to load messages.</div>';
        return;
    }

    renderConversationMessages(data || []);
}

function renderConversationMessages(messages) {
    cvMessages.innerHTML = '';

    if (messages.length === 0) {
        cvMessages.innerHTML = '<div class="cv-empty">No messages in this conversation yet.</div>';
        return;
    }

    messages.forEach(msg => {
        const el = document.createElement('div');
        el.className = 'cv-msg';

        if (msg.role === 'user') {
            el.innerHTML = `<div class="cv-msg-user">${escapeHtml(msg.content)}</div>`;
        } else {
            el.innerHTML = `
                <div class="cv-msg-assistant">
                    <div class="cv-msg-avatar">SW</div>
                    <div class="cv-msg-content">${formatResponse(msg.content)}</div>
                </div>
            `;
        }

        cvMessages.appendChild(el);
    });

    cvMessages.scrollTop = cvMessages.scrollHeight;
}

function hideConversationViewer() {
    conversationViewer.classList.add('hidden');
    selectedConversationId = null;
    if (!document.querySelector('.assessment-section:not(.hidden)')) {
        emptyState.classList.remove('hidden');
    }
}

// ─── Bridge Flow ──────────────────────────────────────────────
async function handleBridgeFlow(conversationId) {
    emptyState.classList.add('hidden');
    assessmentSection.classList.remove('hidden');
    assessmentResult.classList.add('hidden');
    topbarTitle.textContent = 'New Assessment';

    const sb = getSupabaseClient();
    const { data: convo, error } = await sb
        .from('buying_conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

    if (!error && convo) {
        bridgeConvoTitle.textContent = convo.title || 'Chat conversation';
        bridgeBanner.classList.remove('hidden');
        bridgeBackLink.href = `buying-assistant.html?conversation=${conversationId}`;

        // Pre-fill project name from conversation title
        if (convo.title && convo.title !== 'New conversation') {
            afProjectName.value = convo.title;
        } else {
            const intentLabel = convo.intent_type === 'BUY_HOUSE' ? 'House Purchase'
                             : convo.intent_type === 'BUILD_HOUSE' ? 'New Construction'
                             : 'Land Acquisition';
            afProjectName.value = intentLabel + ' — Risk Assessment';
        }
    } else {
        bridgeBanner.classList.add('hidden');
    }

}

// ─── User Info ────────────────────────────────────────────────
function renderUserInfo() {
    if (!currentUser) return;
    const email = currentUser.email || 'user@sitewise.com';
    const name = currentUser.user_metadata?.full_name || email.split('@')[0];
    userNameEl.textContent = name;
    userEmailEl.textContent = email;
    userAvatarEl.textContent = name.charAt(0).toUpperCase();
}

// ─── Event Listeners ──────────────────────────────────────────
function setupEventListeners() {
    // Sidebar
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.add('open');
            sidebarOverlay.classList.add('visible');
        });
    }
    if (sidebarClose) {
        sidebarClose.addEventListener('click', closeSidebar);
    }
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeSidebar);
    }

    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await signOut();
            window.location.href = 'index.html';
        });
    }

    // Slider value display
    afBudget.addEventListener('input', () => { afBudgetVal.textContent = afBudget.value; });
    afTimeline.addEventListener('input', () => { afTimelineVal.textContent = afTimeline.value; });
    afSafety.addEventListener('input', () => { afSafetyVal.textContent = afSafety.value; });
    afResources.addEventListener('input', () => { afResourcesVal.textContent = afResources.value; });

    // Submit
    afSubmitBtn.addEventListener('click', handleSubmit);

    // Cancel / New
    if (afCancelBtn) afCancelBtn.addEventListener('click', resetAssessment);
    if (arNewBtn) arNewBtn.addEventListener('click', resetAssessment);

    // Conversation viewer back
    if (cvBackBtn) cvBackBtn.addEventListener('click', hideConversationViewer);

    // Save
    arSaveBtn.addEventListener('click', handleSave);

    // PDF export
    arPdfBtn.addEventListener('click', exportPdf);
}

function closeSidebar() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('visible');
}

// ─── Submit Assessment ────────────────────────────────────────
async function handleSubmit() {
    const projectName = afProjectName.value.trim() || 'Untitled Project';
    const budget = parseInt(afBudget.value);
    const timeline = parseInt(afTimeline.value);
    const safety = parseInt(afSafety.value);
    const resources = parseInt(afResources.value);

    afSubmitBtn.disabled = true;
    afSubmitBtn.textContent = 'Analyzing...';

    try {
        const result = await assessRisk({ projectName, budget, timeline, safety, resources });
        lastResult = result;
        showResult(result);
    } catch (err) {
        alert('Error: ' + err.message);
    } finally {
        afSubmitBtn.disabled = false;
        afSubmitBtn.textContent = 'Assess Risk';
    }
}

// ─── Display Result ──────────────────────────────────────────
function showResult(result) {
    assessmentForm.classList.add('hidden');
    assessmentResult.classList.remove('hidden');

    const label = result.riskLabel.toLowerCase();
    arScoreCircle.textContent = result.score;
    arScoreCircle.className = 'ar-score-circle ' + label;
    arProjectName.textContent = result.projectName;
    arRiskLabel.textContent = result.riskLabel;
    arRiskLabel.className = 'ar-label ' + label;
    arBudget.textContent = result.budget;
    arTimeline.textContent = result.timeline;
    arSafety.textContent = result.safety;
    arResources.textContent = result.resources;
    arSummary.innerHTML = formatSummary(result.executiveSummary);

    topbarTitle.textContent = 'Assessment: ' + result.projectName;
}

function formatSummary(text) {
    if (!text) return '<p>No executive summary available.</p>';
    return text.split('\n').filter(p => p.trim()).map(p => `<p>${escapeHtml(p.trim())}</p>`).join('');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ─── Save to Supabase ─────────────────────────────────────────
async function handleSave() {
    if (!lastResult) return;
    arSaveBtn.disabled = true;
    arSaveBtn.textContent = 'Saving...';

    try {
        const { data, error } = await saveAssessment({
            projectName: lastResult.projectName,
            budget: lastResult.budget,
            timeline: lastResult.timeline,
            safety: lastResult.safety,
            resources: lastResult.resources,
            score: lastResult.score,
            riskLabel: lastResult.riskLabel,
            executiveSummary: lastResult.executiveSummary,
            originConversationId: fromConversationId || undefined
        });

        if (error) {
            alert('Failed to save: ' + friendlyError(error.message));
            return;
        }

        // Link conversation to assessment
        if (fromConversationId && data && data.length > 0) {
            await linkAssessmentToConversation(fromConversationId, data[0].id);
        }

        arSaveBtn.textContent = 'Saved!';
        arSaveBtn.style.background = 'rgba(111,163,125,0.14)';
        arSaveBtn.style.color = '#6FA37D';
        arSaveBtn.style.border = '1px solid rgba(111,163,125,0.3)';
    } catch (err) {
        alert('Error saving: ' + err.message);
        arSaveBtn.disabled = false;
        arSaveBtn.textContent = 'Save Assessment';
    }
}

// ─── PDF Export ───────────────────────────────────────────────
function exportPdf() {
    if (!lastResult) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;

    // Brand color
    const accent = [59, 130, 246];

    // Header
    doc.setFillColor(...accent);
    doc.rect(0, 0, pageWidth, 8, 'F');
    doc.setFontSize(22);
    doc.setTextColor(20, 20, 30);
    doc.setFont('helvetica', 'bold');
    doc.text('Sitewise', margin, 22);
    doc.setFontSize(9);
    doc.setTextColor(130, 130, 140);
    doc.setFont('helvetica', 'normal');
    doc.text('Risk Assessment Report', margin, 28);

    // Separator
    doc.setDrawColor(230, 230, 235);
    doc.line(margin, 32, pageWidth - margin, 32);

    // Project name
    doc.setFontSize(14);
    doc.setTextColor(20, 20, 30);
    doc.setFont('helvetica', 'bold');
    doc.text(lastResult.projectName, margin, 42);
    doc.setFont('helvetica', 'normal');

    // Score + label
    let y = 52;
    doc.setFontSize(32);
    doc.setTextColor(...accent);
    doc.setFont('helvetica', 'bold');
    doc.text(String(lastResult.score), margin, y);
    doc.setFontSize(10);
    doc.setTextColor(lastResult.riskLabel === 'HIGH' ? 220 : lastResult.riskLabel === 'MEDIUM' ? 217 : 5, lastResult.riskLabel === 'HIGH' ? 38 : lastResult.riskLabel === 'MEDIUM' ? 119 : 150, lastResult.riskLabel === 'HIGH' ? 38 : lastResult.riskLabel === 'MEDIUM' ? 6 : 67);
    doc.text('/100  ' + lastResult.riskLabel, margin + 28, y - 2);

    // Factor score table
    y += 10;
    doc.setDrawColor(240, 240, 245);
    doc.setFillColor(248, 248, 252);
    doc.rect(margin, y, maxWidth, 10, 'F');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 110);
    doc.setFont('helvetica', 'bold');
    doc.text('FACTOR', margin + 4, y + 7);
    doc.text('SCORE', margin + maxWidth - 24, y + 7);

    doc.setFont('helvetica', 'normal');
    const factors = [
        ['Budget', lastResult.budget],
        ['Timeline', lastResult.timeline],
        ['Safety', lastResult.safety],
        ['Resources', lastResult.resources]
    ];
    factors.forEach((f, i) => {
        y += 10;
        if (i % 2 === 0) {
            doc.setFillColor(252, 252, 254);
            doc.rect(margin, y, maxWidth, 10, 'F');
        }
        doc.setFontSize(9);
        doc.setTextColor(40, 40, 50);
        doc.text(f[0], margin + 4, y + 7);
        doc.setTextColor(...accent);
        doc.setFont('helvetica', 'bold');
        doc.text(f[1] + '/10', margin + maxWidth - 24, y + 7, { align: 'right' });
        doc.setFont('helvetica', 'normal');
    });

    // Summary
    y += 16;
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 30);
    doc.setFont('helvetica', 'bold');
    doc.text('Executive Summary', margin, y);

    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 70);
    doc.setFont('helvetica', 'normal');
    const summaryLines = doc.splitTextToSize(
        lastResult.executiveSummary || 'No summary available.',
        maxWidth
    );
    doc.text(summaryLines, margin, y);

    // Date
    y += summaryLines.length * 5 + 10;
    doc.setFontSize(7);
    doc.setTextColor(170, 170, 180);
    doc.text('Generated on ' + new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    }), margin, y);

    // Footer bar
    doc.setFillColor(...accent);
    doc.rect(0, doc.internal.pageSize.getHeight() - 4, pageWidth, 4, 'F');

    // Save
    const filename = 'sitewise-assessment-' + lastResult.projectName.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 30) + '.pdf';
    doc.save(filename);
}

// ─── Reset ────────────────────────────────────────────────────
function resetAssessment() {
    lastResult = null;
    assessmentResult.classList.add('hidden');
    assessmentForm.classList.remove('hidden');
    afBudget.value = 5; afBudgetVal.textContent = '5';
    afTimeline.value = 5; afTimelineVal.textContent = '5';
    afSafety.value = 5; afSafetyVal.textContent = '5';
    afResources.value = 5; afResourcesVal.textContent = '5';
    afProjectName.value = '';
    arSaveBtn.disabled = false;
    arSaveBtn.textContent = 'Save Assessment';
    arSaveBtn.style.background = '';
    arSaveBtn.style.color = '';
    arSaveBtn.style.border = '';
    topbarTitle.textContent = 'New Assessment';

    if (!fromConversationId && !selectedConversationId) {
        assessmentSection.classList.add('hidden');
        emptyState.classList.remove('hidden');
        topbarTitle.textContent = 'Welcome';
    }
}

// ─── Utils ────────────────────────────────────────────────────
function friendlyError(msg) {
    if (!msg) return 'Something went wrong.';
    return msg;
}

// ─── Bootstrap ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);