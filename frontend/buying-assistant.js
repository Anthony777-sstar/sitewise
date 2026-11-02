const sb = getSupabaseClient();
let currentUser = null;
let currentConversationId = null;
let currentIntent = null;
let currentLocation = null;
let conversations = [];
let messages = [];
let attachedFile = null;
let attachedFileText = null;
let isSending = false;

// DOM References
const intentModal = document.getElementById('intentModal');
const confirmModal = document.getElementById('confirmModal');
const baMessages = document.getElementById('baMessages');
const baEmpty = document.getElementById('baEmpty');
const baInput = document.getElementById('baInput');
const baSendBtn = document.getElementById('baSendBtn');
const baNewBtn = document.getElementById('baNewBtn');
const baHistory = document.getElementById('baHistory');
const baTopbarTitle = document.getElementById('baTopbarTitle');
const baFileInput = document.getElementById('baFileInput');
const baAttachBtn = document.getElementById('baAttachBtn');
const baFileName = document.getElementById('baFileName');
const baFileNameText = document.getElementById('baFileNameText');
const baFileRemove = document.getElementById('baFileRemove');
const baLocationPill = document.getElementById('baLocationPill');
const confirmCancel = document.getElementById('confirmCancel');
const confirmGo = document.getElementById('confirmGo');
const baCloseBtn = document.getElementById('baCloseBtn');
const intentModalClose = document.getElementById('intentModalClose');
const startConversationBtn = document.getElementById('startConversationBtn');
const locationPills = document.querySelectorAll('#locationPills .ba-pill');
const intentOptions = document.querySelectorAll('.ba-modal-option');

let selectedLocation = 'NIGERIA';
let selectedIntent = null;

async function init() {
    currentUser = await getCurrentUser();
    if (!currentUser) {
        window.location.href = 'auth.html';
        return;
    }

    setupListeners();
    await loadConversations();

    const params = new URLSearchParams(window.location.search);
    const convoId = params.get('conversation');
    if (convoId) {
        const convo = conversations.find(c => c.id === convoId);
        if (convo) {
            selectConversation(convoId);
            return;
        }
    }

    if (conversations.length > 0) {
        selectConversation(conversations[0].id);
    } else {
        showIntentModal();
    }
}

function setupListeners() {
    locationPills.forEach(pill => {
        pill.addEventListener('click', () => {
            locationPills.forEach(p => p.classList.remove('selected'));
            pill.classList.add('selected');
            selectedLocation = pill.dataset.location;
            updateStartButton();
        });
    });

    intentOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            intentOptions.forEach(o => o.classList.remove('selected-option'));
            opt.classList.add('selected-option');
            selectedIntent = opt.dataset.intent;
            updateStartButton();
        });
    });

    startConversationBtn.addEventListener('click', () => {
        if (selectedIntent) {
            createConversation(selectedIntent, selectedLocation);
        }
    });

    baNewBtn.addEventListener('click', showIntentModal);
    baSendBtn.addEventListener('click', sendMessage);

    baInput.addEventListener('input', () => {
        baInput.style.height = '44px';
        baInput.style.height = Math.min(baInput.scrollHeight, 120) + 'px';
        baSendBtn.disabled = !baInput.value.trim();
    });

    baInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    baAttachBtn.addEventListener('click', () => baFileInput.click());
    baFileInput.addEventListener('change', handleFileAttach);
    baFileRemove.addEventListener('click', removeFile);

    confirmCancel.addEventListener('click', () => confirmModal.classList.add('hidden'));
    confirmGo.addEventListener('click', createAssessmentFromChat);

    if (baCloseBtn) baCloseBtn.addEventListener('click', () => window.location.href = 'app.html');
    if (intentModalClose) intentModalClose.addEventListener('click', () => window.location.href = 'app.html');
    if (intentModal) intentModal.addEventListener('click', (e) => {
        if (e.target === intentModal) window.location.href = 'app.html';
    });

    // Sidebar toggle (mobile)
    const baSidebarToggle = document.getElementById('baSidebarToggle');
    const baSidebarOverlay = document.getElementById('baSidebarOverlay');
    const baSidebar = document.getElementById('baSidebar');
    if (baSidebarToggle && baSidebarOverlay && baSidebar) {
        baSidebarToggle.addEventListener('click', () => {
            baSidebar.classList.add('open');
            baSidebarOverlay.classList.add('visible');
        });
        baSidebarOverlay.addEventListener('click', () => {
            baSidebar.classList.remove('open');
            baSidebarOverlay.classList.remove('visible');
        });
    }

}

function updateStartButton() {
    if (selectedLocation && selectedIntent) {
        startConversationBtn.disabled = false;
    } else {
        startConversationBtn.disabled = true;
    }
}

// Intent Modal
function showIntentModal() {
    selectedLocation = 'NIGERIA';
    selectedIntent = null;
    locationPills.forEach(p => {
        p.classList.toggle('selected', p.dataset.location === 'NIGERIA');
    });
    intentOptions.forEach(o => o.classList.remove('selected-option'));
    startConversationBtn.disabled = true;
    intentModal.classList.remove('hidden');
}

function hideIntentModal() {
    intentModal.classList.add('hidden');
}

// Conversations CRUD
async function createConversation(intentType, location) {
    hideIntentModal();
    showEmptyState();

    const title = intentType === 'BUY_HOUSE' ? 'Buying a house'
                : intentType === 'BUILD_HOUSE' ? 'Building a house'
                : 'Buying land';

    let { data, error } = await sb
        .from('buying_conversations')
        .insert([{
            user_id: currentUser.id,
            intent_type: intentType,
            location: location,
            title: title
        }])
        .select()
        .single();

    if (error && (error.message || '').includes('location')) {
        // location column doesn't exist yet — retry without it
        const result = await sb
            .from('buying_conversations')
            .insert([{
                user_id: currentUser.id,
                intent_type: intentType,
                title: title
            }])
            .select()
            .single();
        data = result.data;
        error = result.error;
    }

    if (error) {
        showInlineError('Failed to create conversation: ' + friendlyError(error.message));
        return;
    }

    currentConversationId = data.id;
    currentIntent = intentType;
    currentLocation = location;
    messages = [];
    renderMessages();
    await loadConversations();
    baInput.focus();
    updateTopbar();
    updateLocationPill();
}

async function loadConversations() {
    const user = await getCurrentUser();
    if (!user) return;

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
    renderHistory();
}

async function loadMessages(conversationId) {
    const { data, error } = await sb
        .from('buying_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

    if (error) {
        showInlineError('Failed to load messages: ' + friendlyError(error.message));
        return;
    }

    messages = data || [];
    const convo = conversations.find(c => c.id === conversationId);
    if (convo) {
        currentIntent = convo.intent_type;
        currentLocation = convo.location || 'NIGERIA';
    }
    renderMessages();
    updateLocationPill();
}

function selectConversation(id) {
    currentConversationId = id;
    removeFile();
    hideInlineError();
    loadMessages(id);
    updateTopbar();
    renderHistory();
}

// Send Message
async function sendMessage() {
    const text = baInput.value.trim();
    if (!text || !currentConversationId || isSending) return;

    isSending = true;
    baSendBtn.disabled = true;
    hideInlineError();

    try {
        const { data: userMsg, error: userErr } = await sb
            .from('buying_messages')
            .insert([{
                conversation_id: currentConversationId,
                role: 'user',
                content: text
            }])
            .select()
            .single();

        if (userErr) {
            showInlineError('Failed to send message: ' + friendlyError(userErr.message));
            return;
        }

        if (attachedFile && attachedFileText) {
            const filePath = `${currentUser.id}/${currentConversationId}/${Date.now()}_${attachedFile.name}`;
            const { error: uploadErr } = await sb.storage
                .from('buying-pdfs')
                .upload(filePath, attachedFile);

            if (!uploadErr) {
                await sb.from('buying_pdf_attachments').insert([{
                    message_id: userMsg.id,
                    storage_path: filePath,
                    original_filename: attachedFile.name,
                    extracted_text: attachedFileText
                }]);
            }
        }

        const currentPdfText = attachedFileText;

        baInput.value = '';
        baInput.style.height = '44px';
        removeFile();

        messages.push(userMsg);
        renderMessages();
        scrollToBottom();

        if (messages.length === 1) {
            const title = text.length > 50 ? text.substring(0, 50) + '...' : text;
            await sb.from('buying_conversations')
                .update({ title: title, updated_at: new Date().toISOString() })
                .eq('id', currentConversationId);
            await loadConversations();
            updateTopbar();
        } else {
            await sb.from('buying_conversations')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', currentConversationId);
        }

        showThinking();

        const history = messages.slice(-20).map(m => ({
            role: m.role,
            content: m.content
        }));
        history.pop();

        try {
            const response = await fetch('/api/buying-assistant/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    intentType: currentIntent || 'BUILD_HOUSE',
                    location: currentLocation || 'NIGERIA',
                    userMessage: text,
                    pdfText: currentPdfText,
                    history: history
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(errText || 'Server error');
            }

            const result = await response.json();

            const { data: assistantMsg, error: asstErr } = await sb
                .from('buying_messages')
                .insert([{
                    conversation_id: currentConversationId,
                    role: 'assistant',
                    content: result.content,
                    suggested_action: result.suggestedAction || null
                }])
                .select()
                .single();

            if (asstErr) {
                showInlineError('Failed to save response: ' + friendlyError(asstErr.message));
            } else {
                messages.push(assistantMsg);
            }

        } catch (err) {
            const errorText = 'Sorry, I ran into an issue: ' + err.message
                + '\n\nMake sure the Java backend is running: cd backend && javac *.java && java Main';
            const { data: errMsg } = await sb
                .from('buying_messages')
                .insert([{
                    conversation_id: currentConversationId,
                    role: 'assistant',
                    content: errorText
                }])
                .select()
                .single();
            if (errMsg) messages.push(errMsg);
        }

        hideThinking();
        renderMessages();
        scrollToBottom();

    } catch (err) {
        showInlineError('Something went wrong: ' + friendlyError(err.message));
    } finally {
        isSending = false;
        baSendBtn.disabled = !baInput.value.trim();
    }
}

// File Handling
async function handleFileAttach(e) {
    const file = e.target.files[0];
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();
    const allowed = ['pdf', 'md', 'txt', 'csv'];
    if (!allowed.includes(ext)) {
        alert('Please select a PDF, Markdown (.md), or text file.');
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        alert('File is too large. Maximum size is 10MB.');
        return;
    }

    attachedFile = file;
    baFileNameText.textContent = file.name;
    baFileName.classList.remove('hidden');

    try {
        if (ext === 'pdf') {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let fullText = '';
            for (let i = 1; i <= Math.min(pdf.numPages, 20); i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                const pageText = content.items.map(item => item.str).join(' ');
                fullText += pageText + '\n';
            }
            attachedFileText = fullText || '[No extractable text found in PDF]';
        } else {
            attachedFileText = await file.text();
        }
    } catch (err) {
        console.error('File extraction error:', err);
        attachedFileText = '[Could not read this file]';
    }

    baFileInput.value = '';
}

function removeFile() {
    attachedFile = null;
    attachedFileText = null;
    baFileName.classList.add('hidden');
    baFileNameText.textContent = '';
    baFileInput.value = '';
}

// Chat Rendering
function showEmptyState() {
    baEmpty.classList.remove('hidden');
    baMessages.querySelectorAll('.ba-msg, .ba-thinking, .ba-inline-error').forEach(el => el.remove());
}

function renderMessages() {
    if (!baMessages) return;

    baMessages.querySelectorAll('.ba-msg, .ba-thinking').forEach(el => el.remove());

    if (messages.length === 0) {
        baEmpty.classList.remove('hidden');
        return;
    }

    baEmpty.classList.add('hidden');

    messages.forEach((msg, idx) => {
        const msgEl = document.createElement('div');
        msgEl.className = 'ba-msg';

        if (msg.role === 'user') {
            msgEl.innerHTML = `<div class="ba-msg-user">${escapeHtml(msg.content)}</div>`;
        } else {
            let extraHtml = '';
            if (msg.suggested_action === 'CREATE_PROJECT') {
                extraHtml = `<button class="ba-bridge-btn" data-conv-id="${currentConversationId}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
                    Create Risk Assessment
                </button>`;
            }
            msgEl.innerHTML = `
                <div class="ba-msg-assistant">
                    <div class="ba-msg-avatar">SW</div>
                    <div style="flex:1;">
                        <div class="ba-msg-content">${formatResponse(msg.content)}</div>
                        ${extraHtml}
                    </div>
                </div>
            `;

            if (msg.suggested_action === 'CREATE_PROJECT') {
                setTimeout(() => {
                    const btn = msgEl.querySelector('.ba-bridge-btn');
                    if (btn) btn.addEventListener('click', showConfirmModal);
                }, 0);
            }
        }

        baMessages.appendChild(msgEl);
    });
}

function showInlineError(msg) {
    const existing = document.getElementById('baInlineError');
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.id = 'baInlineError';
    el.className = 'ba-msg';
    el.style.cssText = 'max-width:680px;margin:0 auto;padding:12px 16px;background:rgba(232,93,93,0.14);border:1px solid rgba(232,93,93,0.15);border-radius:12px;color:#E85D5D;font-size:0.8125rem;line-height:1.6;white-space:pre-line;';
    el.textContent = msg;
    baMessages.appendChild(el);
    scrollToBottom();
}

function hideInlineError() {
    const el = document.getElementById('baInlineError');
    if (el) el.remove();
}

function showThinking() {
    const thinking = document.createElement('div');
    thinking.className = 'ba-thinking ba-msg';
    thinking.id = 'baThinking';
    thinking.innerHTML = `
        <div class="ba-msg-avatar" style="width:28px;height:28px;font-size:0.625rem;">SW</div>
        <div class="ba-thinking-dots">
            <span></span><span></span><span></span>
        </div>
    `;
    baMessages.appendChild(thinking);
    scrollToBottom();
}

function hideThinking() {
    const thinking = document.getElementById('baThinking');
    if (thinking) thinking.remove();
}

function scrollToBottom() {
    baMessages.scrollTop = baMessages.scrollHeight;
}

function updateTopbar() {
    const convo = conversations.find(c => c.id === currentConversationId);
    baTopbarTitle.textContent = convo ? convo.title : 'Buying Assistant';
}

function updateLocationPill() {
    if (!currentLocation) {
        baLocationPill.classList.add('hidden');
        return;
    }

    const intentLabel = currentIntent === 'BUY_HOUSE' ? 'Buying a house'
                      : currentIntent === 'BUILD_HOUSE' ? 'Building a house'
                      : 'Buying land';
    baLocationPill.textContent = `${currentLocation} · ${intentLabel}`;
    baLocationPill.classList.remove('hidden');
}

// History Rendering
function renderHistory() {
    if (!baHistory) return;

    baHistory.innerHTML = '';

    conversations.forEach(c => {
        const el = document.createElement('div');
        el.className = 'ba-history-item';
        if (c.id === currentConversationId) el.classList.add('active');

        const intentLabel = c.intent_type === 'BUY_HOUSE' ? 'Buy'
                          : c.intent_type === 'BUILD_HOUSE' ? 'Build'
                          : 'Land';
        const loc = c.location || 'NIGERIA';

        el.innerHTML = `
            <div class="ba-history-item-name">${escapeHtml(c.title || 'New conversation')}</div>
            <div class="ba-history-item-meta">${intentLabel} &middot; ${timeAgo(c.created_at)}</div>
            <div class="ba-history-location">${loc}</div>
        `;

        el.addEventListener('click', () => selectConversation(c.id));
        baHistory.appendChild(el);
    });
}

// Bridge / Confirm Modal
function showConfirmModal() {
    confirmModal.classList.remove('hidden');
}

async function createAssessmentFromChat() {
    confirmModal.classList.add('hidden');
    window.location.href = `app.html?from_conversation=${currentConversationId}`;
}

// Utils
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatResponse(text) {
    if (!text) return '';
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const withLinks = escaped.replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    ).replace(
        /(^|[^"'>])(https?:\/\/[^\s<]+)/g,
        '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>'
    );
    const paragraphs = withLinks.split('\n').filter(p => p.trim());
    return paragraphs.map(p => `<p>${p.trim()}</p>`).join('');
}

function friendlyError(msg) {
    if (!msg) return 'Something went wrong.';
    if (msg.includes('relation') && msg.includes('does not exist')) {
        return 'Database table not found. Did you run the Module 2 SQL in Supabase?';
    }
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        return 'Cannot reach the Java backend. Make sure to start it: cd backend && javac *.java && java Main';
    }
    if (msg.includes('type') && msg.includes('violates')) return 'Invalid data format.';
    return msg;
}

function timeAgo(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const diff = now - date;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours + 'h ago';
    const days = Math.floor(hours / 24);
    if (days < 7) return days + 'd ago';
    return date.toLocaleDateString();
}

// Bootstrap
document.addEventListener('DOMContentLoaded', init);
