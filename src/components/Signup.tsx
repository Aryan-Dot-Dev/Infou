import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Link, useNavigate } from "react-router-dom"
import { useState, useEffect, useRef } from "react"
import { PiEyeBold, PiEyeClosedBold } from "react-icons/pi"
import { FcGoogle } from "react-icons/fc";
import { supabase } from "@/utils/supabase-client"


export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [errors, setErrors] = useState({ name: false, email: false, password: false, confirmPassword: false })
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const navigate = useNavigate()

  const clearAllErrors = () => {
    setErrors({ name: false, email: false, password: false, confirmPassword: false })
    setErrorMessage(null)
    setSuccessMessage(null)
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (formRef.current && !formRef.current.contains(event.target as Node)) {
        clearAllErrors()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)
    const formData = new FormData(e.currentTarget)
    const name = formData.get("name") as string
    const email = formData.get("email") as string
    const password = formData.get("password") as string
    const confirmPassword = formData.get("confirm-password") as string

    const newErrors = {
      name: !name || name.trim() === "",
      email: !email || email.trim() === "",
      password: !password || password.trim() === "",
      confirmPassword: !confirmPassword || confirmPassword.trim() === ""
    }

    setErrors(newErrors)

    if (!newErrors.email && !newErrors.password && !newErrors.confirmPassword) {
      // Check if passwords match
      if (password !== confirmPassword) {
        setErrorMessage("Passwords do not match")
        return
      }

      // Check password length
      if (password.length < 8) {
        setErrorMessage("Password must be at least 8 characters long")
        return
      }

      setLoading(true)
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name }
          }
        })

        if (error) {
          setErrorMessage(error.message)
        } else if (data.user) {
          // Check if email confirmation is required
          if (data.user.identities?.length === 0) {
            setErrorMessage("An account with this email already exists")
          } else {
            // Redirect to OTP verification page
            navigate("/scan/verify-otp", { state: { email } })
          }
        }
      } catch (error) {
        setErrorMessage("An unexpected error occurred")
      } finally {
        setLoading(false)
      }
    }
  }

  const handleGoogleSignup = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.protocol}//${window.location.host}/scan/dashboard`
        }
      })

      if (error) {
        setErrorMessage(error.message)
      }
    } catch (error) {
      setErrorMessage("An error occurred with Google signup")
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>
            Enter your email below to create your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form ref={formRef} onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Ashok Sharma"
                  className={cn(
                    errors.email && "border-red-500 dark:border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/50 animate-shake"
                  )}
                  onChange={clearAllErrors}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="name">Email</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="m@example.com"
                  className={cn(
                    errors.email && "border-red-500 dark:border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/50 animate-shake"
                  )}
                  onChange={clearAllErrors}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <div className="relative">
                  <Input 
                    id="password" 
                    name="password"
                    type={showPassword ? "text" : "password"} 
                    className={cn(
                      errors.password && "border-red-500 dark:border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/50 animate-shake"
                    )}
                    onChange={clearAllErrors}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    {showPassword ? <PiEyeBold size={20} /> : <PiEyeClosedBold size={20} />}
                  </button>
                </div>
                <FieldDescription>
                  Must be at least 8 characters long.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="confirm-password">
                  Confirm Password
                </FieldLabel>
                <div className="relative">
                  <Input 
                    id="confirm-password" 
                    name="confirm-password"
                    type={showConfirmPassword ? "text" : "password"} 
                    className={cn(
                      errors.confirmPassword && "border-red-500 dark:border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/50 animate-shake"
                    )}
                    onChange={clearAllErrors}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    {showConfirmPassword ? <PiEyeBold size={20} /> : <PiEyeClosedBold size={20} />}
                  </button>
                </div>
              </Field>
              <Field>
                {errorMessage && (
                  <div className="text-sm text-red-500 dark:text-red-400 text-center">
                    {errorMessage}
                  </div>
                )}
                {successMessage && (
                  <div className="text-sm text-green-500 dark:text-green-400 text-center">
                    {successMessage}
                  </div>
                )}
                <Button type="submit" disabled={loading}>
                  {loading ? "Creating Account..." : "Create Account"}
                </Button>
                <Button variant="outline" type="button" onClick={handleGoogleSignup}>
                  <FcGoogle />
                  Sign up with Google
                </Button>
                <FieldDescription className="text-center">
                  Already have an account? <Link to="/scan/login">Sign in</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
