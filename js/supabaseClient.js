/**
 * 한영교회 스마트 안내 & 출석 관리 시스템
 * Supabase Client & Helper Utilities
 */

const SUPABASE_URL = 'https://bzgtchffxmkkdsctrdtq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6Z3RjaGZmeG1ra2RzY3RyZHRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4ODI3NjAsImV4cCI6MjEwNzQ1ODc2MH0.4CrkdfhIPg4dGBz2vnPRu0lyot6J9GjpfuPRRHcLQ_c';

let supabaseClient = null;

function initSupabase() {
  if (!supabaseClient && window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseClient;
}

function getSupabase() {
  if (!supabaseClient) {
    initSupabase();
  }
  return supabaseClient;
}

/**
 * 전역 토스트 알림 표시
 * @param {string} message - 표시할 메시지
 * @param {'info' | 'success' | 'error'} type - 타입
 */
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✓';
  if (type === 'error') icon = '⚠️';

  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 2800);
}

window.getSupabase = getSupabase;
window.showToast = showToast;
