export default function SetlistList({
  setlists,
  selectedSetlistId,
  onSelect,
  onDelete,
}) {
  return (
    <div className="card panel">
      <h2>콘티 목록</h2>

      {setlists.length === 0 ? (
        <p className="muted">등록된 콘티가 없습니다</p>
      ) : (
        <ul className="item-list">
          {setlists.map((setlist) => (
            <li key={setlist._id} className="item-row">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <button
                  className={
                    selectedSetlistId === setlist._id
                      ? 'secondary active'
                      : 'secondary'
                  }
                  onClick={() => onSelect(setlist)}
                >
                  {setlist.name}
                </button>

                <button
                  type="button"
                  className="secondary"
                  onClick={() => onDelete(setlist._id)}
                >
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}