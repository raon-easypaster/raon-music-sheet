import { COPYRIGHT_NOTICE } from './copyright'
import { isoToDateInput, toDateInput } from './dates'

function download(filename, content, type) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const csvCell = (v) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const SONG_COLUMNS = [
  ['title', '제목'], ['artist', '아티스트'], ['key', 'Key'], ['bpm', 'BPM'], ['capo', '카포'],
  ['structure', '송폼'], ['notes', '메모'], ['youtubeUrl', 'YouTube'], ['mrUrl', 'MR'],
  ['sheetImageUrl', '악보 이미지'], ['sheetPdfUrl', '악보 PDF'],
]

// 엑셀에서 바로 열리는 곡 목록 (맨 위에 저작권 안내, 한글 깨짐 방지 BOM 포함)
export function exportSongsCsv(songs, label) {
  const rows = [
    [COPYRIGHT_NOTICE],
    [],
    SONG_COLUMNS.map(([, h]) => h),
    ...songs.map((s) => SONG_COLUMNS.map(([k]) => s[k] ?? '')),
  ]
  const csv = '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n')
  download(`RAON_곡목록_${label}_${toDateInput(new Date())}.csv`, csv, 'text/csv;charset=utf-8')
}

// 곡과 콘티 전체 백업 (다시 불러오기용 JSON)
export function exportBackupJson(songs, setlists, label) {
  const strip = ({ _id, title, artist, key, bpm, capo, structure, notes, youtubeUrl, mrUrl, sheetImageUrl, sheetPdfUrl }) =>
    ({ _id, title, artist, key, bpm, capo, structure, notes, youtubeUrl, mrUrl, sheetImageUrl, sheetPdfUrl })
  const backup = {
    app: 'RAON music sheet',
    exportedAt: new Date().toISOString(),
    workspace: label,
    copyright: COPYRIGHT_NOTICE,
    songs: songs.map(strip),
    setlists: setlists.map((sl) => ({
      name: sl.name,
      date: isoToDateInput(sl.gigDate),
      songs: (sl.songs || []).map((s) => (typeof s === 'string' ? s : s._id)),
      songSettings: sl.songSettings || [],
    })),
  }
  download(`RAON_백업_${label}_${toDateInput(new Date())}.json`, JSON.stringify(backup, null, 2), 'application/json')
}
