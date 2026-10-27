/**
 * 한영교회 스마트 안내 & 출석 관리 시스템 v2.0
 * Attendance Management, Chosung Search, View Switching & Enhanced Kiosk
 */

const CHOSUNG_ARRAY = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
];

let allMembers = [];
let attendancesMap = new Map(); // member_id -> attendance record
let currentChosung = 'ALL';
let currentParish = 'ALL';
let currentStatusFilter = 'ALL';
let currentSearchTerm = '';
let currentViewMode = 'card'; // 'card' or 'list'
let selectedServiceDate = new Date().toISOString().split('T')[0];
let selectedServiceType = '주일1부';
let kioskInactivityTimer = null;

// 한글 초성 분해 유틸리티
function extractChosung(str) {
  if (!str) return '';
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i) - 44032;
    if (code >= 0 && code <= 11171) {
      result += CHOSUNG_ARRAY[Math.floor(code / 588)];
    } else {
      result += str.charAt(i);
    }
  }
  return result;
}

// 첫 자음 추출
function getInitialConsonant(str) {
  const full = extractChosung(str);
  return full.charAt(0) || '';
}

/**
 * 성도 명단 및 당일 출석 데이터 로드
 */
async function loadAttendanceData() {
  const supabase = getSupabase();
  if (!supabase) return;

  const container = document.getElementById('members-container');
  if (container) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="loading-spinner"></div>
        <p style="margin-top:12px; font-weight:600;">교적 명단과 출석 기록을 불러오는 중입니다...</p>
      </div>
    `;
  }

  try {
    // 1. 성도 명단 조회 (재적 성도)
    const { data: members, error: memErr } = await supabase
      .from('members')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (memErr) throw memErr;
    allMembers = members || [];

    // 초성이 누락된 경우 즉석 보정
    allMembers.forEach(m => {
      if (!m.chosung) m.chosung = extractChosung(m.name);
      if (!m.position) m.position = m.title || '성도';
      if (!m.phone_last4) m.phone_last4 = m.phone_tail || '';
    });

    // 교구 목록 드롭다운 채우기
    populateParishFilter();

    // 2. 당일 출석 기록 조회
    await loadTodayAttendances();

    // 3. UI 렌더링
    renderChosungNav();
    applyFiltersAndRender();
    updateStatsSummary();
  } catch (err) {
    console.error('Failed to load data:', err);
    showToast('데이터 로드 실패: ' + err.message, 'error');
    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <p style="color:var(--danger-crimson); font-weight:700;">명단을 불러오지 못했습니다.</p>
          <button class="btn btn-outline btn-sm" onclick="loadAttendanceData()" style="margin-top:10px;">다시 시도</button>
        </div>
      `;
    }
  }
}

async function loadTodayAttendances() {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const { data: attendances, error: attErr } = await supabase
      .from('attendances')
      .select('*')
      .eq('service_date', selectedServiceDate)
      .eq('service_type', selectedServiceType);

    if (attErr) throw attErr;

    attendancesMap.clear();
    (attendances || []).forEach(a => {
      attendancesMap.set(a.member_id, a);
    });
  } catch (err) {
    console.error('Failed to load attendances:', err);
  }
}

/**
 * 교구 드롭다운 옵션 동적 생성
 */
function populateParishFilter() {
  const select = document.getElementById('parish-filter');
  if (!select) return;

  const parishes = Array.from(new Set(allMembers.map(m => m.parish).filter(Boolean))).sort();
  select.innerHTML = `<option value="ALL">전체 교구 (${allMembers.length}명)</option>`;
  select.innerHTML += `<option value="NEWCOMERS">🌱 새가족 / 방문자만</option>`;
  parishes.forEach(p => {
    const count = allMembers.filter(m => m.parish === p).length;
    select.innerHTML += `<option value="${p}">${p} (${count}명)</option>`;
  });
}

/**
 * 초성 네비게이터 렌더링
 */
function renderChosungNav() {
  const nav = document.getElementById('chosung-navigator');
  if (!nav) return;

  const chosungs = ['ALL', 'ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  
  nav.innerHTML = chosungs.map(ch => {
    const isActive = currentChosung === ch;
    const label = ch === 'ALL' ? '전체' : ch;
    const cls = ch === 'ALL' ? 'chosung-chip all' : 'chosung-chip';
    return `<button class="${cls} ${isActive ? 'active' : ''}" onclick="filterByChosung('${ch}')">${label}</button>`;
  }).join('');
}

function filterByChosung(ch) {
  currentChosung = ch;
  renderChosungNav();
  applyFiltersAndRender();
}

/**
 * 검색 및 필터 종합 적용 후 렌더링
 */
function applyFiltersAndRender() {
  const term = currentSearchTerm.trim().toLowerCase();
  const searchChosung = extractChosung(term);

  const filtered = allMembers.filter(m => {
    // 1. 초성 탭 필터
    if (currentChosung !== 'ALL') {
      const initial = getInitialConsonant(m.name);
      if (initial !== currentChosung) return false;
    }

    // 2. 교구 / 새가족 필터
    if (currentParish === 'NEWCOMERS') {
      if (!m.is_newcomer) return false;
    } else if (currentParish !== 'ALL' && m.parish !== currentParish) {
      return false;
    }

    // 3. 출석 상태 필터
    const isAttended = attendancesMap.has(m.id);
    if (currentStatusFilter === 'ATTENDED' && !isAttended) return false;
    if (currentStatusFilter === 'UNATTENDED' && isAttended) return false;

    // 4. 검색어 필터 (이름 1글자, 전화번호, 초성 매칭 지원)
    if (term) {
      const nameMatch = m.name.toLowerCase().includes(term);
      const phoneMatch = (m.phone_last4 || '').includes(term);
      const chosungMatch = (m.chosung || '').includes(term) || (m.chosung || '').includes(searchChosung);
      if (!nameMatch && !phoneMatch && !chosungMatch) return false;
    }

    return true;
  });

  renderMemberList(filtered);
}

/**
 * 성도 목록 카드/리스트 렌더링
 */
function renderMemberList(members) {
  const container = document.getElementById('members-container');
  if (!container) return;

  if (members.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📖</div>
        <p style="font-size:1.1rem; font-weight:700; color:var(--text-soft);">검색 조건에 맞는 성도가 없습니다.</p>
        <p style="font-size:0.85rem; color:var(--text-muted); margin-top:4px;">이름, 초성 또는 교구 필터를 확인해 주세요.</p>
      </div>
    `;
    return;
  }

  if (currentViewMode === 'card') {
    container.innerHTML = `
      <div class="member-grid-cards">
        ${members.map(m => renderMemberCardHTML(m)).join('')}
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="member-list-view">
        <table class="member-table">
          <thead>
            <tr>
              <th style="width:50px;">사진</th>
              <th>성명 / 직분</th>
              <th>교구 / 구역</th>
              <th>연락처 (뒤4자리)</th>
              <th style="width:130px; text-align:center;">출석 확인</th>
            </tr>
          </thead>
          <tbody>
            ${members.map(m => renderMemberTableRowHTML(m)).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
}

function renderMemberCardHTML(m) {
  const isAttended = attendancesMap.has(m.id);
  const photoFallback = m.name.charAt(0);
  const photoTag = m.photo_url 
    ? `<img src="${m.photo_url}" class="member-photo" alt="${m.name}" loading="lazy" onerror="this.outerHTML='<span class=\\'member-photo-fallback\\'>${photoFallback}</span>'" />`
    : `<span class="member-photo-fallback">${photoFallback}</span>`;

  return `
    <div class="member-card ${isAttended ? 'is-attended' : ''}" id="member-card-${m.id}">
      <div class="card-top-content">
        <div class="member-photo-frame">
          ${photoTag}
        </div>
        <div class="member-info">
          <div class="member-name-row">
            <span class="member-name">${m.name}</span>
            <span class="member-position-badge">${m.position || '성도'}</span>
            ${m.is_newcomer ? '<span class="role-tag usher" style="font-size:0.65rem; padding:1px 5px;">새가족</span>' : ''}
          </div>
          <div class="member-meta-row">
            <span>${m.parish}</span>
            ${m.phone_last4 ? `<span class="member-phone">(${m.phone_last4})</span>` : ''}
          </div>
        </div>
      </div>
      <div class="card-bottom-action">
        <button 
          class="checkin-btn ${isAttended ? 'attended' : ''}" 
          id="btn-attend-${m.id}"
          onclick="toggleAttendance('${m.id}')"
        >
          <span>${isAttended ? '✓' : '○'}</span>
          <span>${isAttended ? '출석 완료' : '출석 체크'}</span>
        </button>
      </div>
    </div>
  `;
}

function renderMemberTableRowHTML(m) {
  const isAttended = attendancesMap.has(m.id);
  const photoFallback = m.name.charAt(0);
  const photoTag = m.photo_url
    ? `<img src="${m.photo_url}" class="table-photo" alt="${m.name}" loading="lazy" onerror="this.outerHTML='<span style=\\'font-weight:700; color:var(--gold-dark);\\'>${photoFallback}</span>'" />`
    : `<span style="font-weight:700; color:var(--gold-dark);">${photoFallback}</span>`;

  return `
    <tr class="${isAttended ? 'is-attended' : ''}" id="member-row-${m.id}">
      <td>${photoTag}</td>
      <td>
        <strong style="font-family:var(--font-serif); font-size:1.05rem;">${m.name}</strong>
        <span class="member-position-badge" style="margin-left:6px;">${m.position || '성도'}</span>
        ${m.is_newcomer ? '<span class="role-tag usher" style="margin-left:4px; font-size:0.65rem;">새가족</span>' : ''}
      </td>
      <td>${m.parish}</td>
      <td style="color:var(--text-muted); font-family:monospace;">${m.phone_last4 || '-'}</td>
      <td style="text-align:center;">
        <button 
          class="btn ${isAttended ? 'btn-primary' : 'btn-outline'} btn-sm"
          style="${isAttended ? 'background:var(--sage-green); border-color:var(--sage-green-dark); color:#fff;' : ''}"
          onclick="toggleAttendance('${m.id}')"
        >
          ${isAttended ? '✓ 출석완료' : '○ 출석체크'}
        </button>
      </td>
    </tr>
  `;
}

/**
 * 1초 초성/사진 매칭 출석 토글 (낙관적 UI 반영)
 */
async function toggleAttendance(memberId) {
  const profile = getCurrentProfile();
  if (profile && profile.role === 'pending') {
    showToast('안내위원 승인 대기 중에는 출석 체크 권한이 없습니다.', 'error');
    return;
  }

  const supabase = getSupabase();
  const isCurrentlyAttended = attendancesMap.has(memberId);
  const member = allMembers.find(m => m.id === memberId);
  const memberName = member ? member.name : '성도';

  // 1. 낙관적 UI 업데이트 (즉각 반영)
  if (isCurrentlyAttended) {
    attendancesMap.delete(memberId);
  } else {
    attendancesMap.set(memberId, {
      member_id: memberId,
      service_date: selectedServiceDate,
      service_type: selectedServiceType,
      checked_at: new Date().toISOString()
    });
  }
  updateSingleMemberUI(memberId, !isCurrentlyAttended);
  updateStatsSummary();

  // 2. 서버 DB 반영
  try {
    if (isCurrentlyAttended) {
      const { error } = await supabase
        .from('attendances')
        .delete()
        .eq('member_id', memberId)
        .eq('service_date', selectedServiceDate)
        .eq('service_type', selectedServiceType);

      if (error) throw error;
      showToast(`${memberName} 성도님 출석이 취소되었습니다.`, 'info');
    } else {
      const { data, error } = await supabase
        .from('attendances')
        .insert([{
          member_id: memberId,
          service_date: selectedServiceDate,
          service_type: selectedServiceType,
          checked_by: profile?.id && profile.id !== 'demo-user-id' ? profile.id : null
        }])
        .select()
        .single();

      if (error) throw error;
      if (data) attendancesMap.set(memberId, data);
      showToast(`${memberName} 성도님 출석 확인되었습니다! 🙏`, 'success');
    }
  } catch (err) {
    console.error('Attendance toggle error:', err);
    // 롤백
    if (isCurrentlyAttended) {
      attendancesMap.set(memberId, { member_id: memberId });
    } else {
      attendancesMap.delete(memberId);
    }
    updateSingleMemberUI(memberId, isCurrentlyAttended);
    updateStatsSummary();
    showToast('출석 저장 실패: ' + err.message, 'error');
  }
}

function updateSingleMemberUI(memberId, isAttended) {
  const card = document.getElementById(`member-card-${memberId}`);
  if (card) {
    if (isAttended) {
      card.classList.add('is-attended');
    } else {
      card.classList.remove('is-attended');
    }
    const btn = document.getElementById(`btn-attend-${memberId}`);
    if (btn) {
      btn.className = `checkin-btn ${isAttended ? 'attended' : ''}`;
      btn.innerHTML = `<span>${isAttended ? '✓' : '○'}</span><span>${isAttended ? '출석 완료' : '출석 체크'}</span>`;
    }
  }

  const row = document.getElementById(`member-row-${memberId}`);
  if (row) {
    if (isAttended) {
      row.classList.add('is-attended');
    } else {
      row.classList.remove('is-attended');
    }
    const btn = row.querySelector('button');
    if (btn) {
      btn.className = `btn ${isAttended ? 'btn-primary' : 'btn-outline'} btn-sm`;
      btn.style = isAttended ? 'background:var(--sage-green); border-color:var(--sage-green-dark); color:#fff;' : '';
      btn.innerHTML = isAttended ? '✓ 출석완료' : '○ 출석체크';
    }
  }
}

/**
 * 당일 출석 통계 요약 갱신
 */
function updateStatsSummary() {
  const total = allMembers.length;
  const attended = attendancesMap.size;
  const rate = total > 0 ? ((attended / total) * 100).toFixed(1) : 0;

  const currentEl = document.getElementById('stats-attended-count');
  const totalEl = document.getElementById('stats-total-count');
  const rateEl = document.getElementById('stats-rate');
  const fillEl = document.getElementById('stats-progress-fill');

  if (currentEl) currentEl.textContent = attended;
  if (totalEl) totalEl.textContent = `/ ${total}명`;
  if (rateEl) rateEl.textContent = `${rate}%`;
  if (fillEl) fillEl.style.width = `${Math.min(rate, 100)}%`;
}

/**
 * Web Audio API 기반 은은하고 성스러운 환영 차임 사운드
 */
function playWelcomeChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // 두 개의 부드러운 사인파 화음 (E5 + B5)
    const freqs = [659.25, 987.77];
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);

      gain.gain.setValueAtTime(0.12, ctx.currentTime + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.08 + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + idx * 0.08);
      osc.stop(ctx.currentTime + idx * 0.08 + 1.25);
    });
  } catch (e) {
    // 오디오 미지원 환경은 조용히 통과
  }
}

/**
 * v2.0 개선된 풀스크린 키오스크 모드
 */
function openKioskMode() {
  const overlay = document.getElementById('kiosk-overlay');
  if (overlay) {
    overlay.classList.add('active');
    renderKioskKeypad();
    renderKioskList('');
    resetKioskTimer();

    const input = document.getElementById('kiosk-search-input');
    if (input) {
      input.value = '';
    }
  }
}

function closeKioskMode() {
  const overlay = document.getElementById('kiosk-overlay');
  if (overlay) {
    overlay.classList.remove('active');
    if (kioskInactivityTimer) clearTimeout(kioskInactivityTimer);
    applyFiltersAndRender();
    updateStatsSummary();
  }
}

function resetKioskTimer() {
  if (kioskInactivityTimer) clearTimeout(kioskInactivityTimer);
  // 30초 무반응 시 초기화
  kioskInactivityTimer = setTimeout(() => {
    const input = document.getElementById('kiosk-search-input');
    if (input) input.value = '';
    renderKioskList('');
  }, 30000);
}

/**
 * 키오스크 대형 터치 자음 키패드
 */
function renderKioskKeypad() {
  const container = document.getElementById('kiosk-keypad-container');
  if (!container) return;

  const consonants = ['전체', 'ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ', '지우기'];

  container.innerHTML = consonants.map(c => {
    if (c === '지우기') {
      return `<button class="kiosk-key-btn clear-key" onclick="handleKioskKey('${c}')">⌫ 지움</button>`;
    }
    return `<button class="kiosk-key-btn" onclick="handleKioskKey('${c}')">${c}</button>`;
  }).join('');
}

function handleKioskKey(key) {
  resetKioskTimer();
  const input = document.getElementById('kiosk-search-input');
  if (!input) return;

  if (key === '전체') {
    input.value = '';
  } else if (key === '지우기') {
    input.value = input.value.slice(0, -1);
  } else {
    input.value += key;
  }
  renderKioskList(input.value);
}

function renderKioskList(query) {
  const container = document.getElementById('kiosk-members-grid');
  if (!container) return;

  const term = (query || '').trim().toLowerCase();
  const searchChosung = extractChosung(term);

  const matched = allMembers.filter(m => {
    if (!term) return true;
    const nameMatch = m.name.toLowerCase().includes(term);
    const phoneMatch = (m.phone_last4 || '').includes(term);
    const chosungMatch = (m.chosung || '').includes(term) || (m.chosung || '').includes(searchChosung);
    return nameMatch || phoneMatch || chosungMatch;
  });

  if (matched.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align:center; padding:48px; color:var(--text-muted); background:#fff; border-radius:var(--radius-lg); border:2px dashed var(--border-ink);">
        <p style="font-size:1.35rem; font-weight:700; color:var(--text-soft);">일치하는 성도님이 없습니다.</p>
        <p style="margin-top:8px; font-size:1rem;">성함 1~2글자 또는 위 자음 키패드를 터치해 보세요.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = matched.map(m => {
    const isAttended = attendancesMap.has(m.id);
    const photoFallback = m.name.charAt(0);
    const photoTag = m.photo_url 
      ? `<img src="${m.photo_url}" class="kiosk-photo-v2" alt="${m.name}" onerror="this.outerHTML='<div class=\\'kiosk-photo-fallback-v2\\'>${photoFallback}</div>'" />`
      : `<div class="kiosk-photo-fallback-v2">${photoFallback}</div>`;

    return `
      <div class="kiosk-card-v2 ${isAttended ? 'attended' : ''}" onclick="kioskSelfCheckin('${m.id}')">
        <div class="kiosk-card-header">
          ${photoTag}
          <div style="text-align:left; flex:1;">
            <div class="kiosk-name-v2">${m.name}</div>
            <div class="kiosk-sub-v2">${m.parish} ${m.phone_last4 ? `(${m.phone_last4})` : ''}</div>
          </div>
          <span class="kiosk-badge-v2">${m.position || '성도'}</span>
        </div>
        <div class="kiosk-action-banner ${isAttended ? 'attended' : ''}">
          ${isAttended ? '✓ 출석 확인 완료' : '👉 여기를 터치하여 출석'}
        </div>
      </div>
    `;
  }).join('');
}

async function kioskSelfCheckin(memberId) {
  resetKioskTimer();
  const member = allMembers.find(m => m.id === memberId);
  if (!member) return;

  const isAlreadyAttended = attendancesMap.has(memberId);
  if (!isAlreadyAttended) {
    await toggleAttendance(memberId);
  }

  // 환영 사운드 재생
  playWelcomeChime();

  // 따뜻한 축복 팝업 표시
  showBlessingModal(member.name, member.position || '성도');
  renderKioskList(document.getElementById('kiosk-search-input')?.value || '');
}

function showBlessingModal(name, position) {
  const modal = document.getElementById('blessing-modal');
  const title = document.getElementById('blessing-member-name');
  if (modal && title) {
    title.textContent = `${name} ${position}님`;
    modal.classList.add('active');
    setTimeout(() => {
      modal.classList.remove('active');
    }, 2400);
  }
}

// 초기 이벤트 바인딩
window.addEventListener('DOMContentLoaded', () => {
  loadAttendanceData();

  const searchInput = document.getElementById('search-input');
  const searchClearBtn = document.getElementById('search-clear-btn');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearchTerm = e.target.value;
      if (searchClearBtn) {
        searchClearBtn.style.display = currentSearchTerm ? 'block' : 'none';
      }
      applyFiltersAndRender();
    });
  }

  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      searchInput.value = '';
      currentSearchTerm = '';
      searchClearBtn.style.display = 'none';
      applyFiltersAndRender();
      searchInput.focus();
    });
  }

  const parishSelect = document.getElementById('parish-filter');
  if (parishSelect) {
    parishSelect.addEventListener('change', (e) => {
      currentParish = e.target.value;
      applyFiltersAndRender();
    });
  }

  const statusSelect = document.getElementById('status-filter');
  if (statusSelect) {
    statusSelect.addEventListener('change', (e) => {
      currentStatusFilter = e.target.value;
      applyFiltersAndRender();
    });
  }

  const serviceSelect = document.getElementById('service-type-select');
  if (serviceSelect) {
    serviceSelect.addEventListener('change', async (e) => {
      selectedServiceType = e.target.value;
      await loadTodayAttendances();
      applyFiltersAndRender();
      updateStatsSummary();
    });
  }

  const cardViewBtn = document.getElementById('view-card-btn');
  const listViewBtn = document.getElementById('view-list-btn');
  if (cardViewBtn && listViewBtn) {
    cardViewBtn.addEventListener('click', () => {
      currentViewMode = 'card';
      cardViewBtn.classList.add('active');
      listViewBtn.classList.remove('active');
      applyFiltersAndRender();
    });
    listViewBtn.addEventListener('click', () => {
      currentViewMode = 'list';
      listViewBtn.classList.add('active');
      cardViewBtn.classList.remove('active');
      applyFiltersAndRender();
    });
  }

  const kioskInput = document.getElementById('kiosk-search-input');
  if (kioskInput) {
    kioskInput.addEventListener('input', (e) => {
      resetKioskTimer();
      renderKioskList(e.target.value);
    });
  }
});

window.toggleAttendance = toggleAttendance;
window.filterByChosung = filterByChosung;
window.loadAttendanceData = loadAttendanceData;
window.openKioskMode = openKioskMode;
window.closeKioskMode = closeKioskMode;
window.kioskSelfCheckin = kioskSelfCheckin;
window.handleKioskKey = handleKioskKey;
window.extractChosung = extractChosung;
window.getInitialConsonant = getInitialConsonant;
window.getAllMembers = () => allMembers;
window.getAttendancesMap = () => attendancesMap;
window.getSelectedServiceDate = () => selectedServiceDate;
window.getSelectedServiceType = () => selectedServiceType;
