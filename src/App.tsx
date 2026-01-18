import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import OTPVerificationPage from './pages/OTPVerificationPage'
import DashboardPage from './pages/DashboardPage'
import { CameraPageWrapper } from './pages/CameraPageWrapper'
import { PDFViewerPage } from './pages/PDFViewerPage'

function App() {
  
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/scan" element={<Navigate to="/scan/login" replace />} />
        <Route path="/scan/login" element={<LoginPage />} />
        <Route path="/scan/signup" element={<SignupPage />} />
        <Route path="/scan/verify-otp" element={<OTPVerificationPage />} />
        <Route path="/scan/dashboard" element={<DashboardPage />} />
        <Route path="/scan/camera" element={<CameraPageWrapper />} />
        <Route path="/scan/view/:scanId" element={<PDFViewerPage />} />
        <Route path="*" element={<Navigate to="/scan/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App