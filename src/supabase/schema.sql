-- ============================================================================
-- Lunartide Supabase Migration Schema
-- Phase 16.0 — Cloud Sync Foundation
-- ============================================================================
--
-- Strategy: Each table has:
--   - id (UUID PK) — matches local crypto.randomUUID()
--   - user_id (UUID FK → profiles) — for multi-tenant isolation via RLS
--   - data (JSONB) — full entity payload for flexible schema evolution
--   - created_at / updated_at (TIMESTAMPTZ) — for LWW conflict resolution
--   - is_deleted (BOOLEAN) — soft deletes support
--
-- Local-first: App always writes locally first, sync is async/optional.
-- ============================================================================

-- ── Enable UUID generation ──
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Profiles ──
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  display_name TEXT,
  settings    JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can upsert own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- ── Conversations ──
CREATE TABLE IF NOT EXISTS conversations (
  id            UUID PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title         TEXT NOT NULL DEFAULT '新對話',
  custom_title  TEXT,
  summary_json  JSONB,
  pinned        BOOLEAN DEFAULT false,
  archived      BOOLEAN DEFAULT false,
  auto_title    BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ,
  is_deleted    BOOLEAN DEFAULT false
);

CREATE INDEX idx_conv_user ON conversations(user_id);
CREATE INDEX idx_conv_updated ON conversations(user_id, updated_at DESC);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own conversations"
  ON conversations FOR ALL USING (auth.uid() = user_id);

-- ── Messages ──
CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender          TEXT NOT NULL,               -- 'me' | 'assistant' | 'friend'
  type            TEXT NOT NULL DEFAULT 'text', -- 'text' | 'image' | 'file' | 'sticker'
  content         TEXT,                         -- text content (for text messages)
  data            JSONB DEFAULT '{}'::jsonb,   -- full message payload
  time            TEXT NOT NULL,                -- ISO 8601 string
  status          TEXT DEFAULT 'sent',          -- 'sent' | 'delivered' | 'read'
  revoked         BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_deleted      BOOLEAN DEFAULT false
);

CREATE INDEX idx_msg_conv ON messages(conversation_id);
CREATE INDEX idx_msg_user ON messages(user_id);
CREATE INDEX idx_msg_updated ON messages(conversation_id, updated_at DESC);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own messages"
  ON messages FOR ALL USING (auth.uid() = user_id);

-- ── Memory Entries ──
CREATE TABLE IF NOT EXISTS memory_entries (
  id          UUID PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_deleted  BOOLEAN DEFAULT false
);

CREATE INDEX idx_mem_user ON memory_entries(user_id);
CREATE INDEX idx_mem_updated ON memory_entries(user_id, updated_at DESC);

ALTER TABLE memory_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own memory entries"
  ON memory_entries FOR ALL USING (auth.uid() = user_id);

-- ── Sleep Receipts ──
CREATE TABLE IF NOT EXISTS sleep_receipts (
  id          UUID PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_deleted  BOOLEAN DEFAULT false
);

CREATE INDEX idx_sleep_user ON sleep_receipts(user_id);
CREATE INDEX idx_sleep_updated ON sleep_receipts(user_id, updated_at DESC);

ALTER TABLE sleep_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own sleep receipts"
  ON sleep_receipts FOR ALL USING (auth.uid() = user_id);

-- ── Diet Receipts ──
CREATE TABLE IF NOT EXISTS diet_receipts (
  id          UUID PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_deleted  BOOLEAN DEFAULT false
);

CREATE INDEX idx_diet_user ON diet_receipts(user_id);
CREATE INDEX idx_diet_updated ON diet_receipts(user_id, updated_at DESC);

ALTER TABLE diet_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own diet receipts"
  ON diet_receipts FOR ALL USING (auth.uid() = user_id);

-- ── Focus Sessions ──
CREATE TABLE IF NOT EXISTS focus_sessions (
  id          UUID PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_deleted  BOOLEAN DEFAULT false
);

CREATE INDEX idx_focus_user ON focus_sessions(user_id);
CREATE INDEX idx_focus_updated ON focus_sessions(user_id, updated_at DESC);

ALTER TABLE focus_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own focus sessions"
  ON focus_sessions FOR ALL USING (auth.uid() = user_id);

-- ── Sync Metadata (per-user last sync state) ──
CREATE TABLE IF NOT EXISTS sync_metadata (
  user_id     UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  last_pull_at TIMESTAMPTZ,
  last_push_at TIMESTAMPTZ,
  data         JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE sync_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own sync metadata"
  ON sync_metadata FOR ALL USING (auth.uid() = user_id);

-- ── Updated-at trigger helper ──
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_memory_entries_updated_at BEFORE UPDATE ON memory_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sleep_receipts_updated_at BEFORE UPDATE ON sleep_receipts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_diet_receipts_updated_at BEFORE UPDATE ON diet_receipts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_focus_sessions_updated_at BEFORE UPDATE ON focus_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
