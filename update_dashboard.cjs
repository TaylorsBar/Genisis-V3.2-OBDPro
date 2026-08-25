const fs = require('fs');

let content = fs.readFileSync('pages/Dashboard.tsx', 'utf8');
if (!content.includes('AnimatePresence')) {
    content = content.replace("import React, { useContext } from 'react';", "import React, { useContext } from 'react';\nimport { motion, AnimatePresence } from 'motion/react';");
    
    const returnRegex = /return <div className="h-full w-full">\{renderDashboard\(\)\}<\/div>;/g;
    
    content = content.replace(returnRegex, 
`return (
    <div className="h-full w-full relative">
      <AnimatePresence mode="wait">
        <motion.div
          key={theme}
          initial={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 1.02, filter: 'blur(4px)' }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="w-full h-full absolute inset-0"
        >
          {renderDashboard()}
        </motion.div>
      </AnimatePresence>
    </div>
  );`);

    fs.writeFileSync('pages/Dashboard.tsx', content);
    console.log('Updated Dashboard.tsx');
}
