import React, { useContext, useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { AppearanceContext } from '../contexts/AppearanceContext';
import { auth } from '../services/firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, User } from 'firebase/auth';
import GaugeIcon from './icons/GaugeIcon';
import ChatIcon from './icons/ChatIcon';
import WrenchIcon from './icons/WrenchIcon';
import TuningForkIcon from './icons/TuningForkIcon';
import EngineIcon from './icons/EngineIcon';
import ShieldIcon from './icons/ShieldIcon';
import ARIcon from './icons/ARIcon';
import HederaIcon from './icons/HederaIcon';
import StopwatchIcon from './icons/StopwatchIcon';
import PaintBrushIcon from './icons/PaintBrushIcon';
import SoundWaveIcon from './icons/SoundWaveIcon';
import { KarapiroLogo } from './KarapiroLogo';
import { Compass, X } from 'lucide-react';

const HudIcon = (props: any) => (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
);

interface NavItem {
    name: string;
    href: string;
    icon: React.FC<any>;
}

interface MenuGroup {
    title: string;
    color: string;
    items: NavItem[];
}

const MENU_GROUPS: MenuGroup[] = [
    {
        title: 'DRIVE MODES',
        color: 'cyan',
        items: [
            { name: 'COCKPIT', href: '/', icon: GaugeIcon },
            { name: 'RACE PACK', href: '/race-pack', icon: StopwatchIcon },
            { name: 'STREET NAV', href: '/navigation', icon: Compass },
            { name: 'HUD PROJECTION', href: '/hud', icon: HudIcon },
        ]
    },
    {
        title: 'ENGINEERING',
        color: 'purple',
        items: [
            { name: 'DYNO LAB', href: '/tuning', icon: TuningForkIcon },
            { name: 'INTUITIVE TUNE', href: '/simplify-tuning', icon: EngineIcon },
            { name: 'ECU FLASH', href: '/flash', icon: EngineIcon },
            { name: 'NEURAL CORE', href: '/ai-engine', icon: EngineIcon },
            { name: 'AR VISION', href: '/ar-assistant', icon: ARIcon },
            { name: 'DIAGNOSTICS', href: '/diagnostics', icon: ChatIcon },
        ]
    },
    {
        title: 'SYSTEM OPS',
        color: 'red',
        items: [
            { name: 'SERVICE LOG', href: '/logbook', icon: WrenchIcon },
            { name: 'SECURITY', href: '/security', icon: ShieldIcon },
            { name: 'ZK SCRUTINEER', href: '/hedera', icon: HederaIcon },
            { name: 'CABIN', href: '/accessories', icon: SoundWaveIcon },
            { name: 'APPEARANCE', href: '/appearance', icon: PaintBrushIcon },
        ]
    }
];

const NavModule: React.FC<{ item: NavItem; groupColor: string; onClick?: () => void }> = ({ item, groupColor, onClick }) => {
    const colors: Record<string, string> = {
        cyan: 'text-brand-cyan border-brand-cyan shadow-glow-cyan bg-brand-cyan/10',
        purple: 'text-brand-purple border-brand-purple shadow-glow-purple bg-brand-purple/10',
        red: 'text-brand-red border-brand-red shadow-glow-red bg-brand-red/10'
    };
    
    return (
        <NavLink 
            to={item.href}
            onClick={onClick}
            className={({ isActive }) => `
                group relative flex items-center gap-4 px-6 py-4 transition-all duration-300 ease-out
                ${isActive ? 'bg-white/5 border-r-2 border-white' : 'hover:bg-white/[0.02] border-r-2 border-transparent'}
            `}
        >
            {({ isActive }) => (
                <>
                    <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-white opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
                    
                    <div className={`
                        p-2.5 rounded-xl transition-all duration-300 border
                        ${isActive ? colors[groupColor] : 'text-zinc-500 border-white/5 group-hover:text-white group-hover:border-white/20 group-hover:bg-white/5'}
                    `}>
                        <item.icon className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
                    </div>
                    
                    <div className="flex flex-col">
                        <span className={`
                            font-display font-medium text-[11px] tracking-[0.2em] uppercase transition-colors duration-300
                            ${isActive ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300'}
                        `}>
                            {item.name}
                        </span>
                        {isActive && (
                            <span className={`text-[9px] font-mono tracking-widest ${colors[groupColor].split(' ')[0]} mt-0.5`}>
                                ACTIVE
                            </span>
                        )}
                    </div>
                </>
            )}
        </NavLink>
    );
};

const SideMenu: React.FC = () => {
    const { isSideMenuOpen, setIsSideMenuOpen } = useContext(AppearanceContext);
    const location = useLocation();

    useEffect(() => {
        setIsSideMenuOpen(false);
    }, [location.pathname, setIsSideMenuOpen]);

    if (!isSideMenuOpen) return null;

    return (
        <>
            <div 
                className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] lg:hidden transition-opacity duration-500"
                onClick={() => setIsSideMenuOpen(false)}
            />
            
            <div 
                className="fixed top-0 bottom-0 left-0 w-[300px] z-[110] bg-surface-dark/95 backdrop-blur-3xl border-r border-white/5 shadow-[20px_0_40px_rgba(0,0,0,0.7)] flex flex-col transition-transform duration-500 ease-out transform translate-x-0"
                style={{
                    boxShadow: 'inset -1px 0 0 rgba(255,255,255,0.05)'
                }}
            >
                <div className="h-20 shrink-0 flex items-center justify-between px-8 border-b border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent relative">
                    <KarapiroLogo className="h-5 w-auto text-white" variant="full" />
                    <button 
                        onClick={() => setIsSideMenuOpen(false)}
                        className="absolute top-5 right-6 lg:hidden text-zinc-400 hover:text-white transition-all bg-white/10 hover:bg-white/20 p-2.5 rounded-xl z-[200] border border-white/20 flex items-center justify-center cursor-pointer shadow-2xl active:scale-95"
                        aria-label="Close Menu"
                        style={{ pointerEvents: 'auto' }}
                    >
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar py-6 space-y-10">
                    {MENU_GROUPS.map((group, idx) => (
                        <div key={idx} className="flex flex-col">
                            <div className="px-8 mb-4 flex items-center gap-4">
                                <div className={`w-1 h-1 rounded-full bg-brand-${group.color} shadow-glow-${group.color}`}></div>
                                <h4 className="text-[10px] font-mono font-medium text-zinc-600 uppercase tracking-[0.25em]">
                                    {group.title}
                                </h4>
                            </div>
                            <div className="flex flex-col">
                                {group.items.map((item, itemIdx) => (
                                    <NavModule 
                                        key={itemIdx} 
                                        item={item} 
                                        groupColor={group.color} 
                                        onClick={() => setIsSideMenuOpen(false)}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                
                <div className="shrink-0 p-5 border-t border-white/5 bg-black/60">
                    <FirebaseAuthPanel />
                </div>
            </div>
        </>
    );
};

const FirebaseAuthPanel: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [mode, setMode] = useState<'none' | 'login' | 'register'>('none');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            setUser(u);
        });
        return unsubscribe;
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await signInWithEmailAndPassword(auth, email, password);
            setMode('none');
            setEmail('');
            setPassword('');
        } catch (err: any) {
            setError(err.message.replace('Firebase: ', ''));
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await createUserWithEmailAndPassword(auth, email, password);
            setMode('none');
            setEmail('');
            setPassword('');
        } catch (err: any) {
            setError(err.message.replace('Firebase: ', ''));
        } finally {
            setLoading(false);
        }
    };

    const handleDemoLogin = async () => {
        setLoading(true);
        setError('');
        try {
            await signInWithEmailAndPassword(auth, 'driver@cartelworx.com', 'cartel123');
            setMode('none');
        } catch (err: any) {
            try {
                await createUserWithEmailAndPassword(auth, 'driver@cartelworx.com', 'cartel123');
                setMode('none');
            } catch (regErr: any) {
                setError('Registration failed: please input valid credentials.');
            }
        } finally {
            setLoading(false);
        }
    };

    if (user) {
        return (
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">CLOUD SYNC STATE</span>
                        <span className="text-xs font-display text-brand-cyan tracking-wider font-bold">REPLICATED ONLINE</span>
                    </div>
                    <div className="w-2.5 h-2.5 rounded-full bg-brand-cyan animate-pulse shadow-glow-cyan"></div>
                </div>
                <div className="flex flex-col bg-white/[0.02] border border-white/5 p-2.5 rounded-lg mt-1">
                    <span className="text-[9px] font-mono text-zinc-400 truncate">{user.email}</span>
                    <button
                        onClick={() => signOut(auth)}
                        className="text-[9px] font-mono font-bold text-brand-red hover:text-red-400 mt-2 text-left uppercase tracking-widest"
                    >
                        [ DISCONNECT LINK ]
                    </button>
                </div>
            </div>
        );
    }

    if (mode === 'login' || mode === 'register') {
        return (
            <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="flex flex-col gap-2">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[9px] font-mono text-brand-purple uppercase tracking-widest">
                        {mode === 'login' ? 'TUNER SIGN IN' : 'CREATE CLOUD SYNC'}
                    </span>
                    <button
                        type="button"
                        onClick={() => setMode('none')}
                        className="text-[9px] font-mono text-zinc-500 hover:text-white uppercase"
                    >
                        [ CANCEL ]
                    </button>
                </div>

                <input
                    type="email"
                    placeholder="EMAIL"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-black/60 border border-white/10 px-3 py-1.5 rounded text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-brand-purple w-full"
                />

                <input
                    type="password"
                    placeholder="PASSWORD"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-black/60 border border-white/10 px-3 py-1.5 rounded text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-brand-purple w-full"
                />

                {error && (
                    <span className="text-[9px] font-mono text-brand-red uppercase leading-tight mt-1 truncate block">
                        {error}
                    </span>
                )}

                <div className="flex gap-2 mt-2">
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 bg-brand-purple/20 border border-brand-purple/50 text-white font-mono text-[10px] py-1.5 rounded hover:bg-brand-purple/30 transition-colors uppercase tracking-widest disabled:opacity-50"
                    >
                        {loading ? 'LINKING...' : 'CONNECT'}
                    </button>
                    {mode === 'login' && (
                        <button
                            type="button"
                            onClick={handleDemoLogin}
                            disabled={loading}
                            className="bg-brand-cyan/20 border border-brand-cyan/50 text-white font-mono text-[10px] px-3 py-1.5 rounded hover:bg-brand-cyan/30 transition-colors uppercase tracking-widest disabled:opacity-50"
                            title="Instant one-click sync demo"
                        >
                            FAST DEMO
                        </button>
                    )}
                </div>

                <button
                    type="button"
                    onClick={() => {
                        setMode(mode === 'login' ? 'register' : 'login');
                        setError('');
                    }}
                    className="text-[9px] font-mono text-zinc-500 hover:text-zinc-300 text-center mt-1 uppercase"
                >
                    {mode === 'login' ? 'NEED AN ACCOUNT? SIGN UP' : 'ALREADY REGISTERED? LOG IN'}
                </button>
            </form>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <div className="flex flex-col">
                    <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Genesis Core</span>
                    <span className="text-xs font-display text-white tracking-wider">V5.0 OFFLINE</span>
                </div>
                <div className="w-2.5 h-2.5 rounded-full bg-zinc-600 animate-pulse"></div>
            </div>
            <button
                onClick={() => setMode('login')}
                className="w-full bg-brand-purple/10 border border-brand-purple/30 hover:border-brand-purple/60 hover:bg-brand-purple/20 text-brand-purple font-mono text-[9px] py-2 rounded-lg transition-all uppercase tracking-widest mt-2"
            >
                CONNECT CLOUD SYNC
            </button>
        </div>
    );
};

export default SideMenu;
