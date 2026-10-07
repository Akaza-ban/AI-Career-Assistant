import type { UserRole } from "@/types/assistant"

// The guide uses section URLs; some sections open a creation page in this app.
const ROUTE_ALIASES: Record<string, string> = {
  "/student/overview": "/student",
  "/student/analysis": "/student/analysis/new",
  "/student/interview": "/student/interview/new",
  "/advisor/dashboard": "/advisor",
}

const ROUTES: Record<UserRole, ReadonlySet<string>> = {
  student: new Set([
    "/student", "/student/cv", "/student/analysis/new", "/student/interview/new",
    "/student/interview/start", "/student/history", "/student/share", "/student/settings",
  ]),
  advisor: new Set(["/advisor", "/advisor/students"]),
}

/** Only allow routes implemented by this app and belonging to the current role. */
export function resolveAssistantRoute(route: unknown, role: UserRole): string | null {
  if (typeof route !== "string") return null
  const resolved = ROUTE_ALIASES[route] ?? route
  if (ROUTES[role].has(resolved)) return resolved
  const pattern = role === "advisor"
    ? /^\/advisor\/students\/[\w-]{1,64}$/
    : /^\/student\/(?:cv\/[\w-]{1,64}|analysis\/[\w-]{1,64}(?:\/(?:optimize|export))?|interview\/[\w-]{1,64}(?:\/report)?)$/
  return pattern.test(resolved) ? resolved : null
}
