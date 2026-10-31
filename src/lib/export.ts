import { COLUNAS_RELATORIO } from '@/pedidos/relatorio';

// xlsx e jspdf somam quase 1 MB minificado; sao importados so no clique de
// exportar, para nao pesar no carregamento de nenhuma tela.

/** Gera e baixa um .xlsx com cabeçalho + linhas. */
export async function exportarExcel(linhas: string[][], arquivo: string): Promise<void> {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet([[...COLUNAS_RELATORIO], ...linhas]);
  ws['!cols'] = COLUNAS_RELATORIO.map(() => ({ wch: 22 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pedidos');
  XLSX.writeFile(wb, arquivo);
}

/** Gera e baixa um PDF gerencial (título + data + tabela). */
export async function exportarPdf(linhas: string[][], arquivo: string, titulo: string): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(14);
  doc.text(titulo, 14, 16);
  doc.setFontSize(9);
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')} · ${linhas.length} pedido(s)`, 14, 22);
  autoTable(doc, {
    head: [[...COLUNAS_RELATORIO]],
    body: linhas,
    startY: 28,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [15, 23, 42] },
  });
  doc.save(arquivo);
}
