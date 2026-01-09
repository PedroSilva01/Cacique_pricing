const fs = require('fs');
const path = require('path');

// Carregar o script WTI
const scriptPath = path.join(__dirname, 'import_wti_prices.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

// Executar o script
eval(scriptContent);
