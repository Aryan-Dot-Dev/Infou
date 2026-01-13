import { useRef, useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { IoCamera, IoClose, IoCheckmark } from 'react-icons/io5'

interface CameraModalProps {
    isOpen: boolean
    onClose: () => void
    onCapture: (imageDataUrl: string) => void
}

export function CameraModal({ isOpen, onClose, onCapture }: CameraModalProps) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const [capturedImage, setCapturedImage] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [cameraStarted, setCameraStarted] = useState(false)

    const startCamera = useCallback(async () => {
        try {
            setError(null)
            console.log('Requesting camera access...')
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            })

            console.log('Camera access granted')
            if (videoRef.current) {
                videoRef.current.srcObject = stream
                streamRef.current = stream
                setCameraStarted(true)
            }
        } catch (err: any) {
            console.error('Error accessing camera:', err)
            let errorMessage = 'Unable to access camera. '

            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                errorMessage += 'Permission denied. Please allow camera access in your browser settings.'
            } else if (err.name === 'NotFoundError') {
                errorMessage += 'No camera found on this device.'
            } else if (err.name === 'NotReadableError') {
                errorMessage += 'Camera is already in use by another application.'
            } else {
                errorMessage += err.message || 'Please check permissions and try again.'
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
                setCapturedImage(imageDataUrl)
                stopCamera()
            }
        }
    }, [stopCamera])

    const handleConfirm = useCallback(() => {
        if (capturedImage) {
            onCapture(capturedImage)
            handleClose()
        }
    }, [capturedImage, onCapture])

    const handleRetake = useCallback(() => {
        setCapturedImage(null)
        startCamera()
    }, [startCamera])

    const handleClose = useCallback(() => {
        stopCamera()
        setCapturedImage(null)
        setError(null)
        setCameraStarted(false)
        onClose()
    }, [stopCamera, onClose])

    // Auto-start camera when modal opens
    useEffect(() => {
        if (isOpen && !cameraStarted && !capturedImage) {
            startCamera()
        }
    }, [isOpen, cameraStarted, capturedImage, startCamera])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <Card className="w-full max-w-3xl">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Capture Image</CardTitle>
                    <Button variant="ghost" size="icon" onClick={handleClose}>
                        <IoClose size={24} />
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {error && (
                            <div className="text-sm text-red-500 dark:text-red-400 text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-md">
                                {error}
                            </div>
                        )}

                        <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                            {!cameraStarted && !capturedImage && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Button onClick={startCamera} size="lg">
                                        <IoCamera size={24} className="mr-2" />
                                        Start Camera
                                    </Button>
                                </div>
                            )}

                            {capturedImage ? (
                                <img
                                    src={capturedImage}
                                    alt="Captured"
                                    className="w-full h-full object-contain"
                                />
                            ) : (
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    className="w-full h-full object-contain"
                                />
                            )}

                            <canvas ref={canvasRef} className="hidden" />
                        </div>

                        <div className="flex gap-2 justify-center">
                            {cameraStarted && !capturedImage && (
                                <Button onClick={capturePhoto} size="lg" className="w-full max-w-xs">
                                    <IoCamera size={24} className="mr-2" />
                                    Capture Photo
                                </Button>
                            )}

                            {capturedImage && (
                                <>
                                    <Button onClick={handleRetake} variant="outline" size="lg" className="flex-1">
                                        Retake
                                    </Button>
                                    <Button onClick={handleConfirm} size="lg" className="flex-1">
                                        <IoCheckmark size={24} className="mr-2" />
                                        Confirm
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
