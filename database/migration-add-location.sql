-- Migration: Add location column to buying_conversations
-- Run this in Supabase SQL Editor if you already ran schema-module2.sql
-- before the location column was added to the schema.

ALTER TABLE buying_conversations
ADD COLUMN IF NOT EXISTS location VARCHAR(10) NOT NULL DEFAULT 'NIGERIA'
CHECK (location IN ('USA','UK','NIGERIA'));
