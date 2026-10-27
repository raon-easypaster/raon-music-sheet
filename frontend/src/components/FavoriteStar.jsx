// 곡 즐겨찾기 별 버튼. 체크박스 label 안에서도 쓰이므로 클릭이 체크박스로 번지지 않게 막는다
export default function FavoriteStar({ song, onToggle }) {
  if (!onToggle) return null
  const on = !!song.isFavorite
  return (
    <button
      type="button"
      className={on ? 'fav-star on' : 'fav-star'}
      aria-pressed={on}
      aria-label={on ? `${song.title} 즐겨찾기 해제` : `${song.title} 즐겨찾기`}
      title={on ? '즐겨찾기 해제' : '즐겨찾기'}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onToggle(song._id, !on)
      }}
    >
      {on ? '★' : '☆'}
    </button>
  )
}
