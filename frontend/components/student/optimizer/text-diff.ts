/** Một đoạn của câu mới: `added` = phần không có trong câu cũ (tô nhẹ khi hiển thị). */
export interface DiffPart {
  text: string
  added: boolean
}

const norm = (word: string) => word.toLocaleLowerCase("vi").replace(/[.,;:!?()"“”]/g, "")

/**
 * Đánh dấu phần thêm mới của `next` so với `prev` theo từ (LCS). Nếu câu gần như viết lại toàn bộ (hơn 70% từ là mới)
 * thì không tô gì, vì tô cả câu không giúp SV tìm chỗ khác.
 */
export function diffAdded(prev: string, next: string): DiffPart[] {
  const a = prev.split(/\s+/).filter(Boolean)
  // Giữ khoảng trắng đi kèm để ghép lại đúng câu gốc.
  const tokens = next.match(/\S+\s*/g) ?? []
  const b = tokens.map((t) => t.trim())
  if (!a.length || !b.length) return [{ text: next, added: false }]

  const na = a.map(norm)
  const nb = b.map(norm)
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = na[i] === nb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const kept = new Array<boolean>(b.length).fill(false)
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (na[i] === nb[j]) {
      kept[j] = true
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++
    else j++
  }

  const addedCount = kept.filter((k) => !k).length
  if (addedCount === 0 || addedCount / b.length > 0.7) return [{ text: next, added: false }]

  const parts: DiffPart[] = []
  tokens.forEach((token, k) => {
    const added = !kept[k]
    const last = parts[parts.length - 1]
    if (last && last.added === added) last.text += token
    else parts.push({ text: token, added })
  })
  // Khoảng trắng cuối đoạn được tô chuyển sang đoạn sau để vùng tô không lố ra ngoài chữ.
  for (let k = 0; k < parts.length - 1; k++) {
    const m = /\s+$/.exec(parts[k].text)
    if (parts[k].added && m) {
      parts[k].text = parts[k].text.slice(0, m.index)
      parts[k + 1].text = m[0] + parts[k + 1].text
    }
  }
  return parts
}
