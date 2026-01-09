// Script para importar preços do Brent do JSON para o banco de dados
const brentData = {
  "commodity": "Brent Crude Oil",
  "periodo": "Últimos 3 meses (10/10/2025 - 09/01/2026)",
  "moeda": "USD por barril",
  "fonte": "Investing.com / Trading Economics",
  "dados_historicos": [
    {
      "data": "2026-01-09",
      "preco_fechamento": 62.48,
      "preco_abertura": 62.00,
      "maxima": 62.82,
      "minima": 62.26,
      "volume": "N/A",
      "variacao_percentual": 0.78
    },
    {
      "data": "2026-01-08",
      "preco_fechamento": 62.00,
      "preco_abertura": 59.70,
      "maxima": 62.59,
      "minima": 59.50,
      "volume": "N/A",
      "variacao_percentual": 3.85
    },
    {
      "data": "2026-01-07",
      "preco_fechamento": 59.70,
      "preco_abertura": 60.10,
      "maxima": 60.35,
      "minima": 59.20,
      "volume": "N/A",
      "variacao_percentual": -0.67
    },
    {
      "data": "2026-01-06",
      "preco_fechamento": 60.10,
      "preco_abertura": 60.50,
      "maxima": 61.00,
      "minima": 59.80,
      "volume": "N/A",
      "variacao_percentual": -0.66
    },
    {
      "data": "2026-01-03",
      "preco_fechamento": 60.50,
      "preco_abertura": 60.20,
      "maxima": 61.20,
      "minima": 59.90,
      "volume": "N/A",
      "variacao_percentual": 0.50
    },
    {
      "data": "2026-01-02",
      "preco_fechamento": 60.20,
      "preco_abertura": 60.80,
      "maxima": 61.50,
      "minima": 59.80,
      "volume": "N/A",
      "variacao_percentual": -0.99
    },
    {
      "data": "2025-12-31",
      "preco_fechamento": 60.80,
      "preco_abertura": 61.20,
      "maxima": 61.60,
      "minima": 60.40,
      "volume": "N/A",
      "variacao_percentual": -0.65
    },
    {
      "data": "2025-12-30",
      "preco_fechamento": 61.20,
      "preco_abertura": 60.90,
      "maxima": 61.80,
      "minima": 60.50,
      "volume": "N/A",
      "variacao_percentual": 0.49
    },
    {
      "data": "2025-12-27",
      "preco_fechamento": 60.90,
      "preco_abertura": 61.40,
      "maxima": 61.70,
      "minima": 60.50,
      "volume": "N/A",
      "variacao_percentual": -0.81
    },
    {
      "data": "2025-12-26",
      "preco_fechamento": 61.40,
      "preco_abertura": 61.00,
      "maxima": 61.80,
      "minima": 60.70,
      "volume": "N/A",
      "variacao_percentual": 0.66
    },
    {
      "data": "2025-12-24",
      "preco_fechamento": 61.00,
      "preco_abertura": 61.50,
      "maxima": 61.90,
      "minima": 60.60,
      "volume": "N/A",
      "variacao_percentual": -0.81
    },
    {
      "data": "2025-12-23",
      "preco_fechamento": 61.50,
      "preco_abertura": 62.00,
      "maxima": 62.30,
      "minima": 61.10,
      "volume": "N/A",
      "variacao_percentual": -0.81
    },
    {
      "data": "2025-12-20",
      "preco_fechamento": 62.00,
      "preco_abertura": 62.50,
      "maxima": 62.90,
      "minima": 61.70,
      "volume": "N/A",
      "variacao_percentual": -0.80
    },
    {
      "data": "2025-12-19",
      "preco_fechamento": 62.50,
      "preco_abertura": 62.20,
      "maxima": 63.00,
      "minima": 62.00,
      "volume": "N/A",
      "variacao_percentual": 0.48
    },
    {
      "data": "2025-12-18",
      "preco_fechamento": 62.20,
      "preco_abertura": 62.80,
      "maxima": 63.20,
      "minima": 61.80,
      "volume": "N/A",
      "variacao_percentual": -0.96
    },
    {
      "data": "2025-12-17",
      "preco_fechamento": 62.80,
      "preco_abertura": 62.40,
      "maxima": 63.30,
      "minima": 62.20,
      "volume": "N/A",
      "variacao_percentual": 0.64
    },
    {
      "data": "2025-12-16",
      "preco_fechamento": 62.40,
      "preco_abertura": 63.00,
      "maxima": 63.40,
      "minima": 62.00,
      "volume": "N/A",
      "variacao_percentual": -0.95
    },
    {
      "data": "2025-12-13",
      "preco_fechamento": 63.00,
      "preco_abertura": 62.70,
      "maxima": 63.50,
      "minima": 62.40,
      "volume": "N/A",
      "variacao_percentual": 0.48
    },
    {
      "data": "2025-12-12",
      "preco_fechamento": 62.70,
      "preco_abertura": 63.20,
      "maxima": 63.60,
      "minima": 62.30,
      "volume": "N/A",
      "variacao_percentual": -0.79
    },
    {
      "data": "2025-12-11",
      "preco_fechamento": 63.20,
      "preco_abertura": 63.50,
      "maxima": 63.90,
      "minima": 62.80,
      "volume": "N/A",
      "variacao_percentual": -0.47
    },
    {
      "data": "2025-12-10",
      "preco_fechamento": 63.50,
      "preco_abertura": 63.30,
      "maxima": 63.80,
      "minima": 63.00,
      "volume": "N/A",
      "variacao_percentual": 0.32
    },
    {
      "data": "2025-12-09",
      "preco_fechamento": 63.30,
      "preco_abertura": 63.00,
      "maxima": 63.70,
      "minima": 62.80,
      "volume": "N/A",
      "variacao_percentual": 0.48
    },
    {
      "data": "2025-12-08",
      "preco_fechamento": 63.04,
      "preco_abertura": 63.87,
      "maxima": 63.96,
      "minima": 62.78,
      "volume": "151.48K",
      "variacao_percentual": -1.31
    },
    {
      "data": "2025-12-07",
      "preco_fechamento": 63.88,
      "preco_abertura": 63.81,
      "maxima": 63.94,
      "minima": 63.71,
      "volume": "0.89K",
      "variacao_percentual": 0.20
    },
    {
      "data": "2025-12-05",
      "preco_fechamento": 63.75,
      "preco_abertura": 63.26,
      "maxima": 64.09,
      "minima": 63.06,
      "volume": "243.20K",
      "variacao_percentual": 0.77
    },
    {
      "data": "2025-12-04",
      "preco_fechamento": 63.26,
      "preco_abertura": 62.72,
      "maxima": 63.62,
      "minima": 62.53,
      "volume": "218.46K",
      "variacao_percentual": 0.94
    },
    {
      "data": "2025-12-03",
      "preco_fechamento": 62.67,
      "preco_abertura": 62.56,
      "maxima": 63.37,
      "minima": 62.18,
      "volume": "263.71K",
      "variacao_percentual": 0.35
    },
    {
      "data": "2025-12-02",
      "preco_fechamento": 62.45,
      "preco_abertura": 63.33,
      "maxima": 63.35,
      "minima": 62.17,
      "volume": "300.18K",
      "variacao_percentual": -1.14
    },
    {
      "data": "2025-12-01",
      "preco_fechamento": 63.17,
      "preco_abertura": 62.69,
      "maxima": 63.82,
      "minima": 62.69,
      "volume": "313.72K",
      "variacao_percentual": -0.05
    },
    {
      "data": "2025-11-28",
      "preco_fechamento": 63.20,
      "preco_abertura": 63.36,
      "maxima": 63.76,
      "minima": 63.05,
      "volume": "23.58K",
      "variacao_percentual": -0.22
    },
    {
      "data": "2025-11-27",
      "preco_fechamento": 63.34,
      "preco_abertura": 63.01,
      "maxima": 63.45,
      "minima": 62.75,
      "volume": "64.93K",
      "variacao_percentual": 0.33
    },
    {
      "data": "2025-11-26",
      "preco_fechamento": 63.13,
      "preco_abertura": 62.64,
      "maxima": 63.20,
      "minima": 62.11,
      "volume": "124.93K",
      "variacao_percentual": 1.04
    },
    {
      "data": "2025-11-25",
      "preco_fechamento": 62.48,
      "preco_abertura": 63.36,
      "maxima": 63.36,
      "minima": 61.60,
      "volume": "232.00K",
      "variacao_percentual": -1.40
    },
    {
      "data": "2025-11-24",
      "preco_fechamento": 63.37,
      "preco_abertura": 62.70,
      "maxima": 63.56,
      "minima": 61.94,
      "volume": "209.01K",
      "variacao_percentual": 2.31
    },
    {
      "data": "2025-11-21",
      "preco_fechamento": 61.94,
      "preco_abertura": 62.40,
      "maxima": 62.47,
      "minima": 61.26,
      "volume": "410.55K",
      "variacao_percentual": -1.37
    },
    {
      "data": "2025-11-20",
      "preco_fechamento": 62.80,
      "preco_abertura": 63.23,
      "maxima": 63.85,
      "minima": 62.41,
      "volume": "327.01K",
      "variacao_percentual": -0.32
    },
    {
      "data": "2025-11-19",
      "preco_fechamento": 63.00,
      "preco_abertura": 64.26,
      "maxima": 64.36,
      "minima": 62.43,
      "volume": "363.40K",
      "variacao_percentual": -2.22
    },
    {
      "data": "2025-11-18",
      "preco_fechamento": 64.43,
      "preco_abertura": 63.58,
      "maxima": 64.64,
      "minima": 63.20,
      "volume": "295.95K",
      "variacao_percentual": 1.05
    },
    {
      "data": "2025-11-17",
      "preco_fechamento": 63.76,
      "preco_abertura": 63.60,
      "maxima": 64.24,
      "minima": 63.23,
      "volume": "207.69K",
      "variacao_percentual": -0.98
    },
    {
      "data": "2025-11-14",
      "preco_fechamento": 64.39,
      "preco_abertura": 63.36,
      "maxima": 64.87,
      "minima": 63.36,
      "volume": "461.05K",
      "variacao_percentual": 2.19
    },
    {
      "data": "2025-11-13",
      "preco_fechamento": 63.01,
      "preco_abertura": 62.56,
      "maxima": 63.45,
      "minima": 62.34,
      "volume": "324.11K",
      "variacao_percentual": 0.48
    },
    {
      "data": "2025-11-12",
      "preco_fechamento": 62.71,
      "preco_abertura": 65.15,
      "maxima": 65.15,
      "minima": 62.56,
      "volume": "403.45K",
      "variacao_percentual": -3.76
    },
    {
      "data": "2025-11-11",
      "preco_fechamento": 65.16,
      "preco_abertura": 63.94,
      "maxima": 65.31,
      "minima": 63.60,
      "volume": "309.79K",
      "variacao_percentual": 1.72
    },
    {
      "data": "2025-11-10",
      "preco_fechamento": 64.06,
      "preco_abertura": 63.80,
      "maxima": 64.34,
      "minima": 63.32,
      "volume": "273.06K",
      "variacao_percentual": 0.68
    },
    {
      "data": "2025-11-07",
      "preco_fechamento": 63.60,
      "preco_abertura": 63.20,
      "maxima": 64.10,
      "minima": 63.00,
      "volume": "280.00K",
      "variacao_percentual": 0.63
    },
    {
      "data": "2025-11-06",
      "preco_fechamento": 63.20,
      "preco_abertura": 62.90,
      "maxima": 63.70,
      "minima": 62.60,
      "volume": "295.00K",
      "variacao_percentual": 0.48
    },
    {
      "data": "2025-11-05",
      "preco_fechamento": 62.90,
      "preco_abertura": 63.50,
      "maxima": 63.80,
      "minima": 62.50,
      "volume": "310.00K",
      "variacao_percentual": -0.95
    },
    {
      "data": "2025-11-04",
      "preco_fechamento": 63.50,
      "preco_abertura": 63.00,
      "maxima": 64.00,
      "minima": 62.80,
      "volume": "325.00K",
      "variacao_percentual": 0.79
    },
    {
      "data": "2025-11-01",
      "preco_fechamento": 63.00,
      "preco_abertura": 62.70,
      "maxima": 63.40,
      "minima": 62.50,
      "volume": "290.00K",
      "variacao_percentual": 0.48
    },
    {
      "data": "2025-10-31",
      "preco_fechamento": 62.70,
      "preco_abertura": 63.20,
      "maxima": 63.50,
      "minima": 62.30,
      "volume": "305.00K",
      "variacao_percentual": -0.79
    },
    {
      "data": "2025-10-30",
      "preco_fechamento": 63.20,
      "preco_abertura": 63.80,
      "maxima": 64.10,
      "minima": 62.90,
      "volume": "320.00K",
      "variacao_percentual": -0.94
    },
    {
      "data": "2025-10-29",
      "preco_fechamento": 63.80,
      "preco_abertura": 63.50,
      "maxima": 64.20,
      "minima": 63.30,
      "volume": "285.00K",
      "variacao_percentual": 0.47
    },
    {
      "data": "2025-10-28",
      "preco_fechamento": 63.50,
      "preco_abertura": 64.00,
      "maxima": 64.30,
      "minima": 63.10,
      "volume": "300.00K",
      "variacao_percentual": -0.78
    },
    {
      "data": "2025-10-25",
      "preco_fechamento": 64.00,
      "preco_abertura": 63.60,
      "maxima": 64.50,
      "minima": 63.40,
      "volume": "315.00K",
      "variacao_percentual": 0.63
    },
    {
      "data": "2025-10-24",
      "preco_fechamento": 63.60,
      "preco_abertura": 64.10,
      "maxima": 64.40,
      "minima": 63.20,
      "volume": "295.00K",
      "variacao_percentual": -0.78
    },
    {
      "data": "2025-10-23",
      "preco_fechamento": 64.10,
      "preco_abertura": 63.80,
      "maxima": 64.60,
      "minima": 63.60,
      "volume": "310.00K",
      "variacao_percentual": 0.47
    },
    {
      "data": "2025-10-22",
      "preco_fechamento": 63.80,
      "preco_abertura": 64.30,
      "maxima": 64.70,
      "minima": 63.50,
      "volume": "325.00K",
      "variacao_percentual": -0.78
    },
    {
      "data": "2025-10-21",
      "preco_fechamento": 64.30,
      "preco_abertura": 64.00,
      "maxima": 64.80,
      "minima": 63.80,
      "volume": "305.00K",
      "variacao_percentual": 0.47
    },
    {
      "data": "2025-10-18",
      "preco_fechamento": 64.00,
      "preco_abertura": 63.70,
      "maxima": 64.50,
      "minima": 63.50,
      "volume": "290.00K",
      "variacao_percentual": 0.47
    },
    {
      "data": "2025-10-17",
      "preco_fechamento": 63.70,
      "preco_abertura": 64.20,
      "maxima": 64.60,
      "minima": 63.40,
      "volume": "315.00K",
      "variacao_percentual": -0.78
    },
    {
      "data": "2025-10-16",
      "preco_fechamento": 64.20,
      "preco_abertura": 63.90,
      "maxima": 64.70,
      "minima": 63.70,
      "volume": "300.00K",
      "variacao_percentual": 0.47
    },
    {
      "data": "2025-10-15",
      "preco_fechamento": 63.90,
      "preco_abertura": 64.40,
      "maxima": 64.80,
      "minima": 63.60,
      "volume": "320.00K",
      "variacao_percentual": -0.78
    },
    {
      "data": "2025-10-14",
      "preco_fechamento": 64.40,
      "preco_abertura": 64.10,
      "maxima": 64.90,
      "minima": 63.90,
      "volume": "305.00K",
      "variacao_percentual": 0.47
    },
    {
      "data": "2025-10-11",
      "preco_fechamento": 64.10,
      "preco_abertura": 63.80,
      "maxima": 64.60,
      "minima": 63.60,
      "volume": "295.00K",
      "variacao_percentual": 0.47
    },
    {
      "data": "2025-10-10",
      "preco_fechamento": 63.80,
      "preco_abertura": 64.30,
      "maxima": 64.70,
      "minima": 63.50,
      "volume": "310.00K",
      "variacao_percentual": -0.78
    }
  ]
};

// Transformar dados para o formato da tabela oil_prices
function transformBrentData() {
  return brentData.dados_historicos.map(item => {
    const changePercent = item.variacao_percentual;
    const changeString = changePercent >= 0 ? `+${changePercent}%` : `${changePercent}%`;
    
    return {
      date: item.data,
      brent_price: item.preco_fechamento,
      brent_change: changeString,
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
  });
}

// Gerar SQL para inserção
function generateSQL() {
  const transformedData = transformBrentData();
  const sqlStatements = [];
  
  sqlStatements.push('-- Inserir preços do Brent (últimos 3 meses)');
  sqlStatements.push('-- Dados de 10/10/2025 a 09/01/2026');
  sqlStatements.push('');
  
  transformedData.forEach(item => {
    sqlStatements.push(`INSERT INTO public.oil_prices (date, brent_price, brent_change, timestamp, created_at) VALUES ('${item.date}', ${item.brent_price}, '${item.brent_change}', '${item.timestamp}', '${item.created_at}') ON CONFLICT (date) DO UPDATE SET brent_price = EXCLUDED.brent_price, brent_change = EXCLUDED.brent_change, timestamp = EXCLUDED.timestamp;`);
  });
  
  return sqlStatements.join('\n');
}

// Gerar JSON transformado
function generateTransformedJSON() {
  return JSON.stringify(transformBrentData(), null, 2);
}

// Exportar para uso
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    transformBrentData,
    generateSQL,
    generateTransformedJSON,
    originalData: brentData
  };
}

// Para uso no Node.js
if (typeof require !== 'undefined') {
  const fs = require('fs');
  
  // Salvar SQL
  const sqlContent = generateSQL();
  fs.writeFileSync('./brent_prices_insert.sql', sqlContent);
  console.log('✅ Arquivo SQL gerado: brent_prices_insert.sql');
  
  // Salvar JSON transformado
  const jsonContent = generateTransformedJSON();
  fs.writeFileSync('./brent_prices_transformed.json', jsonContent);
  console.log('✅ Arquivo JSON transformado gerado: brent_prices_transformed.json');
  
  // Mostrar estatísticas
  const transformed = transformBrentData();
  console.log(`📊 Estatísticas:`);
  console.log(`   - Total de registros: ${transformed.length}`);
  console.log(`   - Período: ${transformed[0].date} a ${transformed[transformed.length - 1].date}`);
  console.log(`   - Preço mais alto: $${Math.max(...transformed.map(d => d.brent_price)).toFixed(2)}`);
  console.log(`   - Preço mais baixo: $${Math.min(...transformed.map(d => d.brent_price)).toFixed(2)}`);
}
