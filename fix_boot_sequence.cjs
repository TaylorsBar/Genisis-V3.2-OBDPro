const fs = require('fs');
let content = fs.readFileSync('App.tsx', 'utf8');

// Replace boot sequence background
content = content.replace(
    /className="fixed inset-0 z-\[99999\] bg-black flex flex-col items-center justify-center font-mono text-xs overflow-hidden"/g,
    'className="fixed inset-0 z-[99999] bg-[#030303] flex flex-col items-center justify-center font-mono overflow-hidden"'
);

// Replace button style
content = content.replace(
    /className="px-6 py-2 border border-brand-cyan text-brand-cyan uppercase tracking-widest font-black hover:bg-brand-cyan hover:text-black transition-all shadow-\[0_0_15px_rgba\(0,240,255,0.4\)\]"/g,
    'className="px-8 py-3 bg-brand-cyan/10 border border-brand-cyan text-brand-cyan text-xs uppercase tracking-[0.3em] font-medium hover:bg-brand-cyan hover:text-black transition-all duration-300 ease-out shadow-glow-cyan"'
);

// Add styling to KarapiroLogo in boot
content = content.replace(
    /variant="monochrome" className="h-16 w-auto text-white opacity-80 mb-8"/g,
    'variant="monochrome" className="h-20 w-auto text-white opacity-90 drop-shadow-[0_0_30px_rgba(255,255,255,0.1)]"'
);

// Tweak progress bar container
content = content.replace(
    /className="w-full max-w-md h-px bg-white\/10 relative overflow-hidden mb-8"/g,
    'className="w-full max-w-lg h-[2px] bg-white/[0.05] rounded-full relative overflow-hidden mb-12"'
);

// Tweak progress bar inner
content = content.replace(
    /className="h-full bg-brand-cyan shadow-\[0_0_10px_#00F0FF\] transition-all duration-75 ease-linear"/g,
    'className="h-full bg-brand-cyan shadow-glow-cyan transition-all duration-75 ease-out"'
);

// Improve logging typography
content = content.replace(
    /className="w-full max-w-md flex flex-col items-start justify-end h-32 space-y-1 mb-8 opacity-60"/g,
    'className="w-full max-w-lg flex flex-col items-start justify-end h-32 space-y-2 mb-10 opacity-70"'
);

content = content.replace(
    /className="animate-in slide-in-from-bottom-2"/g,
    'className="animate-in slide-in-from-bottom-2 text-[10px] tracking-widest text-zinc-400"'
);

content = content.replace(
    /className="text-white\/40"/g,
    'className="text-brand-cyan/50 mr-3"'
);

fs.writeFileSync('App.tsx', content);
