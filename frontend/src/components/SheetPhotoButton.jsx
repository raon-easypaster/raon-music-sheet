import { useRef, useState } from 'react'
import { uploadSheetPhoto } from '../utils/sheetUpload'

// 휴대폰에서는 "사진 찍기 / 앨범에서 고르기"가 함께 뜬다. 올리면 구글 드라이브 폴더에 저장되고 주소가 채워진다
export default function SheetPhotoButton({ title, onUploaded }) {
  const inputRef = useRef(null)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setStatus('사진을 줄이고 올리는 중...')
    try {
      const url = await uploadSheetPhoto(file, title)
      onUploaded(url)
      setStatus('✓ 구글 드라이브에 올렸습니다. 곡을 저장하면 반영됩니다.')
    } catch (err) {
      setStatus(err.message || '올리지 못했습니다')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sheet-photo">
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleFile} />
      <button type="button" className="secondary" onClick={() => inputRef.current?.click()} disabled={busy}>
        {busy ? '올리는 중...' : '📷 악보 사진 올리기'}
      </button>
      <span className="sheet-photo-note">
        {status || '교회가 사용 권한을 가진 악보만 올려 주세요.'}
      </span>
    </div>
  )
}
