/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { IoFlash, IoClose, IoDocumentText, IoAdd, IoPencil } from 'react-icons/io5'
import { supabase } from '@/utils/supabase-client'

export function CameraPageMobile() {
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const [capturedPages, setCapturedPages] = useState<string[]>([])
    const [cameraStarted, setCameraStarted] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [processing, setProcessing] = useState(false)
    const [pdfName, setPdfName] = useState('')
    const [isEditingName, setIsEditingName] = useState(false)
    const navigate = useNavigate()
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''

    const startCamera = useCallback(async () => {
        try {
            setError(null)
            
            // Check if camera access is available
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Camera API not supported')
            }

            // Check if using HTTPS or localhost
            const isSecureContext = window.isSecureContext
            if (!isSecureContext) {
                throw new Error('HTTPS required for camera access. Please use HTTPS or localhost.')
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
            })

            if (videoRef.current) {
                videoRef.current.srcObject = stream
                streamRef.current = stream
            }
        } catch (err: any) {
            console.error('Error accessing camera:', err)
            let errorMessage = 'Unable to access camera. '

            if (err.message && err.message.includes('HTTPS required')) {
                errorMessage = '🔒 HTTPS Required: Camera access needs a secure connection. Access via HTTPS or localhost.'
            } else if (err.name === 'NotAllowedError') {
                errorMessage += 'Please allow camera permission in your browser settings.'
            } else if (err.name === 'NotFoundError') {
                errorMessage += 'No camera found on this device.'
            } else if (err.name === 'NotReadableError') {
                errorMessage += 'Camera is already in use by another app.'
            } else if (err.message && err.message.includes('not supported')) {
                errorMessage = 'Camera is not supported on this browser.'
            } else {
                errorMessage += 'Please check browser permissions and try again.'
            }

            setError(errorMessage)
        }
    }, [])

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop())
            streamRef.current = null
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null
        }
        setCameraStarted(false)
    }, [])

    const capturePhoto = useCallback(() => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current
            const canvas = canvasRef.current

            canvas.width = video.videoWidth
            canvas.height = video.videoHeight

            const ctx = canvas.getContext('2d')
            if (ctx) {
                ctx.drawImage(video, 0, 0)
                // Compress image using JPEG format with 0.8 quality
                const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8)
                setCapturedPages(prev => [...prev, imageDataUrl])
            }
        }
    }, [])

    const handleFinish = async () => {
        if (capturedPages.length === 0) {
            return
        }

        setProcessing(true)

        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession()
            
            if (sessionError || !session) {
                alert('Authentication error. Please log in again.')
                navigate('/scan/login')
                return
            }

            const formData = new FormData()
            formData.append('pdf_name', pdfName.trim() || `Scan_${new Date().toISOString().split('T')[0]}.pdf`)
            
            for (let i = 0; i < capturedPages.length; i++) {
                const response = await fetch(capturedPages[i])
                const blob = await response.blob()
                // Compress blob if it's larger than 500KB
                let finalBlob = blob
                if (blob.size > 500000) {
                    const img = new Image()
                    img.src = capturedPages[i]
                    await new Promise(resolve => img.onload = resolve)
                    
                    const canvas = document.createElement('canvas')
                    canvas.width = img.width
                    canvas.height = img.height
                    const ctx = canvas.getContext('2d')
                    if (ctx) {
                        ctx.drawImage(img, 0, 0)
                        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7)
                        const compressedResponse = await fetch(compressedDataUrl)
                        finalBlob = await compressedResponse.blob()
                    }
                }
                formData.append('images', finalBlob, `page_${i + 1}.jpg`)
            }

            const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/scan`
            
            const scanResponse = await fetch(edgeFunctionUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''
                },
                body: formData
            })

            if (!scanResponse.ok) {
                throw new Error('Failed to process scan')
            }

            const result = await scanResponse.json()
            
            if (result.scanId) {
                navigate(`/scan/view/${result?.scanId}`)
            } else {
                navigate('/scan/dashboard')
            }
        } catch (error: any) {
            console.error('Error processing scan:', error)
            alert(`Failed to process scan: ${error.message || 'Unknown error'}`)
        } finally {
            setProcessing(false)
        }
    }

    useEffect(() => {
        startCamera()
        return () => {
            stopCamera()
        }
    }, [startCamera, stopCamera])

    return (
        <div className="dark h-screen flex flex-col bg-black overflow-hidden relative">
            {/* Live Camera Feed Background */}
            <div className="absolute inset-0 z-0">
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    onCanPlay={() => setCameraStarted(true)}
                    className="w-full h-full object-cover opacity-80"
                />
            </div>

            {/* Top Navigation */}
            <div className="relative z-10 bg-gradient-to-b from-black/60 to-transparent">
                <div className="flex items-center p-4 pb-3 justify-between">
                    <button 
                        className="text-white flex size-12 shrink-0 items-center justify-center rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                        onClick={() => {
                            stopCamera()
                            navigate('/scan/dashboard')
                        }}
                    >
                        <IoClose className="text-2xl" />
                    </button>
                    <div className="flex flex-col items-center">
                        <h2 className="text-white text-lg font-bold leading-tight tracking-[-0.015em]">Scan Document</h2>
                        <span className="text-white/70 text-xs font-medium uppercase tracking-widest mt-0.5">Auto Mode</span>
                    </div>
                    <div className="flex w-12 items-center justify-end">
                        <button className="flex size-10 items-center justify-center rounded-full text-white hover:bg-white/10 transition-colors cursor-pointer">
                            <IoFlash className="text-2xl" />
                        </button>
                    </div>
                </div>
                
                {/* PDF Name Input */}
                <div className="px-4 pb-6">
                    {isEditingName ? (
                        <Input
                            value={pdfName}
                            onChange={(e) => setPdfName(e.target.value)}
                            onBlur={() => setIsEditingName(false)}
                            placeholder="Enter PDF name..."
                            className="bg-white/10 border-white/20 text-white placeholder:text-white/50 text-sm h-9"
                            autoFocus
                        />
                    ) : (
                        <button
                            onClick={() => setIsEditingName(true)}
                            className="w-full flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-lg px-3 py-2 text-white hover:bg-white/20 transition-colors cursor-pointer"
                        >
                            <IoPencil className="text-sm" />
                            <span className="text-sm font-medium truncate">
                                {pdfName || `Scan_${new Date().toISOString().split('T')[0]}`}
                            </span>
                        </button>
                    )}
                </div>
            </div>

            {/* Center Instruction */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 gap-3">
                {!cameraStarted && !error && (
                    <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/20">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mx-auto"></div>
                    </div>
                )}
                {cameraStarted && !error && (
                    <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/20">
                        <p className="text-white text-sm font-medium">Position document in frame</p>
                    </div>
                )}
                {error && (
                    <div className="flex flex-col items-center gap-3 max-w-sm">
                        <div className="bg-red-500/40 backdrop-blur-md px-5 py-3 rounded-2xl border border-red-500/20 text-center">
                            <p className="text-white text-sm font-medium leading-relaxed">{error}</p>
                        </div>
                        <Button
                            onClick={startCamera}
                            className="bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-md"
                        >
                            Retry Camera Access
                        </Button>
                    </div>
                )}
            </div>

            {/* Bottom UI Section */}
            <div className="relative z-10 flex flex-col gap-2 pb-8 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                {/* Captured Gallery Carousel */}
                <div className="flex overflow-x-auto scrollbar-none px-4">
                    <div className="flex items-end gap-3 pb-2">
                        {capturedPages.map((page, index) => (
                            <div key={index} className="flex flex-col gap-2 shrink-0">
                                <div className="relative size-20 rounded-lg border-2 border-white/50 overflow-hidden shadow-xl">
                                    <img src={page} alt={`Page ${index + 1}`} className="h-full w-full object-cover" />
                                    <div className="absolute top-1 right-1 bg-primary size-5 rounded-full flex items-center justify-center text-[10px] text-white font-bold">
                                        {index + 1}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {/* Placeholder for next capture */}
                        <div className="flex flex-col gap-2 shrink-0">
                            <div className="size-20 rounded-lg border-2 border-dashed border-white/30 flex items-center justify-center bg-white/5 backdrop-blur-sm">
                                <IoAdd className="text-white/40 text-2xl" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Shutter & Main Controls */}
                <div className="flex items-center justify-between px-8 py-4">
                    {/* Gallery Toggle */}
                    <button className="flex shrink-0 items-center justify-center rounded-full size-12 bg-white/10 backdrop-blur-md text-white border border-white/10 hover:bg-white/20 transition-colors cursor-pointer">
                        <IoDocumentText className="text-xl" />
                    </button>

                    {/* Main Shutter Button */}
                    <button 
                        onClick={capturePhoto}
                        disabled={!cameraStarted}
                        className="relative flex items-center justify-center size-20 cursor-pointer"
                    >
                        <div className="absolute inset-0 rounded-full border-4 border-white/80 pointer-events-none"></div>
                        <div className="size-16 bg-white rounded-full flex items-center justify-center shadow-inner active:bg-white/90 transition-transform active:scale-90 disabled:opacity-50">
                            <div className="size-14 rounded-full border-2 border-black/5 pointer-events-none"></div>
                        </div>
                    </button>

                    {/* Done Button */}
                    <Button
                        onClick={handleFinish}
                        disabled={capturedPages.length === 0 || processing}
                        className="min-w-[80px] h-12 px-5 bg-primary text-sm font-bold hover:bg-primary/90 active:scale-95 transition-all rounded-xl disabled:opacity-50 disabled:shadow-none shadow-lg shadow-primary/40"
                    >
                        {processing ? 'Processing...' : `Done (${capturedPages.length})`}
                    </Button>
                </div>

                {/* Interaction Mode Select */}
                <div className="flex justify-center gap-6 px-4 pb-2">
                    <button className="text-xs font-bold text-white tracking-widest uppercase cursor-pointer">Document</button>
                </div>
            </div>

            {/* iOS Bottom Indicator */}
            <div className="h-1.5 w-32 bg-white/30 rounded-full absolute bottom-2 left-1/2 -translate-x-1/2 z-10"></div>

            <canvas ref={canvasRef} className="hidden" />

            {/* Processing Overlay with Skeleton Loader */}
            {processing && (
                <div className="absolute inset-0 bg-black/95 backdrop-blur-lg z-50 flex items-center justify-center p-4">
                    <div className="w-full max-w-md">
                        <Card className="border-2 border-primary/30 bg-background/95 shadow-2xl">
                            <CardContent className="pt-6 space-y-6">
                                <div className="flex flex-col items-center text-center space-y-4">
                                    <div className="relative">
                                        <div className="animate-spin rounded-full h-20 w-20 border-4 border-primary/20 border-t-primary"></div>
                                        <IoDocumentText className="absolute inset-0 m-auto h-10 w-10 text-primary" />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-2xl font-bold">Processing Your PDF</h3>
                                        <p className="text-sm text-muted-foreground">
                                            Converting {capturedPages.length} page{capturedPages.length > 1 ? 's' : ''} into a PDF document...
                                        </p>
                                    </div>
                                </div>
                                
                                {/* <div className="space-y-3">
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-5/6" />
                                    <Skeleton className="h-4 w-4/6" />
                                </div>
                                
                                <div className="pt-2">
                                    <div className="flex items-center justify-center gap-2">
                                        <Skeleton className="h-24 w-24 rounded-lg" />
                                        <Skeleton className="h-24 w-24 rounded-lg" />
                                        <Skeleton className="h-24 w-24 rounded-lg" />
                                    </div>
                                </div> */}

                                <div className="text-center pt-2">
                                    <p className="text-xs text-muted-foreground animate-pulse">
                                        Please wait while we generate your PDF...
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    )
}
