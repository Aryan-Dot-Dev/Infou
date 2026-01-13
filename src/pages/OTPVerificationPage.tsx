import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '@/utils/supabase-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from '@/components/ui/input-otp'
import { IoArrowBack, IoShieldCheckmark } from 'react-icons/io5'

export function OTPVerificationPage() {
    const [otp, setOtp] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [email, setEmail] = useState<string>('')
    const navigate = useNavigate()
    const location = useLocation()

    useEffect(() => {
        // Get email from navigation state
        const emailFromState = location.state?.email
        if (emailFromState) {
            setEmail(emailFromState)
        } else {
            // Redirect to signup if no email provided
            navigate('/scan/signup')
        }
    }, [location, navigate])

    const handleVerifyOTP = async () => {
        if (otp.length !== 8) {
            setError('Please enter the complete 8-digit code')
            return
        }

        setLoading(true)
        setError(null)

        try {
            const { error: verifyError } = await supabase.auth.verifyOtp({
                email,
                token: otp,
                type: 'signup'
            })

            if (verifyError) {
                setError(verifyError.message)
                return
            }

            // Successfully verified, redirect to dashboard
            navigate('/scan/dashboard')
        } catch (err: any) {
            setError(err.message || 'Verification failed')
        } finally {
            setLoading(false)
        }
    }

    const handleResendCode = async () => {
        setError(null)
        try {
            const { error: resendError } = await supabase.auth.resend({
                type: 'signup',
                email
            })

            if (resendError) {
                setError(resendError.message)
            } else {
                setError('Code sent! Check your email.')
            }
        } catch (err: any) {
            setError(err.message || 'Failed to resend code')
        }
    }

    return (
        <div className="dark min-h-screen bg-background flex items-center justify-center p-4">
            <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate('/scan/signup')}
                className="absolute top-4 left-4 text-white hover:text-white/80"
            >
                <IoArrowBack className="h-5 w-5" />
            </Button>

            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1 text-center">
                    <div className="flex justify-center mb-4">
                        <div className="rounded-full bg-primary/10 p-3">
                            <IoShieldCheckmark className="h-8 w-8 text-primary" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl">Verify Your Email</CardTitle>
                    <CardDescription>
                        We've sent an 8-digit verification code to<br />
                        <span className="font-medium text-foreground">{email}</span>
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex flex-col items-center space-y-4">
                        <InputOTP 
                            maxLength={8} 
                            value={otp}
                            onChange={(value) => {
                                setOtp(value)
                                setError(null)
                            }}
                        >
                            <InputOTPGroup>
                                <InputOTPSlot index={0} />
                                <InputOTPSlot index={1} />
                                <InputOTPSlot index={2} />
                                <InputOTPSlot index={3} />
                            </InputOTPGroup>
                            <InputOTPSeparator />
                            <InputOTPGroup>
                                <InputOTPSlot index={4} />
                                <InputOTPSlot index={5} />
                                <InputOTPSlot index={6} />
                                <InputOTPSlot index={7} />
                            </InputOTPGroup>
                        </InputOTP>

                        {error && (
                            <p className={`text-sm ${error.includes('sent') ? 'text-green-500' : 'text-red-500'}`}>
                                {error}
                            </p>
                        )}
                    </div>

                    <Button
                        onClick={handleVerifyOTP}
                        disabled={loading || otp.length !== 8}
                        className="w-full"
                        size="lg"
                    >
                        {loading ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Verifying...
                            </>
                        ) : (
                            'Verify Email'
                        )}
                    </Button>

                    <div className="text-center">
                        <p className="text-sm text-muted-foreground mb-2">
                            Didn't receive the code?
                        </p>
                        <Button
                            variant="link"
                            onClick={handleResendCode}
                            className="text-primary"
                        >
                            Resend Code
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

export default OTPVerificationPage
