const fs = require('fs');

let content = fs.readFileSync('App.tsx', 'utf8');

const routesRegex = /<Routes>[\s\S]*?<\/Routes>/;
content = content.replace(routesRegex, '<AnimatedRoutes />');

fs.writeFileSync('App.tsx', content);
