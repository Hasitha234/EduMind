import { Button } from '@/components/ui/button';
import { useAuth, useAuthStore } from '@/store/authStore';
import { useNavigate } from '@tanstack/react-router';
import { LogOut, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ModeToggle } from '../mode-toggle/mode-toggle';

export function Navbar() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuth();
    const logout = useAuthStore((s) => s.logout);

    // Handle scroll effect
    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToSection = (sectionId: string) => {
        const element = document.getElementById(sectionId);
        if (element) {
            const offset = 80; // Account for floating navbar height
            const bodyRect = document.body.getBoundingClientRect().top;
            const elementRect = element.getBoundingClientRect().top;
            const elementPosition = elementRect - bodyRect;
            const offsetPosition = elementPosition - offset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
            setMobileMenuOpen(false);
        }
    };

    return (
        <>
            <nav
                className={`fixed left-0 right-0 z-50 transition-all duration-300 ease-in-out ${scrolled ? 'top-0' : 'top-0 md:top-4'
                    } ${mobileMenuOpen ? 'bg-background' : ''}`}
            >
                <div
                    className={`
                        mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-300 ease-in-out
                        ${scrolled
                            ? 'max-w-full rounded-none border-b border-border bg-background/80 backdrop-blur-xl shadow-sm'
                            : 'md:max-w-5xl md:rounded-full md:border md:backdrop-blur-xl bg-transparent border-transparent md:bg-background/40 md:border-white/10'
                        }
                        ${mobileMenuOpen ? 'bg-background border-b border-border' : ''}
                    `}
                >
                    <div className="flex items-center justify-between h-16 md:h-14">
                        {/* Logo */}
                        <div
                            className="flex items-center gap-2 cursor-pointer group"
                            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                        >
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center transform transition-transform group-hover:scale-105 group-hover:rotate-3 shadow-lg group-hover:shadow-blue-500/25">
                                <span className="text-white font-bold text-lg">E</span>
                            </div>
                            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                                EduMind
                            </span>
                        </div>

                        {/* Desktop Navigation */}
                        <div className="hidden md:flex items-center gap-8">
                            <button
                                onClick={() => scrollToSection('features')}
                                className="text-sm font-medium text-foreground hover:text-primary transition-colors relative group"
                            >
                                Features
                                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-600 to-purple-600 transition-all duration-300 group-hover:w-full" />
                            </button>

                            {/* Solutions Dropdown */}
                            <div className="relative group">
                                <button
                                    className="text-sm font-medium text-foreground hover:text-primary transition-colors relative flex items-center gap-1"
                                >
                                    Solutions
                                    <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-600 to-purple-600 transition-all duration-300 group-hover:w-full opacity-0 group-hover:opacity-100" />
                                </button>
                                <div className="absolute top-full -left-4 pt-4 w-64 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform group-hover:translate-y-0 translate-y-2">
                                    <div className="bg-card/95 backdrop-blur-xl border border-border rounded-xl shadow-xl p-2 overflow-hidden">
                                        <div className="space-y-1">
                                            <a href="/analytics" className="block px-4 py-3 rounded-lg hover:bg-accent group/item">
                                                <div className="text-sm font-semibold text-foreground">Risk Prediction</div>
                                                <div className="text-xs text-muted-foreground">AI-powered dropout prevention</div>
                                            </a>
                                            <a href="/engagement" className="block px-4 py-3 rounded-lg hover:bg-accent group/item">
                                                <div className="text-sm font-semibold text-foreground">Engagement</div>
                                                <div className="text-xs text-muted-foreground">Real-time participation tracking</div>
                                            </a>
                                            <a href="/learning-style" className="block px-4 py-3 rounded-lg hover:bg-accent group/item">
                                                <div className="text-sm font-semibold text-foreground">Learning Styles</div>
                                                <div className="text-xs text-muted-foreground">Adaptive content delivery</div>
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => navigate({ to: '/pricing' })}
                                className="text-sm font-medium text-foreground hover:text-primary transition-colors relative group"
                            >
                                Pricing
                                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-600 to-purple-600 transition-all duration-300 group-hover:w-full" />
                            </button>

                            <button
                                onClick={() => navigate({ to: '/docs' })}
                                className="text-sm font-medium text-foreground hover:text-primary transition-colors relative group"
                            >
                                Docs
                                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-600 to-purple-600 transition-all duration-300 group-hover:w-full" />
                            </button>
                        </div>

                        {/* Desktop Actions */}
                        <div className="hidden md:flex items-center gap-4">
                            <ModeToggle />
                            <div className="w-px h-6 bg-border" />
                            {isAuthenticated && user ? (
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-medium text-foreground">{user.name}</span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => { logout(); navigate({ to: '/' }); }}
                                        className="rounded-full px-3"
                                    >
                                        <LogOut size={16} className="mr-1" />
                                        Logout
                                    </Button>
                                </div>
                            ) : (
                                <Button
                                    onClick={() => navigate({ to: '/user-signin' })}
                                    className="rounded-full px-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
                                >
                                    Sign In
                                </Button>
                            )}
                        </div>

                        {/* Mobile Menu Button */}
                        <div className="flex items-center gap-4 md:hidden">
                            <ModeToggle />
                            <button
                                className="p-2 rounded-lg hover:bg-accent transition-colors"
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                aria-label="Toggle menu"
                            >
                                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Menu Overlay */}
                <div
                    className={`
                        md:hidden fixed inset-x-0 top-16 bg-background/95 backdrop-blur-xl border-b border-border transition-all duration-300 ease-in-out
                        ${mobileMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}
                    `}
                >
                    <div className="px-4 py-6 space-y-4">
                        <button
                            onClick={() => scrollToSection('features')}
                            className="block w-full text-left px-4 py-3 text-base font-medium text-foreground hover:bg-accent rounded-xl transition-colors"
                        >
                            Features
                        </button>
                        <button
                            onClick={() => navigate({ to: '/analytics' })}
                            className="block w-full text-left px-4 py-3 text-base font-medium text-foreground hover:bg-accent rounded-xl transition-colors"
                        >
                            Solutions
                        </button>
                        <button
                            onClick={() => navigate({ to: '/pricing' })}
                            className="block w-full text-left px-4 py-3 text-base font-medium text-foreground hover:bg-accent rounded-xl transition-colors"
                        >
                            Pricing
                        </button>
                        <button
                            onClick={() => navigate({ to: '/docs' })}
                            className="block w-full text-left px-4 py-3 text-base font-medium text-foreground hover:bg-accent rounded-xl transition-colors"
                        >
                            Docs
                        </button>
                        <div className="h-px bg-border my-2" />
                        {isAuthenticated && user ? (
                            <Button
                                onClick={() => { logout(); navigate({ to: '/' }); setMobileMenuOpen(false); }}
                                variant="outline"
                                className="w-full rounded-xl h-12 text-base"
                            >
                                <LogOut size={16} className="mr-2" />
                                Logout ({user.name})
                            </Button>
                        ) : (
                            <Button
                                onClick={() => { navigate({ to: '/user-signin' }); setMobileMenuOpen(false); }}
                                className="w-full rounded-xl h-12 text-base bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg"
                            >
                                Sign In
                            </Button>
                        )}
                    </div>
                </div>
            </nav>
        </>
    );
}
