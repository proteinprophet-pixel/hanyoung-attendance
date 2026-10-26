-- 한영교회 스마트 안내 & 출석 관리 시스템 초기 스키마
-- Migration: 20261026000001_initial_schema.sql

-- 1. 사용자 프로필 및 역할 관리 테이블
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'pending' CHECK (role IN ('pending', 'usher', 'admin', 'member', 'viewer', 'guest')),
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 한영교회 성도 교적 테이블
CREATE TABLE IF NOT EXISTS public.members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,                    -- 성도 이름 (예: 김은혜)
    chosung TEXT NOT NULL,                 -- 초성 검색용 (예: ㄱㅇㅎ)
    initial_consonant TEXT,                -- 첫 자음 (예: ㄱ)
    position TEXT NOT NULL DEFAULT '성도', -- 직분 (목사, 장로, 권사, 집사, 성도 등)
    parish TEXT NOT NULL,                  -- 교구 / 구역 (예: 1교구 2구역)
    phone_last4 TEXT,                      -- 동명이인 구별용 뒤 4자리
    photo_url TEXT,                        -- 얼굴 매칭용 프로필 사진
    is_active BOOLEAN DEFAULT TRUE,        -- 재적 여부
    notes TEXT,                            -- 비고
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 출석 체크 기록 테이블
CREATE TABLE IF NOT EXISTS public.attendances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    service_date DATE NOT NULL DEFAULT CURRENT_DATE, -- 예배 날짜 (주일)
    service_type TEXT NOT NULL DEFAULT '주일1부',    -- 주일1부, 주일2부, 주일오후 등
    checked_by UUID REFERENCES public.profiles(id),  -- 체크한 안내위원
    checked_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_member_attendance_per_date UNIQUE (member_id, service_date, service_type)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_members_chosung ON public.members (chosung);
CREATE INDEX IF NOT EXISTS idx_members_name ON public.members (name);
CREATE INDEX IF NOT EXISTS idx_members_parish ON public.members (parish);
CREATE INDEX IF NOT EXISTS idx_attendances_date_type ON public.attendances (service_date, service_type);

-- RLS 활성화
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;

-- 관리자 여부 판별 함수 (무한 재귀 방지 SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Profiles RLS 정책
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
CREATE POLICY "profiles_insert_policy" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy" ON public.profiles FOR UPDATE USING (auth.uid() = id OR public.is_admin());

-- Members RLS 정책
DROP POLICY IF EXISTS "members_select_policy" ON public.members;
CREATE POLICY "members_select_policy" ON public.members FOR SELECT USING (true);

DROP POLICY IF EXISTS "members_admin_policy" ON public.members;
CREATE POLICY "members_admin_policy" ON public.members FOR ALL USING (public.is_admin());

-- Attendances RLS 정책
DROP POLICY IF EXISTS "attendances_select_policy" ON public.attendances;
CREATE POLICY "attendances_select_policy" ON public.attendances FOR SELECT USING (true);

DROP POLICY IF EXISTS "attendances_insert_policy" ON public.attendances;
CREATE POLICY "attendances_insert_policy" ON public.attendances FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "attendances_delete_policy" ON public.attendances;
CREATE POLICY "attendances_delete_policy" ON public.attendances FOR DELETE USING (true);

-- 신규 가입 시 기본 pending 프로필 생성 트리거
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url, role, status)
    VALUES (
        new.id,
        coalesce(new.email, ''),
        coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
        coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', ''),
        'pending',
        'pending'
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
        updated_at = NOW();
    RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
