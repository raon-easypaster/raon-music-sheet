import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import LoginForm from '../components/LoginForm'
import {
  getOperatorInfo, listCopyrightRequests, getCopyrightRequest, updateCopyrightRequest,
  blockSheets, unblockSheet, lockRequestShare,
} from '../api/copyright'

const STATUS = {
  received: '접수',
  reviewing: '확인 중',
  blocked: '차단함',
  rejected: '반려',
  resolved: '처리 끝',
}
const ROLE = { owner: '저작권자', publisher: '출판사', agent: '대리인', other: '기타' }
const when = (d) => (d ? new Date(d).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' }) : '')

// 운영자(ADMIN_EMAILS)용 저작권 신고 처리 화면
export default function CopyrightAdminPage() {
  const { token } = useAuth()
  const [operator, setOperator] = useState(null) // null = 확인 중
  const [filter, setFilter] = useState('')
  const [list, setList] = useState([])
  const [openId, setOpenId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    getOperatorInfo().then((r) => setOperator(!!r.operator)).catch(() => setOperator(false))
  }, [token])

  const loadList = useCallback(() => {
    listCopyrightRequests(filter).then(setList).catch((err) => setError(err.message))
  }, [filter])
  useEffect(() => { if (operator) loadList() }, [operator, loadList])

  if (!token) return <LoginForm />
  if (operator === null) return <div className="dashboard"><div className="card panel">확인하는 중…</div></div>
  if (!operator) {
    return (
      <div className="dashboard">
        <div className="card panel">
          <h2>운영자만 볼 수 있는 화면입니다</h2>
          <p className="muted-dark">저작권 신고는 서버 설정 ADMIN_EMAILS에 적힌 운영자 계정만 처리합니다.</p>
          <Link to="/">돌아가기</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard copyright-admin">
      <div className="card panel">
        <h2>©️ 저작권 신고 처리</h2>
        <p className="muted-dark">악보 파일은 지우지 않고 <b>차단</b>만 합니다(앱에서 보이지 않음). 신고가 잘못됐으면 차단을 풀면 그대로 돌아옵니다. 처리 결과는 신고한 분의 이메일로 직접 알려 주세요.</p>
        <div className="key-chips" role="group" aria-label="상태로 거르기">
          {[['', '전체'], ...Object.entries(STATUS)].map(([k, label]) => (
            <button key={k || 'all'} type="button" className={filter === k ? 'active' : 'secondary'} onClick={() => setFilter(k)}>{label}</button>
          ))}
        </div>
        {error && <p className="error-text">{error}</p>}
        {list.length === 0 ? <p className="muted">신고가 없습니다</p> : (
          <ul className="copyright-list">
            {list.map((r) => (
              <li key={r._id}>
                <button type="button" className={`secondary copyright-row${openId === r._id ? ' active' : ''}`} onClick={() => setOpenId(openId === r._id ? null : r._id)}>
                  <span className={`copyright-status st-${r.status}`}>{STATUS[r.status]}</span>
                  <b>{r.work}</b>
                  <small>{r.receipt} · {r.name} · {when(r.createdAt)}</small>
                </button>
                {openId === r._id && <RequestDetail id={r._id} onChanged={loadList} />}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="copyright-back"><Link to="/">앱으로 돌아가기</Link></p>
    </div>
  )
}

function RequestDetail({ id, onChanged }) {
  const [data, setData] = useState(null)
  const [version, setVersion] = useState(0)
  const [picked, setPicked] = useState(() => new Set())
  const [status, setStatus] = useState('')
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let alive = true
    getCopyrightRequest(id).then((d) => {
      if (!alive) return
      setData(d)
      setStatus(d.request.status)
      setNote(d.request.operatorNote || '')
    }).catch((err) => { if (alive) setMsg(err.message) })
    return () => { alive = false }
  }, [id, version])

  async function run(action, done) {
    setMsg('')
    try {
      await action()
      setMsg(done)
      setPicked(new Set())
      setVersion((v) => v + 1)
      onChanged()
    } catch (err) { setMsg(err.message) }
  }

  if (!data) return <div className="copyright-detail">{msg || '불러오는 중…'}</div>
  const { request: r, setlist, songs, files } = data
  const inSongs = new Set(songs.flatMap((s) => s.pages.map((p) => p.fileId)).filter(Boolean))
  const extraFiles = files.filter((f) => !inSongs.has(f.fileId))
  const toggle = (fileId) => setPicked((s) => { const n = new Set(s); if (n.has(fileId)) n.delete(fileId); else n.add(fileId); return n })

  const fileRow = (fileId, blocked, label) => (
    <span className="copyright-file">
      {blocked
        ? <><span className="copyright-status st-blocked">차단됨</span>{label}<button type="button" className="secondary" onClick={() => run(() => unblockSheet(fileId), '차단을 풀었습니다')}>차단 풀기</button></>
        : <label><input type="checkbox" checked={picked.has(fileId)} onChange={() => toggle(fileId)} />{label}</label>}
      <a href={`/api/sheets/${fileId}`} target="_blank" rel="noopener noreferrer">파일 보기</a>
    </span>
  )

  return (
    <div className="copyright-detail">
      <dl>
        <dt>신고한 분</dt><dd>{r.name} ({ROLE[r.role]}) · <a href={`mailto:${r.email}`}>{r.email}</a></dd>
        <dt>저작물</dt><dd>{r.work}</dd>
        {r.location && <><dt>위치</dt><dd className="copyright-pre">{r.location}</dd></>}
        {r.details && <><dt>내용</dt><dd className="copyright-pre">{r.details}</dd></>}
        <dt>접수</dt><dd>{r.receipt} · {when(r.createdAt)}{r.handledBy && ` · 마지막 처리 ${r.handledBy} ${when(r.handledAt)}`}</dd>
      </dl>

      {setlist ? (
        <div className="copyright-target">
          <b>공유 링크의 콘티: {setlist.name} ({setlist.team})</b>
          <span className="muted-dark"> · {setlist.shareOpen ? '열린 링크' : '팀원 전용'}{setlist.hasSharePin ? ' · 공유 비밀번호 있음' : ''}</span>
          {(setlist.shareOpen || setlist.hasSharePin) && (
            <button type="button" className="secondary" onClick={() => window.confirm('이 공유 링크를 팀원 전용으로 잠그고 공유 비밀번호를 해제할까요? (팀원은 계속 로그인해서 봅니다)') && run(() => lockRequestShare(id), '공유 링크를 팀원 전용으로 잠갔습니다')}>
              공유 링크 잠그기
            </button>
          )}
          <ul>
            {songs.map((s) => (
              <li key={s._id}>
                <b>{s.title}</b>{s.artist && <span className="muted-dark"> — {s.artist}</span>}
                {s.pages.length === 0 && <span className="muted-dark"> · 악보 없음</span>}
                <ul>
                  {s.pages.map((p, i) => (
                    <li key={i}>
                      {p.fileId
                        ? fileRow(p.fileId, p.blocked, `${p.sheet ? `${p.sheet} 악보 · ` : ''}${p.pageNo}쪽 ${p.type === 'pdf' ? 'PDF' : '사진'}`)
                        : <span className="muted-dark">{p.sheet ? `${p.sheet} 악보 · ` : ''}{p.pageNo}쪽 외부 주소 (앱이 보관하지 않음): {p.url}</span>}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      ) : r.shareToken
        ? <p className="muted-dark">신고에 적힌 공유 링크의 콘티를 찾지 못했습니다 (이미 지워졌을 수 있음).</p>
        : <p className="muted-dark">신고에 공유 링크가 없습니다. 아래 파일 주소나 신고 내용으로 찾아 주세요.</p>}

      {extraFiles.length > 0 && (
        <div className="copyright-target">
          <b>신고에 적힌 악보 파일</b>
          <ul>{extraFiles.map((f) => <li key={f.fileId}>{fileRow(f.fileId, f.blocked, f.fileId.slice(0, 10) + '…')}</li>)}</ul>
        </div>
      )}

      <div className="copyright-actions">
        <button type="button" disabled={!picked.size}
          onClick={() => window.confirm(`고른 악보 ${picked.size}개를 차단할까요? (파일은 지우지 않으며, 언제든 풀 수 있습니다)`) && run(() => blockSheets([...picked], id), `${picked.size}개를 차단했습니다`)}>
          고른 악보 차단 ({picked.size})
        </button>
      </div>
      <div className="copyright-actions">
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="처리 상태">
          {Object.entries(STATUS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
        <input type="text" value={note} maxLength={2000} placeholder="운영자 메모 (답변한 날짜, 처리 근거 등)" onChange={(e) => setNote(e.target.value)} />
        <button type="button" className="secondary" onClick={() => run(() => updateCopyrightRequest(id, { status, operatorNote: note }), '저장했습니다')}>저장</button>
      </div>
      {msg && <p className="share-pin-msg">{msg}</p>}
    </div>
  )
}
