/**
 * 한영교회 스마트 안내 & 출석 관리 시스템
 * Admin Dashboard: User Approvals, Member CRUD & Statistics
 */

let pendingUsers = [];
let allProfiles = [];
let adminServiceDate = new Date().toISOString().split('T')[0];
let adminServiceType = '주일1부';

async function initAdminDashboard() {
  const profile = getCurrentProfile();
  
  // 관리자 권한 확인 (데모 모드 포함)
  if (!profile || profile.role !== 'admin') {
    const main = document.getElementById('admin-content-area');
    if (main) {
      main.innerHTML = `
        <div class="admin-section-card" style="text-align:center; padding:48px 20px;">
          <div style="font-size:3rem; margin-bottom:12px;">🔒</div>
          <h3 style="font-family:var(--font-serif); font-size:1.4rem; color:var(--primary-navy);">관리자 전용 페이지입니다</h3>
          <p style="color:var(--text-muted); margin:8px 0 20px;">이 페이지는 교회 교역자 및 행정 관리자만 접근할 수 있습니다.</p>
          <div style="display:inline-flex; gap:10px;">
            <a href="index.html" class="btn btn-outline">출석부로 돌아가기</a>
            <button class="btn btn-gold" onclick="setDemoRole('admin'); location.reload();">관리자 체험 모드로 전환</button>
          </div>
        </div>
      `;
    }
    return;
  }

  // 데이터 로드
  await loadUserApprovals();
  await loadAttendanceStats();
  await loadAdminMembers();
}

/**
 * 1. 신규 가입자 승인 관리 로드
 */
async function loadUserApprovals() {
  const supabase = getSupabase();
  if (!supabase) return;

  const container = document.getElementById('pending-users-container');
  if (!container) return;

  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    allProfiles = profiles || [];
    pendingUsers = allProfiles.filter(p => p.role === 'pending' || p.status === 'pending');

    renderUserApprovals();
  } catch (err) {
    console.error('Failed to load profiles:', err);
    container.innerHTML = `<p style="color:var(--danger-crimson);">사용자 목록을 불러오지 못했습니다: ${err.message}</p>`;
  }
}

function renderUserApprovals() {
  const pendingContainer = document.getElementById('pending-users-container');
  const allUsersContainer = document.getElementById('all-users-table-body');
  const badge = document.getElementById('pending-count-badge');

  if (badge) {
    badge.textContent = `${pendingUsers.length}명 대기`;
    badge.style.display = pendingUsers.length > 0 ? 'inline-block' : 'none';
  }

  if (pendingContainer) {
    if (pendingUsers.length === 0) {
      pendingContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align:center; padding:32px; color:var(--text-muted); background:var(--bg-canvas); border-radius:var(--radius-md); border:1px dashed var(--border-ink);">
          <p style="font-weight:600;">현재 승인 대기 중인 사용자가 없습니다.</p>
          <p style="font-size:0.85rem; margin-top:4px;">신규 봉사자가 구글 로그인하면 이곳에 즉시 표시됩니다.</p>
        </div>
      `;
    } else {
      pendingContainer.innerHTML = pendingUsers.map(u => `
        <div class="pending-user-card" id="pending-card-${u.id}">
          <div class="user-identity">
            <img src="${u.avatar_url || 'https://api.dicebear.com/7.x/initials/svg?seed=' + encodeURIComponent(u.full_name || u.email)}" alt="사진" />
            <div>
              <div class="name">${u.full_name || '이름 없음'}</div>
              <div class="email">${u.email}</div>
            </div>
          </div>
          <div class="pending-actions">
            <button class="btn btn-primary btn-sm" style="background:var(--sage-green); border-color:var(--sage-green-dark); flex:1;" onclick="updateUserRole('${u.id}', 'usher', 'approved')">
              ✓ 안내위원 승인
            </button>
            <button class="btn btn-gold btn-sm" style="flex:1;" onclick="updateUserRole('${u.id}', 'admin', 'approved')">
              👑 관리자 승인
            </button>
            <button class="btn btn-outline btn-sm" style="color:var(--danger-crimson);" onclick="updateUserRole('${u.id}', 'pending', 'rejected')">
              반려
            </button>
          </div>
        </div>
      `).join('');
    }
  }

  if (allUsersContainer) {
    allUsersContainer.innerHTML = allProfiles.map(u => `
      <tr>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <img src="${u.avatar_url || 'https://api.dicebear.com/7.x/initials/svg?seed=' + encodeURIComponent(u.full_name || u.email)}" style="width:28px; height:28px; border-radius:50%;" />
            <strong>${u.full_name || '이름 없음'}</strong>
          </div>
        </td>
        <td style="color:var(--text-soft);">${u.email}</td>
        <td>
          <span class="role-tag ${u.role}">${u.role === 'admin' ? '관리자' : (u.role === 'usher' ? '안내위원' : '승인대기')}</span>
        </td>
        <td>
          <select class="styled-select" style="padding:4px 8px; font-size:0.8rem;" onchange="updateUserRole('${u.id}', this.value, 'approved')">
            <option value="usher" ${u.role === 'usher' ? 'selected' : ''}>안내위원</option>
            <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>관리자</option>
            <option value="pending" ${u.role === 'pending' ? 'selected' : ''}>승인대기</option>
          </select>
        </td>
      </tr>
    `).join('');
  }
}

async function updateUserRole(userId, newRole, newStatus) {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        role: newRole,
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) throw error;

    showToast(`권한이 '${newRole === 'admin' ? '관리자' : (newRole === 'usher' ? '안내위원' : '승인대기')}'으로 변경되었습니다.`, 'success');
    await loadUserApprovals();
  } catch (err) {
    showToast('권한 변경 실패: ' + err.message, 'error');
  }
}

/**
 * 2. 출석 통계 대시보드 로드
 */
async function loadAttendanceStats() {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    // 1. 재적 인원
    const { count: totalMembers, error: mErr } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    if (mErr) throw mErr;

    // 2. 선택된 예배의 출석 인원
    const { data: attendances, error: aErr } = await supabase
      .from('attendances')
      .select('*, members(parish)')
      .eq('service_date', adminServiceDate)
      .eq('service_type', adminServiceType);

    if (aErr) throw aErr;

    const total = totalMembers || 0;
    const attended = attendances?.length || 0;
    const unattended = Math.max(0, total - attended);
    const rate = total > 0 ? ((attended / total) * 100).toFixed(1) : 0;

    // 통계 메트릭 갱신
    document.getElementById('metric-total').textContent = `${total}명`;
    document.getElementById('metric-attended').textContent = `${attended}명`;
    document.getElementById('metric-unattended').textContent = `${unattended}명`;
    document.getElementById('metric-rate').textContent = `${rate}%`;

    // 교구별 출석 통계 집계
    const parishMap = new Map();
    (attendances || []).forEach(a => {
      const p = a.members?.parish || '미지정';
      parishMap.set(p, (parishMap.get(p) || 0) + 1);
    });

    const parishTbody = document.getElementById('parish-stats-tbody');
    if (parishTbody) {
      if (parishMap.size === 0) {
        parishTbody.innerHTML = `<tr><td colspan="2" style="text-align:center; color:var(--text-muted); padding:20px;">출석 기록이 없습니다.</td></tr>`;
      } else {
        const sorted = Array.from(parishMap.entries()).sort((a, b) => b[1] - a[1]);
        parishTbody.innerHTML = sorted.map(([p, count]) => `
          <tr>
            <td style="font-weight:600;">${p}</td>
            <td style="text-align:right; font-weight:700; color:var(--sage-green);">${count}명</td>
          </tr>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

/**
 * 3. 성도 교적 관리 (CRUD)
 */
let adminMembers = [];

async function loadAdminMembers() {
  const supabase = getSupabase();
  if (!supabase) return;

  const tbody = document.getElementById('admin-members-tbody');
  if (!tbody) return;

  try {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .order('name');

    if (error) throw error;
    adminMembers = data || [];
    renderAdminMembersTable(adminMembers);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="color:var(--danger-crimson); text-align:center;">교적 목록 로드 실패: ${err.message}</td></tr>`;
  }
}

function renderAdminMembersTable(members) {
  const tbody = document.getElementById('admin-members-tbody');
  if (!tbody) return;

  if (members.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:24px;">등록된 성도가 없습니다.</td></tr>`;
    return;
  }

  tbody.innerHTML = members.map((m, idx) => `
    <tr>
      <td style="color:var(--text-muted); font-size:0.8rem;">${idx + 1}</td>
      <td>
        <strong style="font-family:var(--font-serif); font-size:1.05rem;">${m.name}</strong>
        <span style="font-size:0.75rem; color:var(--text-muted); margin-left:4px;">(${m.chosung || '-'})</span>
      </td>
      <td><span class="member-position-badge">${m.position || m.title || '성도'}</span></td>
      <td>${m.parish}</td>
      <td style="font-family:monospace; color:var(--text-muted);">${m.phone_last4 || m.phone_tail || '-'}</td>
      <td style="text-align:right;">
        <button class="btn btn-outline btn-sm" onclick="openEditMemberModal('${m.id}')">수정</button>
        <button class="btn btn-outline btn-sm" style="color:var(--danger-crimson); margin-left:4px;" onclick="deleteMember('${m.id}', '${m.name}')">삭제</button>
      </td>
    </tr>
  `).join('');
}

function openAddMemberModal() {
  document.getElementById('member-modal-title').textContent = '새 성도 등록';
  document.getElementById('member-form-id').value = '';
  document.getElementById('member-form-name').value = '';
  document.getElementById('member-form-position').value = '성도';
  document.getElementById('member-form-parish').value = '1교구 1구역';
  document.getElementById('member-form-phone').value = '';
  document.getElementById('member-form-photo').value = '';
  document.getElementById('member-form-notes').value = '';
  document.getElementById('member-modal').classList.add('active');
}

function openEditMemberModal(id) {
  const member = adminMembers.find(m => m.id === id);
  if (!member) return;

  document.getElementById('member-modal-title').textContent = '성도 정보 수정';
  document.getElementById('member-form-id').value = member.id;
  document.getElementById('member-form-name').value = member.name;
  document.getElementById('member-form-position').value = member.position || member.title || '성도';
  document.getElementById('member-form-parish').value = member.parish || '1교구 1구역';
  document.getElementById('member-form-phone').value = member.phone_last4 || member.phone_tail || '';
  document.getElementById('member-form-photo').value = member.photo_url || '';
  document.getElementById('member-form-notes').value = member.notes || '';
  document.getElementById('member-modal').classList.add('active');
}

function closeMemberModal() {
  document.getElementById('member-modal').classList.remove('active');
}

async function handleSaveMember(e) {
  e.preventDefault();
  const supabase = getSupabase();
  if (!supabase) return;

  const id = document.getElementById('member-form-id').value;
  const name = document.getElementById('member-form-name').value.trim();
  const position = document.getElementById('member-form-position').value;
  const parish = document.getElementById('member-form-parish').value;
  const phone_last4 = document.getElementById('member-form-phone').value.trim();
  const photo_url = document.getElementById('member-form-photo').value.trim();
  const notes = document.getElementById('member-form-notes').value.trim();

  if (!name) {
    showToast('성도 이름을 입력해 주세요.', 'error');
    return;
  }

  // 한글 초성 자동 생성
  const chosung = extractChosung(name);

  try {
    if (id) {
      // 수정
      const { error } = await supabase
        .from('members')
        .update({
          name,
          chosung,
          position,
          title: position,
          parish,
          phone_last4,
          phone_tail: phone_last4,
          photo_url: photo_url || null,
          notes
        })
        .eq('id', id);

      if (error) throw error;
      showToast(`${name} 성도 정보가 수정되었습니다.`, 'success');
    } else {
      // 신규 등록
      const { error } = await supabase
        .from('members')
        .insert([{
          name,
          chosung,
          position,
          title: position,
          parish,
          phone_last4,
          phone_tail: phone_last4,
          photo_url: photo_url || null,
          notes,
          is_active: true
        }]);

      if (error) throw error;
      showToast(`${name} 성도가 새로 등록되었습니다.`, 'success');
    }

    closeMemberModal();
    await loadAdminMembers();
    await loadAttendanceStats();
  } catch (err) {
    showToast('저장 실패: ' + err.message, 'error');
  }
}

async function deleteMember(id, name) {
  if (!confirm(`'${name}' 성도를 교적부에서 삭제(비활성화)하시겠습니까?`)) return;

  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const { error } = await supabase
      .from('members')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
    showToast(`${name} 성도가 비활성화되었습니다.`, 'info');
    await loadAdminMembers();
    await loadAttendanceStats();
  } catch (err) {
    showToast('삭제 실패: ' + err.message, 'error');
  }
}

// 탭 전환
function switchAdminTab(tabName) {
  document.querySelectorAll('.admin-tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.admin-tab-content').forEach(content => content.style.display = 'none');

  const activeBtn = document.getElementById(`tab-btn-${tabName}`);
  const activeContent = document.getElementById(`tab-content-${tabName}`);

  if (activeBtn) activeBtn.classList.add('active');
  if (activeContent) activeContent.style.display = 'block';
}

window.addEventListener('DOMContentLoaded', () => {
  if (window.location.pathname.includes('admin.html')) {
    initAdminDashboard();
    window.addEventListener('auth:change', () => {
      initAdminDashboard();
    });

    const datePicker = document.getElementById('admin-date-picker');
    const typeSelect = document.getElementById('admin-type-select');
    if (datePicker) {
      datePicker.value = adminServiceDate;
      datePicker.addEventListener('change', (e) => {
        adminServiceDate = e.target.value;
        loadAttendanceStats();
      });
    }
    if (typeSelect) {
      typeSelect.value = adminServiceType;
      typeSelect.addEventListener('change', (e) => {
        adminServiceType = e.target.value;
        loadAttendanceStats();
      });
    }

    const memberSearchInput = document.getElementById('admin-member-search');
    if (memberSearchInput) {
      memberSearchInput.addEventListener('input', (e) => {
        const q = e.target.value.trim().toLowerCase();
        const filtered = adminMembers.filter(m => 
          m.name.toLowerCase().includes(q) || 
          (m.parish || '').toLowerCase().includes(q) || 
          (m.chosung || '').includes(q)
        );
        renderAdminMembersTable(filtered);
      });
    }
  }
});

window.switchAdminTab = switchAdminTab;
window.updateUserRole = updateUserRole;
window.openAddMemberModal = openAddMemberModal;
window.openEditMemberModal = openEditMemberModal;
window.closeMemberModal = closeMemberModal;
window.handleSaveMember = handleSaveMember;
window.deleteMember = deleteMember;
window.getAdminServiceDate = () => adminServiceDate;
window.getAdminServiceType = () => adminServiceType;
