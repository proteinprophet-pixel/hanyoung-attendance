# 한영교회 스마트 안내 & 디지털 출석 관리 시스템 (v2.0)

**버전:** v2.0.0  
**기술 스택:** Pure Web (HTML5, Vanilla CSS3, Vanilla JS ES6+), Google OAuth 2.0, Supabase (DB/Auth/RLS), Vercel (Hosting)  
**라이브 배포 URL:** [https://1026001.vercel.app](https://1026001.vercel.app)  
**관리자 대시보드:** [https://1026001.vercel.app/admin.html](https://1026001.vercel.app/admin.html)

---

## 1. 개요 및 v2.0 신규 기능

약 250명의 재적 성도와 방문자를 관리하는 한영교회를 위한 **하이브리드 터치 & 셀프 출석 안내 시스템 v2.0**입니다.

### 🌟 v2.0 신규 추가 기능
1. **엑셀(.xlsx/.csv) 파일로 250명 성도 명단 일괄 업로드 / 수정**:
   - [📄 양식 받기] 클릭 시 표준 업로드 서식 다운로드
   - 엑셀 및 CSV 파일 드래그앤드롭 파싱 (SheetJS 기반)
   - 업로드 전 10개 행 미리보기 및 유효성 검사 후 데이터베이스 일괄 업서트
2. **새가족 / 방문자 등록 및 별도 관리 탭**:
   - 안내석 및 관리자 화면에서 성함, 연락처, 인도자(소개자), 희망 교구, 방문 계기 등록
   - 등록 즉시 당일 예배 출석 자동 체크 지원
   - 메인 출석부 및 관리자 대시보드에 [🌱 새가족 / 방문자 관리] 전용 필터 및 탭 제공
3. **주일 출석 보고서 인쇄 (A4 출력 / PDF 저장)**:
   - 교역자실 및 당회 보고용 공식 서식 (`@media print` A4 최적화)
   - 결재란(담당 교역자, 교구 총괄, 담임 목사) 포함
   - 출석 총괄 요약, 주일 예배별(1부, 2부, 오후) 현황, 교구별 명단 포함
4. **키오스크 화면 디자인 및 버튼 크기 대폭 개선**:
   - 대형 한글 자음 가상 키패드 (`[전체] [ㄱ] [ㄴ] ... [ㅎ] [⌫ 지움]`) 지원
   - 큰 터치 카드, 고대비 가독성, 터치 시 Web Audio API 기반의 은은한 환영 차임 사운드
   - 30초 무반응 시 키오스크 자동 초기화 타이머 적용
5. **예배별 (1부, 2부, 청년부/오후 등) 통계 비교 막대 그래프**:
   - 관리자 대시보드 내 주일 1부, 2부, 오후 찬양, 수요, 금요 예배별 출석 비교 막대 그래프 시각화

---

## 2. Anti-AI 감성 디자인 시스템 (Warm Paper Crafting)

* **캔버스 배경 (Canvas Background):** `#FBF9F5` (Warm Cream Canvas)
* **메인 포인트 (Primary Navy):** `#1B2A4A` (Liturgical Deep Navy)
* **악센트 골드 (Accent Gold):** `#C5A880` (Antique Liturgical Gold)
* **출석 완료 (Sage Green):** `#3A6351` (Sage Green)
* **타이포그래피:** `Nanum Myeongjo`, `Noto Serif KR` (성도명/직분), `Pretendard` (시스템 UI)

---

## 3. 디렉토리 구조

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
