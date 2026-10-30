import { useState } from 'react'
import { agreeSheetRights } from '../utils/sheetRights'

// '사용 권한이 있는 악보만 올립니다' 동의 창. 동의하면 서버에 기록하고 onAgree를 부른다
export default function SheetRightsDialog({ onAgree, onCancel }) {
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function agree() {
    setBusy(true)
    setError('')
    try {
      await agreeSheetRights()
      onAgree()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="rights-dialog" role="dialog" aria-modal="true" aria-labelledby="rights-title">
      <div className="rights-box">
        <h3 id="rights-title">악보를 넣기 전에 확인해 주세요</h3>
        <ul>
          <li>악보는 작곡가·작사가·출판사의 <b>저작권</b>이 있는 자료입니다. 무료로 쓰더라도 허락 없이 복사·공유하면 저작권 침해가 될 수 있습니다.</li>
          <li><b>교회나 내가 사용 권한을 가진 악보만</b> 올립니다. (예: 구입한 악보, 교회 저작권 라이선스로 쓸 수 있는 곡, 저작권자가 허락한 악보, 직접 만든 악보)</li>
          <li>올린 악보는 <b>우리 팀 안에서 예배·연습용으로만</b> 씁니다. 공유 링크는 팀원 전용이나 공유 비밀번호로 잠가 둡니다.</li>
          <li>권리자가 요청하면 그 악보는 지워질 수 있습니다. 올린 악보에 대한 책임은 올린 사람에게 있습니다.</li>
        </ul>
        <label className="rights-check">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          위 내용을 확인했고, 사용 권한이 있는 악보만 올리거나 주소로 넣겠습니다.
        </label>
        {error && <p className="error-text">{error}</p>}
        <div className="rights-actions">
          <button type="button" className="secondary" onClick={onCancel} disabled={busy}>취소</button>
          <button type="button" onClick={agree} disabled={!checked || busy}>{busy ? '저장 중…' : '동의하고 계속'}</button>
        </div>
      </div>
    </div>
  )
}
