import { apiFetch } from '../api/client'

// 악보 올리기 동의 안내문 판 번호. 서버 sheetController의 SHEET_RIGHTS_VERSION과 같아야 한다
export const SHEET_RIGHTS_VERSION = 1

let agreedCache = false // 이 화면에서 한 번 확인되면 다시 묻지 않는다

// 동의했는지 서버에 물어본다 → true/false
export async function hasAgreedSheetRights() {
  if (agreedCache) return true
  try {
    const r = await apiFetch('/sheets/agreement')
    agreedCache = !!r.agreed
  } catch {
    agreedCache = false
  }
  return agreedCache
}

// 동의를 서버에 기록한다
export async function agreeSheetRights() {
  await apiFetch('/sheets/agreement', { method: 'POST', body: JSON.stringify({ version: SHEET_RIGHTS_VERSION }) })
  agreedCache = true
}
