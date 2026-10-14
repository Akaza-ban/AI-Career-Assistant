"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { API_BASE_URL, isLive } from "./config"

/** Chế độ mock: không có micro / Soniox, "nói" bằng cách gõ dần câu trả lời mẫu này. */
const MOCK_SPEECH =
  "Ở kỳ thực tập vừa rồi, nhóm em cần làm lại trang quản trị đơn hàng vì trang cũ tải rất chậm. Em phụ trách phần " +
  "giao diện, nên đã tách các bảng lớn thành component nhỏ, thêm phân trang và lưu bộ lọc trên URL. Sau hai tuần, " +
  "thời gian tải trang giảm khoảng 40% và đội vận hành báo lỗi ít hẳn. Em rút ra là nên đo hiệu năng trước khi sửa."
const MOCK_WORD_MS = 140

interface UseSonioxSttOptions {
  sessionId?: string
  onTranscriptUpdate?: (speechText: string) => void
}

interface SonioxToken {
  text: string
  is_final: boolean
  confidence?: number
}

function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length)
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]))
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return output
}

export function useSonioxStt(options: UseSonioxSttOptions = {}) {
  const { sessionId, onTranscriptUpdate } = options

  const [isRecording, setIsRecording] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [volume, setVolume] = useState(0)
  const [speechText, setSpeechText] = useState("")

  const wsRef = useRef<WebSocket | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const isReadyRef = useRef(false)
  const confirmedTextRef = useRef("")
  const provisionalTextRef = useRef("")
  const mockTimerRef = useRef<number | null>(null)

  const stop = useCallback(() => {
    setIsRecording(false)
    setIsConnecting(false)
    setVolume(0)
    isReadyRef.current = false
    if (mockTimerRef.current !== null) {
      window.clearInterval(mockTimerRef.current)
      window.clearTimeout(mockTimerRef.current)
      mockTimerRef.current = null
    }

    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ action: "stop" }))
        } catch {
          // ignore
        }
      }
      try {
        wsRef.current.close()
      } catch {
        // ignore
      }
      wsRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (audioCtxRef.current) {
      try {
        void audioCtxRef.current.close()
      } catch {
        // ignore
      }
      audioCtxRef.current = null
    }
  }, [])

  const start = useCallback(async () => {
    if (isRecording || isConnecting) return

    setIsConnecting(true)
    confirmedTextRef.current = ""
    provisionalTextRef.current = ""
    setSpeechText("")

    if (!isLive("interview")) {
      toast.info("Bản demo: giọng nói được mô phỏng bằng một câu trả lời mẫu.")
      const words = MOCK_SPEECH.split(" ")
      mockTimerRef.current = window.setTimeout(() => {
        setIsConnecting(false)
        setIsRecording(true)
        let shown = 0
        mockTimerRef.current = window.setInterval(() => {
          shown += 1
          const text = words.slice(0, shown).join(" ")
          setSpeechText(text)
          onTranscriptUpdate?.(text)
          if (shown >= words.length) stop()
        }, MOCK_WORD_MS)
      }, 700)
      return
    }

    // 1. Xin quyền micro từ trình duyệt
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
      streamRef.current = stream
    } catch {
      setIsConnecting(false)
      toast.error("Không thể truy cập microphone. Vui lòng cấp quyền micro trên trình duyệt.")
      return
    }

    // 2. Mở WebSocket tới backend proxy Soniox
    const wsBase = API_BASE_URL.replace(/^http(s?):\/\//, "ws$1://")
    const wsUrl = `${wsBase}/api/v1/interviews/ws/transcribe${
      sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : ""
    }`

    let ws: WebSocket
    try {
      ws = new WebSocket(wsUrl)
      ws.binaryType = "arraybuffer"
      wsRef.current = ws
    } catch {
      stop()
      toast.error("Không thể kết nối dịch vụ Speech-to-Text.")
      return
    }

    ws.onopen = () => {
      // Chờ bản tin "ready" từ backend
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === "ready") {
          setIsConnecting(false)
          setIsRecording(true)
          isReadyRef.current = true
        } else if (data.type === "tokens") {
          const rawTokens: SonioxToken[] = data.tokens || []
          let addedConfirmed = ""
          for (const token of rawTokens) {
            if (token.is_final) {
              addedConfirmed += token.text
            }
          }
          if (addedConfirmed) {
            confirmedTextRef.current += addedConfirmed
          }

          const currentProvisional = rawTokens
            .filter((t) => !t.is_final)
            .map((t) => t.text)
            .join("")
          provisionalTextRef.current = currentProvisional

          const fullSpeech = confirmedTextRef.current + currentProvisional
          setSpeechText(fullSpeech)
          onTranscriptUpdate?.(fullSpeech)
        } else if (data.type === "error") {
          toast.error(data.message || "Lỗi nhận diện giọng nói từ Soniox.")
          stop()
        }
      } catch {
        // ignore parse error
      }
    }

    ws.onerror = () => {
      toast.error("Lỗi kết nối máy chủ Soniox STT.")
      stop()
    }

    ws.onclose = () => {
      setIsRecording(false)
      setIsConnecting(false)
      isReadyRef.current = false
    }

    // 3. Khởi tạo AudioContext và bắt đầu stream PCM 16kHz
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const audioCtx = new AudioCtx({ sampleRate: 16000 })
      audioCtxRef.current = audioCtx

      const source = audioCtx.createMediaStreamSource(stream)
      // Dùng buffer 4096 tương đương ~256ms audio mỗi chunk
      const processor = audioCtx.createScriptProcessor(4096, 1, 1)

      processor.onaudioprocess = (e) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && isReadyRef.current) {
          const inputData = e.inputBuffer.getChannelData(0)
          const pcm16 = floatTo16BitPCM(inputData)
          wsRef.current.send(pcm16.buffer)

          // Đo volume thực tế để hiển thị animation micro
          let sum = 0
          for (let i = 0; i < inputData.length; i += 8) {
            sum += inputData[i] * inputData[i]
          }
          const rms = Math.sqrt(sum / (inputData.length / 8))
          setVolume(Math.min(1, rms * 5))
        }
      }

      source.connect(processor)
      processor.connect(audioCtx.destination)
    } catch {
      stop()
      toast.error("Trình duyệt không hỗ trợ Web Audio API.")
    }
  }, [isRecording, isConnecting, sessionId, onTranscriptUpdate, stop])

  const toggle = useCallback(() => {
    if (isRecording || isConnecting) {
      stop()
    } else {
      void start()
    }
  }, [isRecording, isConnecting, start, stop])

  // Dọn dẹp khi component unmount
  useEffect(() => {
    return () => {
      stop()
    }
  }, [stop])

  return {
    isRecording,
    isConnecting,
    volume,
    speechText,
    start,
    stop,
    toggle,
  }
}
