// Feature flag cho chức năng chưa làm xong. Mặc định tắt; bật bằng NEXT_PUBLIC_FEATURE_<TÊN>=true khi cần.

function flag(value: string | undefined): boolean {
  return value === "true"
}

export const features = {
  /** Dòng "hoặc nhập từ Google Drive" khi tải CV (chưa có chức năng nhập thật). */
  driveImport: flag(process.env.NEXT_PUBLIC_FEATURE_DRIVE_IMPORT),
} as const

export type FeatureName = keyof typeof features
