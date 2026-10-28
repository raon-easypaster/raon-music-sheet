import { useEffect, useState } from 'react'
import { assetUrl } from '../api/client'
import { renderPdfPages, explainPdfError } from '../utils/pdf'

// 악보 한 개를 화면에 보여 줄 쪽 목록으로 바꾼다.
// 사진은 한 장이 한 쪽, PDF는 안의 쪽마다 한 쪽. 쪽마다 필기 번호(pageKey)가 붙는다
// → [{ key, pageKey, src, type, openUrl, loading?, error? }]
export function useSheetViews(sheet) {
  const [pdfState, setPdfState] = useState({}) // '페이지 id|주소' → { pages } | { error } (없으면 여는 중)
  const pdfPages = (sheet?.pages || []).filter((p) => p.type === 'pdf')
  const pdfKey = pdfPages.map((p) => `${p.id}|${p.url}`).join(',')

  useEffect(() => {
    let alive = true
    const list = pdfKey ? pdfKey.split(',').map((x) => { const [id, ...rest] = x.split('|'); return { id, url: rest.join('|') } }) : []
    for (const p of list) {
      const url = assetUrl(p.url)
      const key = `${p.id}|${p.url}`
      renderPdfPages(url, (r) => { if (alive) setPdfState((s) => ({ ...s, [key]: { pages: r.pages, total: r.total } })) })
        .catch((err) => { if (alive) setPdfState((s) => ({ ...s, [key]: { error: explainPdfError(err, url) } })) })
    }
    return () => { alive = false }
  }, [pdfKey])

  const views = []
  for (const page of sheet?.pages || []) {
    const openUrl = assetUrl(page.url)
    if (page.type === 'image') {
      views.push({ key: page.id, pageKey: page.id, src: openUrl, type: 'image', openUrl })
      continue
    }
    const st = pdfState[`${page.id}|${page.url}`] || { loading: true }
    if (st.total) {
      // 쪽 수는 먼저 알 수 있다. 아직 그리지 못한 쪽은 '여는 중'으로 둔다
      for (let n = 1; n <= st.total; n++) {
        const pg = st.pages[n - 1]
        const pageKey = `${page.id}#${n}`
        views.push(pg
          ? { key: pageKey, pageKey, src: pg.src, type: 'pdf', openUrl, pdfPage: n, pdfTotal: st.total }
          : { key: pageKey, pageKey, src: null, type: 'pdf', openUrl, pdfPage: n, pdfTotal: st.total, loading: true })
      }
    } else {
      views.push({ key: `${page.id}#x`, pageKey: null, src: null, type: 'pdf', openUrl, loading: !!st.loading, error: st.error })
    }
  }
  return views
}
