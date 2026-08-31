import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT) || 8080;

const distDir = path.join(__dirname, 'dist');
const staticRoot = fs.existsSync(distDir) ? distDir : __dirname;

app.use(express.static(staticRoot));

app.get('*', (req, res) => {
  const indexPath = path.join(staticRoot, 'index.html');
  res.sendFile(indexPath);
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Genesis OS listening on :${port} (root: ${staticRoot})`);
});
