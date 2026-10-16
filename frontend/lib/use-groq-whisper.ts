"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { api } from "./api"
import { ApiError } from "./api-error"
import { isLive } from "./config"

interface UseGroqWhisperOptions {
  /** Buổi phỏng vấn đang diễn ra: backend gợi ý thuật ngữ của vị trí cho bộ nhận diện. */
  sessionId?: string
  /** Gọi mỗi khi nhận diện xong thêm một đoạn, với toàn bộ chữ đã nói trong lần ghi này. */
  onTranscript?: (text: string) => void
}

// Ghi theo đoạn, cắt ở khoảng ngừng nói: chữ hiện sau mỗi cụm câu thay vì đợi bấm Dừng nói.
// Groq tính tối thiểu 10 giây âm thanh cho mỗi lần gửi và giới hạn số lần gọi mỗi phút, nên đoạn ngắn nhất ~6 giây
// (tối đa ~10 lần gọi / phút); nói liền không ngừng thì vẫn cắt ở 25 giây để chữ không phải chờ quá lâu.
const MIN_SEGMENT_MS = 6000
const MAX_SEGMENT_MS = 25000
/** Ngừng nói ít nhất ngần này thì coi là hết một cụm câu. */
const PAUSE_MS = 700
/** Mức âm (RMS) trên ngưỡng này coi là đang nói; đoạn không có lúc nào vượt ngưỡng thì không gửi đi. */
const VOICE_RMS = 0.02
const MONITOR_MS = 100
/** Tổng thời gian một lần nói (mỗi câu hỏi có 5 phút). */
const MAX_RECORD_SECONDS = 290
const MIN_AUDIO_BYTES = 500

/** Chế độ mock: không cần micro, câu trả lời mẫu hiện dần theo từng cụm như khi nói thật. */
const MOCK_SPEECH = [
  "Ở kỳ thực tập vừa rồi, nhóm em cần làm lại trang quản trị đơn hàng vì trang cũ tải rất chậm.",
  "Em phụ trách phần giao diện, nên đã tách các bảng lớn thành component nhỏ, thêm phân trang và lưu bộ lọc trên URL.",
  "Sau hai tuần, thời gian tải trang giảm khoảng 40% và đội vận hành báo lỗi ít hẳn.",
  "Em rút ra là nên đo hiệu năng trước khi sửa.",
]
const MOCK_PHRASE_MS = 2200

function pickMimeType(): string {
  for (const type of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) return type
  }
  return ""
}

const join = (a: string, b: string) => [a.trim(), b.trim()].filter(Boolean).join(" ")

interface Segment {
  recorder: MediaRecorder
  chunks: Blob[]
  /** Có lúc nào vượt ngưỡng giọng nói không; đoạn chỉ có im lặng thì không gửi (tiết kiệm hạn mức, tránh chữ "ảo"). */
  voiced: boolean
  final: boolean
}

/**
 * Trả lời bằng giọng nói qua Groq Whisper (src/services/groq_stt.py). Ghi âm theo từng đoạn, cắt ở khoảng ngừng nói;
 * mỗi đoạn gửi lên backend theo đúng thứ tự, kèm chữ của các đoạn trước làm ngữ cảnh, nên chữ hiện dần trong lúc nói.
 */
export function useGroqWhisper({ sessionId, onTranscript }: UseGroqWhisperOptions = {}) {
  const [isRecording, setIsRecording] = useState(false)
  const [pending, setPending] = useState(0)
  const [recordSeconds, setRecordSeconds] = useState(0)

  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const segmentRef = useRef<Segment | null>(null)
  const segmentStartRef = useRef(0)
  const lastVoiceRef = useRef(0)
  const monitorRef = useRef<number | null>(null)
  const timerRef = useRef<number | null>(null)
  const queueRef = useRef<Promise<void>>(Promise.resolve())
  const textRef = useRef("")
  const discardRef = useRef(false)
  const errorShownRef = useRef(false)
  const onTranscriptRef = useRef(onTranscript)
  useEffect(() => {
    onTranscriptRef.current = onTranscript
  }, [onTranscript])

  const stopTimers = useCallback(() => {
    for (const ref of [monitorRef, timerRef]) {
      if (ref.current !== null) {
        window.clearInterval(ref.current)
        ref.current = null
      }
    }
  }, [])

  const releaseMic = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    void audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
  }, [])

  /** Gửi một đoạn; các đoạn xếp hàng để chữ nối đúng thứ tự nói. */
  const enqueue = useCallback(
    (audio: Blob) => {
      setPending((n) => n + 1)
      queueRef.current = queueRef.current.then(async () => {
        try {
          if (discardRef.current) return
          const { text } = await api.transcribeAudio(audio, sessionId, textRef.current)
          if (text.trim() && !discardRef.current) {
            textRef.current = join(textRef.current, text)
            onTranscriptRef.current?.(textRef.current)
          }
        } catch (err) {
          // Báo một lần cho cả lần nói; các đoạn sau vẫn tiếp tục
          if (!errorShownRef.current) {
            errorShownRef.current = true
            toast.error(err instanceof ApiError || err instanceof Error ? err.message : "Chưa nhận diện được giọng nói.")
          }
        } finally {
          setPending((n) => n - 1)
        }
      })
    },
    [sessionId],
  )

  const startSegment = useCallback(
    (stream: MediaStream) => {
      const mimeType = pickMimeType()
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      const segment: Segment = { recorder, chunks: [], voiced: false, final: false }
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) segment.chunks.push(e.data)
      }
      recorder.onstop = () => {
        if (segment.final) releaseMic()
        if (discardRef.current || !segment.voiced) return
        const audio = new Blob(segment.chunks, { type: recorder.mimeType || "audio/webm" })
        if (audio.size >= MIN_AUDIO_BYTES) enqueue(audio)
      }
      recorder.start(250)
      segmentRef.current = segment
      segmentStartRef.current = performance.now()
      lastVoiceRef.current = performance.now()
    },
    [enqueue, releaseMic],
  )

  /** Kết thúc đoạn đang ghi (đoạn đã đủ dài và người dùng vừa ngừng nói); final = dừng hẳn. */
  const cutSegment = useCallback(
    (final: boolean) => {
      const segment = segmentRef.current
      if (!segment || segment.recorder.state === "inactive") {
        if (final) releaseMic()
        return
      }
      segment.final = final
      segment.recorder.stop()
      segmentRef.current = null
      if (!final && streamRef.current) startSegment(streamRef.current)
    },
    [releaseMic, startSegment],
  )

  /** Dừng ghi âm; discard = bỏ phần chưa chuyển thành chữ (buổi phỏng vấn kết thúc), ngược lại chuyển nốt đoạn cuối. */
  const finish = useCallback(
    (discard: boolean) => {
      stopTimers()
      setIsRecording(false)
      discardRef.current = discard
      if (!isLive("interview")) {
        if (discard) return
        const rest = MOCK_SPEECH.filter((phrase) => !textRef.current.includes(phrase))
        if (rest.length === 0) return
        setPending((n) => n + 1)
        window.setTimeout(() => {
          textRef.current = join(textRef.current, rest.join(" "))
          onTranscriptRef.current?.(textRef.current)
          setPending((n) => n - 1)
        }, 700)
        return
      }
      cutSegment(true)
    },
    [cutSegment, stopTimers],
  )

  const start = useCallback(async () => {
    if (isRecording || pending > 0) return
    textRef.current = ""
    discardRef.current = false
    errorShownRef.current = false
    setRecordSeconds(0)
    const tick = () =>
      setRecordSeconds((s) => {
        if (s + 1 >= MAX_RECORD_SECONDS) {
          toast.info("Đã nói gần 5 phút, hệ thống tự dừng ghi âm.")
          window.setTimeout(() => finish(false), 0)
        }
        return s + 1
      })

    if (!isLive("interview")) {
      toast.info("Bản demo: giọng nói được mô phỏng bằng một câu trả lời mẫu.")
      setIsRecording(true)
      timerRef.current = window.setInterval(tick, 1000)
      let shown = 0
      monitorRef.current = window.setInterval(() => {
        if (shown >= MOCK_SPEECH.length) return
        textRef.current = join(textRef.current, MOCK_SPEECH[shown++])
        onTranscriptRef.current?.(textRef.current)
      }, MOCK_PHRASE_MS)
      return
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Trình duyệt này chưa hỗ trợ ghi âm. Hãy gõ câu trả lời.")
      return
    }
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      })
    } catch {
      toast.error("Không bật được micro. Hãy cấp quyền micro cho trình duyệt.")
      return
    }
    streamRef.current = stream

    // Đo mức âm để biết lúc nào đang nói, lúc nào ngừng
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const audioCtx = new AudioCtx()
    audioCtxRef.current = audioCtx
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 2048
    audioCtx.createMediaStreamSource(stream).connect(analyser)
    const samples = new Float32Array(analyser.fftSize)

    startSegment(stream)
    monitorRef.current = window.setInterval(() => {
      const segment = segmentRef.current
      if (!segment) return
      analyser.getFloatTimeDomainData(samples)
      let sum = 0
      for (const v of samples) sum += v * v
      const now = performance.now()
      if (Math.sqrt(sum / samples.length) > VOICE_RMS) {
        segment.voiced = true
        lastVoiceRef.current = now
      }
      const length = now - segmentStartRef.current
      const paused = now - lastVoiceRef.current >= PAUSE_MS
      if ((length >= MIN_SEGMENT_MS && segment.voiced && paused) || length >= MAX_SEGMENT_MS) cutSegment(false)
    }, MONITOR_MS)
    setIsRecording(true)
    timerRef.current = window.setInterval(tick, 1000)
  }, [isRecording, pending, finish, startSegment, cutSegment])

  const toggle = useCallback(() => {
    if (isRecording) finish(false)
    else void start()
  }, [isRecording, finish, start])

  /** Dừng và chuyển nốt đoạn cuối thành chữ (ví dụ khi tạm dừng buổi phỏng vấn). */
  const stop = useCallback(() => {
    if (isRecording) finish(false)
  }, [isRecording, finish])

  /** Dừng và bỏ phần chưa chuyển thành chữ (ví dụ buổi phỏng vấn kết thúc). */
  const cancel = useCallback(() => {
    if (isRecording) finish(true)
  }, [isRecording, finish])

  useEffect(
    () => () => {
      discardRef.current = true
      stopTimers()
      const segment = segmentRef.current
      if (segment && segment.recorder.state !== "inactive") segment.recorder.stop()
      releaseMic()
    },
    [releaseMic, stopTimers],
  )

  return {
    isRecording,
    /** Đã bấm Dừng nói, đang chờ chuyển nốt các đoạn cuối thành chữ. */
    isTranscribing: !isRecording && pending > 0,
    recordSeconds,
    toggle,
    stop,
    cancel,
  }
}
