(() => {
  const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1-zLfvumiNppHxMbPSN0Ld_rYFrdoUPnc5sd-gvszu3w/edit?gid=0#gid=0';
  const CACHE_KEY = 'sister-school-portal-data';
  const PRIVACY_SWITCH = new Date('2026-08-04T00:00:00+09:00');
  const $ = (selector) => document.querySelector(selector);
  const escape = (value = '') => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[char]);

  function activate(name) {
    document.querySelectorAll('.panel').forEach(panel => panel.classList.toggle('is-active', panel.id === `panel-${name}`));
    document.querySelectorAll('[data-page]').forEach(button => button.setAttribute('aria-selected', String(button.dataset.page === name)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  document.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => activate(button.dataset.page)));

  function setStatus(type, text) {
    const dot = $('#status-dot'); dot.className = `dot ${type}`;
    $('#status-text').textContent = text;
  }
  function showNotice(text) { const notice = $('#data-notice'); notice.textContent = text; notice.hidden = false; }
  function hideNotice() { $('#data-notice').hidden = true; }
  function formatDate(iso) { return new Intl.DateTimeFormat('ko-KR', { dateStyle:'medium', timeStyle:'short', timeZone:'Asia/Seoul' }).format(new Date(iso)); }

  function jsonp(url) {
    return new Promise((resolve, reject) => {
      const callback = `portalData_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      const cleanUp = () => { delete window[callback]; script.remove(); };
      const timer = setTimeout(() => { cleanUp(); reject(new Error('시간 내 응답이 없습니다.')); }, 12000);
      window[callback] = (data) => { clearTimeout(timer); cleanUp(); resolve(data); };
      script.onerror = () => { clearTimeout(timer); cleanUp(); reject(new Error('데이터 API에 연결할 수 없습니다.')); };
      script.src = `${url}${url.includes('?') ? '&' : '?'}callback=${callback}&_=${Date.now()}`;
      document.head.appendChild(script);
    });
  }

  function drawSchedule(items = []) {
    const groups = items.reduce((all, item) => ((all[item.date] ||= []).push(item), all), {});
    $('#schedule-list').innerHTML = Object.entries(groups).map(([date, rows]) => `<section class="date-group"><div class="date-label">${escape(date)}</div>${rows.map(row => `<article class="schedule-item"><div class="time">${escape(row.time)}</div><div><p>${escape(row.activity)}</p><div class="meta">${row.dress ? `<span>복장 · ${escape(row.dress)}</span>` : ''}${row.note ? `<span>${escape(row.note)}</span>` : ''}</div></div></article>`).join('')}</section>`).join('');
  }
  function drawHomestay(items = []) {
    $('#homestay-list').innerHTML = items.map(row => `<article class="card pair"><div class="room-number">매칭 ${escape(row.no)}</div><div class="person-label">한국 참여 학생</div><div class="name">${escape(row.koreanName)}</div><div class="details">${escape([row.grade, row.gender].filter(Boolean).join(' · '))}${row.familyNote ? `\n${escape(row.familyNote)}` : ''}</div><div class="person-label">일본 교류 학생</div><div class="name">${escape(row.partnerName)}</div><div class="details">${escape([row.partnerGrade, row.partnerGender].filter(Boolean).join(' · '))}${row.family ? `\n가족 구성 · ${escape(row.family)}` : ''}</div></article>`).join('');
  }
  function drawHotel(items = []) {
    const rooms = items.reduce((all, item) => ((all[item.room] ||= []).push(item), all), {});
    $('#hotel-list').innerHTML = Object.entries(rooms).map(([room, members]) => `<article class="card"><div class="room-title"><h3>객실 배정</h3><span class="room-number">객실 ${escape(room)}</span></div><ul class="roster">${members.map(member => `<li>${escape(member.name)}<small>${escape([member.grade && member.grade + '학년', member.class && member.class + '반'].filter(Boolean).join(' · '))}</small></li>`).join('')}</ul></article>`).join('');
  }
  function drawNotes(items = []) { $('#notes-list').innerHTML = items.map(item => `<article class="card note-item"><b>●</b><span>${escape(item.text)}</span></article>`).join(''); }
  function drawHome(data) {
    const first = data.schedule && data.schedule[0];
    $('#next-schedule').innerHTML = first ? `<span class="next-time">${escape(first.date)} · ${escape(first.time)}</span><h3>${escape(first.activity)}</h3>${first.note ? `<p>${escape(first.note)}</p>` : ''}` : '<h3>최신 일정을 불러오는 중입니다.</h3>';
    $('#privacy-copy').innerHTML = data.policy && data.policy.isMasked ? '<strong>개인정보 보호 모드가 적용 중입니다.</strong> 2026년 8월 4일부터 학생 이름은 익명화되고, 연락처는 가림 처리됩니다.' : '<strong>행사 운영 기간 정보 표시 중입니다.</strong> 2026년 8월 4일 0시부터 서버에서 학생 이름 익명화와 연락처 가림 처리가 자동 적용됩니다.';
  }
  function render(data) {
    drawSchedule(data.schedule); drawHomestay(data.homestay); drawHotel(data.hotel); drawNotes(data.notes); drawHome(data);
    $('#updated-at').textContent = `마지막 업데이트 · ${formatDate(data.updatedAt)}`;
    setStatus('live', '최신 시트 정보를 표시하고 있습니다.'); hideNotice();
  }
  function cache(data) { if (new Date() < PRIVACY_SWITCH) localStorage.setItem(CACHE_KEY, JSON.stringify(data)); else localStorage.removeItem(CACHE_KEY); }
  function loadCache() { if (new Date() >= PRIVACY_SWITCH) { localStorage.removeItem(CACHE_KEY); return; } try { const saved = JSON.parse(localStorage.getItem(CACHE_KEY)); if (saved) { render(saved); setStatus('alert', '저장된 정보를 표시 중이며 최신 자료를 확인하고 있습니다.'); } } catch (_) {} }
  async function load() {
    const apiUrl = window.PortalConfig && window.PortalConfig.apiUrl;
    if (!apiUrl) { setStatus('alert', '시트 연동 준비 중입니다. 기존 교육 자료는 바로 이용할 수 있습니다.'); showNotice('관리자가 데이터 연동을 설정하는 동안에는 최신 일정·배정 자료를 이 화면에 표시하지 않습니다.'); return; }
    try { const data = await jsonp(apiUrl); render(data); cache(data); }
    catch (_) { setStatus('alert', '최신 정보를 불러오지 못했습니다. 잠시 후 다시 확인합니다.'); showNotice('현재 최신 시트 정보를 불러올 수 없습니다. 네트워크를 확인하거나 원본 시트를 열어 주세요.'); }
  }
  loadCache(); load(); setInterval(load, 10 * 60 * 1000);
  $('#sheet-link').href = SHEET_URL;
})();
