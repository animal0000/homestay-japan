/**
 * 2026 자매학교 교류 포털 데이터 API
 *
 * 1. 이 파일을 Google Apps Script 프로젝트의 Code.gs에 붙여 넣습니다.
 * 2. 배포 > 새 배포 > 웹 앱을 선택합니다.
 * 3. 실행 사용자: 나 / 액세스 권한: 모든 사용자로 배포합니다.
 * 4. 발급된 /exec 주소를 사이트의 config.js apiUrl에 넣습니다.
 *
 * 2026-08-04 00:00 (Asia/Seoul)부터 서버 응답 자체가 익명화되므로,
 * GitHub Pages 소스나 브라우저 저장소에 실명이 남지 않습니다.
 */
const SPREADSHEET_ID = '1-zLfvumiNppHxMbPSN0Ld_rYFrdoUPnc5sd-gvszu3w';
const PRIVACY_SWITCH = new Date('2026-08-04T00:00:00+09:00');
const SEOUL_TZ = 'Asia/Seoul';

function doGet(e) {
  const payload = buildPayload_(new Date());
  const callback = (e && e.parameter && e.parameter.callback) || '';
  const body = JSON.stringify(payload);

  // GitHub Pages에서 안전하게 호출할 수 있도록 JSONP를 기본으로 지원합니다.
  if (/^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + body + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(body)
    .setMimeType(ContentService.MimeType.JSON);
}

function buildPayload_(now) {
  const isMasked = now >= PRIVACY_SWITCH;
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const data = {
    policy: { isMasked: isMasked, switchAt: PRIVACY_SWITCH.toISOString() },
    updatedAt: Utilities.formatDate(now, SEOUL_TZ, "yyyy-MM-dd'T'HH:mm:ssXXX"),
    schedule: schedule_(ss.getSheetByName('자매학교 교류관련 행사 일정표')),
    homestay: homestay_(ss.getSheetByName('홈스테이 가정 매칭표'), isMasked),
    hotel: hotel_(ss.getSheetByName('호텔 배정 명단'), isMasked),
    notes: notes_(ss.getSheetByName('교류간 참고사항'), isMasked)
  };
  return data;
}

function values_(sheet) {
  if (!sheet) throw new Error('필수 시트 탭을 찾을 수 없습니다.');
  return sheet.getDataRange().getDisplayValues();
}

function schedule_(sheet) {
  const rows = values_(sheet).slice(2);
  let currentDate = '';
  return rows.filter(r => r.some(Boolean)).map(r => {
    if (r[0]) currentDate = r[0];
    return { date: currentDate, time: r[1] || '', activity: r[2] || '', note: r[3] || '', dress: r[4] || '' };
  });
}

function homestay_(sheet, masked) {
  const rows = values_(sheet).slice(2);
  const result = [];
  let current = null;
  rows.forEach(r => {
    if (!r.some(Boolean)) return;
    if (r[0]) {
      current = { no: r[0], koreanName: person_(r[1], masked, '참여 학생', r[0]), gender: r[2] || '', grade: r[3] || '', familyNote: r[4] || '', partnerName: '', partnerGender: '', partnerGrade: '', family: '' };
      result.push(current);
    } else if (current && r[1]) {
      current.partnerName = person_(r[1], masked, '교류 학생', current.no);
      current.partnerGender = r[2] || '';
      current.partnerGrade = r[3] || '';
      current.family = r[4] || '';
    }
  });
  return result;
}

function hotel_(sheet, masked) {
  const rows = values_(sheet).slice(2);
  let room = '';
  return rows.filter(r => r.some(Boolean)).map((r, i) => {
    if (r[0]) room = r[0];
    return { room: room || String(i + 1), grade: r[1] || '', class: r[2] || '', name: person_(r[3], masked, '참여 학생', i + 1) };
  });
}

function notes_(sheet, masked) {
  return values_(sheet).flat().filter(Boolean).map(text => ({
    text: masked ? String(text).replace(/01[0-9][- ]?\d{3,4}[- ]?\d{4}/g, '010-****-****') : text
  }));
}

function person_(value, masked, label, number) {
  return masked && value ? label + ' ' + String(number).padStart(2, '0') : (value || '');
}
