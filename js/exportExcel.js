/**
 * 한영교회 스마트 안내 & 출석 관리 시스템
 * 이번 주 출석자 엑셀(CSV) 원클릭 생성 및 다운로드 모듈
 */

/**
 * 이번 주 또는 지정된 예배의 출석자 명단을 UTF-8 BOM CSV 포맷으로 생성하여 다운로드
 * @param {string} serviceDate - 'YYYY-MM-DD'
 * @param {string} serviceType - '주일1부', '주일2부' 등
 */
async function exportAttendanceToExcel(serviceDate, serviceType) {
  const supabase = getSupabase();
  if (!supabase) {
    showToast('데이터베이스에 연결할 수 없습니다.', 'error');
    return;
  }

  showToast('출석 데이터를 취합하여 엑셀 파일을 생성 중입니다...', 'info');

  try {
    const targetDate = serviceDate || new Date().toISOString().split('T')[0];
    const targetType = serviceType || '주일1부';

    // 1. 해당 날짜/예배의 출석 기록 조회
    const { data: attendances, error: attErr } = await supabase
      .from('attendances')
      .select('*, members(*), profiles(full_name, email)')
      .eq('service_date', targetDate)
      .eq('service_type', targetType)
      .order('checked_at', { ascending: true });

    if (attErr) throw attErr;

    if (!attendances || attendances.length === 0) {
      showToast(`${targetDate} (${targetType}) 출석 기록이 없습니다.`, 'info');
      return;
    }

    // 2. CSV 헤더 및 데이터 행 구성
    const headers = ['순번', '예배일자', '예배구분', '교구/구역', '직분', '성명', '체크시간', '담당안내위원'];
    
    const rows = attendances.map((att, idx) => {
      const member = att.members || {};
      const checker = att.profiles ? (att.profiles.full_name || att.profiles.email) : '키오스크/자율';
      
      let checkTime = '-';
      if (att.checked_at) {
        const d = new Date(att.checked_at);
        checkTime = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }

      return [
        idx + 1,
        att.service_date,
        att.service_type,
        `"${(member.parish || '').replace(/"/g, '""')}"`,
        `"${(member.position || member.title || '성도').replace(/"/g, '""')}"`,
        `"${(member.name || '').replace(/"/g, '""')}"`,
        `"${checkTime}"`,
        `"${checker.replace(/"/g, '""')}"`
      ];
    });

    // 3. UTF-8 BOM(\uFEFF) 추가하여 엑셀 한글 깨짐 방지
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');

    // 4. Blob 생성 및 다운로드 링크 트리거
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = url;
    downloadAnchor.setAttribute('download', `한영교회_출석명단_${targetDate}_${targetType}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
    URL.revokeObjectURL(url);

    showToast(`총 ${attendances.length}명의 출석 명단이 엑셀(CSV)로 다운로드되었습니다.`, 'success');
  } catch (err) {
    console.error('Export Excel failed:', err);
    showToast('엑셀 다운로드 실패: ' + err.message, 'error');
  }
}

window.exportAttendanceToExcel = exportAttendanceToExcel;
