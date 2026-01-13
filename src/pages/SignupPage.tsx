import { SignupForm } from '../components/Signup'
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/utils/supabase-client";
import { Button } from "@/components/ui/button";
import { IoArrowBack } from "react-icons/io5";

const SignupPage = () => {
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        // Check if user is already logged in
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                navigate('/scan/dashboard');
            } else {
                setLoading(false);
            }
        };

        checkSession();
    }, [navigate]);

    if (loading) {
        return (
            <div className="dark bg-muted flex min-h-svh flex-col items-center justify-center p-8 md:p-14">
                <div className="text-lg">Loading...</div>
            </div>
        );
    }

    return (
        <div className="dark bg-muted flex min-h-svh flex-col items-center justify-center p-2 md:p-2 relative">
            <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                className="absolute top-4 left-4 text-white hover:text-white/80"
            >
                <IoArrowBack className="h-5 w-5" />
            </Button>
            <div className="w-full max-w-sm md:max-w-md">
                <SignupForm />
            </div>
        </div>
    )
}

export default SignupPage