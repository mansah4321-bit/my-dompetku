import * as XLSX from 'xlsx';

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

/**
 * Format angka rupiah untuk tampilan teks
 */
const formatNumberId = (val: number): string => {
  return new Intl.NumberFormat('id-ID').format(val);
};

/**
 * Ekspor seluruh riwayat transaksi ke format Microsoft Excel (.xlsx)
 * Menggunakan format 2 kolom terpisah (Kolom Pemasukan & Kolom Pengeluaran)
 * sehingga sangat mudah diolah dengan rumus SUM di Excel / Spreadsheet.
 */
export const exportTransactionsToExcel = (
  transactions: ExportTransactionItem[],
  customFileName?: string
): boolean => {
  try {
    if (!transactions || transactions.length === 0) {
      alert('Belum ada data transaksi untuk diekspor.');
      return false;
    }

    // Urutkan transaksi dari tanggal terlama ke terbaru untuk kalkulasi saldo berjalan kronologis yang akurat
    const sorted = [...transactions].sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();
      return dateA - dateB;
    });

    let runningBalance = 0;
    let totalIncome = 0;
    let totalExpense = 0;

    // Siapkan baris data transaksi
    const dataRows = sorted.map((t, idx) => {
      const isIncome = t.type === 'income';
      const incomeAmt = isIncome ? t.amount : 0;
      const expenseAmt = !isIncome ? t.amount : 0;

      if (isIncome) {
        runningBalance += t.amount;
        totalIncome += t.amount;
      } else {
        runningBalance -= t.amount;
        totalExpense += t.amount;
      }

      // Bersihkan tanggal
      let formattedDate = t.date || '';
      try {
        if (formattedDate.includes('T')) {
          formattedDate = formattedDate.split('T')[0];
        }
      } catch {}

      return [
        idx + 1, // No
        formattedDate, // Tanggal
        isIncome ? 'Pemasukan' : 'Pengeluaran', // Tipe
        t.category || 'Lainnya', // Kategori
        t.subCategory || '-', // Sub-Kategori
        t.title || t.description || 'Transaksi', // Keterangan / Judul
        isIncome ? incomeAmt : '', // Pemasukan (Rp) - 2 Kolom Terpisah
        !isIncome ? expenseAmt : '', // Pengeluaran (Rp) - 2 Kolom Terpisah
        runningBalance, // Saldo Berjalan (Rp)
        t.notes || '', // Catatan
      ];
    });

    const todayStr = new Date().toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    // Susun lembar kerja (Array of Arrays)
    const sheetData: (string | number | null)[][] = [
      ['LAPORAN KEUANGAN & RIWAYAT TRANSAKSI - MYDOMPET'],
      [`Tanggal Ekspor: ${todayStr}`, '', '', '', '', '', '', '', '', ''],
      [
        `Ringkasan: Total Pemasukan = Rp ${formatNumberId(totalIncome)} | Total Pengeluaran = Rp ${formatNumberId(totalExpense)} | Saldo Kas Bersih = Rp ${formatNumberId(totalIncome - totalExpense)}`,
      ],
      [], // Baris kosong pembatas
      [
        'No',
        'Tanggal',
        'Tipe',
        'Kategori',
        'Sub-Kategori',
        'Keterangan / Judul',
        'Pemasukan (Rp)',
        'Pengeluaran (Rp)',
        'Saldo Berjalan (Rp)',
        'Catatan',
      ],
      ...dataRows,
      [], // Baris kosong
      [
        'TOTAL KESELURUHAN',
        '',
        '',
        '',
        '',
        '',
        totalIncome,
        totalExpense,
        totalIncome - totalExpense,
        '',
      ],
    ];

    // Buat worksheet dan workbook
    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Atur lebar kolom (Auto column widths agar rapi dan tidak terpotong di Excel)
    ws['!cols'] = [
      { wch: 6 }, // No
      { wch: 14 }, // Tanggal
      { wch: 14 }, // Tipe
      { wch: 18 }, // Kategori
      { wch: 20 }, // Sub-Kategori
      { wch: 32 }, // Keterangan / Judul
      { wch: 18 }, // Pemasukan (Rp)
      { wch: 18 }, // Pengeluaran (Rp)
      { wch: 20 }, // Saldo Berjalan (Rp)
      { wch: 28 }, // Catatan
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Riwayat Transaksi');

    // Buat nama file yang deskriptif
    const dateFileStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const fileName = customFileName || `MyDompet_Laporan_Transaksi_${dateFileStr}.xlsx`;

    // Download file .xlsx
    XLSX.writeFile(wb, fileName);
    return true;
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    alert('Gagal mengekspor file Excel. Silakan coba lagi.');
    return false;
  }
};
