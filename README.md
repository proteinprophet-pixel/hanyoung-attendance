# 한영교회 스마트 안내 & 출석 관리 시스템

**버전:** v1.1.0  
**기술 스택:** Pure Web (HTML5, Vanilla CSS3, Vanilla JS ES6+), Google OAuth 2.0, Supabase (DB/Auth/RLS), Vercel (Hosting)  
**라이브 배포 URL:** [https://1026001.vercel.app](https://1026001.vercel.app)

---

## 1. 개요 및 핵심 기능

매 주일 약 250명의 성도가 출석하는 한영교회를 위한 **하이브리드 터치 & 셀프 출석 안내 시스템**입니다.

1. **안내위원 1초 초성/사진 매칭 모드 (안내석 태블릿용)**:
   - 한글 초성 원클릭 네비게이터 (`[전체] [ㄱ] [ㄴ] ... [ㅎ]`) 지원.
   - 이름 1글자, 전화번호 뒤 4자리, 전체 초성(예: 'ㄱㅇㅎ') 실시간 검색.
   - 얼굴 사진과 교구/구역이 노출되는 카드 뷰 및 빠른 터치용 리스트 뷰 지원.
   - 원터치 출석 토글 (낙관적 UI로 즉각 반응 및 Supabase 실시간 동기화).

2. **입구 성도 셀프 체크인 키오스크 모드 (성도 자율용)**:
   - 태블릿 거치대 전용 풀스크린 키오스크 UI.
   - 성도가 본인 이름을 1~2글자 검색하거나 자음 목록에서 찾아 원터치 출석.
   - 체크인 시 "OOO 성도님, 환영하고 축복합니다! 🙏" 따뜻한 축복 팝업 표시.

3. **관리자 대시보드 및 엑셀(CSV) 원클릭 다운로드 (`/admin.html`)**:
   - 구글 로그인 신규 가입자 승인 관리 (`pending` ➔ `usher` / `admin`).
   - 주일 출석 통계 대시보드 (총 재적, 당일 출석, 미출석, 출석률, 교구별 출석 통계).
   - **이번 주 출석자 엑셀 다운로드**: UTF-8 BOM 인코딩(`\uFEFF`) 기반으로 한글 깨짐 없이 `한영교회_출석명단_YYYY-MM-DD.csv` 즉시 생성.
   - 250명 성도 교적 CRUD 관리 (등록, 수정, 삭제).

---

## 2. Anti-AI 감성 디자인 시스템 (Warm Paper Crafting)

인위적인 네온 그라디언트와 글래스모피즘을 배제하고, 정갈한 주보와 가죽 장정 교적부의 따뜻한 물성을 디지털로 구현했습니다.

* **캔버스 배경 (Canvas Background):** `#FBF9F5` (Warm Cream Canvas)
* **메인 포인트 (Primary Navy):** `#1B2A4A` (Liturgical Deep Navy)
* **악센트 골드 (Accent Gold):** `#C5A880` (Antique Liturgical Gold)
* **출석 완료 (Sage Green):** `#3A6351` (Sage Green)
* **타이포그래피:** `Nanum Myeongjo`, `Noto Serif KR` (성도명/직분), `Pretendard` (시스템 UI)

---

## 3. 디렉토리 구조

```
├── index.html            # 메인 출석부 및 키오스크 화면
├── admin.html            # 관리자 승인, 통계 및 엑셀 다운로드 대시보드
├── css/
│   └── style.css         # Anti-AI 감성 디자인 시스템 스타일시트
├── js/
│   ├── supabaseClient.js # Supabase 클라이언트 및 토스트 유틸
│   ├── auth.js           # 구글 OAuth 및 RBAC 권한 체크
│   ├── attendance.js     # 초성 검색, 출석 토글, 카드/리스트 렌더링, 키오스크
│   ├── admin.js          # 사용자 권한 승인, 성도 CRUD, 출석 통계
│   └── exportExcel.js    # 이번 주 출석자 엑셀/CSV 생성 및 다운로드 로직
└── supabase/
    ├── config.toml       # Supabase 프로젝트 설정
    └── migrations/
        └── 20261026000001_initial_schema.sql # DDL 및 RLS 정책
```
