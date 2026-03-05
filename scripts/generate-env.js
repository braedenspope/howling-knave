const fs = require('fs');
const path = require('path');

const envContent = `(function (window) {
  window.__env = {
    supabaseUrl: '${process.env.NG_APP_SUPABASE_URL || 'YOUR_SUPABASE_URL'}',
    supabaseAnonKey: '${process.env.NG_APP_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY'}'
  };
})(window);
`;

const outputDir = path.join(__dirname, '..', 'public', 'assets');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(path.join(outputDir, 'env.js'), envContent, 'utf8');
console.log('Environment file generated at public/assets/env.js');
