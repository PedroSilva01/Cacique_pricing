const fs = require('fs');
const path = require('path');

// Carregar o script principal
const scriptPath = path.join(__dirname, 'import_brent_prices.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

// Executar o script
eval(scriptContent);
