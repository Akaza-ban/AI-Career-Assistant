import Link from "next/link"
import { GraduationCap, UserRoundCheck } from "lucide-react"

import { USE_MOCK } from "@/lib/config"

// Màn chọn vai trò tạm thời, thay cho đăng nhập cho tới khi có auth thật.
const roles = [
  {
    href: "/student",
    title: "Sinh viên",
    description: "Phân tích CV theo JD, tối ưu CV và luyện phỏng vấn STAR.",
    icon: GraduationCap,
  },
  {
    href: "/advisor",
    title: "Cố vấn hướng nghiệp",
    description: "Theo dõi tiến bộ và báo cáo của sinh viên được phân công.",
    icon: UserRoundCheck,
  },
]

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1180px] flex-col justify-center gap-10 px-4 py-16 sm:px-10">
      <div className="grid justify-items-start gap-4">
        <span className="rounded-full bg-blue-soft px-3 py-1 font-heading text-[13px] font-semibold text-blue">
          CareerX {USE_MOCK && "· dữ liệu minh hoạ"}
        </span>
        <h1 className="font-heading text-4xl font-extrabold leading-tight sm:text-5xl">
          Chọn vai trò để <span className="text-grad">bắt đầu</span>
        </h1>
        <p className="max-w-xl text-ink-2">
          Bản dựng thử giao diện. Đăng nhập thật sẽ thay thế màn hình này khi backend sẵn sàng.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {roles.map(({ href, title, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="grid gap-3 rounded-[20px] border border-line bg-card p-6 shadow-card transition hover:-translate-y-1 hover:shadow-float"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-blue-soft text-blue">
              <Icon className="size-5" aria-hidden />
            </span>
            <h2 className="font-heading text-lg font-bold">{title}</h2>
            <p className="text-sm text-ink-2">{description}</p>
          </Link>
        ))}
      </div>
    </main>
  )
}
