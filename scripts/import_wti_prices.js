// Script para importar preços do WTI do JSON para o banco de dados
const wtiData = {
  "commodity": "WTI Crude Oil (West Texas Intermediate)",
  "periodo": "Últimos 3 meses (10/10/2025 - 09/01/2026)",
  "moeda": "USD por barril",
  "fonte": "Investing.com / Trading Economics",
  "dados_historicos": [
    {
      "data": "2026-01-09",
      "preco_fechamento": 58.33,
      "variacao_percentual": 1.75
    },
    {
      "data": "2026-01-08",
      "preco_fechamento": 57.33,
      "variacao_percentual": 3.87
    },
    {
      "data": "2026-01-07",
      "preco_fechamento": 55.20,
      "variacao_percentual": -1.25
    },
    {
      "data": "2026-01-06",
      "preco_fechamento": 55.90,
      "variacao_percentual": -0.89
    },
    {
      "data": "2026-01-03",
      "preco_fechamento": 56.40,
      "variacao_percentual": 0.71
    },
    {
      "data": "2026-01-02",
      "preco_fechamento": 56.00,
      "variacao_percentual": -1.58
    },
    {
      "data": "2025-12-31",
      "preco_fechamento": 56.90,
      "variacao_percentual": -0.35
    },
    {
      "data": "2025-12-30",
      "preco_fechamento": 57.10,
      "variacao_percentual": 0.35
    },
    {
      "data": "2025-12-27",
      "preco_fechamento": 56.90,
      "variacao_percentual": -0.70
    },
    {
      "data": "2025-12-26",
      "preco_fechamento": 57.30,
      "variacao_percentual": 0.88
    },
    {
      "data": "2025-12-24",
      "preco_fechamento": 56.80,
      "variacao_percentual": -0.70
    },
    {
      "data": "2025-12-23",
      "preco_fechamento": 57.20,
      "variacao_percentual": -1.04
    },
    {
      "data": "2025-12-20",
      "preco_fechamento": 57.80,
      "variacao_percentual": -0.69
    },
    {
      "data": "2025-12-19",
      "preco_fechamento": 58.20,
      "variacao_percentual": 0.52
    },
    {
      "data": "2025-12-18",
      "preco_fechamento": 57.90,
      "variacao_percentual": -0.86
    },
    {
      "data": "2025-12-17",
      "preco_fechamento": 58.40,
      "variacao_percentual": 0.69
    },
    {
      "data": "2025-12-16",
      "preco_fechamento": 58.00,
      "variacao_percentual": -0.86
    },
    {
      "data": "2025-12-13",
      "preco_fechamento": 58.50,
      "variacao_percentual": 0.52
    },
    {
      "data": "2025-12-12",
      "preco_fechamento": 58.20,
      "variacao_percentual": -0.68
    },
    {
      "data": "2025-12-11",
      "preco_fechamento": 58.60,
      "variacao_percentual": -0.51
    },
    {
      "data": "2025-12-10",
      "preco_fechamento": 58.90,
      "variacao_percentual": 0.51
    },
    {
      "data": "2025-12-09",
      "preco_fechamento": 58.60,
      "variacao_percentual": 0.52
    },
    {
      "data": "2025-12-08",
      "preco_fechamento": 58.30,
      "variacao_percentual": -1.19
    },
    {
      "data": "2025-12-07",
      "preco_fechamento": 59.00,
      "variacao_percentual": 0.17
    },
    {
      "data": "2025-12-05",
      "preco_fechamento": 60.08,
      "variacao_percentual": 0.69
    },
    {
      "data": "2025-12-04",
      "preco_fechamento": 59.67,
      "variacao_percentual": 1.22
    },
    {
      "data": "2025-12-03",
      "preco_fechamento": 58.95,
      "variacao_percentual": 0.53
    },
    {
      "data": "2025-12-02",
      "preco_fechamento": 58.64,
      "variacao_percentual": -1.15
    },
    {
      "data": "2025-12-01",
      "preco_fechamento": 59.32,
      "variacao_percentual": 1.32
    },
    {
      "data": "2025-11-28",
      "preco_fechamento": 58.55,
      "variacao_percentual": -0.76
    },
    {
      "data": "2025-11-27",
      "preco_fechamento": 59.00,
      "variacao_percentual": 0.60
    },
    {
      "data": "2025-11-26",
      "preco_fechamento": 58.65,
      "variacao_percentual": 1.21
    },
    {
      "data": "2025-11-25",
      "preco_fechamento": 57.95,
      "variacao_percentual": -1.51
    },
    {
      "data": "2025-11-24",
      "preco_fechamento": 58.84,
      "variacao_percentual": 1.34
    },
    {
      "data": "2025-11-21",
      "preco_fechamento": 58.06,
      "variacao_percentual": -1.83
    },
    {
      "data": "2025-11-20",
      "preco_fechamento": 59.14,
      "variacao_percentual": -0.50
    },
    {
      "data": "2025-11-19",
      "preco_fechamento": 59.44,
      "variacao_percentual": -2.14
    },
    {
      "data": "2025-11-18",
      "preco_fechamento": 60.74,
      "variacao_percentual": 1.39
    },
    {
      "data": "2025-11-17",
      "preco_fechamento": 59.91,
      "variacao_percentual": -0.07
    },
    {
      "data": "2025-11-14",
      "preco_fechamento": 59.95,
      "variacao_percentual": 2.23
    },
    {
      "data": "2025-11-13",
      "preco_fechamento": 58.64,
      "variacao_percentual": 0.26
    },
    {
      "data": "2025-11-12",
      "preco_fechamento": 58.49,
      "variacao_percentual": -4.10
    },
    {
      "data": "2025-11-11",
      "preco_fechamento": 60.99,
      "variacao_percentual": 1.60
    },
    {
      "data": "2025-11-10",
      "preco_fechamento": 60.03,
      "variacao_percentual": 0.47
    },
    {
      "data": "2025-11-07",
      "preco_fechamento": 59.75,
      "variacao_percentual": 0.54
    },
    {
      "data": "2025-11-06",
      "preco_fechamento": 59.43,
      "variacao_percentual": -0.29
    },
    {
      "data": "2025-11-05",
      "preco_fechamento": 59.60,
      "variacao_percentual": -0.67
    },
    {
      "data": "2025-11-04",
      "preco_fechamento": 60.00,
      "variacao_percentual": 0.84
    },
    {
      "data": "2025-11-01",
      "preco_fechamento": 59.50,
      "variacao_percentual": 0.51
    },
    {
      "data": "2025-10-31",
      "preco_fechamento": 59.20,
      "variacao_percentual": -0.67
    },
    {
      "data": "2025-10-30",
      "preco_fechamento": 59.60,
      "variacao_percentual": -0.67
    },
    {
      "data": "2025-10-29",
      "preco_fechamento": 60.00,
      "variacao_percentual": 0.67
    },
    {
      "data": "2025-10-28",
      "preco_fechamento": 59.60,
      "variacao_percentual": -0.67
    },
    {
      "data": "2025-10-25",
      "preco_fechamento": 60.00,
      "variacao_percentual": 0.67
    },
    {
      "data": "2025-10-24",
      "preco_fechamento": 59.60,
      "variacao_percentual": -0.67
    },
    {
      "data": "2025-10-23",
      "preco_fechamento": 60.00,
      "variacao_percentual": 0.67
    },
    {
      "data": "2025-10-22",
      "preco_fechamento": 59.60,
      "variacao_percentual": -0.67
    },
    {
      "data": "2025-10-21",
      "preco_fechamento": 60.00,
      "variacao_percentual": 0.67
    },
    {
      "data": "2025-10-18",
      "preco_fechamento": 59.60,
      "variacao_percentual": -0.67
    },
    {
      "data": "2025-10-17",
      "preco_fechamento": 60.00,
      "variacao_percentual": 0.67
    },
    {
      "data": "2025-10-16",
      "preco_fechamento": 59.60,
      "variacao_percentual": -0.67
    },
    {
      "data": "2025-10-15",
      "preco_fechamento": 60.00,
      "variacao_percentual": 0.67
    },
    {
      "data": "2025-10-14",
      "preco_fechamento": 59.60,
      "variacao_percentual": -0.67
    },
    {
      "data": "2025-10-11",
      "preco_fechamento": 60.00,
      "variacao_percentual": 0.67
    },
    {
      "data": "2025-10-10",
      "preco_fechamento": 59.60,
      "variacao_percentual": 0.00
    }
  ]
};

// Transformar dados para o formato da tabela oil_prices (foco em WTI)
function transformWTIData() {
  return wtiData.dados_historicos.map(item => {
    const changePercent = item.variacao_percentual;
    const changeString = changePercent >= 0 ? `+${changePercent}%` : `${changePercent}%`;
    
    return {
      date: item.data,
      wti_price: item.preco_fechamento,
      wti_change: changeString,
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
  });
}

// Gerar SQL para inserção (UPDATE para registros existentes do Brent)
function generateSQL() {
  const transformedData = transformWTIData();
  const sqlStatements = [];
  
  sqlStatements.push('-- Atualizar preços do WTI (últimos 3 meses)');
  sqlStatements.push('-- Dados de 10/10/2025 a 09/01/2026');
  sqlStatements.push('-- Usa UPDATE para adicionar campos WTI aos registros existentes do Brent');
  sqlStatements.push('');
  
  transformedData.forEach(item => {
    sqlStatements.push(`UPDATE public.oil_prices SET wti_price = ${item.wti_price}, wti_change = '${item.wti_change}', timestamp = '${item.timestamp}' WHERE date = '${item.date}';`);
  });
  
  return sqlStatements.join('\n');
}

// Gerar JSON transformado
function generateTransformedJSON() {
  return JSON.stringify(transformWTIData(), null, 2);
}

// Exportar para uso
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    transformWTIData,
    generateSQL,
    generateTransformedJSON,
    originalData: wtiData
  };
}

// Para uso no Node.js
if (typeof require !== 'undefined') {
  const fs = require('fs');
  
  // Salvar SQL
  const sqlContent = generateSQL();
  fs.writeFileSync('./wti_prices_update.sql', sqlContent);
  console.log('✅ Arquivo SQL gerado: wti_prices_update.sql');
  
  // Salvar JSON transformado
  const jsonContent = generateTransformedJSON();
  fs.writeFileSync('./wti_prices_transformed.json', jsonContent);
  console.log('✅ Arquivo JSON transformado gerado: wti_prices_transformed.json');
  
  // Mostrar estatísticas
  const transformed = transformWTIData();
  console.log(`📊 Estatísticas WTI:`);
  console.log(`   - Total de registros: ${transformed.length}`);
  console.log(`   - Período: ${transformed[0].date} a ${transformed[transformed.length - 1].date}`);
  console.log(`   - Preço mais alto: $${Math.max(...transformed.map(d => d.wti_price)).toFixed(2)}`);
  console.log(`   - Preço mais baixo: $${Math.min(...transformed.map(d => d.wti_price)).toFixed(2)}`);
}
