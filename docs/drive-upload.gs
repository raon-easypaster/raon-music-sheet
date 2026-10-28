/**
 * RAON music sheet — 악보 사진 구글 드라이브 연결 (Google Apps Script)
 *
 * 목사님 구글 계정으로 script.google.com 에 붙여 넣고 "웹 앱"으로 배포해서 씁니다.
 * - 앱 서버가 보낸 악보 사진·PDF를 아래 폴더에 저장합니다.
 * - 앱이 사진을 보여 달라고 하면, 이 폴더 안의 파일만 돌려줍니다. (다른 드라이브 파일은 거절)
 * - 스크립트 속성 SECRET 값과 Vercel 환경 변수 DRIVE_UPLOAD_SECRET 값이 같아야 동작합니다.
 */
const FOLDER_ID = '1xjGbQAX8m_8blDpk6XfHNHNDi-cwDMWa'
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents)
    const secret = PropertiesService.getScriptProperties().getProperty('SECRET')
    if (!secret || body.secret !== secret) return json({ error: '접근 권한이 없습니다' })

    const folder = DriveApp.getFolderById(FOLDER_ID)

    if (body.action === 'upload') {
      if (ALLOWED_TYPES.indexOf(body.mimeType) === -1) return json({ error: '사진·PDF 파일만 올릴 수 있습니다' })
      const blob = Utilities.newBlob(Utilities.base64Decode(body.data), body.mimeType, body.name)
      const file = folder.createFile(blob)
      file.setDescription('RAON music sheet 업로드 · ' + (body.uploader || ''))
      return json({ id: file.getId() })
    }

    if (body.action === 'get') {
      const file = DriveApp.getFileById(body.id)
      if (!isInFolder(file)) return json({ error: '파일을 찾을 수 없습니다' })
      const fileBlob = file.getBlob()
      return json({ mimeType: fileBlob.getContentType(), data: Utilities.base64Encode(fileBlob.getBytes()) })
    }

    return json({ error: '알 수 없는 요청입니다' })
  } catch (err) {
    return json({ error: String((err && err.message) || err) })
  }
}

function isInFolder(file) {
  const parents = file.getParents()
  while (parents.hasNext()) {
    if (parents.next().getId() === FOLDER_ID) return true
  }
  return false
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)
}
