// Lộ trình roadmap.sh cho chế độ mock: cùng bảng ánh xạ và cách khớp với src/services/roadmap.py.
import type { RequirementAssessment } from "@/lib/types"

export const DEFAULT_ROADMAP_URL = "https://roadmap.sh/roadmaps"

// Sinh từ SKILL_ROADMAP_MAP ở backend; sửa bên đó thì cập nhật lại bảng này.
const SKILL_ROADMAP_MAP: Record<string, string> = {
  "python": "https://roadmap.sh/python",
  "java": "https://roadmap.sh/java",
  "javascript": "https://roadmap.sh/javascript",
  "js": "https://roadmap.sh/javascript",
  "typescript": "https://roadmap.sh/typescript",
  "ts": "https://roadmap.sh/typescript",
  "c++": "https://roadmap.sh/cpp",
  "cpp": "https://roadmap.sh/cpp",
  "c#": "https://roadmap.sh/csharp",
  "csharp": "https://roadmap.sh/csharp",
  ".net": "https://roadmap.sh/aspnet-core",
  "asp.net": "https://roadmap.sh/aspnet-core",
  "aspnet": "https://roadmap.sh/aspnet-core",
  "golang": "https://roadmap.sh/golang",
  "go": "https://roadmap.sh/golang",
  "rust": "https://roadmap.sh/rust",
  "php": "https://roadmap.sh/php",
  "ruby": "https://roadmap.sh/ruby",
  "kotlin": "https://roadmap.sh/kotlin",
  "swift": "https://roadmap.sh/swift",
  "sql": "https://roadmap.sh/sql",
  "frontend": "https://roadmap.sh/frontend",
  "react": "https://roadmap.sh/react",
  "reactjs": "https://roadmap.sh/react",
  "react.js": "https://roadmap.sh/react",
  "vue": "https://roadmap.sh/vue",
  "vuejs": "https://roadmap.sh/vue",
  "vue.js": "https://roadmap.sh/vue",
  "angular": "https://roadmap.sh/angular",
  "next.js": "https://roadmap.sh/react",
  "nextjs": "https://roadmap.sh/react",
  "html": "https://roadmap.sh/frontend",
  "css": "https://roadmap.sh/frontend",
  "tailwind": "https://roadmap.sh/frontend",
  "tailwindcss": "https://roadmap.sh/frontend",
  "backend": "https://roadmap.sh/backend",
  "nodejs": "https://roadmap.sh/nodejs",
  "node.js": "https://roadmap.sh/nodejs",
  "node": "https://roadmap.sh/nodejs",
  "express": "https://roadmap.sh/nodejs",
  "expressjs": "https://roadmap.sh/nodejs",
  "spring": "https://roadmap.sh/spring-boot",
  "spring boot": "https://roadmap.sh/spring-boot",
  "springboot": "https://roadmap.sh/spring-boot",
  "fastapi": "https://roadmap.sh/python",
  "django": "https://roadmap.sh/python",
  "flask": "https://roadmap.sh/python",
  "nest.js": "https://roadmap.sh/nodejs",
  "nestjs": "https://roadmap.sh/nodejs",
  "rest api": "https://roadmap.sh/backend",
  "restful": "https://roadmap.sh/backend",
  "graphql": "https://roadmap.sh/graphql",
  "postgresql": "https://roadmap.sh/postgresql",
  "postgres": "https://roadmap.sh/postgresql",
  "mysql": "https://roadmap.sh/sql",
  "mongodb": "https://roadmap.sh/mongodb",
  "redis": "https://roadmap.sh/redis",
  "devops": "https://roadmap.sh/devops",
  "docker": "https://roadmap.sh/docker",
  "kubernetes": "https://roadmap.sh/kubernetes",
  "k8s": "https://roadmap.sh/kubernetes",
  "linux": "https://roadmap.sh/linux",
  "git": "https://roadmap.sh/git-github",
  "github": "https://roadmap.sh/git-github",
  "gitlab": "https://roadmap.sh/git-github",
  "aws": "https://roadmap.sh/aws",
  "cloud": "https://roadmap.sh/aws",
  "ci/cd": "https://roadmap.sh/devops",
  "cicd": "https://roadmap.sh/devops",
  "ai": "https://roadmap.sh/ai-data-scientist",
  "artificial intelligence": "https://roadmap.sh/ai-data-scientist",
  "machine learning": "https://roadmap.sh/ai-data-scientist",
  "deep learning": "https://roadmap.sh/ai-data-scientist",
  "data science": "https://roadmap.sh/ai-data-scientist",
  "data analyst": "https://roadmap.sh/data-analyst",
  "data analysis": "https://roadmap.sh/data-analyst",
  "data engineer": "https://roadmap.sh/data-engineer",
  "pytorch": "https://roadmap.sh/ai-data-scientist",
  "tensorflow": "https://roadmap.sh/ai-data-scientist",
  "nlp": "https://roadmap.sh/ai-data-scientist",
  "android": "https://roadmap.sh/android",
  "ios": "https://roadmap.sh/ios",
  "flutter": "https://roadmap.sh/flutter",
  "react native": "https://roadmap.sh/react-native",
  "cyber security": "https://roadmap.sh/cyber-security",
  "security": "https://roadmap.sh/cyber-security",
  "qa": "https://roadmap.sh/qa",
  "testing": "https://roadmap.sh/qa",
  "software testing": "https://roadmap.sh/qa",
  "computer science": "https://roadmap.sh/computer-science",
  "system design": "https://roadmap.sh/system-design",
  "fullstack": "https://roadmap.sh/full-stack",
  "full-stack": "https://roadmap.sh/full-stack",
  "blockchain": "https://roadmap.sh/blockchain",
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** Link lộ trình của kỹ năng, hoặc null khi roadmap.sh chưa có lộ trình riêng (thường là kỹ năng ngoài CNTT). */
export function roadmapUrlOf(skill: string): string | null {
  const cleaned = skill.replace(/\(.*?\)/g, "").trim().toLowerCase()
  if (!cleaned) return null
  if (SKILL_ROADMAP_MAP[cleaned]) return SKILL_ROADMAP_MAP[cleaned]
  for (const [keyword, url] of Object.entries(SKILL_ROADMAP_MAP)) {
    // Như (?<!\w)...(?!\w) của Python: \w trong Python gồm cả chữ có dấu
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}_])${escape(keyword)}(?![\\p{L}\\p{N}_])`, "u")
    if (keyword.length >= 2 && pattern.test(cleaned)) return url
  }
  return null
}

export function withRoadmap(r: RequirementAssessment): RequirementAssessment {
  const url = roadmapUrlOf(r.skill)
  return { ...r, roadmap_url: url ?? DEFAULT_ROADMAP_URL, is_it_supported: url !== null }
}

/** Kỹ năng thiếu chung → link lộ trình, chỉ những kỹ năng roadmap.sh có lộ trình riêng. */
export function roadmapsOf(skills: string[]): Record<string, string> {
  return Object.fromEntries(skills.flatMap((s) => {
    const url = roadmapUrlOf(s)
    return url ? [[s, url]] : []
  }))
}
