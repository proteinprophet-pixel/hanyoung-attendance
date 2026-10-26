/**
 * 한영교회 스마트 안내 & 출석 관리 시스템
 * Authentication & Role-Based Access Control (RBAC)
 */

let currentUser = null;
let currentProfile = null;

async function checkSession() {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.warn('Session check error:', error.message);
      return null;
    }

    if (session?.user) {
      currentUser = session.user;
      await fetchUserProfile(currentUser.id, currentUser.email);
    } else {
      currentUser = null;
      currentProfile = null;
    }
  } catch (err) {
    console.error('Failed to get session:', err);
  }

  updateAuthUI();
  dispatchAuthEvent();
  return { user: currentUser, profile: currentProfile };
}

async function fetchUserProfile(userId, email) {
  const supabase = getSupabase();
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      currentProfile = data;
    } else {
      // 신규 가입자 초기 프로필 생성
      const { data: newProfile, error: insertErr } = await supabase
        .from('profiles')
        .insert([{
          id: userId,
          email: email,
          full_name: currentUser.user_metadata?.full_name || email.split('@')[0],
          avatar_url: currentUser.user_metadata?.avatar_url || '',
          role: 'pending',
          status: 'pending'
        }])
        .select()
        .single();
      
      if (!insertErr) {
        currentProfile = newProfile;
      }
    }
  } catch (err) {
    console.error('Error fetching profile:', err);
  }
}

async function signInWithGoogle() {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname
      }
    });
    if (error) throw error;
  } catch (err) {
    showToast('구글 로그인 실패: ' + err.message, 'error');
  }
}

async function signOut() {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    await supabase.auth.signOut();
    currentUser = null;
    currentProfile = null;
    localStorage.removeItem('hanyoung_demo_role');
    showToast('로그아웃 되었습니다.', 'info');
    updateAuthUI();
    dispatchAuthEvent();
    if (window.location.pathname.includes('admin.html')) {
      window.location.href = 'index.html';
    }
  } catch (err) {
    showToast('로그아웃 중 오류가 발생했습니다.', 'error');
  }
}

/**
 * 데모/시뮬레이션 역할 설정 (안내석 빠른 시연용)
 */
function setDemoRole(role) {
  if (role) {
    localStorage.setItem('hanyoung_demo_role', role);
    currentProfile = {
      id: 'demo-user-id',
      email: `${role}@hanyoung.church`,
      full_name: role === 'admin' ? '김관리 목사 (시연)' : '이안내 권사 (시연)',
      avatar_url: '',
      role: role,
      status: 'approved'
    };
    currentUser = {
      id: 'demo-user-id',
      email: `${role}@hanyoung.church`
    };
    showToast(`'${role === 'admin' ? '관리자(Admin)' : '안내위원(Usher)'}' 권한으로 전환되었습니다.`, 'success');
  } else {
    localStorage.removeItem('hanyoung_demo_role');
    checkSession();
  }
  updateAuthUI();
  dispatchAuthEvent();
}

function updateAuthUI() {
  const authContainer = document.getElementById('auth-action-area');
  const pendingBanner = document.getElementById('pending-approval-banner');
  const adminLink = document.getElementById('admin-nav-link');

  // 로컬 데모 롤 확인
  const savedDemoRole = localStorage.getItem('hanyoung_demo_role');
  if (savedDemoRole && !currentUser) {
    currentProfile = {
      id: 'demo-user-id',
      email: `${savedDemoRole}@hanyoung.church`,
      full_name: savedDemoRole === 'admin' ? '김관리 목사 (시연)' : '이안내 권사 (시연)',
      avatar_url: '',
      role: savedDemoRole,
      status: 'approved'
    };
    currentUser = { id: 'demo-user-id', email: currentProfile.email };
  }

  if (!authContainer) return;

  if (currentUser && currentProfile) {
    const roleText = currentProfile.role === 'admin' ? '관리자' : (currentProfile.role === 'usher' ? '안내위원' : '승인대기');
    const roleClass = currentProfile.role;

    authContainer.innerHTML = `
      <div class="user-profile-badge">
        <img class="user-avatar" src="${currentProfile.avatar_url || 'https://api.dicebear.com/7.x/initials/svg?seed=' + encodeURIComponent(currentProfile.full_name || '성도')}" alt="프로필" />
        <span style="font-weight:600;">${currentProfile.full_name || '봉사자'}</span>
        <span class="role-tag ${roleClass}">${roleText}</span>
        <button class="btn btn-outline btn-sm" onclick="signOut()" title="로그아웃">로그아웃</button>
      </div>
    `;

    // 관리자 메뉴 노출 제어
    if (adminLink) {
      adminLink.style.display = currentProfile.role === 'admin' ? 'inline-flex' : 'none';
    }

    // 승인 대기 배너 제어
    if (pendingBanner) {
      pendingBanner.style.display = currentProfile.role === 'pending' ? 'block' : 'none';
    }
  } else {
    authContainer.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;">
        <button class="btn btn-primary btn-sm" onclick="signInWithGoogle()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.761H12.545z"/></svg>
          구글 로그인
        </button>
        <button class="btn btn-outline btn-sm" onclick="setDemoRole('usher')" title="안내위원 권한으로 체험">안내위원 체험</button>
        <button class="btn btn-gold btn-sm" onclick="setDemoRole('admin')" title="관리자 권한으로 체험">관리자 체험</button>
      </div>
    `;

    if (adminLink) adminLink.style.display = 'none';
    if (pendingBanner) pendingBanner.style.display = 'none';
  }
}

function dispatchAuthEvent() {
  const event = new CustomEvent('auth:change', {
    detail: { user: currentUser, profile: currentProfile }
  });
  window.dispatchEvent(event);
}

// 초기화
window.addEventListener('DOMContentLoaded', () => {
  initSupabase();
  const supabase = getSupabase();
  if (supabase) {
    supabase.auth.onAuthStateChange((event, session) => {
      checkSession();
    });
  }
  checkSession();
});

window.signInWithGoogle = signInWithGoogle;
window.signOut = signOut;
window.setDemoRole = setDemoRole;
window.getCurrentUser = () => currentUser;
window.getCurrentProfile = () => currentProfile;
