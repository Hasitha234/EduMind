import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/authStore';
import { useEngagementDashboardStore } from '@/store/engagement-dashboard';
import { useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Check, Lock, Mail, Shield } from 'lucide-react';
import { useState } from 'react';

function AdminSignin() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Credential registry: username -> { password, institute_id, display name }
  // In production this would be a real API call.
  const ADMIN_ACCOUNTS: Record<string, { password: string; institute_id: string; name: string }> = {
    admin:   { password: 'admin',   institute_id: 'LMS_INST_A', name: 'Admin – Institute A' },
    admin_b: { password: 'admin_b', institute_id: 'LMS_INST_B', name: 'Admin – Institute B' },
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    setTimeout(() => {
      setIsLoading(false);
      const account = ADMIN_ACCOUNTS[username];
      if (account && account.password === password) {
        useEngagementDashboardStore.getState().setStats(null);
        useEngagementDashboardStore.getState().setStudents([]);
        useEngagementDashboardStore.getState().clearDashboardData();
        login(
          {
            id: `ADMIN_${account.institute_id}`,
            name: account.name,
            email: `${username}@edumind.com`,
            role: 'admin',
            institute_id: account.institute_id,
          },
          `admin-token-${account.institute_id}`,
        );
        navigate({ to: '/engagement-overview' });
      } else {
        setError('Invalid username or password');
      }
    }, 800);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0">
        <img
          src="/images/hero-background.png"
          alt="Background"
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/80 via-blue-900/80 to-indigo-900/80" />
      </div>

      {/* Animated orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Sign-in Card */}
      <div className="relative w-full max-w-md">
        <div className="bg-card/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-border">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 mb-4 shadow-lg">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Admin Portal</h1>
            <p className="text-muted-foreground">Sign in to your admin account</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username Field */}
            <div className="space-y-2">
              <Label htmlFor="username" className="text-foreground font-medium flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Username
              </Label>
              <Input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                required
                className="h-12 bg-background border-input focus:border-blue-500 focus:ring-blue-500 text-foreground placeholder:text-muted-foreground"
              />
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground font-medium flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Password
              </Label>
              <Input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="h-12 bg-background border-input focus:border-blue-500 focus:ring-blue-500 text-foreground placeholder:text-muted-foreground"
              />
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-input text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-muted-foreground">Remember me</span>
              </label>
              <button type="button" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                Forgot password?
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Signing in...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  Sign in as Admin
                </>
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-background text-muted-foreground">or continue as</span>
            </div>
          </div>

          {/* User Sign-in Link */}
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: '/user-signin' })}
            className="w-full h-12 border-2 border-border hover:border-blue-500/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-foreground"
          >
            <Mail className="w-5 h-5 mr-2" />
            Sign in as User
          </Button>

          {/* Back to Home */}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => navigate({ to: '/' })}
              className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminSignin;
