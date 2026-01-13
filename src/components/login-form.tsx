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
import { supabase } from "@/utils/supabase-client"
import { FcGoogle } from "react-icons/fc"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({ email: false, password: false })
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const navigate = useNavigate()

  const clearAllErrors = () => {
    setErrors({ email: false, password: false })
    setErrorMessage(null)
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
    const formData = new FormData(e.currentTarget)
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    const newErrors = {
      email: !email || email.trim() === "",
      password: !password || password.trim() === ""
    }

    setErrors(newErrors)

    if (!newErrors.email && !newErrors.password) {
      setLoading(true)
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          setErrorMessage(error.message)
        } else if (data.user) {
          // Successful login - redirect or handle success
          console.log("Login successful", data.user)
          navigate("/scan/dashboard") // Update with your desired route
        }
      } catch (error) {
        setErrorMessage("An unexpected error occurred")
      } finally {
        setLoading(false)
      }
    }
  }

  const handleGoogleLogin = async () => {
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
      setErrorMessage("An error occurred with Google login")
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Login to your account</CardTitle>
          <CardDescription>
            Enter your email below to login to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form ref={formRef} onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
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
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <a
                    href="#"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </a>
                </div>
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
              </Field>
              <Field>
                {errorMessage && (
                  <div className="text-sm text-red-500 dark:text-red-400 text-center">
                    {errorMessage}
                  </div>
                )}
                <Button type="submit" disabled={loading}>
                  {loading ? "Logging in..." : "Login"}
                </Button>
                <Button variant="outline" type="button" onClick={handleGoogleLogin}>
                  <FcGoogle />
                  Login with Google
                </Button>
                <FieldDescription className="text-center">
                  Don&apos;t have an account? <Link to="/scan/signup">Sign up</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
