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
        <Step n={3} title="악보 등록" desc="링크·악보를 펼쳐 '악보에 적힌 Key'를 고르고, 사진 여러 장이나 PDF(3MB까지)를 올리거나 악보 주소를 넣습니다. 쪽 순서는 ▲▼로 바꾸고, '교체'는 그 쪽만 새 파일로 바꿉니다." />
        <Step n={4} title="Key별 악보" desc="Key가 다른 악보는 '+ 새 악보 추가'로 따로 넣습니다. 콘티에서 Key를 고르면 그 Key 악보를 먼저 씁니다." />
        <Tip>예전에 넣은 악보는 'Key 미확인'으로 보입니다. 곡을 고쳐 악보에 적힌 Key를 골라 주세요.</Tip>
      </Section>

      <Section title="📋 콘티 작성">
        <Step n={1} title="새 콘티 만들기" desc='콘티 탭에서 이름을 입력 후 만들기를 누릅니다. 예: "2026년 9월 첫째주 주일 예배"' />
        <Step n={2} title="곡 추가" desc="콘티를 선택한 뒤 곡 추가 버튼을 누르면 등록된 곡 목록에서 선택할 수 있습니다." />
        <Step n={3} title="순서 변경" desc="곡 옆의 ⠿ 핸들을 잡고 드래그하면 곡 순서를 바꿀 수 있습니다. 변경된 순서는 자동 저장됩니다." />
        <Step n={4} title="Key·악보·메모" desc="곡의 'Key·악보·메모'에서 이번에 부를 Key와 쓸 악보를 고릅니다. Key를 바꿔도 악보 그림·PDF가 조옮김되지는 않습니다. 악보 Key가 다르면 '이번 Key는 D, 등록 악보는 C입니다'처럼 알려 줍니다." />
        <Step n={5} title="예배 준비 점검" desc="콘티 위쪽에서 악보 없는 곡, Key 불일치, 이 기기 오프라인 저장, 팀원 배정, 팀원별 연습 완료를 한 번에 봅니다." />
        <Step n={6} title="확정 · 수정 이력" desc="팀장이나 인도자가 '콘티 확정'을 누릅니다. 확정 뒤 고친 내용은 '확정 후 변경'으로 기록되고, 팀원은 '변경 확인'을 누릅니다. '수정 이력'에서 이전 판으로 되돌릴 수 있습니다." />
        <Tip>다른 사람이 먼저 고친 콘티를 저장하려 하면 덮어쓰지 않고, 무엇이 바뀌었는지 보여 준 뒤 최신 내용을 다시 불러옵니다.</Tip>
      </Section>

      <Section title="🔗 콘티 공유 &amp; 실시간 동기화">
        <Step n={1} title="공유 링크 생성" desc="콘티 상세 화면에서 🔗 공유 링크 버튼을 누르고 링크를 복사합니다." />
        <Step n={2} title="링크 전달" desc="카카오톡·문자로 팀원에게 전달합니다. 로그인 없이 바로 열람 가능합니다." />
        <Step n={3} title="공유 화면 구성" desc="링크를 열면 왼쪽에 곡 목록, 오른쪽에 현재 곡의 악보·영상이 표시됩니다. 왼쪽 곡 이름을 누르면 악보가 전환됩니다." />
        <Step n={4} title="실시간 진행" desc="팀장이나 '인도'로 배정된 팀원이 로그인해 '내가 진행하기'를 누르고 곡을 넘기면, '인도자 따라가기' 화면이 모두 따라 넘어갑니다. 다른 사람이 곡을 넘기면 자기 화면만 바뀝니다(혼자 보기)." />
        <Tip>💬 카톡 요약 버튼을 누르면 곡 순서·Key·BPM·송폼을 카카오톡에 붙여넣기 좋은 텍스트로 복사합니다.</Tip>
        <Notice>공유 링크를 받은 사람은 로그인 없이 콘티·악보를 볼 수 있지만, 다른 사람 화면을 바꿀 수는 없습니다. (3초마다 자동 동기화, 연결이 끊기면 화면 위에 표시)</Notice>
      </Section>

      <Section title="🎸 연습 도구">
        <Step n={1} title="🥁 메트로놈" desc="BPM 슬라이더 또는 ±1/±5 버튼으로 템포 설정 후 ▶ 시작. 👆 탭 버튼으로 리듬을 탭하면 BPM 자동 측정." />
        <Step n={2} title="🎸 크로매틱 튜너" desc="🎤 시작을 누르면 마이크로 악기 소리를 감지합니다. 음정 이름과 cents 오차(±5 이내 = 초록)를 실시간 표시." />
        <Step n={3} title="🎸 카포 계산기" desc="악보 Key와 카포 위치를 선택하면 실제 연주 Key를 자동 계산. 카포 위치별 Key 목록도 확인 가능." />
        <Tip>연습 도구는 앱 설치 없이 브라우저에서 바로 사용합니다. 튜너는 마이크 권한 허용이 필요합니다.</Tip>
      </Section>

      <Section title="👥 팀 관리">
        <Step n={1} title="팀 탭 선택" desc="상단 탭에서 팀을 누릅니다." />
        <Step n={2} title="멤버 추가" desc="이름과 역할(보컬, 기타, 드럼 등)을 입력해 팀원을 추가합니다." />
      </Section>

      <Section title="📱 모바일에서 편하게 사용하기">
        <Step n={1} title="곡 이동" desc="하단 곡 슬라이더를 좌우로 밀어 다음 곡이나 이전 곡을 바로 선택합니다." />
        <Step n={2} title="악보 맞춤" desc="맞춤 버튼으로 악보 전체를 화면에 맞추고, −와 +로 필요한 부분을 확대하거나 축소합니다." />
        <Step n={3} title="쪽 이동" desc="여러 장 악보는 '이전 쪽 · 다음 쪽'으로 넘깁니다(곡 이동과 따로). 좌우로 밀면 남은 쪽을 먼저, 마지막 쪽에서는 다음 곡으로 넘어갑니다." />
        <Step n={4} title="안정적인 사용" desc="예배 전에 팀원 모두 같은 공유 링크에 입장해 곡 순서·페이지·확대가 맞는지 한 번 확인하는 것을 권장합니다." />
        <Tip>악보가 보이지 않을 때는 이미지 주소가 브라우저에서 열리는지, 콘티 저장 여부부터 확인하세요.</Tip>
        <Notice>보기는 공유 링크를 받은 누구나 가능하고, 진행(모두의 곡 넘기기)은 팀장과 이 콘티의 인도 배정자만 할 수 있습니다.</Notice>
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
