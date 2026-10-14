/**
 * Sidebar thu gọn / mở rộng (bản vẽ SidebarMoRong, SidebarThuGon). Trạng thái nằm ở thuộc tính data-sidebar của <html>
 * và được lưu ở localStorage; giao diện đổi bằng biến thể CSS `sidebar-collapsed:` nên không cần state React.
 */
export const SIDEBAR_STORAGE_KEY = "careerv:sidebar"

/** Chạy trong <head> trước khi trang hiển thị, để người đã thu gọn không thấy sidebar mở ra rồi đóng lại. */
export const SIDEBAR_INIT_SCRIPT = `try{if(localStorage.getItem("${SIDEBAR_STORAGE_KEY}")==="collapsed")document.documentElement.dataset.sidebar="collapsed"}catch(e){}`

export function toggleSidebar(): void {
  const root = document.documentElement
  const collapse = root.dataset.sidebar !== "collapsed"
  if (collapse) root.dataset.sidebar = "collapsed"
  else delete root.dataset.sidebar
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, collapse ? "collapsed" : "expanded")
  } catch {
    // Không lưu được thì vẫn đổi trong phiên hiện tại.
  }
}
