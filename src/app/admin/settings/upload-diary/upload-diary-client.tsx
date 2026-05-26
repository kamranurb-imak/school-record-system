'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

const AGENT_URL = 'http://localhost:3099'

interface HealthData {
  ok: boolean
  pendingDir: string | null
  pendingCount: number
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function UploadDiaryClient() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [agentOnline, setAgentOnline] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    checkHealth()
    const interval = setInterval(checkHealth, 10000)
    return () => clearInterval(interval)
  }, [])

  async function checkHealth() {
    try {
      const res = await fetch(`${AGENT_URL}/health`, { signal: AbortSignal.timeout(3000) })
      if (res.ok) {
        const data: HealthData = await res.json()
        setHealth(data)
        setAgentOnline(true)
      } else {
        setAgentOnline(false)
      }
    } catch {
      setAgentOnline(false)
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)

    let succeeded = 0
    let failed = 0

    for (const file of files) {
      try {
        const data = await fileToBase64(file)
        const res = await fetch(`${AGENT_URL}/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, data }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Upload failed')
        succeeded++
      } catch (err) {
        failed++
        toast.error(`${file.name}: ${err instanceof Error ? err.message : 'Upload failed'}`)
      }
    }

    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''

    if (succeeded > 0) toast.success(`${succeeded} file${succeeded > 1 ? 's' : ''} uploaded to Pending folder`)
    await checkHealth()
  }

  return (
    <div className="space-y-4">
      {/* Agent status */}
      <div className={`flex items-center gap-2 px-4 py-3 rounded border text-sm ${agentOnline ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
        <span className={`inline-block w-2 h-2 rounded-full ${agentOnline ? 'bg-green-500' : 'bg-red-500'}`} />
        {agentOnline ? 'Local Agent Running' : 'Local Agent Offline'}
        {!agentOnline && (
          <span className="ml-2 text-red-600">
            — run <code className="bg-red-100 px-1 rounded text-xs">npm run local-agent</code> on the school PC
          </span>
        )}
      </div>

      {/* Pending folder info */}
      {agentOnline && health && (
        <div className="bg-gray-50 border rounded px-4 py-3 text-sm text-gray-700 space-y-1">
          <p><span className="font-medium">Pending folder:</span> {health.pendingDir ?? <span className="text-amber-600">Not configured — set it in Folder Paths</span>}</p>
          <p><span className="font-medium">Files waiting:</span> {health.pendingCount}</p>
        </div>
      )}

      {/* Upload form */}
      <div className="bg-white border rounded p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-800 mb-1">Upload Diary Images</h2>
          <p className="text-sm text-gray-500">Select one or more JPG/PNG diary images. They will be saved to the Pending folder and picked up by the next scheduled processor run.</p>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".jpg,.jpeg,.png"
          multiple
          className="hidden"
          onChange={handleUpload}
          disabled={!agentOnline || uploading}
        />

        <Button
          onClick={() => fileRef.current?.click()}
          disabled={!agentOnline || uploading}
        >
          {uploading ? 'Uploading...' : 'Select Images to Upload'}
        </Button>

        {!agentOnline && (
          <p className="text-xs text-gray-400">Start the local agent to enable uploads.</p>
        )}
      </div>
    </div>
  )
}
