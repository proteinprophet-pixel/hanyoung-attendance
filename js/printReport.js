/**
 * 한영교회 스마트 안내 & 출석 관리 시스템 v2.0
 * 주일 출석 보고서 인쇄 (A4 규격 / PDF 저장) 모듈
 */

async function openPrintReportModal(serviceDate, serviceType) {
  const supabase = getSupabase();
  if (!supabase) return;

  const targetDate = serviceDate || (typeof getAdminServiceDate === 'function' ? getAdminServiceDate() : new Date().toISOString().split('T')[0]);
  const targetType = serviceType || (typeof getAdminServiceType === 'function' ? getAdminServiceType() : '주일1부');

  showToast('보고서 양식을 생성 중입니다...', 'info');

  try {
    // 1. 전체 재적
    const { data: members, error: mErr } = await supabase
      .from('members')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (mErr) throw mErr;

    // 2. 당일 출석 데이터
    const { data: attendances, error: aErr } = await supabase
      .from('attendances')
      .select('*, members(*)')
      .eq('service_date', targetDate);

    if (aErr) throw aErr;

    // 당일 선택 예배 출석자 및 전체 예배 출석자 분류
    const allAttendedMembers = (attendances || []).map(a => a.members).filter(Boolean);
    const serviceAttended = (attendances || []).filter(a => a.service_type === targetType);

    // 예배별 집계 (1부, 2부, 오후, 수요, 금요)
    const serviceCounts = {
      '주일1부': (attendances || []).filter(a => a.service_type === '주일1부').length,
      '주일2부': (attendances || []).filter(a => a.service_type === '주일2부').length,
      '주일오후': (attendances || []).filter(a => a.service_type === '주일오후').length,
      '수요예배': (attendances || []).filter(a => a.service_type === '수요예배').length,
      '금요철야': (attendances || []).filter(a => a.service_type === '금요철야').length
    };

    // 교구별 집계
    const parishStats = {};
    const attendedMemberIds = new Set(serviceAttended.map(a => a.member_id));

    (members || []).forEach(m => {
      const p = m.parish || '기타';
      if (!parishStats[p]) {
        parishStats[p] = { total: 0, attended: 0, members: [] };
      }
      parishStats[p].total++;
      if (attendedMemberIds.has(m.id)) {
        parishStats[p].attended++;
        parishStats[p].members.push(m);
      }
    });

    const total = members?.length || 0;
    const attended = serviceAttended.length;
    const rate = total > 0 ? ((attended / total) * 100).toFixed(1) : 0;
    const newcomersCount = serviceAttended.filter(a => a.members?.is_newcomer).length;

    // HTML 양식 채우기
    const reportHtml = `
      <div class="print-a4-page" id="printable-report">
        <!-- 보고서 머리말 -->
        <div class="report-header">
          <div class="report-title-area">
            <h2>한영교회 주일 출석 현황 보고서</h2>
            <div class="report-meta">
              <span><strong>예배일자:</strong> ${targetDate} (${targetType})</span>
              <span><strong>출력일시:</strong> ${new Date().toLocaleString('ko-KR')}</span>
            </div>
          </div>
          <!-- 결재란 -->
          <div class="report-approval-box">
            <table class="approval-table">
              <tr>
                <th rowspan="2" class="approval-side">결<br/>재</th>
                <th>담당 교역자</th>
                <th>교구 총괄</th>
                <th>담임 목사</th>
              </tr>
              <tr class="approval-stamp-row">
                <td></td>
                <td></td>
                <td></td>
              </tr>
            </table>
          </div>
        </div>

        <!-- 1. 핵심 요약 표 -->
        <div class="report-section">
          <h4 class="report-section-title">1. 출석 총괄 요약</h4>
          <table class="report-table">
            <thead>
              <tr>
                <th>구분</th>
                <th>총 재적 성도</th>
                <th>당일 출석 인원</th>
                <th>미출석 인원</th>
                <th>출석률</th>
                <th>새가족/방문자</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>${targetType}</strong></td>
                <td>${total}명</td>
                <td><strong style="color:#1B2A4A;">${attended}명</strong></td>
                <td>${total - attended}명</td>
                <td><strong>${rate}%</strong></td>
                <td><strong style="color:#3A6351;">${newcomersCount}명</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 2. 주일 예배별 현황 비교 -->
        <div class="report-section">
          <h4 class="report-section-title">2. 예배별 출석 인원</h4>
          <table class="report-table">
            <thead>
              <tr>
                <th>예배 구분</th>
                <th>주일 1부 (09:00)</th>
                <th>주일 2부 (11:00)</th>
                <th>오후 찬양예배</th>
                <th>당일 누적 합계</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>출석 인원</strong></td>
                <td>${serviceCounts['주일1부']}명</td>
                <td>${serviceCounts['주일2부']}명</td>
                <td>${serviceCounts['주일오후']}명</td>
                <td><strong>${serviceCounts['주일1부'] + serviceCounts['주일2부'] + serviceCounts['주일오후']}명</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 3. 교구/구역별 출석 현황 -->
        <div class="report-section">
          <h4 class="report-section-title">3. 교구 및 구역별 출석 현황</h4>
          <table class="report-table">
            <thead>
              <tr>
                <th>교구 / 구역명</th>
                <th style="width:70px;">재적</th>
                <th style="width:70px;">출석</th>
                <th style="width:70px;">출석률</th>
                <th>출석 성도 명단 (일부)</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(parishStats).map(([p, data]) => {
                const pRate = data.total > 0 ? ((data.attended / data.total) * 100).toFixed(0) : 0;
                const names = data.members.map(m => m.name).join(', ') || '-';
                return `
                  <tr>
                    <td><strong>${p}</strong></td>
                    <td style="text-align:center;">${data.total}</td>
                    <td style="text-align:center; font-weight:700;">${data.attended}</td>
                    <td style="text-align:center;">${pRate}%</td>
                    <td style="font-size:0.82rem; color:#444;">${names}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <!-- 보고서 바닥글 -->
        <div class="report-footer">
          <span>대한예수교장로회 한영교회 행정교역자실 &middot; 안내위원회 보고용</span>
          <span>(서명/직인) _____________________</span>
        </div>
      </div>
    `;

    const container = document.getElementById('print-modal-content');
    const modal = document.getElementById('print-report-modal');
    if (container && modal) {
      container.innerHTML = reportHtml;
      modal.classList.add('active');
    }
  } catch (err) {
    console.error('Report generate error:', err);
    showToast('보고서 생성 실패: ' + err.message, 'error');
  }
}

function executeBrowserPrint() {
  window.print();
}

function closePrintReportModal() {
  const modal = document.getElementById('print-report-modal');
  if (modal) modal.classList.remove('active');
}

window.openPrintReportModal = openPrintReportModal;
window.executeBrowserPrint = executeBrowserPrint;
window.closePrintReportModal = closePrintReportModal;
