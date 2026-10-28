import { useEffect, useState } from 'react'
import { getPosts, markPostsSeen, createPost, deletePost, pinPost, togglePray } from '../api/teamExtras'
import { sameId, memberName, shortDateTime } from './teamExtrasShared'

const KIND_LABEL = { notice: '공지', prayer: '기도제목' }

// 공지 · 기도제목 게시판
export default function TeamPosts({ team, currentUserId, onSeen }) {
  const teamId = team._id
  const isOwner = sameId(team.owner, currentUserId)

  const [posts, setPosts] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [version, setVersion] = useState(0)
  const [form, setForm] = useState({ kind: 'notice', title: '', body: '', pinned: false })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // 불러온 뒤 "읽음"으로 표시해서 탭 배지를 지운다
  useEffect(() => {
    let alive = true
    getPosts(teamId)
      .then((data) => {
        if (!alive) return
        setPosts(data.posts || [])
        setHasMore(!!data.hasMore)
        setLoaded(true)
        return markPostsSeen(teamId).then(() => onSeen?.())
      })
      .catch((err) => { if (alive) setError(err.message) })
    return () => { alive = false }
  }, [teamId, version, onSeen])

  async function run(action) {
    setBusy(true)
    setError('')
    try {
      await action()
      return true
    } catch (err) {
      setError(err.message)
      return false
    } finally {
      setBusy(false)
    }
  }

  // 글 하나만 바뀐 경우 목록에서 그 글만 바꾼다
  const replace = (post) => setPosts((list) => list.map((p) => (p._id === post._id ? post : p)))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) { setError('제목을 적어 주세요'); return }
    const ok = await run(() => createPost(teamId, { ...form, pinned: form.kind === 'notice' && form.pinned }))
    if (ok) {
      setForm((f) => ({ ...f, title: '', body: '', pinned: false }))
      setVersion((v) => v + 1)
    }
  }

  async function handleMore() {
    const last = posts.filter((p) => !p.pinned).at(-1)
    if (!last) return
    await run(async () => {
      const data = await getPosts(teamId, last.createdAt)
      setPosts((list) => [...list, ...(data.posts || [])])
      setHasMore(!!data.hasMore)
    })
  }

  function handleDelete(post) {
    if (!window.confirm(`'${post.title}' 글을 지울까요?`)) return
    run(async () => {
      await deletePost(teamId, post._id)
      setPosts((list) => list.filter((p) => p._id !== post._id))
    })
  }

  return (
    <div>
      <form className="tx-post-form" onSubmit={handleSubmit}>
        <div className="tx-segment" role="group" aria-label="글 종류">
          {['notice', 'prayer'].map((k) => (
            <button
              key={k}
              type="button"
              className={form.kind === k ? 'active' : ''}
              onClick={() => setForm((f) => ({ ...f, kind: k }))}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder={form.kind === 'notice' ? '공지 제목 (예: 이번 주 연습 시간 변경)' : '기도제목 (예: 어머니 수술을 위해)'}
          maxLength={100}
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />
        <textarea
          placeholder="내용 (선택, 2000자 이내)"
          maxLength={2000}
          rows={3}
          value={form.body}
          onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
        />
        <div className="tx-inline">
          {isOwner && form.kind === 'notice' && (
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.pinned}
                onChange={(e) => setForm((f) => ({ ...f, pinned: e.target.checked }))}
              />
              맨 위에 고정
            </label>
          )}
          <button type="submit" disabled={busy}>올리기</button>
        </div>
      </form>

      {error && <p className="error-text">{error}</p>}

      {!loaded ? (
        <p className="muted">불러오는 중...</p>
      ) : posts.length === 0 ? (
        <p className="muted">아직 올라온 글이 없습니다. 첫 공지나 기도제목을 올려 보세요.</p>
      ) : (
        <ul className="tx-list">
          {posts.map((post) => {
            const mine = sameId(post.author, currentUserId)
            const prayed = post.prayedBy?.some((u) => sameId(u, currentUserId))
            return (
              <li key={post._id} className={`tx-post${post.pinned ? ' tx-post-pinned' : ''}`}>
                <div className="tx-row-main">
                  <span className={`tx-kind tx-kind-${post.kind}`}>{KIND_LABEL[post.kind]}</span>
                  {post.pinned && <span className="tx-kind tx-kind-pinned">고정</span>}
                  <strong className="tx-post-title">{post.title}</strong>
                </div>
                {post.body && <p className="tx-post-body">{post.body}</p>}
                <p className="muted-dark">{memberName(post.author)} · {shortDateTime(post.createdAt)}</p>
                <div className="tx-actions">
                  {post.kind === 'prayer' && (
                    <button
                      type="button"
                      className={prayed ? 'tx-pray active' : 'tx-pray secondary'}
                      disabled={busy}
                      title={post.prayedBy?.map(memberName).join(', ') || ''}
                      onClick={() => run(async () => replace(await togglePray(teamId, post._id)))}
                    >
                      함께 기도해요 {post.prayedBy?.length || 0}
                    </button>
                  )}
                  {isOwner && post.kind === 'notice' && (
                    <button
                      type="button"
                      className="secondary"
                      disabled={busy}
                      onClick={() => run(async () => { await pinPost(teamId, post._id, !post.pinned); setVersion((v) => v + 1) })}
                    >
                      {post.pinned ? '고정 풀기' : '맨 위에 고정'}
                    </button>
                  )}
                  {(mine || isOwner) && (
                    <button type="button" className="secondary" disabled={busy} onClick={() => handleDelete(post)}>지우기</button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {hasMore && <button type="button" className="secondary tx-more" disabled={busy} onClick={handleMore}>이전 글 더 보기</button>}
    </div>
  )
}
