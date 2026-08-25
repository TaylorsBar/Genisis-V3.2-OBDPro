const fs = require('fs');
let content = fs.readFileSync('pages/dashboards/ProTunerDashboard.tsx', 'utf8');

// Update background grid texture
content = content.replace(
    /bg-\[linear-gradient\(rgba\(255,255,255,1\)_1px,transparent_1px\),linear-gradient\(90deg,rgba\(255,255,255,1\)_1px,transparent_1px\)\] bg-\[length:40px_40px\] opacity-\[0.02\]/g,
    'bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[length:24px_24px] opacity-20'
);

// Update toolbar design
content = content.replace(
    /h-14 bg-\[#0a0a0a\]\/90 backdrop-blur-xl border-b border-white\/5 flex items-center px-8 gap-8 text-\[9px\] font-black text-zinc-500 tracking-\[0.2em\] shadow-\[0_10px_30px_rgba\(0,0,0,0.5\)\] z-20 shrink-0/g,
    'h-14 bg-[#0a0a0a]/80 backdrop-blur-3xl border-b border-white/[0.08] flex items-center px-8 gap-8 text-[10px] font-display font-medium text-zinc-500 tracking-[0.2em] shadow-glass z-20 shrink-0'
);

// Replace side panel design
content = content.replace(
    /w-full md:w-80 lg:w-96 bg-\[#050505\]\/95 backdrop-blur-md border-r border-white\/5 flex flex-col overflow-y-auto no-scrollbar shadow-\[20px_0_30px_rgba\(0,0,0,0.5\)\]/g,
    'w-full md:w-80 lg:w-96 bg-[#030303]/90 backdrop-blur-3xl border-r border-white/[0.08] flex flex-col overflow-y-auto no-scrollbar shadow-[30px_0_50px_rgba(0,0,0,0.7)]'
);

fs.writeFileSync('pages/dashboards/ProTunerDashboard.tsx', content);
