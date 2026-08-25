const fs = require('fs');
let content = fs.readFileSync('components/MobileNavBar.tsx', 'utf8');

content = content.replace(
    /className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none pb-\[env\(safe-area-inset-bottom,6px\)\] pt-1 opacity-80 hover:opacity-100 transition-opacity duration-500"/g,
    'className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none pb-[env(safe-area-inset-bottom,12px)] pt-2 transition-transform duration-500"'
);

content = content.replace(
    /className="pointer-events-auto bg-\[#080808\]\/80 backdrop-blur-xl border border-white\/10 rounded-full shadow-\[0_8px_32px_rgba\(0,0,0,0.8\)\] flex items-center gap-1 py-1 px-2 mx-2 w-fit max-w-\[98vw\] overflow-x-auto no-scrollbar relative"/g,
    'className="pointer-events-auto bg-surface-dark/90 backdrop-blur-3xl border border-white/10 rounded-full shadow-glass flex items-center gap-1.5 py-1.5 px-3 mx-2 w-fit max-w-[98vw] overflow-x-auto no-scrollbar relative"'
);

content = content.replace(
    /text-black bg-brand-cyan shadow-\[0_0_20px_rgba\(0,240,255,0.5\)\] scale-110 z-10/g,
    'text-black bg-brand-cyan shadow-glow-cyan scale-110 z-10'
);

content = content.replace(
    /min-w-\[36px\] h-8/g,
    'min-w-[40px] h-10'
);

content = content.replace(
    /w-4 h-4/g,
    'w-[18px] h-[18px]'
);

fs.writeFileSync('components/MobileNavBar.tsx', content);
