import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/authStore';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { ArrowLeft, Check, GraduationCap, Lock, Shield, User } from 'lucide-react';
import { useEffect, useState } from 'react';

function UserSignin() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const { student_id: queryStudentId, institute_id: queryInstituteId } = useSearch({ from: '/user-signin' });

  const [studentId, setStudentId] = useState(queryStudentId ?? '');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-login when arriving from LMS with a student_id query param
  useEffect(() => {
    if (queryStudentId) {
      setStudentId(queryStudentId);
      performLogin(queryStudentId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryStudentId]);

  function performLogin(id: string) {
    const trimmed = id.trim().toUpperCase();
    if (!trimmed) {
      setError('Student ID is required');
      return;
    }

    setIsLoading(true);
    setError('');

    setTimeout(() => {
      setIsLoading(false);
      login(
        {
          id: trimmed,
          name: `Student ${trimmed}`,
          email: `${trimmed.toLowerCase()}@lms.edu`,
          role: 'student',
          institute_id: (queryInstituteId ?? 'LMS_INST_A').trim(),
        },
        `student-token-${trimmed}`,
      );
      navigate({ to: '/engagement' });
    }, 600);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performLogin(studentId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-teal-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0">
        <img
          src="/images/hero-background.png"
          alt="Background"
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/80 via-emerald-900/80 to-teal-900/80" />
      </div>

      {/* Animated orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Sign-in Card */}
      <div className="relative w-full max-w-md">
        <div className="bg-card/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-border">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 mb-4 shadow-lg">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Welcome Back</h1>
            <p className="text-muted-foreground">Sign in to view your analytics</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Student ID Field */}
            <div className="space-y-2">
              <Label htmlFor="studentId" className="text-foreground font-medium flex items-center gap-2">
                <User className="w-4 h-4" />
                Student ID
              </Label>
              <Input
                type="text"
                id="studentId"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="e.g. STU0001"
                required
                className="h-12 bg-background border-input focus:border-emerald-500 focus:ring-emerald-500 text-foreground placeholder:text-muted-foreground"
              />
            </div>

            {/* Password Field (cosmetic) */}
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
                className="h-12 bg-background border-input focus:border-emerald-500 focus:ring-emerald-500 text-foreground placeholder:text-muted-foreground"
              />
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-input text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-muted-foreground">Remember me</span>
              </label>
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
              className="w-full h-12 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Signing in...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  Sign in to Account
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

          {/* Admin Sign-in Link */}
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: '/admin-signin' })}
            className="w-full h-12 border-2 border-border hover:border-emerald-500/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-foreground"
          >
            <Shield className="w-5 h-5 mr-2" />
            Admin Sign in
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

export default UserSignin;
