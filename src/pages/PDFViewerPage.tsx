import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/utils/supabase-client'
import { Button } from '@/components/ui/button'
import { IoArrowBack, IoPrint, IoShare, IoDownload, IoAdd, IoTrash, IoSync, IoDocument, IoContractOutline, IoSparkles } from 'react-icons/io5'
import { MdEdit } from 'react-icons/md'
import { Document, Page, pdfjs } from 'react-pdf'
import ReactMarkdown from 'react-markdown'

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface Scan {
    id: string
    user_id: string
    pdf_path: string
    pdf_name?: string
    summary?: string
    created_at: string
}

export function PDFViewerPage() {
    const { scanId } = useParams<{ scanId: string }>()
    const navigate = useNavigate()
    const [scan, setScan] = useState<Scan | null>(null)
    const [pdfUrl, setPdfUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [zoom, setZoom] = useState(100)
    const [selectedPage, setSelectedPage] = useState(1)
    const [numPages, setNumPages] = useState<number>(0)
    const [pageWidth, setPageWidth] = useState(850)
    const [showSummary, setShowSummary] = useState(false)
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''

    useEffect(() => {
        const updatePageWidth = () => {
            if (window.innerWidth < 640) {
                setPageWidth(window.innerWidth - 32) // Mobile: full width minus padding
            } else if (window.innerWidth < 1024) {
                setPageWidth(Math.min(600, window.innerWidth - 100)) // Tablet: constrained
            } else {
                setPageWidth(850) // Desktop: full size
            }
        }

        updatePageWidth()
        window.addEventListener('resize', updatePageWidth)
        return () => window.removeEventListener('resize', updatePageWidth)
    }, [])

    useEffect(() => {
        if (!scanId) {
            navigate('/scan/dashboard')
            return
        }

        fetchScanDetails()
    }, [scanId])

    const fetchScanDetails = async () => {
        try {
            setLoading(true)
            setError(null)

            // Fetch scan details
            const { data: scanData, error: scanError } = await supabase
                .from('scans')
                .select('*')
                .eq('id', scanId)
                .single()

            if (scanError) throw scanError

            setScan(scanData)

            // Get signed URL
            const { data: { session }, error: sessionError } = await supabase.auth.getSession()
            
            if (sessionError || !session) {
                throw new Error('Authentication error')
            }

            const response = await fetch(`${SUPABASE_URL}/functions/v1/clever-service`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                    'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''
                },
                body: JSON.stringify({ scanId })
            })

            if (!response.ok) {
                throw new Error('Failed to get PDF URL')
            }

            const result = await response.json()
            setPdfUrl(result.url)
        } catch (err: any) {
            console.error('Error fetching scan:', err)
            setError(err.message || 'Failed to load PDF')
        } finally {
            setLoading(false)
        }
    }

    const handleDownload = () => {
        if (pdfUrl) {
            window.open(pdfUrl, '_blank')
        }
    }

    const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 200))
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50))
    const handleFitWidth = () => setZoom(100)

    const handlePageClick = (pageNumber: number) => {
        setSelectedPage(pageNumber)
        // Scroll to the page in the main viewer
        const pageElement = document.getElementById(`page-${pageNumber}`)
        if (pageElement) {
            pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
    }

    const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
        setNumPages(numPages)
    }

    if (loading) {
        return (
            <div className="dark h-screen flex items-center justify-center bg-background">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading PDF...</p>
                </div>
            </div>
        )
    }

    if (error || !scan) {
        return (
            <div className="dark h-screen flex items-center justify-center bg-background">
                <div className="text-center">
                    <p className="text-red-500 mb-4">{error || 'Scan not found'}</p>
                    <Button onClick={() => navigate('/scan/dashboard')}>
                        Back to Dashboard
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="dark h-screen flex flex-col bg-background overflow-hidden">
            {/* Hidden Document to load page count */}
            {pdfUrl && (
                <div className="hidden">
                    <Document
                        file={pdfUrl}
                        onLoadSuccess={onDocumentLoadSuccess}
                    />
                </div>
            )}
            
            {/* Top Navigation Bar */}
            <header className="flex items-center justify-between border-b border-border bg-card px-3 sm:px-6 py-3 shrink-0 z-30 shadow-sm">
                {/* Left: Navigation & Title */}
                <div className="flex items-center gap-2 sm:gap-5 flex-1 min-w-0">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate('/scan/dashboard')}
                        className="rounded-lg shrink-0 text-white hover:text-white/80"
                    >
                        <IoArrowBack className="h-5 w-5" />
                    </Button>
                    <div className="flex flex-col min-w-0 flex-1">
                        <div className="hidden sm:flex items-center text-xs font-medium text-muted-foreground space-x-2">
                            <span>Dashboard</span>
                            <span className="text-muted-foreground/50">/</span>
                            <span>Scans</span>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            <h1 className="text-sm sm:text-lg text-white font-bold leading-tight tracking-[-0.015em] truncate">
                                {scan.pdf_name || 'Untitled Scan'}
                            </h1>
                            <button className="text-muted-foreground hover:text-primary transition-colors shrink-0 cursor-pointer">
                                <MdEdit className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right: Primary Actions */}
                <div className="flex items-center gap-1 sm:gap-3 text-white shrink-0">
                    {/* Mobile AI Button */}
                    <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => setShowSummary(true)}
                        className="lg:hidden text-blue-400 hover:text-blue-300 border-blue-500/30"
                    >
                        <IoSparkles className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" className="hidden lg:flex" size="sm">
                        <IoPrint className="mr-2 h-4 w-4" />
                        Print
                    </Button>
                    <Button variant="outline" size="sm" className="px-2 sm:px-3">
                        <IoShare className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Share</span>
                    </Button>
                    <div className="hidden sm:block h-6 w-px bg-border mx-1"></div>
                    <Button onClick={handleDownload} size="sm" className="px-2 sm:px-4">
                        <IoDownload className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Download</span>
                    </Button>
                </div>
            </header>

            {/* Floating AI Summary Button - Desktop Only */}
            <button
                onClick={() => setShowSummary(true)}
                className="hidden hover:cursor-pointer lg:flex fixed top-20 right-8 z-40 bg-slate-800/95 hover:bg-slate-800 backdrop-blur-sm text-white rounded-full p-3 shadow-lg shadow-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/50 transition-all duration-300 group items-center justify-center border border-blue-500/30"
            >
                <div className="flex items-center gap-0 group-hover:gap-2 transition-all duration-300">
                    <IoSparkles className="h-5 w-5 shrink-0 text-blue-400 hidden:mr-2" />
                    <span className="max-w-0 overflow-hidden group-hover:max-w-[150px] transition-all duration-300 whitespace-nowrap text-sm font-semibold">
                        Infou AI
                    </span>
                </div>
            </button>

            <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar: Page Manager */}
                <aside className="hidden lg:flex w-72 bg-card border-r border-border flex-col shrink-0 z-20 shadow-sm">
                    {/* Sidebar Header */}
                    <div className="p-4 border-b border-border">
                        <div className="flex items-center justify-between mb-1">
                            <h2 className="text-base font-bold text-white ">Page Manager</h2>
                            <span className="bg-muted text-muted-foreground text-xs font-bold px-2 py-0.5 rounded-full" >
                                {numPages}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground">Click page to view</p>
                    </div>

                    {/* Thumbnails List */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {pdfUrl && numPages > 0 && Array.from(new Array(numPages), (_, index) => {
                            const pageNum = index + 1
                            return (
                            <div
                                key={`page_${pageNum}`}
                                className={`group relative cursor-pointer`}
                                onClick={() => handlePageClick(pageNum)}
                            >
                                {/* Selection Indicator */}
                                {selectedPage === pageNum && (
                                    <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-1.5 h-12 bg-primary rounded-r"></div>
                                )}
                                <div className={`relative rounded-lg ${selectedPage === pageNum ? 'ring-2 ring-primary ring-offset-2 ring-offset-card' : 'border border-border hover:border-primary/50'} overflow-hidden shadow-md bg-white transition-all hover:shadow-lg`}>
                                    <Document
                                        key={`doc_${pageNum}`}
                                        file={pdfUrl}
                                        loading={
                                            <div className="w-[240px] aspect-[1/1.414] bg-muted flex items-center justify-center">
                                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                                            </div>
                                        }
                                        error={
                                            <div className="w-[240px] aspect-[1/1.414] bg-muted flex items-center justify-center">
                                                <IoDocument className="h-8 w-8 text-muted-foreground" />
                                            </div>
                                        }
                                    >
                                        <Page
                                            key={`page_render_${pageNum}`}
                                            pageNumber={pageNum}
                                            width={240}
                                            renderTextLayer={false}
                                            renderAnnotationLayer={false}
                                            loading={
                                                <div className="w-[240px] aspect-[1/1.414] bg-muted flex items-center justify-center">
                                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                                                </div>
                                            }
                                        />
                                    </Document>
                                    {/* Hover Actions Overlay */}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                        <button className="bg-background text-foreground hover:text-red-500 p-1.5 rounded-full shadow-lg transition-transform hover:scale-110 cursor-pointer">
                                            <IoTrash className="h-4 w-4" />
                                        </button>
                                        <button className="bg-background text-foreground hover:text-primary p-1.5 rounded-full shadow-lg transition-transform hover:scale-110 cursor-pointer">
                                            <IoSync className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm font-medium">
                                        {pageNum}
                                    </div>
                                </div>
                            </div>
                        )})}
                    </div>
                </aside>

                {/* Main Viewer Area */}
                <section className="flex-1 bg-muted/30 overflow-y-auto flex flex-col items-center py-8 px-4 sm:px-10">
                    {/* Floating Zoom Controls */}
                    <div className="sticky top-0 z-10 mb-8 mt-2 text-white ">
                        <div className="bg-card/80 backdrop-blur-md shadow-lg ring-1 ring-border rounded-full flex items-center px-1.5 py-1.5 gap-1">
                            <button
                                onClick={handleZoomOut}
                                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors cursor-pointer"
                                title="Zoom Out"
                            >
                                <span className="text-xl font-bold">−</span>
                            </button>
                            <span className="text-xs font-bold w-14 text-center font-mono">
                                {zoom}%
                            </span>
                            <button
                                onClick={handleZoomIn}
                                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors cursor-pointer"
                                title="Zoom In"
                            >
                                <span className="text-xl font-bold">+</span>
                            </button>
                            <div className="w-px h-4 bg-border mx-1"></div>
                            <button
                                onClick={handleFitWidth}
                                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors cursor-pointer"
                                title="Fit Width"
                            >
                                <IoContractOutline className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    {/* PDF Viewer */}
                    <div 
                        className="w-full max-w-full sm:max-w-[850px] pb-20 space-y-4"
                        style={{ 
                            transform: `scale(${zoom / 100})`,
                            transformOrigin: 'top center',
                            transition: 'transform 0.2s ease'
                        }}
                    >
                        {pdfUrl ? (
                            <Document
                                file={pdfUrl}
                                onLoadSuccess={onDocumentLoadSuccess}
                                loading={
                                    <div className="flex items-center justify-center py-20">
                                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                                    </div>
                                }
                                error={
                                    <div className="flex items-center justify-center py-20 text-red-500">
                                        Failed to load PDF
                                    </div>
                                }
                            >
                                {Array.from(new Array(numPages), (_, index) => (
                                    <div key={`main_page_${index + 1}`} id={`page-${index + 1}`}>
                                        <Page
                                            pageNumber={index + 1}
                                            width={pageWidth}
                                            renderTextLayer={false}
                                            renderAnnotationLayer={false}
                                            className="!mb-4 shadow-2xl"
                                        />
                                    </div>
                                ))}
                            </Document>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-border rounded-xl bg-muted/50">
                                <IoDocument className="h-16 w-16 text-muted-foreground mb-4" />
                                <p className="text-sm font-medium text-muted-foreground">
                                    No PDF available
                                </p>
                            </div>
                        )}
                    </div>
                </section>
            </div>

            {/* AI Summary Modal */}
            {showSummary && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-pointer" onClick={() => setShowSummary(false)}>
                    <div className="bg-card border border-border rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-6 border-b border-border">
                            <div className="flex items-center gap-3">
                                <div className="bg-primary/10 p-2 rounded-lg">
                                    <IoSparkles className="h-5 w-5 text-primary" />
                                </div>
                                <h2 className="text-xl font-bold text-white">AI Summary</h2>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setShowSummary(false)} className="text-gray-400 hover:text-white">
                                <IoArrowBack className="h-5 w-5" />
                            </Button>
                        </div>
                        <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
                            {scan?.summary ? (
                                <div className="text-gray-300">
                                    <ReactMarkdown 
                                        components={{
                                            h1: ({node, ...props}) => <h1 className="text-white text-2xl font-bold mb-4 mt-6" {...props} />,
                                            h2: ({node, ...props}) => <h2 className="text-white text-xl font-bold mb-3 mt-5" {...props} />,
                                            h3: ({node, ...props}) => <h3 className="text-white text-lg font-semibold mb-2 mt-4" {...props} />,
                                            p: ({node, ...props}) => <p className="text-gray-300 leading-relaxed mb-4" {...props} />,
                                            ul: ({node, ...props}) => <ul className="list-disc list-inside ml-2 mb-4 space-y-2" {...props} />,
                                            ol: ({node, ...props}) => <ol className="list-decimal list-inside ml-2 mb-4 space-y-2" {...props} />,
                                            li: ({node, children, ...props}) => (
                                                <li className="text-gray-300 leading-relaxed" {...props}>
                                                    <span className="ml-2">{children}</span>
                                                </li>
                                            ),
                                            strong: ({node, ...props}) => <strong className="text-white font-semibold" {...props} />,
                                            em: ({node, ...props}) => <em className="text-gray-200" {...props} />,
                                            code: ({node, inline, className, children, ...props}) => {
                                                // Only render as code block if it's explicitly marked as not inline
                                                if (!inline && className?.includes('language-')) {
                                                    return (
                                                        <pre className="bg-muted rounded-lg p-4 my-4 overflow-x-auto">
                                                            <code className="text-gray-200 text-sm font-mono" {...props}>{children}</code>
                                                        </pre>
                                                    )
                                                }
                                                // Inline code or simple backticks
                                                return <code className="bg-muted text-primary px-2 py-1 rounded text-sm font-mono" {...props}>{children}</code>
                                            },
                                            pre: ({node, ...props}) => <div {...props} />
                                        }}
                                    >
                                        {scan.summary}
                                    </ReactMarkdown>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <IoSparkles className="h-12 w-12 text-muted-foreground mb-4" />
                                    <p className="text-muted-foreground text-lg">No summary available</p>
                                    <p className="text-muted-foreground/70 text-sm mt-2">AI summary will be generated when available</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
