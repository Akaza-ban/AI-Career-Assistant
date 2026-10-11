// Mock cho Thư viện JD: gợi ý vị trí theo CV (POST /jd/recommend) và JD đã lưu.
// Mô phỏng src/services/jd_recommendation.py: chấm theo quy tắc PRD 5.2 (trọng số 3/2/1, Match 1/0.5/0),
// sắp theo điểm giảm dần, cắt top_n. Kỹ năng của mỗi CV là hồ sơ cố định để kết quả luôn như nhau.

import type {
  CareerAdvice,
  JdRecommendationItem,
  JobDescription,
  MatchLabel,
  RequirementImportance,
  ScoreBreakdown,
} from "@/lib/types"

interface SkillProfile {
  /** Có bằng chứng sử dụng (Kinh nghiệm / Dự án / Hoạt động). */
  matched: string[]
  /** Chỉ được liệt kê ở mục Kỹ năng. */
  partial: string[]
}

const BA_PROFILE: SkillProfile = {
  matched: [
    "SQL",
    "Phân tích yêu cầu",
    "Viết tài liệu BRD/SRS",
    "Agile/Scrum",
    "Scrum",
    "Excel",
    "User Story",
    "Power BI",
    "Trực quan hoá dữ liệu",
    "Tiếng Anh",
  ],
  partial: ["BPMN", "Jira", "Python", "Figma", "Phân tích dữ liệu", "Google Analytics"],
}

const PO_PROFILE: SkillProfile = {
  matched: ["User Story", "Scrum", "Quản lý Backlog", "Jira", "UX Flow", "Figma"],
  partial: ["Agile/Scrum", "Phân tích yêu cầu", "Excel", "Tiếng Anh", "SQL"],
}

/** Hồ sơ kỹ năng theo mã CV (family_id); CV mới tải lên dùng hồ sơ CV Business Analyst. */
const PROFILES: Record<string, SkillProfile> = {
  "cv-ba-v10": BA_PROFILE,
  "cv-v1": PO_PROFILE,
}

export const skillProfileOf = (familyId: string): SkillProfile => PROFILES[familyId] ?? BA_PROFILE

const WEIGHTS: Record<RequirementImportance, number> = { required: 3, preferred: 2, additional: 1 }
const GROUP_LABELS: Record<RequirementImportance, string> = {
  required: "Bắt buộc",
  preferred: "Ưu tiên",
  additional: "Bổ trợ",
}

const labelOf = (score: number): MatchLabel => (score >= 75 ? "high" : score >= 50 ? "medium" : "low")

function scoreJd(jd: JobDescription, profile: SkillProfile, rank: number): JdRecommendationItem {
  const status = (name: string) =>
    profile.matched.includes(name) ? "matched" : profile.partial.includes(name) ? "partial" : "missing"
  const breakdown: ScoreBreakdown[] = (Object.keys(WEIGHTS) as RequirementImportance[])
    .map((importance) => {
      const items = jd.skills.filter((s) => s.importance === importance)
      const weight = WEIGHTS[importance]
      const matched = items.filter((s) => status(s.name) === "matched").length
      const partial = items.filter((s) => status(s.name) === "partial").length
      return {
        importance,
        label: GROUP_LABELS[importance],
        weight,
        total: items.length,
        matched,
        partial,
        missing: items.length - matched - partial,
        earned: weight * (matched + partial * 0.5),
        possible: weight * items.length,
      }
    })
    .filter((b) => b.total > 0)
  const possible = breakdown.reduce((sum, b) => sum + b.possible, 0)
  const score = possible ? Math.round((breakdown.reduce((sum, b) => sum + b.earned, 0) / possible) * 1000) / 10 : 0
  const names = (s: string) => jd.skills.filter((k) => status(k.name) === s).map((k) => k.name)
  return {
    jd_id: jd.id,
    title: jd.title,
    company: jd.company,
    industry: jd.industry,
    level: jd.level,
    // Giả lập độ tương đồng ngữ nghĩa ổn định theo điểm và thứ tự trong thư viện.
    semantic_score: Math.round((0.35 + score / 200 - rank * 0.005) * 10_000) / 10_000,
    match_score: score,
    match_label: labelOf(score),
    matched_skills: names("matched"),
    partial_skills: names("partial"),
    missing_skills: names("missing"),
    breakdown,
  }
}

export function recommendFromProfile(
  library: JobDescription[],
  profile: SkillProfile,
  topN: number,
): JdRecommendationItem[] {
  return library
    .map((jd, i) => scoreJd(jd, profile, i))
    .sort((a, b) => (b.match_score ?? -1) - (a.match_score ?? -1) || b.semantic_score - a.semantic_score)
    .slice(0, topN)
}

const joinVi = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} và ${items[items.length - 1]}`

/** Lời khuyên mẫu cho vị trí #1, cùng khuôn với CareerAdvice của backend. */
export function adviceFor(top: JdRecommendationItem | undefined): CareerAdvice {
  if (!top) {
    return {
      summary: "Chưa đủ dữ liệu để đưa ra lời khuyên.",
      top_position_advice: "Hãy bổ sung kinh nghiệm và dự án vào CV.",
      action_plan: ["Cập nhật thêm kỹ năng chuyên môn và kinh nghiệm dự án."],
    }
  }
  const strong = top.matched_skills.slice(0, 3)
  const gap = top.missing_skills[0] ?? top.partial_skills[0]
  return {
    summary:
      `CV mạnh về ${joinVi(strong) || "các kỹ năng nền tảng"}` +
      (gap ? `; còn thiếu bằng chứng về ${gap}.` : "; đã đáp ứng hầu hết yêu cầu."),
    top_position_advice: `Bạn đã có nền tảng tốt cho vị trí ${top.title}. Hãy làm rõ kết quả từng dự án bằng số liệu cụ thể.`,
    action_plan: [
      top.missing_skills[0]
        ? `Học ${top.missing_skills[0]} và áp dụng vào một bài tập hoặc dự án nhỏ.`
        : "Hoàn thiện thêm một dự án thực tế cho vị trí này.",
      top.partial_skills[0]
        ? `Bổ sung mô tả cách bạn đã dùng ${top.partial_skills[0]} trong một dự án.`
        : "Bổ sung số liệu kết quả cho các dự án trong CV.",
      `Luyện phỏng vấn thử cho vị trí ${top.title}.`,
    ],
  }
}
