// fix-paths.cjs
// 批量修正 SvelteKit/Vite 生成的 HTML/JS 文件中的绝对资源路径为相对路径
// 用法：node scripts/fix-paths.cjs [targetDir]

const fs = require('fs');
const path = require('path');

const exts = ['.html', '.js', '.mjs', '.cjs'];
const targetDir = process.argv[2] || path.resolve(__dirname, '../build');

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  // 替换 /_app/xxx => ./_app/xxx
  content = content.replace(/(["'`(=]\s*)\/(?!\/|[a-zA-Z0-9\-_.]+:|\*)_app\//g, '$1._app/');
  // 替换 /favicon.svg => ./favicon.svg
  content = content.replace(/(["'`(=]\s*)\/(?!\/|[a-zA-Z0-9\-_.]+:|\*)favicon\.svg/g, '$1.favicon.svg');
  // 替换 import("/_app/...) => import("./_app/...)
  content = content.replace(/import\(["']\/(?!\/|[a-zA-Z0-9\-_.]+:|\*)_app\//g, 'import("._app/');
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Fixed:', filePath);
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (exts.includes(path.extname(entry.name))) {
      fixFile(fullPath);
    }
  }
}

walk(targetDir);
console.log('All HTML/JS files in', targetDir, 'have been fixed.');
