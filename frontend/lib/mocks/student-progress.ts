// Tổng hợp Tổng quan (S1) và Lịch sử & Tiến bộ (S8) từ dữ liệu mock, theo cùng quy tắc với src/services/progress.py.

import type {
  AnalysisRow,
  CvProgress,
  CvVersion,
  InterviewProgress,
  InterviewQuota,
  InterviewRow,
  NextStep,
  PositionOption,
  ProgressRange,
  RequirementAssessment,
  StarCriterion,
  StarScores,
  StudentOverview,
  StudentProgress,
} from "@/lib/types"
import { roadmapUrlOf } from "@/lib/mocks/roadmap"

const RECENT_LIMIT = 5
/** Số buổi gần nhất dùng cho điểm trung bình S/T/A/R và biểu đồ nhỏ ở Tổng quan. */
export const STAR_WINDOW = 5
const SKILLS_LIMIT = 6
const RANGE_DAYS: Record<ProgressRange, number | null> = { "30d": 30, "90d": 90, all: null }
const IMPORTANCE_ORDER = { required: 0, preferred: 1, additional: 2 }
const CRITERIA: StarCriterion[] = ["situation", "task", "action", "result"]

const round2 = (n: number) => Math.round(n * 100) / 100
const time = (iso: string) => new Date(iso).getTime()
const newestFirst = (a: string, b: string) => time(b) - time(a)
const point = (s: InterviewRow) => ({ id: s.id, completed_at: s.completed_at, score: s.overall_score })

export function starAverage(sessions: InterviewRow[]): StarScores {
  const avg = (c: StarCriterion) => round2(sessions.reduce((sum, s) => sum + s.star[c], 0) / sessions.length)
  return { situation: avg("situation"), task: avg("task"), action: avg("action"), result: avg("result") }
}

export const weakest = (star: StarScores) => CRITERIA.reduce((low, c) => (star[c] < star[low] ? c : low))

interface OverviewInput {
  cvs: CvVersion[]
  /** Buổi đã hoàn thành, mới nhất trước. */
  sessions: InterviewRow[]
  /** Mọi lượt phân tích, mới nhất trước. */
  analyses: AnalysisRow[]
  requirementsOf: (analysisId: string) => RequirementAssessment[]
  activeInterview: StudentOverview["in_progress"]["interview"]
  quota: (jdId: string) => InterviewQuota
  guidance: Record<StarCriterion, string>
  weekStart: number
}

function nextStep({ cvs, sessions, quota, guidance }: OverviewInput, completed: AnalysisRow[]): NextStep {
  if (cvs.length === 0) return { kind: "upload_cv" }
  if (completed.length === 0) {
    const cv = cvs.find((c) => c.is_active) ?? [...cvs].sort((a, b) => b.version - a.version)[0]
    return { kind: "analyze", cv_version_id: cv.id, cv_label: cv.label }
  }
  const latest = completed[0]
  if (!sessions.some((s) => s.jd.id === latest.jd.id)) {
    const q = quota(latest.jd.id)
    return {
      kind: "interview",
      jd: latest.jd,
      analysis_id: latest.id,
      match_score: latest.match_score,
      quota_remaining: q.remaining,
      quota_resets_at: q.resets_at,
    }
  }
  const last = sessions[0]
  const criterion = weakest(last.star)
  const q = quota(last.jd.id)
  return {
    kind: "improve",
    jd: last.jd,
    session_id: last.id,
    criterion,
    criterion_score: last.star[criterion],
    guidance: guidance[criterion],
    quota_remaining: q.remaining,
    quota_resets_at: q.resets_at,
  }
}

export function buildOverview(input: OverviewInput): StudentOverview {
  const { cvs, sessions, analyses } = input
  const completed = analyses.filter((a) => a.status === "completed").sort((a, b) => newestFirst(a.completed_at!, b.completed_at!))
  const latestAnalysis = completed[0]
  const last = sessions[0]
  const sameJd = last ? sessions.filter((s) => s.jd.id === last.jd.id) : []
  const first = sameJd.at(-1)
  const window = sessions.slice(0, STAR_WINDOW)
  const average = window.length ? starAverage(window) : null
  const missing = latestAnalysis
    ? input
        .requirementsOf(latestAnalysis.id)
        .filter((r) => r.status === "missing")
        .sort((a, b) => IMPORTANCE_ORDER[a.importance] - IMPORTANCE_ORDER[b.importance])
    : []

  return {
    cv_count: cvs.length,
    cv_latest_at: cvs.map((c) => c.uploaded_at).sort(newestFirst)[0] ?? null,
    interview_count: sessions.length,
    interview_week_count: sessions.filter((s) => time(s.completed_at) >= input.weekStart).length,
    latest_match: latestAnalysis
      ? {
          analysis_id: latestAnalysis.id,
          jd: latestAnalysis.jd,
          cv_label: latestAnalysis.cv_label,
          score: latestAnalysis.match_score,
          label: latestAnalysis.match_label,
          completed_at: latestAnalysis.completed_at!,
        }
      : null,
    latest_interview:
      last && first
        ? {
            id: last.id,
            jd: last.jd,
            completed_at: last.completed_at,
            score: last.overall_score,
            label: last.label,
            first_score: first.id !== last.id ? first.overall_score : null,
            delta: first.id !== last.id ? round2(last.overall_score - first.overall_score) : null,
            session_count: sameJd.length,
            trend: sameJd.slice(0, STAR_WINDOW).reverse().map(point),
          }
        : null,
    star: average ? { average, weakest: weakest(average), session_count: window.length } : null,
    in_progress: {
      analyses: analyses.filter((a) => a.status === "processing"),
      interview: input.activeInterview,
    },
    next_step: nextStep(input, completed),
    skills_to_learn: latestAnalysis
      ? {
          analysis_id: latestAnalysis.id,
          jd: latestAnalysis.jd,
          skills: missing
            .slice(0, SKILLS_LIMIT)
            .map((r) => ({ name: r.skill, importance: r.importance, roadmap_url: roadmapUrlOf(r.skill) })),
          total_missing: missing.length,
        }
      : null,
    recent_analyses: analyses.slice(0, RECENT_LIMIT),
    recent_interviews: sessions.slice(0, RECENT_LIMIT),
  }
}

interface ProgressInput {
  cvs: CvVersion[]
  sessions: InterviewRow[]
  analyses: AnalysisRow[]
  range: ProgressRange
  jdId: string | null
  now: number
}

function positions(sessions: InterviewRow[], analyses: AnalysisRow[]): PositionOption[] {
  const stats = new Map<string, PositionOption>()
  const touch = (jd: PositionOption["jd"], at: string) => {
    const entry = stats.get(jd.id) ?? { jd, interview_count: 0, analysis_count: 0, last_activity_at: at }
    if (time(at) > time(entry.last_activity_at)) entry.last_activity_at = at
    stats.set(jd.id, entry)
    return entry
  }
  for (const s of sessions) touch(s.jd, s.completed_at).interview_count++
  for (const a of analyses) if (a.status === "completed") touch(a.jd, a.completed_at!).analysis_count++
  return [...stats.values()].sort((a, b) => newestFirst(a.last_activity_at, b.last_activity_at))
}

export function interviewProgress(sessions: InterviewRow[]): InterviewProgress[] {
  const groups = new Map<string, InterviewRow[]>()
  for (const s of [...sessions].sort((a, b) => time(a.completed_at) - time(b.completed_at))) {
    groups.set(s.jd.id, [...(groups.get(s.jd.id) ?? []), s])
  }
  return [...groups.values()]
    .map((group) => {
      const first = group[0]
      const latest = group[group.length - 1]
      const previous = group.length > 1 ? group[group.length - 2] : null
      return {
        jd: latest.jd,
        session_count: group.length,
        points: group.map(point),
        first_score: first.overall_score,
        latest_score: latest.overall_score,
        delta_from_first: previous ? round2(latest.overall_score - first.overall_score) : null,
        delta_from_previous: previous ? round2(latest.overall_score - previous.overall_score) : null,
        latest_session_id: latest.id,
        previous_session_id: previous?.id ?? null,
        star_latest: latest.star,
        star_previous: previous?.star ?? null,
      }
    })
    .sort((a, b) => newestFirst(a.points.at(-1)!.completed_at, b.points.at(-1)!.completed_at))
}

export function cvProgress(analyses: AnalysisRow[], cvs: CvVersion[]): CvProgress[] {
  const versionOf = (a: AnalysisRow) =>
    cvs.find((c) => c.id === a.cv_version_id)?.version ?? Number(/v(\d+)/.exec(a.cv_label)?.[1] ?? 0)
  const latestPerCv = new Map<string, AnalysisRow>()
  for (const a of analyses) {
    if (a.status !== "completed" || a.match_score === null) continue
    const key = `${a.jd.id}|${a.cv_version_id}`
    const current = latestPerCv.get(key)
    if (!current || time(a.completed_at!) > time(current.completed_at!)) latestPerCv.set(key, a)
  }
  const groups = new Map<string, AnalysisRow[]>()
  for (const a of latestPerCv.values()) groups.set(a.jd.id, [...(groups.get(a.jd.id) ?? []), a])
  const lastActivity = (group: AnalysisRow[]) => Math.max(...group.map((a) => time(a.completed_at!)))
  return [...groups.values()]
    .sort((a, b) => lastActivity(b) - lastActivity(a))
    .map((group) => {
      group.sort((a, b) => versionOf(a) - versionOf(b) || time(a.completed_at!) - time(b.completed_at!))
      return {
        jd: group[0].jd,
        points: group.map((a) => ({
          analysis_id: a.id,
          cv_version_id: a.cv_version_id,
          cv_label: a.cv_label,
          match_score: a.match_score!,
          completed_at: a.completed_at!,
        })),
        delta: group.length > 1 ? round2(group[group.length - 1].match_score! - group[0].match_score!) : null,
      }
    })
}

export function buildProgress({ cvs, sessions: allSessions, analyses: allAnalyses, range, jdId, now }: ProgressInput): StudentProgress {
  const days = RANGE_DAYS[range]
  const since = days === null ? null : now - days * 86_400_000
  const keep = (at: string, jd: string) => (since === null || time(at) >= since) && (jdId === null || jd === jdId)
  const sessions = allSessions.filter((s) => keep(s.completed_at, s.jd.id))
  const analyses = allAnalyses.filter((a) => keep(a.created_at, a.jd.id))
  const activity = [...sessions.map((s) => s.completed_at), ...analyses.map((a) => a.completed_at ?? a.created_at)]
  return {
    range,
    jd_id: jdId,
    last_activity_at: activity.sort(newestFirst)[0] ?? null,
    positions: positions(allSessions, allAnalyses),
    interview_progress: interviewProgress(sessions),
    cv_progress: cvProgress(analyses, cvs),
    interviews: sessions,
    analyses,
  }
}
