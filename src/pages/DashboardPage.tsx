/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/utils/supabase-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { IoClose, IoCamera, IoDocumentText, IoTime, IoSearch, IoLogOut, IoAddCircle, IoTrash } from 'react-icons/io5'
import { MdDashboard } from 'react-icons/md'
import { Document, Page, pdfjs } from 'react-pdf'
import type { User } from '@supabase/supabase-js'

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface Scan {
    id: string
    user_id: string
    pdf_path: string
    pdf_name?: string
    created_at: string
}

const DashboardPage = () => {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const [pendingImages, setPendingImages] = useState<string[]>([])
    const [pdfName, setPdfName] = useState('')
    const [scans, setScans] = useState<Scan[]>([])
    const [loadingScans, setLoadingScans] = useState(false)
    const [processingPdf, setProcessingPdf] = useState(false)
    const [pdfUrls, setPdfUrls] = useState<Record<string, string>>({})
    const [activeFilter, setActiveFilter] = useState<'dashboard' | 'recent'>('dashboard')
    const [searchQuery, setSearchQuery] = useState('')
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void } | null>(null)
    const [alertModal, setAlertModal] = useState<{ isOpen: boolean; title: string; message: string } | null>(null)
    const navigate = useNavigate()
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''

    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            
            if (!user) {
                navigate('/scan/login')
            } else {
                setUser(user)
            }
            setLoading(false)
        }

        checkUser()
        fetchScans()

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session) {
                navigate('/scan/login')
            } else {
                setUser(session.user)
            }
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [navigate])

    const fetchScans = async () => {
        setLoadingScans(true)
        try {
            const { data, error } = await supabase
                .from('scans')
                .select('*')
                .order('created_at', { ascending: false })
            
            if (error) {
                console.error('Error fetching scans:', error)
            } else {
                setScans(data || [])
                
                // Fetch PDF URLs for previews
                if (data && data.length > 0) {
                    fetchPdfUrls(data)
                }
            }
        } catch (error) {
            console.error('Error fetching scans:', error)
        } finally {
            setLoadingScans(false)
        }
    }

    const fetchPdfUrls = async (scansList: Scan[]) => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const urls: Record<string, string> = {}
        
        // Fetch URLs for first 8 scans only (for performance)
        const scansToFetch = scansList.slice(0, 8)
        
        await Promise.all(
            scansToFetch.map(async (scan) => {
                try {
                    const response = await fetch(`${SUPABASE_URL}/functions/v1/clever-service`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session.access_token}`,
                            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''
                        },
                        body: JSON.stringify({ scanId: scan.id })
                    })
                    
                    if (response.ok) {
                        const result = await response.json()
                        urls[scan.id] = result?.url
                    }
                } catch (error) {
                    console.error(`Error fetching PDF URL for scan ${scan.id}:`, error)
                }
            })
        )
        
        setPdfUrls(urls)
    }

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        navigate('/scan/login')
    }

    const handleDeleteScan = async (scanId: string, event: React.MouseEvent) => {
        event.stopPropagation() // Prevent card click
        
        setConfirmModal({
            isOpen: true,
            title: 'Delete PDF',
            message: 'Are you sure you want to delete this PDF? This action cannot be undone.',
            onConfirm: async () => {
                setConfirmModal(null)
                
                try {
                    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
                    
                    if (sessionError || !session) {
                        setAlertModal({
                            isOpen: true,
                            title: 'Authentication Error',
                            message: 'Please log in again.'
                        })
                        navigate('/scan/login')
                        return
                    }

                    const response = await fetch(
                        `${SUPABASE_URL}/functions/v1/deleteScan`,
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${session.access_token}`,
                                'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''
                            },
                            body: JSON.stringify({ scanId })
                        }
                    )

                    if (!response.ok) {
                        const error = await response.json()
                        throw new Error(error.error || 'Failed to delete scan')
                    }

                    // Refresh the scans list
                    await fetchScans()
                } catch (error: any) {
                    console.error('Error deleting scan:', error)
                    setAlertModal({
                        isOpen: true,
                        title: 'Delete Failed',
                        message: `Failed to delete PDF: ${error.message || 'Unknown error'}`
                    })
                }
            }
        })
    }


    const handleRemovePendingImage = (index: number) => {
        setPendingImages(prev => prev.filter((_, i) => i !== index))
    }

    const handleScanPdf = async () => {
        if (pendingImages.length === 0) {
            setAlertModal({
                isOpen: true,
                title: 'No Images',
                message: 'Please capture at least one image first'
            })
            return
        }

        setProcessingPdf(true)
        console.log('=== Processing PDF with', pendingImages.length, 'images ===')
        
        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession()
            
            if (sessionError || !session) {
                console.error('Session error:', sessionError)
                setAlertModal({
                    isOpen: true,
                    title: 'Authentication Error',
                    message: 'Please log in again.'
                })
                return
            }

            const formData = new FormData()
            
            formData.append('pdf_name', pdfName.trim() || `Scan_${new Date().toISOString().split('T')[0]}.pdf`)
            
            for (let i = 0; i < pendingImages.length; i++) {
                const base64Response = await fetch(pendingImages[i])
                const blob = await base64Response.blob()
                formData.append('images', blob, `scan_${i + 1}.png`)
            }

            console.log('Sending', pendingImages.length, 'images to edge function')

            const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/scan`
            const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''
            
            const response = await fetch(edgeFunctionUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'apikey': anonKey
                },
                body: formData
            })

            console.log('Edge function response status:', response.status)

            if (!response.ok) {
                const error = await response.text()
                console.error('Edge function error response:', error)
                throw new Error(`Failed to process scan: ${error}`)
            }

            const result = await response.json()
            console.log('PDF processed successfully:', result)
            
            setPendingImages([])
            setPdfName('')
            
            if (result?.scanId) {
                console.log('Scan ID retrieved:', result?.scanId)
                fetchScans()
                // Navigate to the PDF viewer page
                navigate(`/scan/view/${result?.scanId}`)
            }
        } catch (error: any) {
            console.error('Error processing scan:', error)
            setAlertModal({
                isOpen: true,
                title: 'Scan Failed',
                message: `Failed to process scan: ${error.message || 'Unknown error'}`
            })
        } finally {
            setProcessingPdf(false)
        }
    }


    const formatTimeAgo = (dateString: string) => {
        const date = new Date(dateString)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMs / 3600000)
        const diffDays = Math.floor(diffMs / 86400000)

        if (diffMins < 1) return 'Just now'
        if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
        if (diffDays === 1) return 'Yesterday'
        if (diffDays < 7) return `${diffDays} days ago`
        return date.toLocaleDateString()
    }

    const getFilteredScans = () => {
        let filtered = scans
        
        // Apply filter based on active tab
        switch (activeFilter) {
            case 'recent': {
                const sevenDaysAgo = new Date()
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
                filtered = scans.filter(scan => new Date(scan.created_at) >= sevenDaysAgo)
                break
            }
            case 'dashboard':
            default:
                filtered = scans
        }
        
        // Apply search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase()
            filtered = filtered.filter(scan => 
                (scan.pdf_name?.toLowerCase().includes(query)) ||
                (new Date(scan.created_at).toLocaleDateString().toLowerCase().includes(query))
            )
        }
        
        return filtered
    }

    const getSectionTitle = () => {
        switch (activeFilter) {
            case 'recent':
                return 'Recent PDFs (Last 7 Days)'
            case 'dashboard':
            default:
                return 'All PDFs'
        }
    }

    const getSectionIcon = () => {
        switch (activeFilter) {
            case 'recent':
                return IoTime
            case 'dashboard':
            default:
                return IoDocumentText
        }
    }

    const filteredScans = getFilteredScans()

    if (loading) {
        return (
            <div className="dark flex h-screen bg-background overflow-hidden">
                <aside className="w-64 flex-shrink-0 bg-card border-r border-border p-6">
                    <Skeleton className="h-10 w-full mb-8" />
                    <Skeleton className="h-10 w-full mb-6" />
                    <div className="space-y-2">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                </aside>
                <main className="flex-1 flex flex-col">
                    <header className="h-16 border-b border-border bg-card px-8">
                        <Skeleton className="h-8 w-40" />
                    </header>
                    <div className="flex-1 p-8">
                        <Skeleton className="h-48 w-full mb-8" />
                        <Skeleton className="h-64 w-full" />
                    </div>
                </main>
            </div>
        )
    }

    return (
        <div className="dark flex h-screen bg-background overflow-hidden">
            {/* Sidebar */}
            <aside className="hidden lg:flex w-64 flex-shrink-0 bg-card border-r border-border flex-col h-full">
                <div className="p-6 pb-2">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="bg-primary/10 flex items-center justify-center rounded-lg size-10 text-primary">
                            <IoDocumentText className="h-6 w-6" />
                        </div>
                        <div className="flex flex-col">
                            <h1 className="text-base font-bold text-white ">InfoU Scan</h1>
                        </div>
                    </div>
                    
                    <Button 
                        onClick={() => navigate('/scan/camera')}
                        className="w-full mb-6 shadow-lg shadow-primary/20"
                    >
                        <IoAddCircle className="mr-2 h-5 w-5" />
                        New PDF
                    </Button>
                    
                    <div className="flex flex-col gap-1">
                        <button 
                            onClick={() => setActiveFilter('dashboard')}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer ${
                                activeFilter === 'dashboard' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground transition-colors'
                            }`}
                        >
                            <MdDashboard className="h-5 w-5" />
                            <span className="text-sm font-medium">Dashboard</span>
                        <Button 
                            variant="ghost" 
                            size="icon"
                            className="lg:hidden text-muted-foreground hover:text-red-500 hover:bg-transparent dark:hover:bg-transparent"
                            onClick={handleSignOut}
                            title="Sign out"
                        >
                            <p className='' >Logout</p>
                        </Button>
                        </button>
                    </div>
                </div>
                
                <div className="mt-auto p-6 border-t border-border">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold overflow-hidden">
                            { user?.user_metadata?.avatar_url ? <img src={user?.user_metadata?.avatar_url} alt="" /> : user?.user_metadata?.full_name?.charAt(0).toUpperCase() }
                            {/* {user?.email?.charAt(0).toUpperCase()} */}
                        </div>
                        <div className="flex flex-col overflow-hidden flex-1">
                            <p className="text-sm font-semibold truncate text-white ">{user?.user_metadata?.full_name}</p>
                            <p className="text-xs text-muted-foreground truncate">{scans.length} scans</p>
                        </div>
                        <Button variant="ghost" size="icon" className="text-white hover:text-white/80" onClick={handleSignOut} title="Sign out">
                            <IoLogOut className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Top Header */}
                <header className="h-14 sm:h-16 flex-shrink-0 border-b border-border bg-card/80 backdrop-blur-md flex items-center justify-between px-4 sm:px-8">
                    <div className="flex items-center gap-3">
                        {/* Mobile Profile Avatar */}
                        {/* <div className="lg:hidden h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold overflow-hidden shrink-0">
                            {user?.user_metadata?.avatar_url ? (
                                <img src={user.user_metadata.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-sm">{user?.email?.charAt(0).toUpperCase()}</span>
                            )}
                        </div> */}
                        <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white ">{activeFilter === 'recent' ? 'Recent' : 'Infou'}</h2>
                    </div>
                    <div className="flex items-center gap-3 sm:gap-6">
                        <div className="hidden lg:flex relative">
                            <IoSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <Input 
                                placeholder="Search PDFs..." 
                                className="w-48 sm:w-64 pl-10 text-white"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        {/* <Button 
                            variant="ghost" 
                            size="icon"
                            className="lg:hidden text-muted-foreground hover:text-foreground"
                            onClick={() => navigate('/scan/camera')}
                        >
                            {/* <IoCamera className="h-5 w-5" /> */}
                        {/* </Button> */}
                        {/* Mobile Sign Out Button */}
                        <Button 
                            variant="ghost" 
                            // size="icon"
                            className="lg:hidden text-muted-foreground hover:text-red-500 hover:bg-red-500"
                            onClick={handleSignOut}
                            title="Sign out"
                        >
                            <p className='' >Logout</p>
                        </Button>
                    </div>
                </header>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                    <div className="max-w-6xl mx-auto space-y-10">
                        {/* Hero: Create New PDF */}
                        {activeFilter === 'dashboard' && (
                            <section>
                                <Card className="overflow-hidden border-2 transition-colors">
                                    <div className="flex flex-col sm:flex-row">
                                        <div className="w-full sm:w-2/7 h-64 bg-transparent from-primary/20 to-primary/5 flex items-center justify-center p-4">
                                            <img 
                                                src="/scanning.gif" 
                                                alt="Quick scan illustration" 
                                                className="w-full h-full object-contain scale-70"
                                            />
                                        </div>
                                        <div className="flex flex-col justify-center items-center text-center p-6 sm:p-8 flex-1 sm:items-start sm:text-left">
                                            <h3 className="text-2xl font-bold mb-2">Quick Scan</h3>
                                            <p className="text-muted-foreground mb-6">
                                                Snap pages, then fine-tune and export a polished PDF, fast and simple.
                                            </p>
                                            <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
                                                <Button 
                                                    onClick={() => navigate('/scan/camera')} 
                                                    size="lg"
                                                    className="shadow-sm"
                                                >
                                                    <IoCamera className="mr-2 h-5 w-5" />
                                                    Start Quick Scan
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            </section>
                        )}

                        {/* Pending Images Section */}
                        {pendingImages.length > 0 && (
                            <section className="relative">
                                <Card>
                                    <CardHeader>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <CardTitle>Pending Images ({pendingImages.length})</CardTitle>
                                                <CardDescription>Review and name your PDF before generating</CardDescription>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div>
                                            <label htmlFor="pdf-name" className="text-sm font-medium block mb-2">
                                                PDF Name
                                            </label>
                                            <Input
                                                id="pdf-name"
                                                placeholder="e.g., My Math Notes"
                                                value={pdfName}
                                                onChange={(e) => setPdfName(e.target.value)}
                                            />
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Leave empty to auto-generate with date
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                                            {pendingImages.map((image, index) => (
                                                <div key={index} className="relative group aspect-square">
                                                    <img
                                                        src={image}
                                                        alt={`Page ${index + 1}`}
                                                        className="w-full h-full object-cover rounded-lg border-2 border-border hover:border-primary transition-colors"
                                                    />
                                                    <Button
                                                        variant="destructive"
                                                        size="icon"
                                                        className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                                        onClick={() => handleRemovePendingImage(index)}
                                                    >
                                                        <IoClose className="h-4 w-4" />
                                                    </Button>
                                                    <div className="absolute bottom-2 left-2 bg-black/80 text-white text-xs px-2 py-0.5 rounded">
                                                        {index + 1}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="flex gap-3 pt-2">
                                            <Button
                                                variant="outline"
                                                onClick={() => {
                                                    setPendingImages([])
                                                    setPdfName('')
                                                }}
                                                disabled={processingPdf}
                                                className="flex-1"
                                            >
                                                Clear All
                                            </Button>
                                            <Button
                                                onClick={handleScanPdf}
                                                disabled={processingPdf}
                                                size="lg"
                                                className="flex-[2]"
                                            >
                                                {processingPdf ? (
                                                    <>
                                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                                        Processing...
                                                    </>
                                                ) : (
                                                    <>Generate PDF ({pendingImages.length} page{pendingImages.length > 1 ? 's' : ''})</>
                                                )}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Processing Overlay with Skeleton Loader */}
                                {processingPdf && (
                                    <div className="absolute inset-0 bg-background/95 backdrop-blur-md rounded-lg z-50 flex items-center justify-center p-4">
                                        <div className="w-full max-w-md">
                                            <Card className="border-2 border-primary/20 shadow-2xl">
                                                <CardContent className="pt-6 space-y-4">
                                                    <div className="flex flex-col items-center text-center space-y-4">
                                                        <div className="relative">
                                                            <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary/20 border-t-primary"></div>
                                                            <IoDocumentText className="absolute inset-0 m-auto h-8 w-8 text-primary" />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <h3 className="text-xl font-semibold">Processing Your PDF</h3>
                                                            <p className="text-sm text-muted-foreground">
                                                                Converting {pendingImages.length} image{pendingImages.length > 1 ? 's' : ''} into a PDF document...
                                                            </p>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="space-y-3 pt-2">
                                                        <Skeleton className="h-4 w-full" />
                                                        <Skeleton className="h-4 w-4/5" />
                                                        <Skeleton className="h-4 w-3/5" />
                                                    </div>
                                                    
                                                    <div className="pt-2">
                                                        <div className="grid grid-cols-3 gap-2">
                                                            <Skeleton className="h-20 w-full rounded-md" />
                                                            <Skeleton className="h-20 w-full rounded-md" />
                                                            <Skeleton className="h-20 w-full rounded-md" />
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </div>
                                    </div>
                                )}
                            </section>
                        )}

                        {/* Recent PDFs Section */}
                        <section>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-lg text-white font-bold flex items-center gap-2">
                                    {(() => {
                                        const Icon = getSectionIcon()
                                        return <Icon className="h-5 w-5 text-primary" />
                                    })()}
                                    {getSectionTitle()}
                                </h2>
                            </div>

                            {loadingScans ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                                    {[1, 2, 3, 4].map((i) => (
                                        <Skeleton key={i} className="h-80 w-full" />
                                    ))}
                                </div>
                            ) : filteredScans.length === 0 ? (
                                <Card>
                                    <CardContent className="pt-6">
                                        <p className="text-center text-muted-foreground py-8">
                                            {activeFilter === 'recent'
                                                ? 'No PDFs from the last 7 days.'
                                                : 'No scans yet. Click "New PDF" to create your first PDF.'}
                                        </p>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
                                    {filteredScans.filter(scan => pdfUrls[scan.id]).map((scan) => (
                                        <Card 
                                            key={scan.id} 
                                            className="group border hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 transition-all duration-200 overflow-hidden cursor-pointer"
                                            onClick={() => navigate(`/scan/view/${scan.id}`)}
                                        >
                                            <div className="relative aspect-square bg-muted overflow-hidden flex items-center justify-center">
                                                {pdfUrls[scan.id] ? (
                                                    <Document
                                                        file={pdfUrls[scan.id]}
                                                        loading={
                                                            <div className="w-full h-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                                                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                                                            </div>
                                                        }
                                                        error={
                                                            <div className="w-full h-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                                                                <IoDocumentText className="h-12 w-12 text-primary/30" />
                                                            </div>
                                                        }
                                                        className="flex items-center justify-center w-full h-full"
                                                    >
                                                        <Page
                                                            pageNumber={1}
                                                            height={200}
                                                            renderTextLayer={false}
                                                            renderAnnotationLayer={false}
                                                            className="max-w-full max-h-full object-contain"
                                                        />
                                                    </Document>
                                                ) : (
                                                    <div className="w-full h-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                                                        <IoDocumentText className="h-12 w-12 text-primary/30" />
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <Button
                                                        size="sm"
                                                        className="cursor-pointer shadow-lg"
                                                        onClick={() => navigate(`/scan/view/${scan.id}`)}
                                                    >
                                                        <IoDocumentText className="mr-1.5 h-4 w-4" />
                                                        View
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="p-2.5 sm:p-3 space-y-1">
                                                <div className="flex items-center justify-between gap-2">
                                                    <h4 className="font-medium text-sm truncate flex-1" title={scan.pdf_name || `Scan_${scan.created_at}`}>
                                                        {scan.pdf_name || `Scan_${new Date(scan.created_at).toLocaleDateString()}`}
                                                    </h4>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-muted-foreground hover:text-red-500 shrink-0"
                                                        onClick={(e) => handleDeleteScan(scan.id, e)}
                                                    >
                                                        <IoTrash className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    {formatTimeAgo(scan.created_at)}
                                                </p>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </section>

                        <footer className="text-center text-xs text-muted-foreground py-4">
                            <p>© 2026 InfoU Scan. All rights reserved.</p>
                        </footer>
                    </div>
                </div>
            </main>

            {/* Confirmation Modal */}
            {confirmModal?.isOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-md">
                        <CardHeader>
                            <CardTitle>{confirmModal.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-muted-foreground">{confirmModal.message}</p>
                            <div className="flex gap-3 justify-end">
                                <Button
                                    variant="outline"
                                    onClick={() => setConfirmModal(null)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={confirmModal.onConfirm}
                                >
                                    Delete
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Alert Modal */}
            {alertModal?.isOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-md">
                        <CardHeader>
                            <CardTitle>{alertModal.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-muted-foreground">{alertModal.message}</p>
                            <div className="flex justify-end">
                                <Button onClick={() => setAlertModal(null)}>
                                    OK
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
}

export default DashboardPage