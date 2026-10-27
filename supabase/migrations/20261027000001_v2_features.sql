-- 한영교회 스마트 안내 & 출석 관리 시스템 v2.0 마이그레이션
-- Migration: 20261027000001_v2_features.sql

-- 새가족 및 방문자 관리 필드 추가
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS is_newcomer BOOLEAN DEFAULT FALSE;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS guide_name TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS visit_reason TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS registered_date DATE DEFAULT CURRENT_DATE;

CREATE INDEX IF NOT EXISTS idx_members_is_newcomer ON public.members (is_newcomer);
