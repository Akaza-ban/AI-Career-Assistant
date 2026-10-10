/** Also covers older responses that predate the model's explicit refusal flag. */
export function isAssistantRefusal(content: string): boolean {
  const text = content.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d")
    .toLowerCase().replace(/[*_#`]/g, "").replace(/\s+/g, " ").trim()
  if (text.startsWith("yeu cau cua ban vi pham chinh sach an toan")) return true
  if (!/^(?:xin loi|rat tiec|toi|minh|hien tai|tai lieu)\b/.test(text)) return false
  return /(?:chua|khong) (?:co|tim thay) (?:thong tin|tai lieu)|(?:khong the|khong du|chua du) (?:tra loi|ho tro|bang chung)|ngoai (?:pham vi|he thong)|khong (?:co bang chung|the xac dinh|the cung cap)/.test(text.slice(0, 500))
}

export function sourcePageTitle(title: string): string {
  return title.replace(/^Hướng dẫn(?: xem)?\s+/iu, "Trang ")
}
