import { Construction } from "lucide-react"

import { Badge } from "@/components/ui/badge"

interface ComingSoonProps {
  title: string
  description: string
  /** Tên frame tương ứng trong Figma. */
  figmaFrame?: string
  /** Đầu việc phụ trách, ví dụ "B1", "B4". */
  task?: string
}

/** Trang giữ chỗ cho các màn chưa dựng, để điều hướng không bị 404. */
export function ComingSoon({ title, description, figmaFrame, task }: ComingSoonProps) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <h1 className="font-heading text-2xl font-bold sm:text-3xl">{title}</h1>
        <p className="max-w-2xl text-ink-2">{description}</p>
      </div>
      <div className="grid justify-items-center gap-3 rounded-[20px] border border-dashed border-line bg-card px-6 py-14 text-center shadow-card">
        <span className="grid size-12 place-items-center rounded-full bg-blue-soft text-blue">
          <Construction className="size-6" aria-hidden />
        </span>
        <p className="font-heading font-bold">Màn hình đang được xây dựng</p>
        <div className="flex flex-wrap justify-center gap-2">
          {task && <Badge variant="violet">{task}</Badge>}
          {figmaFrame && <Badge variant="neutral">Figma: {figmaFrame}</Badge>}
        </div>
      </div>
    </div>
  )
}
