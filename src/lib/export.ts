import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { COLUNAS_RELATORIO } from '@/pedidos/relatorio';

/** Gera e baixa um .xlsx com cabeçalho + linhas. */
export function exportarExcel(linhas: string[][], arquivo: string): void {
  const ws = XLSX.utils.aoa_to_sheet([[...COLUNAS_RELATORIO], ...linhas]);
  ws['!cols'] = COLUNAS_RELATORIO.map(() => ({ wch: 22 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pedidos');
  XLSX.writeFile(wb, arquivo);
}

/** Gera e baixa um PDF gerencial (título + data + tabela). */
export function exportarPdf(linhas: string[][], arquivo: string, titulo: string): void {
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
