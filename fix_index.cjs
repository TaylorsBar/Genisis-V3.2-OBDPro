const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// replace tailwind config
html = html.replace(/tailwind\.config\s*=\s*{[\s\S]*?}\n\s*<\/script>/, `tailwind.config = {
        theme: {
          extend: {
            colors: {
              'brand-cyan': '#00F0FF',
              'brand-blue': '#0099FF',
              'brand-purple': '#8A2BE2',
              'brand-red': '#FF2A4D',
              'brand-yellow': '#FCEE0A',
              'brand-green': '#00FA9A',
              'surface-dark': '#060606',
              'surface-panel': '#0c0c0c',
              'surface-border': '#1e1e1e',
              'carbon-gray': '#121212',
            },
            fontFamily: {
              'sans': ['Inter', 'system-ui', 'sans-serif'],
              'mono': ['JetBrains Mono', 'Roboto Mono', 'monospace'],
              'display': ['Space Grotesk', 'sans-serif'],
              'technical': ['Orbitron', 'sans-serif'],
            },
            boxShadow: {
              'glow-cyan': '0 0 20px rgba(0, 240, 255, 0.25)',
              'glow-red': '0 0 20px rgba(255, 42, 77, 0.25)',
              'glow-green': '0 0 20px rgba(0, 250, 154, 0.25)',
              'inner-light': 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
              'brutal': '4px 4px 0px #000',
              'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
            },
            backgroundImage: {
              'glass-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.01) 100%)',
              'radial-fade': 'radial-gradient(circle at top, rgba(255, 255, 255, 0.03), transparent 60%)',
            }
          }
        }
      }
    </script>`);

fs.writeFileSync('index.html', html);
