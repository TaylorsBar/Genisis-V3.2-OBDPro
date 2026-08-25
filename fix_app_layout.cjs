const fs = require('fs');

let content = fs.readFileSync('App.tsx', 'utf8');

// Replace the main flex container background
content = content.replace(
    /className=\{\`flex flex-col w-full h-full bg-black text-gray-200 overflow-hidden font-sans relative select-none \$\{globalDimmingClass\}\`\}/g,
    "className={`flex flex-col w-full h-full bg-surface-dark text-gray-200 overflow-hidden font-sans relative select-none ${globalDimmingClass}`}"
);

// Replace the page header layout
content = content.replace(
    /className="flex-shrink-0 flex justify-between items-center mb-1 sm:mb-2 px-4 sm:px-6 h-9 bg-gradient-to-b from-white\/\[0\.02\] to-transparent border-b border-white\/5"/g,
    'className="flex-shrink-0 flex justify-between items-center mb-2 px-6 h-12 bg-gradient-to-b from-white/[0.03] to-transparent border-b border-white/[0.08]"'
);

// Replace header text styling
content = content.replace(
    /className="text-\[10px\] sm:text-xs font-display font-black text-white italic tracking-\[0\.2em\] uppercase border-l border-white\/10 pl-2 sm:pl-4 truncate"/g,
    'className="text-[11px] sm:text-[13px] font-display font-medium text-white tracking-[0.25em] uppercase border-l border-white/20 pl-4 truncate"'
);

// Replace header text styling (removing the explicit style attribute)
content = content.replace(
    /style=\{\{ fontStyle: 'normal', textAlign: 'left' \}\}/g,
    ""
);

// Replace the little divider in the header
content = content.replace(
    /className="h-px w-20 bg-gradient-to-r from-transparent to-white\/20"/g,
    'className="h-[2px] w-12 bg-brand-cyan/50 rounded-full"'
);

// Replace background in BootSequence
content = content.replace(
    /className="absolute inset-0 bg-\[radial-gradient\(circle_at_center,_#0a0a0a_0%,_#000000_100%\)\] pointer-events-none"/g,
    'className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#121212_0%,_#050505_100%)] pointer-events-none"'
);

fs.writeFileSync('App.tsx', content);
