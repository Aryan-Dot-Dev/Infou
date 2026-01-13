import { useRef, useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { IoCamera, IoArrowForward, IoTrash, IoClose, IoDocumentText, IoArrowBack } from 'react-icons/io5'
import { supabase } from '@/utils/supabase-client'

export function CameraPage() {
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const [capturedPages, setCapturedPages] = useState<string[]>([])
    const [cameraStarted, setCameraStarted] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [pdfName, setPdfName] = useState('')
    const [processing, setProcessing] = useState(false)
    const navigate = useNavigate()

    const startCamera = useCallback(async () => {
        try {
            setError(null)
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

            if (err.name === 'NotAllowedError') {
                errorMessage += 'Permission denied. Please allow camera access.'
            } else if (err.name === 'NotFoundError') {
                errorMessage += 'No camera found.'
            } else if (err.name === 'NotReadableError') {
                errorMessage += 'Camera is already in use.'
            } else {
                errorMessage += err.message || 'Please check permissions.'
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
                const imageDataUrl = canvas.toDataURL('image/png')
                setCapturedPages(prev => [...prev, imageDataUrl])
            }
        }
    }, [])

    const removePage = useCallback((index: number) => {
        setCapturedPages(prev => prev.filter((_, i) => i !== index))
    }, [])

    const handleFinish = async () => {
        if (capturedPages.length === 0) {
            alert('Please capture at least one page first')
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
                const base64Response = await fetch(capturedPages[i])
                const blob = await base64Response.blob()
                formData.append('images', blob, `scan_${i + 1}.png`)
            }

            const response = await fetch('https://izmyrqxkusvzjwgjtezd.supabase.co/functions/v1/scan', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''
                },
                body: formData
            })

            if (!response.ok) {
                throw new Error('Failed to process scan')
            }

            stopCamera()
            navigate('/scan/dashboard')
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

    const estimatedSize = (capturedPages.length * 0.4).toFixed(1)
    const progress = Math.min((capturedPages.length / 5) * 100, 100)

    return (
        <div className="dark h-screen flex flex-col bg-background overflow-hidden">
            {/* Top Header */}
            <header className="flex items-center justify-between px-3 sm:px-6 py-3 bg-card border-b border-border">
                <div className="flex items-center gap-2 sm:gap-4">
                    <Button variant="ghost" size="icon" className="text-white hover:text-white" onClick={() => {
                        stopCamera()
                        navigate('/scan/dashboard')
                    }}>
                        <IoArrowBack className="h-5 w-5" />
                    </Button>
                    <IoDocumentText className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                    <h2 className="text-base sm:text-lg font-bold text-white">InfoU Scan</h2>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex flex-1 overflow-hidden">
                {/* Camera View */}
                <section className="flex-1 flex flex-col bg-black relative">
                    {/* Live Camera Feed */}
                    <div className="flex-1 relative flex items-center justify-center overflow-hidden">
                        {error ? (
                            <div className="text-center p-8 z-20">
                                <p className="text-red-400 mb-4">{error}</p>
                                <Button onClick={startCamera}>Retry</Button>
                            </div>
                        ) : (
                            <>
                                {!cameraStarted && (
                                    <div className="text-center z-20">
                                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                                        <p className="text-white">Starting camera...</p>
                                    </div>
                                )}
                                
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    onCanPlay={() => setCameraStarted(true)}
                                    className="absolute inset-0 w-full h-full object-cover z-0"
                                />
                            </>
                        )}
                    </div>

                    {/* Bottom Controls */}
                    <div className="h-20 sm:h-24 bg-black/90 backdrop-blur-md border-t border-gray-800 flex items-center justify-center px-3 sm:px-8 gap-3 sm:gap-8">
                        {/* Main Capture Button */}
                        <div className="flex items-center gap-3 sm:gap-6 mx-auto">
                            <Button
                                size="icon"
                                variant="outline"
                                className="size-10 sm:size-12 rounded-full text-white border-white/30 hover:bg-white/10"
                                onClick={() => setCapturedPages(prev => prev.slice(0, -1))}
                                disabled={capturedPages.length === 0}
                            >
                                <IoArrowBack className="h-5 w-5 sm:h-6 sm:w-6" />
                            </Button>
                            
                            <Button
                                size="icon"
                                onClick={capturePhoto}
                                disabled={!cameraStarted}
                                className="size-14 sm:size-16 rounded-full shadow-lg shadow-primary/50 ring-4 ring-primary/20 hover:scale-105 active:scale-95 transition-transform"
                            >
                                <IoCamera className="h-6 w-6 sm:h-8 sm:w-8" />
                            </Button>
                            
                            <Button
                                onClick={handleFinish}
                                disabled={capturedPages.length === 0 || processing}
                                className="h-10 sm:h-12 px-4 sm:px-6 rounded-full shadow-lg text-sm"
                            >
                                {processing ? 'Processing...' : 'Finish'}
                                <IoArrowForward className="ml-2 h-4 w-4" />
                            </Button>
                        </div>

                        
                    </div>
                </section>

                {/* Right Sidebar Gallery */}
                <aside className="w-80 lg:w-96 bg-card border-l border-border flex flex-col shadow-xl">
                    {/* Sidebar Header */}
                    <div className="p-5 border-b border-border">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-lg font-bold text-white">Captured Pages</h2>
                            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-bold">
                                {capturedPages.length}
                            </span>
                        </div>
                        <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-primary rounded-full transition-all duration-300" 
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">
                            Ready to generate PDF (approx. {estimatedSize} MB)
                        </p>
                    </div>

                    {/* PDF Name Input */}
                    {capturedPages.length > 0 && (
                        <div className="p-4 border-b border-border bg-muted/30">
                            <label htmlFor="pdf-name-camera" className="text-xs font-medium block mb-2 text-gray-300">
                                PDF Name
                            </label>
                            <Input
                                id="pdf-name-camera"
                                placeholder="e.g., Study Notes"
                                value={pdfName}
                                onChange={(e) => setPdfName(e.target.value)}
                                className="text-sm text-white"
                            />
                        </div>
                    )}

                    {/* Scrollable Pages List */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {capturedPages.map((page, index) => (
                            <div
                                key={index}
                                className="group relative flex gap-3 p-3 bg-muted/50 rounded-xl border-2 border-border hover:border-primary/50 transition-all"
                            >
                                <div className="w-20 h-24 bg-background rounded-lg overflow-hidden shrink-0 relative">
                                    <img
                                        src={page}
                                        alt={`Page ${index + 1}`}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div className="flex flex-col flex-1 py-1">
                                    <div className="flex justify-between items-start">
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                            Page {index + 1}
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-gray-400 hover:text-red-500"
                                            onClick={() => removePage(index)}
                                        >
                                            <IoTrash className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <p className="text-sm font-semibold mt-0.5 text-white">
                                        {pdfName || 'Untitled'} - {index + 1}
                                    </p>
                                </div>
                            </div>
                        ))}

                        {/* Add New Placeholder */}
                        {capturedPages.length > 0 && (
                            <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-xl text-center">
                                <div className="bg-muted rounded-full p-2 mb-2 text-gray-400">
                                    <IoCamera className="h-5 w-5" />
                                </div>
                                <p className="text-xs text-gray-400 font-medium">Capture next page</p>
                            </div>
                        )}

                        {capturedPages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                                <IoCamera className="h-16 w-16 text-gray-600 mb-4" />
                                <p className="text-sm text-gray-400">No pages captured yet</p>
                                <p className="text-xs text-gray-500 mt-1">Press the capture button to start</p>
                            </div>
                        )}
                    </div>

                    {/* Sidebar Footer */}
                    {capturedPages.length > 0 && (
                        <div className="p-4 border-t border-border">
                            <Button
                                onClick={handleFinish}
                                disabled={processing}
                                className="w-full shadow-lg"
                            >
                                <IoDocumentText className="mr-2 h-5 w-5" />
                                {processing ? 'Processing...' : 'Generate PDF'}
                            </Button>
                            <div className="mt-3 flex justify-between text-xs text-gray-400 px-1">
                                <span>Quality: High</span>
                                <span>Format: A4</span>
                            </div>
                        </div>
                    )}
                </aside>
            </main>

            {/* Hidden Canvas */}
            <canvas ref={canvasRef} className="hidden" />
        </div>
    )
}
