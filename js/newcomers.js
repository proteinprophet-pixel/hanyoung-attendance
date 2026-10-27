/**
 * 한영교회 스마트 안내 & 출석 관리 시스템 v2.0
 * 새가족 / 방문자 등록 및 관리 모듈
 */

let allNewcomers = [];

/**
 * 새가족 등록 모달 열기
 */
function openNewcomerModal() {
  const modal = document.getElementById('newcomer-modal');
  if (modal) {
    document.getElementById('newcomer-form-name').value = '';
    document.getElementById('newcomer-form-phone').value = '';
    document.getElementById('newcomer-form-guide').value = '';
    document.getElementById('newcomer-form-reason').value = '';
    document.getElementById('newcomer-form-parish').value = '새가족부';
    modal.classList.add('active');
    setTimeout(() => {
      document.getElementById('newcomer-form-name')?.focus();
    }, 150);
  }
}

function closeNewcomerModal() {
  const modal = document.getElementById('newcomer-modal');
  if (modal) modal.classList.remove('active');
}

/**
 * 새가족 등록 처리 (등록 + 당일 출석 자동 체크)
 */
async function handleSaveNewcomer(e) {
  e.preventDefault();
  const supabase = getSupabase();
  if (!supabase) return;

  const name = document.getElementById('newcomer-form-name').value.trim();
  const phone = document.getElementById('newcomer-form-phone').value.trim();
  const guide_name = document.getElementById('newcomer-form-guide').value.trim();
  const visit_reason = document.getElementById('newcomer-form-reason').value.trim();
  const parish = document.getElementById('newcomer-form-parish').value.trim() || '새가족부';
  const autoCheckin = document.getElementById('newcomer-form-autocheck')?.checked ?? true;

  if (!name) {
    showToast('새가족 성함을 입력해 주세요.', 'error');
    return;
  }

  const phone_last4 = phone.replace(/[^0-9]/g, '').slice(-4);
  const chosung = typeof extractChosung === 'function' ? extractChosung(name) : '';
  const initial = typeof getInitialConsonant === 'function' ? getInitialConsonant(name) : '';
  const today = new Date().toISOString().split('T')[0];

  try {
    // 1. members 테이블에 새가족으로 등록
    const { data: member, error: memErr } = await supabase
      .from('members')
      .insert([{
        name,
        chosung,
        initial_consonant: initial,
        position: '성도',
        title: '성도',
        parish,
        phone_last4,
        phone_tail: phone_last4,
        is_active: true,
        is_newcomer: true,
        guide_name,
        visit_reason,
        registered_date: today,
        notes: `새가족 (인도자: ${guide_name || '없음'}, 방문사유: ${visit_reason || '미입력'})`
      }])
      .select()
      .single();

    if (memErr) throw memErr;

    // 2. 당일 출석 자동 체크
    if (autoCheckin && member) {
      const serviceType = typeof getSelectedServiceType === 'function' ? getSelectedServiceType() : '주일1부';
      const profile = typeof getCurrentProfile === 'function' ? getCurrentProfile() : null;

      await supabase
        .from('attendances')
        .insert([{
          member_id: member.id,
          service_date: today,
          service_type: serviceType,
          checked_by: profile?.id && profile.id !== 'demo-user-id' ? profile.id : null
        }]);
    }

    showToast(`환영합니다! '${name}' 새가족이 등록되고 출석 확인되었습니다. 🙏`, 'success');
    closeNewcomerModal();

    // 화면 데이터 새로고침
    if (typeof loadAttendanceData === 'function') await loadAttendanceData();
    if (typeof loadNewcomersList === 'function') await loadNewcomersList();
  } catch (err) {
    console.error('Newcomer save error:', err);
    showToast('새가족 등록 실패: ' + err.message, 'error');
  }
}

/**
 * 관리자용 새가족 목록 로드
 */
async function loadNewcomersList() {
  const supabase = getSupabase();
  if (!supabase) return;

  const tbody = document.getElementById('newcomers-table-body');
  if (!tbody) return;

  try {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('is_newcomer', true)
      .order('registered_date', { ascending: false });

    if (error) throw error;
    allNewcomers = data || [];
    renderNewcomersTable(allNewcomers);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--danger-crimson); padding:20px;">새가족 목록 로드 실패: ${err.message}</td></tr>`;
  }
}

function renderNewcomersTable(list) {
  const tbody = document.getElementById('newcomers-table-body');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:32px;">등록된 새가족이 없습니다.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map((m, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>
        <strong style="font-family:var(--font-serif); font-size:1.05rem;">${m.name}</strong>
        <span class="role-tag usher" style="margin-left:6px; font-size:0.7rem;">새가족</span>
      </td>
      <td>${m.registered_date || '-'}</td>
      <td><strong>${m.guide_name || '-'}</strong></td>
      <td>${m.parish}</td>
      <td style="color:var(--text-soft); font-size:0.85rem;">${m.visit_reason || m.notes || '-'}</td>
    </tr>
  `).join('');
}

window.openNewcomerModal = openNewcomerModal;
window.closeNewcomerModal = closeNewcomerModal;
window.handleSaveNewcomer = handleSaveNewcomer;
window.loadNewcomersList = loadNewcomersList;
