export default function HelpPage() {
  return (
    <div className="panel" style={{ maxWidth: 640, margin: '0 auto', padding: '28px 24px' }}>
      <h2 style={{ marginTop: 0, marginBottom: 6, fontSize: 20 }}>사용법 안내</h2>
      <p style={{ color: '#64748b', fontSize: 13, marginBottom: 28, marginTop: 0 }}>
        찬양팀 악보 &amp; 콘티 관리 앱 사용 가이드
      </p>

      <Section title="🎵 악보 등록">
        <Step n={1} title="곡 목록 탭 선택" desc="상단 탭에서 곡 목록을 누릅니다." />
        <Step n={2} title="곡 정보 입력" desc="곡 제목(필수), 아티스트, Key(예: G, Am), BPM을 입력합니다." />
        <Step n={3} title="악보 등록" desc="PDF 악보를 업로드하거나 YouTube·악보 URL을 붙여넣고 등록을 누릅니다." />
        <Tip>곡 제목을 클릭하면 악보 상세 보기(PDF·동영상)가 열립니다.</Tip>
      </Section>

      <Section title="📋 콘티 작성">
        <Step n={1} title="새 콘티 만들기" desc='콘티 탭에서 이름을 입력 후 만들기를 누릅니다. 예: "2026년 9월 첫째주 주일 예배"' />
        <Step n={2} title="곡 추가" desc="콘티를 선택한 뒤 곡 추가 버튼을 누르면 등록된 곡 목록에서 선택할 수 있습니다." />
        <Step n={3} title="순서 변경" desc="곡 옆의 ⠿ 핸들을 잡고 드래그하면 곡 순서를 바꿀 수 있습니다. 변경된 순서는 자동 저장됩니다." />
      </Section>

      <Section title="🔗 콘티 공유">
        <Step n={1} title="공유 링크 생성" desc="콘티 상세 화면에서 공유 링크 생성 버튼을 누릅니다." />
        <Step n={2} title="링크 전달" desc="생성된 링크를 복사해서 카카오톡·문자 등으로 팀원에게 전달합니다." />
        <Notice>공유 링크를 받은 사람은 로그인 없이 콘티와 악보를 볼 수 있습니다.</Notice>
      </Section>

      <Section title="👥 팀 관리">
        <Step n={1} title="팀 탭 선택" desc="상단 탭에서 팀을 누릅니다." />
        <Step n={2} title="멤버 추가" desc="이름과 역할(보컬, 기타, 드럼 등)을 입력해 팀원을 추가합니다." />
      </Section>

      <Section title="🔑 비밀번호 변경">
        <Step n={1} title="비밀번호 변경 버튼" desc="화면 오른쪽 상단 비밀번호 변경 버튼을 누릅니다." />
        <Step n={2} title="변경" desc="현재 비밀번호 확인 후 새 비밀번호(6자 이상)를 두 번 입력하고 변경을 누릅니다." />
        <Tip>비밀번호를 분실한 경우 관리자에게 문의하면 계정을 초기화해드립니다.</Tip>
      </Section>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px', color: '#1e293b' }}>{title}</h3>
      <div style={{ background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  )
}

function Step({ n, title, desc }) {
  return (
    <div style={{ display: 'flex', gap: 14, padding: '14px 16px', borderBottom: '1px solid #e2e8f0', alignItems: 'flex-start' }}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%', background: '#15803d', color: '#fff',
        fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, marginTop: 1
      }}>{n}</div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>{desc}</div>
      </div>
    </div>
  )
}

function Tip({ children }) {
  return (
    <div style={{ padding: '10px 16px', background: '#f0fdf4', borderTop: '1px solid #e2e8f0', fontSize: 13, color: '#15803d' }}>
      💡 {children}
    </div>
  )
}

function Notice({ children }) {
  return (
    <div style={{ padding: '10px 16px', background: '#f0fdf4', borderTop: '1px solid #e2e8f0', fontSize: 13, color: '#15803d' }}>
      ✅ {children}
    </div>
  )
}
