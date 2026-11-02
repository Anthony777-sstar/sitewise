-- Sitewise Module 2 — Buying Assistant
-- Run this AFTER schema.sql in your Supabase SQL Editor

-- 1. Conversation threads
CREATE TABLE IF NOT EXISTS buying_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    intent_type VARCHAR(20) NOT NULL CHECK (intent_type IN ('BUY_HOUSE','BUILD_HOUSE','BUY_LAND')),
    title VARCHAR(255),
    linked_assessment_id UUID REFERENCES assessments(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_buying_conversations_user_id ON buying_conversations(user_id);
ALTER TABLE buying_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own conversations" ON buying_conversations
    FOR ALL USING (auth.uid() = user_id);

-- 2. Messages in each thread
CREATE TABLE IF NOT EXISTS buying_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES buying_conversations(id) ON DELETE CASCADE,
    role VARCHAR(10) NOT NULL CHECK (role IN ('user','assistant')),
    content TEXT NOT NULL,
    suggested_action VARCHAR(30),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_buying_messages_conversation_id ON buying_messages(conversation_id);
ALTER TABLE buying_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own messages" ON buying_messages
    FOR ALL USING (
        EXISTS (SELECT 1 FROM buying_conversations WHERE id = buying_messages.conversation_id AND user_id = auth.uid())
    );

-- 3. PDF attachments
CREATE TABLE IF NOT EXISTS buying_pdf_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES buying_messages(id) ON DELETE CASCADE,
    storage_path VARCHAR(500) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    extracted_text TEXT,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pdf_attachments_message_id ON buying_pdf_attachments(message_id);
ALTER TABLE buying_pdf_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own PDFs" ON buying_pdf_attachments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM buying_messages m
            JOIN buying_conversations c ON c.id = m.conversation_id
            WHERE m.id = buying_pdf_attachments.message_id AND c.user_id = auth.uid()
        )
    );

-- 4. Link assessments back to the conversation that spawned them
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS origin_conversation_id UUID
    REFERENCES buying_conversations(id) ON DELETE SET NULL;
