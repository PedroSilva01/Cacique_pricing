
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const generatePdf = (reportData) => {
  const doc = new jsPDF();
  const { date, sheetName, selectedFuel, comparisonData, defaultDestination } = reportData;

  doc.setFontSize(20);
  doc.text("Relatório Diário de Custos de Combustível", 14, 22);
  
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Data: ${date}`, 14, 30);
  
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text(`Análise para ${selectedFuel || 'N/A'} com Destino: ${defaultDestination}`, 14, 45);

  const tableColumn = ["#", "Fornecedor", "Preço/L", "Frete/L", "Preço Final/L"];
  const tableRows = [];

  comparisonData.forEach((item, index) => {
    const rowData = [
      index + 1,
      item.name,
      item.currentPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 }),
      item.freight.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 }),
      item.finalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 }),
    ];
    tableRows.push(rowData);
  });

  doc.autoTable({
    head: [tableColumn],
    body: tableRows,
    startY: 50,
    headStyles: { fillColor: [30, 144, 255] }, // Azul vibrante
    styles: { font: 'helvetica', fontSize: 10 },
  });

  let finalY = doc.lastAutoTable.finalY || 50;
  
  const bestOption = comparisonData[0];
  const worstOption = comparisonData[comparisonData.length - 1];
  const savings = (worstOption.finalPrice - bestOption.finalPrice);

  doc.setFontSize(12);
  doc.text("Destaques:", 14, finalY + 15);
  
  doc.setFontSize(10);
  if(bestOption) {
    doc.setTextColor(34, 139, 34); // verde
    doc.text(`Melhor Opção: ${bestOption.name} com custo final de ${bestOption.finalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 })}/L`, 14, finalY + 22);

    if (savings > 0) {
      doc.setTextColor(220, 20, 60); // vermelho
      doc.text(`Economia Potencial: ${savings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 })}/L (vs. pior opção)`, 14, finalY + 29);
    }
  } else {
    doc.setTextColor(100);
    doc.text(`Nenhuma opção de compra encontrada para os filtros selecionados.`, 14, finalY + 22);
  }

  doc.save(`Relatorio_Combustivel_${date.replace(/\//g, '-')}.pdf`);
};
