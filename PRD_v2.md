# [PRD] 한영교회 스마트 안내 & 디지털 출석 관리 시스템 (v2.0)

**문서 버전:** v2.0.0  
**작성 일자:** 2026년 10월  
**적용 대상:** 한영교회 안내위원회, 행정 교역자실, 당회  
**기술 스택:** Pure Web (HTML5, Vanilla CSS3, Vanilla JS ES6+), Google OAuth 2.0, Supabase (DB/Auth/RLS), Vercel (Hosting)  
**라이브 배포 URL:** [https://1026001.vercel.app](https://1026001.vercel.app)

---

## 1. 프로젝트 개요 및 v2.0 핵심 강화 명세

한영교회 약 250명의 성도와 매주 방문하는 새가족을 효율적으로 맞이하고 신속한 행정 처리를 지원하는 **하이브리드 터치 & 셀프 출석 관리 시스템 v2.0**입니다.

### 1.1 v2.0 핵심 요구사항 구현 목록
1. **엑셀(.xlsx/.csv) 파일로 250명 성도 명단 일괄 업로드/수정**:
   - 엑셀 업로드 표준 양식(`한영교회_성도명단_업로드양식.csv`) 원클릭 다운로드.
   - SheetJS(`xlsx.full.min.js`) 기반 드래그앤드롭/파일 선택으로 `.xlsx` 및 `.csv` 파싱.
   - 업로드 전 실시간 미리보기 모달 및 한글 초성(`chosung`, `initial_consonant`) 자동 생성 후 50개 단위 청크 배치 저장.

2. **새가족 / 방문자 빠른 등록 및 별도 관리 탭**:
   - 안내석 및 관리자 화면에서 성함, 연락처, 인도자(소개자), 배정 희망 교구, 방문 계기 즉석 등록.
   - 등록과 동시에 당일 주일예배 출석 자동 체크 옵션.
   - 메인 출석부 교구 필터에 `[🌱 새가족 / 방문자만]` 전용 필터링 및 관리자 대시보드 내 전용 관리 탭 제공.

3. **주일 출석 보고서 인쇄 (A4 출력 / PDF 저장)**:
   - 교역자실 및 당회 보고용 공식 서식 (`@media print` 최적화).
   - 결재란(담당 교역자 - 교구 총괄 - 담임 목사) 포함.
   - 예배별 출석 총괄 요약표, 주일 예배별(1부, 2부, 오후) 비교표, 교구별 출석자 명단 정갈한 인쇄 양식.

4. **키오스크 화면 디자인 및 대형 터치 버튼 대폭 개선**:
   - 상단 대형 한글 자음 가상 키패드 (`[전체] [ㄱ] [ㄴ] ... [ㅎ] [⌫ 지움]`) 탑재로 터치스크린 입력 편의 극대화.
   - 카드 크기 및 얼굴 사진 확대, 고대비 터치 액션 바 적용.
   - 터치 체크인 시 Web Audio API 기반의 은은하고 성스러운 환영 차임 사운드 자동 합성 재생.
   - 30초 무반응 시 키오스크 자동 초기화 타이머 적용.

5. **예배별 (1부, 2부, 청년부/오후 등) 통계 비교 막대 그래프**:
   - 관리자 대시보드 내 예배별(주일 1부, 주일 2부, 오후 찬양, 수요 기도회, 금요 철야) 출석 인원 및 비율 시각화 막대 그래프.
   - 종이 질감(Paper Crafting) 감성에 최적화된 CSS/SVG 반응형 바 차트.

---

## 2. 데이터베이스 스키마 (v2.0)

```sql
-- 1. 사용자 프로필 및 권한 (public.profiles)
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

-- 2. 성도 및 새가족 교적 (public.members)
CREATE TABLE IF NOT EXISTS public.members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    chosung TEXT NOT NULL,
    initial_consonant TEXT,
    position TEXT NOT NULL DEFAULT '성도',
    parish TEXT NOT NULL,
    phone_last4 TEXT,
    photo_url TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_newcomer BOOLEAN DEFAULT FALSE,     -- [v2.0] 새가족 여부
    guide_name TEXT,                       -- [v2.0] 인도자(소개자)
    visit_reason TEXT,                     -- [v2.0] 방문 사유
    registered_date DATE DEFAULT CURRENT_DATE, -- [v2.0] 등록일자
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 출석 체크 기록 (public.attendances)
CREATE TABLE IF NOT EXISTS public.attendances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    service_date DATE NOT NULL DEFAULT CURRENT_DATE,
    service_type TEXT NOT NULL DEFAULT '주일1부',
    checked_by UUID REFERENCES public.profiles(id),
    checked_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_member_attendance_per_date UNIQUE (member_id, service_date, service_type)
);
```

---

## 3. 디렉토리 구조 (v2.0)

```
├── index.html            # 메인 출석부 및 대형 터치 키오스크 (v2.0)
├── admin.html            # 관리자 대시보드 (통계 그래프, 새가족, 엑셀 일괄 업로드, A4 보고서)
├── css/
│   └── style.css         # Anti-AI 감성 디자인 시스템 및 @media print A4 스타일
├── js/
│   ├── supabaseClient.js # Supabase 클라이언트 연동 및 전역 알림
│   ├── auth.js           # Google OAuth 2.0 및 시연 모드
│   ├── attendance.js     # 초성 필터링, 출석 토글, 개선된 키오스크, 사운드 합성
│   ├── batchExcel.js     # [v2.0] 엑셀(.xlsx/.csv) 일괄 업로드 & 서식 다운로드
│   ├── newcomers.js      # [v2.0] 새가족/방문자 등록 및 조회 관리
│   ├── printReport.js    # [v2.0] 주일 출석 보고서 인쇄 (A4 서식 / PDF)
│   ├── exportExcel.js    # 이번 주 출석자 명단 CSV/XLSX 다운로드
│   └── admin.js          # 권한 승인, 교적 CRUD, 예배별 통계 비교 그래프
└── supabase/
    ├── config.toml
    └── migrations/
        ├── 20261026000001_initial_schema.sql
        └── 20261027000001_v2_features.sql
```
