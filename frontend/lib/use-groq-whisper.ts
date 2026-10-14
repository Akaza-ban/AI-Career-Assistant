"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { api } from "./api"

interface UseGroqWhisperOptions {
  sessionId?: string
  onTranscriptUpdate?: (speechText: string) => void
}

export function useGroqWhisper(options: UseGroqWhisperOptions = {}) {
  const { sessionId, onTranscriptUpdate } = options

  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [volume, setVolume] = useState(0)
  const [recordSeconds, setRecordSeconds] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const cleanupAudio = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    if (audioCtxRef.current) {
      try {
        void audioCtxRef.current.close()
      } catch {
        // ignore
      }
      audioCtxRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setVolume(0)
    setRecordSeconds(0)
  }, [])

  const start = useCallback(async () => {
    if (isRecording || isTranscribing) return

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error("Trình duyệt của bạn không hỗ trợ ghi âm trực tiếp.")
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
      streamRef.current = stream

      // Thiết lập đo âm lượng visualizer
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        const audioCtx = new AudioCtx()
        audioCtxRef.current = audioCtx
        const source = audioCtx.createMediaStreamSource(stream)
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 256
        source.connect(analyser)
        const dataArray = new Uint8Array(analyser.frequencyBinCount)

        const updateVolume = () => {
          if (!streamRef.current) return
          analyser.getByteFrequencyData(dataArray)
          let sum = 0
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i]
          }
          const avg = sum / dataArray.length
          setVolume(Math.min(100, Math.round((avg / 128) * 100)))
          animFrameRef.current = requestAnimationFrame(updateVolume)
        }
        animFrameRef.current = requestAnimationFrame(updateVolume)
      } catch {
        // bỏ qua nếu browser không hỗ trợ visualizer
      }

      audioChunksRef.current = []

      // Chọn mimeType phù hợp nhất của trình duyệt
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : ""

      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)

      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.start(250) // gom chunk mỗi 250ms
      setIsRecording(true)

      setRecordSeconds(0)
      timerRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1)
      }, 1000)
    } catch (err) {
      cleanupAudio()
      setIsRecording(false)
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes("Permission denied") || msg.includes("NotAllowedError")) {
        toast.error("Vui lòng cấp quyền truy cập Microphone cho trình duyệt để nói câu trả lời.")
      } else {
        toast.error(`Không thể bật micro: ${msg}`)
      }
    }
  }, [isRecording, isTranscribing, cleanupAudio])

  const stop = useCallback(() => {
    if (!isRecording) return

    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== "inactive") {
      setIsRecording(false)
      setIsTranscribing(true)

      recorder.onstop = async () => {
        try {
          const mimeType = recorder.mimeType || "audio/webm"
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
          audioChunksRef.current = []
          cleanupAudio()

          if (audioBlob.size < 500) {
            toast.warning("Thời lượng nói quá ngắn hoặc không có âm thanh.")
            setIsTranscribing(false)
            return
          }

          toast.info("Đang dịch giọng nói qua Groq Whisper Turbo AI…", { duration: 2500 })
          const res = await api.transcribeAudio(audioBlob, sessionId)
          const text = (res.text || "").trim()

          if (text) {
            onTranscriptUpdate?.(text)
            toast.success("Đã chuyển giọng nói thành văn bản thành công!")
          } else {
            toast.warning("Chưa nhận diện được giọng nói. Vui lòng nói to và rõ hơn.")
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Lỗi chuyển đổi giọng nói."
          toast.error(`Groq Whisper lỗi: ${msg}`)
        } finally {
          setIsTranscribing(false)
        }
      }

      try {
        recorder.stop()
      } catch {
        cleanupAudio()
        setIsTranscribing(false)
      }
    } else {
      cleanupAudio()
      setIsRecording(false)
      setIsTranscribing(false)
    }
  }, [isRecording, sessionId, onTranscriptUpdate, cleanupAudio])

  const toggle = useCallback(() => {
    if (isRecording) {
      stop()
    } else {
      void start()
    }
  }, [isRecording, start, stop])

  const cancel = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop()
      } catch {
        // ignore
      }
    }
    audioChunksRef.current = []
    cleanupAudio()
    setIsRecording(false)
    setIsTranscribing(false)
  }, [cleanupAudio])

  useEffect(() => {
    return () => {
      cleanupAudio()
    }
  }, [cleanupAudio])

  return {
    isRecording,
    isTranscribing,
    isConnecting: isTranscribing, // tương thích với interface trước đây
    volume,
    recordSeconds,
    start,
    stop,
    toggle,
    cancel,
  }
}
