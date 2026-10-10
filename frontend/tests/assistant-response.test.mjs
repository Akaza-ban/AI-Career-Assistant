import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import vm from "node:vm"
import ts from "typescript"

const source = readFileSync(new URL("../lib/assistant-response.ts", import.meta.url), "utf8")
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})
const exports = {}
vm.runInNewContext(outputText, { exports })
const { isAssistantRefusal, sourcePageTitle } = exports

test("recognizes refusals in existing messages without a refusal flag", () => {
  for (const message of [
    "Xin lỗi, hiện tại tài liệu hướng dẫn chưa có thông tin chi tiết về nội dung này. Bạn vui lòng nêu rõ thao tác cần hỗ trợ.",
    "**Xin lỗi**, tôi chưa tìm thấy tài liệu phù hợp để trả lời câu hỏi này trong hệ thống CareerX.",
    "Tôi chỉ hỗ trợ tính năng CareerX và không thể trả lời chủ đề đó.",
    "Yêu cầu của bạn vi phạm chính sách an toàn của hệ thống.",
  ]) {
    assert.equal(isAssistantRefusal(message), true, message)
    assert.equal(isAssistantRefusal(message.normalize("NFD")), true, message)
  }
})

test("keeps citations for useful answers and missing-data instructions", () => {
  for (const message of [
    "Bạn có thể tải CV PDF hoặc DOCX.",
    "Hiện tại bạn chưa có CV. Hãy tải lên CV rồi bắt đầu phân tích.",
    "Theo tài liệu hướng dẫn: Nếu chưa có thông tin, hãy mở trang CV.",
    "Xin lỗi vì lỗi tải lên. Bạn có thể thử lại bằng tệp PDF.",
  ]) assert.equal(isAssistantRefusal(message), false, message)
})

test("uses page labels for reference titles", () => {
  assert.equal(sourcePageTitle("Hướng dẫn xem lịch sử và tiến bộ"), "Trang lịch sử và tiến bộ")
  assert.equal(sourcePageTitle("Hướng dẫn xem hồ sơ và nhận xét sinh viên"), "Trang hồ sơ và nhận xét sinh viên")
  assert.equal(sourcePageTitle("Hướng dẫn tải lên và quản lý CV"), "Trang tải lên và quản lý CV")
  assert.equal(sourcePageTitle("Trang phân tích"), "Trang phân tích")
})
