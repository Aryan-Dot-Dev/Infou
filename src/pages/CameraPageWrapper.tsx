import { useEffect, useState } from 'react'
import { CameraPage } from './CameraPage'
import { CameraPageMobile } from './CameraPageMobile'

export function CameraPageWrapper() {
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024)

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 1024)
        }

        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    return isMobile ? <CameraPageMobile /> : <CameraPage />
}
