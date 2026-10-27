/**
 * 한영교회 스마트 안내 & 출석 관리 시스템 v2.0
 * 엑셀(.xlsx/.csv) 성도 명단 일괄 업로드 및 템플릿 다운로드 모듈
 */

let parsedBatchMembers = [];

/**
 * 엑셀 업로드용 표준 템플릿 다운로드 (.csv)
 */
function downloadMemberTemplate() {
  const headers = ['성명', '직분', '교구', '전화번호뒤4자리', '비고'];
  const sampleData = [
    ['김한영', '담임목사', '교역자실', '1004', '총괄 목회'],
    ['이은혜', '부목사', '교역자실', '7788', '교구 담당'],
    ['박바울', '교육전도사', '청년부 1팀', '3321', '청년부 담당'],
    ['임예린', '성도', '청년부 1팀', '9266', '성가대'],
    ['김경자', '권사', '1교구 3구역', '7877', '안내위원']
  ];

  const csvRows = [
    headers.join(','),
    ...sampleData.map(row => row.map(cell => `"${cell}"`).join(','))
  ];

  const csvContent = '\uFEFF' + csvRows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '한영교회_성도명단_업로드양식.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('업로드 표준 서식 파일이 다운로드되었습니다.', 'success');
}

/**
 * 엑셀(.xlsx, .xls, .csv) 파일 파싱 처리
 */
async function handleBatchFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  const fileName = file.name.toLowerCase();
  showToast(`'${file.name}' 파일을 읽는 중입니다...`, 'info');

  try {
    if (fileName.endsWith('.csv')) {
      await parseCSVFile(file);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      await parseXLSXFile(file);
    } else {
      showToast('지원하지 않는 파일 형식입니다. (.xlsx 또는 .csv 파일 선택)', 'error');
      return;
    }

    renderBatchPreview();
  } catch (err) {
    console.error('Batch parse error:', err);
    showToast('파일 파싱 중 오류가 발생했습니다: ' + err.message, 'error');
  }
}

function parseCSVFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length < 2) {
          throw new Error('데이터 행이 존재하지 않습니다.');
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        parsedBatchMembers = [];

        for (let i = 1; i < lines.length; i++) {
          const cells = parseCSVLine(lines[i]);
          if (cells.length === 0 || !cells[0]) continue;

          parsedBatchMembers.push(mapRowToMember(cells, headers));
        }
        resolve();
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file, 'utf-8');
  });
}

function parseCSVLine(line) {
  const result = [];
  let inQuotes = false;
  let cur = '';
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(cur.trim().replace(/^"|"$/g, ''));
      cur = '';
    } else {
      cur += char;
    }
  }
  result.push(cur.trim().replace(/^"|"$/g, ''));
  return result;
}

function parseXLSXFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        if (!window.XLSX) {
          throw new Error('XLSX 파서 라이브러리가 로드되지 않았습니다.');
        }
        const data = new Uint8Array(e.target.result);
        const workbook = window.XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonRows = window.XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonRows.length < 2) {
          throw new Error('데이터 행이 존재하지 않습니다.');
        }

        const headers = jsonRows[0].map(h => String(h || '').trim());
        parsedBatchMembers = [];

        for (let i = 1; i < jsonRows.length; i++) {
          const row = jsonRows[i];
          if (!row || row.length === 0 || !row[0]) continue;

          const cells = row.map(c => String(c ?? '').trim());
          parsedBatchMembers.push(mapRowToMember(cells, headers));
        }
        resolve();
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function mapRowToMember(cells, headers) {
  let name = '';
  let position = '성도';
  let parish = '1교구 1구역';
  let phone_last4 = '';
  let notes = '';

  headers.forEach((h, idx) => {
    const val = cells[idx] || '';
    if (h.includes('성명') || h.includes('이름') || h.toLowerCase() === 'name') {
      name = val;
    } else if (h.includes('직분') || h.includes('직책') || h.toLowerCase() === 'position') {
      position = val || '성도';
    } else if (h.includes('교구') || h.includes('구역') || h.toLowerCase() === 'parish') {
      parish = val || '1교구 1구역';
    } else if (h.includes('전화') || h.includes('핸드폰') || h.includes('연락처') || h.toLowerCase().includes('phone')) {
      const nums = val.replace(/[^0-9]/g, '');
      phone_last4 = nums.length >= 4 ? nums.slice(-4) : nums;
    } else if (h.includes('비고') || h.includes('메모') || h.toLowerCase() === 'notes') {
      notes = val;
    }
  });

  // 한글 초성 추출
  const chosung = typeof extractChosung === 'function' ? extractChosung(name) : '';
  const initial = typeof getInitialConsonant === 'function' ? getInitialConsonant(name) : '';

  return {
    name,
    chosung,
    initial_consonant: initial,
    position,
    title: position,
    parish,
    phone_last4,
    phone_tail: phone_last4,
    notes,
    is_active: true
  };
}

/**
 * 엑셀 일괄 업로드 미리보기 렌더링
 */
function renderBatchPreview() {
  const modal = document.getElementById('batch-upload-modal');
  const countEl = document.getElementById('batch-preview-count');
  const tbody = document.getElementById('batch-preview-tbody');
  const submitBtn = document.getElementById('batch-submit-btn');

  if (!modal || !tbody) return;

  modal.classList.add('active');
  if (countEl) countEl.textContent = `총 ${parsedBatchMembers.length}명의 성도 데이터 감지`;

  if (parsedBatchMembers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--danger-crimson);">유효한 성도 데이터가 없습니다. 양식을 확인해 주세요.</td></tr>`;
    if (submitBtn) submitBtn.disabled = true;
    return;
  }

  if (submitBtn) submitBtn.disabled = false;

  // 상위 10개 행 미리보기
  const previewRows = parsedBatchMembers.slice(0, 10);
  tbody.innerHTML = previewRows.map((m, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td><strong>${m.name}</strong> <span style="font-size:0.75rem; color:var(--text-muted);">(${m.chosung})</span></td>
      <td><span class="member-position-badge">${m.position}</span></td>
      <td>${m.parish}</td>
      <td style="font-family:monospace;">${m.phone_last4 || '-'}</td>
    </tr>
  `).join('');

  if (parsedBatchMembers.length > 10) {
    tbody.innerHTML += `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:8px; font-size:0.85rem;">... 외 ${parsedBatchMembers.length - 10}명 추가 반영 예정</td></tr>`;
  }
}

/**
 * Supabase DB 일괄 전송 (배치 업서트)
 */
async function submitBatchMembers() {
  const supabase = getSupabase();
  if (!supabase) return;

  if (parsedBatchMembers.length === 0) {
    showToast('업로드할 성도 데이터가 없습니다.', 'error');
    return;
  }

  const submitBtn = document.getElementById('batch-submit-btn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '데이터베이스에 반영 중...';
  }

  showToast(`총 ${parsedBatchMembers.length}명의 성도 데이터를 저장 중입니다...`, 'info');

  try {
    // 50개 단위 청크로 분할하여 안전하게 INSERT
    const chunkSize = 50;
    let insertedCount = 0;

    for (let i = 0; i < parsedBatchMembers.length; i += chunkSize) {
      const chunk = parsedBatchMembers.slice(i, i + chunkSize);
      const { error } = await supabase
        .from('members')
        .insert(chunk);

      if (error) throw error;
      insertedCount += chunk.length;
    }

    showToast(`성공: 총 ${insertedCount}명의 성도 교적이 등록/수정되었습니다!`, 'success');
    closeBatchModal();

    // 관리자 테이블 및 메인 목록 새로고침
    if (typeof loadAdminMembers === 'function') await loadAdminMembers();
    if (typeof loadAttendanceData === 'function') await loadAttendanceData();
    if (typeof loadAttendanceStats === 'function') await loadAttendanceStats();
  } catch (err) {
    console.error('Batch insert error:', err);
    showToast('일괄 등록 실패: ' + err.message, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = '일괄 등록 실행';
    }
  }
}

function closeBatchModal() {
  const modal = document.getElementById('batch-upload-modal');
  if (modal) modal.classList.remove('active');
  parsedBatchMembers = [];
  const fileInput = document.getElementById('batch-file-input');
  if (fileInput) fileInput.value = '';
}

window.downloadMemberTemplate = downloadMemberTemplate;
window.handleBatchFileSelect = handleBatchFileSelect;
window.submitBatchMembers = submitBatchMembers;
window.closeBatchModal = closeBatchModal;
