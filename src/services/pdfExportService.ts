import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ExportTransactionItem {
  id: string;
  type: 'income' | 'expense';
  title: string;
  description?: string;
  category: string;
  subCategory?: string;
  amount: number;
  date: string;
  notes?: string;
}

const formatNumberId = (val: number): string => {
  return new Intl.NumberFormat('id-ID').format(val);
};

/**
 * Ekspor seluruh riwayat transaksi ke format PDF document
 */
export const exportTransactionsToPdf = (
  transactions: ExportTransactionItem[],
  customFileName?: string
): boolean => {
  try {
    if (!transactions || transactions.length === 0) {
      alert('Belum ada data transaksi untuk diekspor.');
      return false;
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Urutkan transaksi kronologis (dari terlama ke terbaru)
    const sorted = [...transactions].sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();
      return dateA - dateB;
    });

    let runningBalance = 0;
    let totalIncome = 0;
    let totalExpense = 0;

    const tableRows = sorted.map((t, idx) => {
      const isIncome = t.type === 'income';
      if (isIncome) {
        runningBalance += t.amount;
        totalIncome += t.amount;
      } else {
        runningBalance -= t.amount;
        totalExpense += t.amount;
      }

      let formattedDate = t.date || '';
      try {
        if (formattedDate.includes('T')) {
          formattedDate = formattedDate.split('T')[0];
        }
      } catch {}

      return [
        (idx + 1).toString(),
        formattedDate,
        isIncome ? 'Pemasukan' : 'Pengeluaran',
        t.category || 'Lainnya',
        t.title || t.description || 'Transaksi',
        isIncome ? `+Rp ${formatNumberId(t.amount)}` : '-',
        !isIncome ? `-Rp ${formatNumberId(t.amount)}` : '-',
        `Rp ${formatNumberId(runningBalance)}`,
      ];
    });

    // Header Banner
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 210, 26, 'F');

    doc.setTextColor(223, 183, 108); // Gold color (#DFB76C)
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text('MYDOMPET - LAPORAN TRANSAKSI KEUANGAN', 14, 12);

    doc.setTextColor(203, 213, 225);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    const todayStr = new Date().toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    doc.text(`Tanggal Cetak: ${todayStr}`, 14, 20);

    // Ringkasan Card Box
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 30, 182, 18, 2, 2, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 30, 182, 18, 2, 2, 'D');

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('TOTAL PEMASUKAN', 20, 36);
    doc.text('TOTAL PENGELUARAN', 80, 36);
    doc.text('SALDO NETO', 140, 36);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129); // emerald-500
    doc.text(`Rp ${formatNumberId(totalIncome)}`, 20, 43);

    doc.setTextColor(239, 68, 68); // red-500
    doc.text(`Rp ${formatNumberId(totalExpense)}`, 80, 43);

    const net = totalIncome - totalExpense;
    if (net >= 0) {
      doc.setTextColor(16, 185, 129);
    } else {
      doc.setTextColor(239, 68, 68);
    }
    doc.text(`Rp ${formatNumberId(net)}`, 140, 43);

    // Tabel Transaksi AutoTable
    autoTable(doc, {
      startY: 52,
      head: [
        [
          'No',
          'Tanggal',
          'Tipe',
          'Kategori',
          'Keterangan',
          'Pemasukan',
          'Pengeluaran',
          'Saldo',
        ],
      ],
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'center',
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: [51, 65, 85],
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'center', cellWidth: 22 },
        2: { halign: 'center', cellWidth: 22 },
        3: { cellWidth: 26 },
        4: { cellWidth: 42 },
        5: { halign: 'right', cellWidth: 20 },
        6: { halign: 'right', cellWidth: 20 },
        7: { halign: 'right', cellWidth: 20 },
      },
      foot: [
        [
          'TOTAL',
          '',
          '',
          '',
          '',
          `Rp ${formatNumberId(totalIncome)}`,
          `Rp ${formatNumberId(totalExpense)}`,
          `Rp ${formatNumberId(net)}`,
        ],
      ],
      footStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontSize: 8,
        fontStyle: 'bold',
      },
    });

    const dateFileStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const fileName = customFileName || `MyDompet_Laporan_Transaksi_${dateFileStr}.pdf`;

    doc.save(fileName);
    return true;
  } catch (error) {
    console.error('Error exporting to PDF:', error);
    alert('Gagal mengekspor file PDF. Silakan coba lagi.');
    return false;
  }
};
