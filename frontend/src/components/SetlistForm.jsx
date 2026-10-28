import { useState } from 'react'
import { nextSunday, formatKoreanDate } from '../utils/dates'
import { SERVICE_TYPES, KIND_LABEL } from '../utils/serviceOrder'

export default function SetlistForm({ onCreate, templates = [], onDeleteTemplate }) {
  const [name, setName] = useState('')
  const [gigDate, setGigDate] = useState(nextSunday)
  const [serviceType, setServiceType] = useState('')
  const [startTime, setStartTime] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [showTemplates, setShowTemplates] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // 템플릿을 고르면 예배 종류·시작 시각을 템플릿 값으로 채운다 (바꿀 수 있음)
  function pickTemplate(id) {
    setTemplateId(id)
    const t = templates.find((x) => x._id === id)
    if (!t) return
    setServiceType(t.serviceType || '')
    setStartTime(t.startTime || '')
    if (!name.trim()) setName([gigDate && formatKoreanDate(gigDate), t.serviceType || t.name].filter(Boolean).join(' '))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      await onCreate({ name, gigDate: gigDate || null, serviceType, startTime, templateId: templateId || undefined })
      setName('')
      setGigDate(nextSunday())
      setTemplateId('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function removeTemplate(t) {
    if (!window.confirm(`'${t.name}' 템플릿을 지울까요? (이 템플릿으로 만든 콘티는 그대로 남습니다)`)) return
    try {
      await onDeleteTemplate(t._id)
      if (templateId === t._id) setTemplateId('')
    } catch (err) { setError(err.message) }
  }

  return (
    <form className="card form-card" onSubmit={handleSubmit}>
      <h2>콘티 만들기</h2>

      {templates.length > 0 && (
        <label className="date-field">
          <span>템플릿</span>
          <select value={templateId} onChange={(e) => pickTemplate(e.target.value)}>
            <option value="">템플릿 없이 빈 콘티</option>
            {templates.map((t) => (
              <option key={t._id} value={t._id}>{t.name}{t.serviceType && t.serviceType !== t.name ? ` (${t.serviceType})` : ''}</option>
            ))}
          </select>
        </label>
      )}

      <input
        type="text"
        placeholder="콘티 이름 (예: 9월 1주 주일예배)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />

      <div className="row-fields">
        <label className="date-field">
          <span>예배 날짜</span>
          <input type="date" value={gigDate} onChange={(e) => setGigDate(e.target.value)} />
        </label>
        <label className="date-field">
          <span>시작 시각</span>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </label>
      </div>

      <label className="date-field">
        <span>예배 종류</span>
        <input type="text" list="service-types" placeholder="예: 주일 1부, 청년부 (직접 입력 가능)" maxLength={30}
          value={serviceType} onChange={(e) => setServiceType(e.target.value)} />
      </label>
      <datalist id="service-types">
        {SERVICE_TYPES.map((t) => <option key={t} value={t} />)}
      </datalist>

      <button type="submit" disabled={submitting}>
        {submitting ? '저장 중...' : '콘티 저장'}
      </button>

      {error ? <p className="error-text">{error}</p> : null}

      {templates.length > 0 && (
        <div className="template-manage">
          <button type="button" className="link-btn" onClick={() => setShowTemplates((v) => !v)}>
            저장한 템플릿 {templates.length}개 {showTemplates ? '접기' : '보기'}
          </button>
          {showTemplates && (
            <ul>
              {templates.map((t) => (
                <li key={t._id}>
                  <span>
                    <b>{t.name}</b>
                    <span className="muted"> {[t.serviceType, t.startTime].filter(Boolean).join(' · ')}</span>
                    <span className="muted template-items">{t.items.map((i) => i.title || KIND_LABEL[i.kind]).join(' → ')}</span>
                  </span>
                  {onDeleteTemplate && <button type="button" className="secondary" onClick={() => removeTemplate(t)}>지우기</button>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  )
}
