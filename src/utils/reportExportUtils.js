/**
 * Report Export & Import Utilities for Make System DME Dashboard
 * Supports Excel (.xls XML Spreadsheet / CSV), PDF printing, and file parsing
 */

/**
 * Generates an Excel-compatible XML Spreadsheet 2003 with multiple formatted sheets,
 * custom styles, bold headers, and colored KPI cells.
 */
export function exportDmeReportToExcel(data, filename = 'DME_Performance_Report') {
  const { summary, systemBreakdown, companyBreakdown, records } = data;
  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const escapeXml = (val) => {
    if (val === null || val === undefined) return '';
    return String(val)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#1E293B"/>
  </Style>
  <Style ss:ID="Title">
   <Font ss:FontName="Calibri" ss:Size="16" ss:Bold="1" ss:Color="#1E1B4B"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="SubTitle">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Italic="1" ss:Color="#64748B"/>
  </Style>
  <Style ss:ID="Header">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#3B82F6" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1D4ED8"/>
   </Borders>
  </Style>
  <Style ss:ID="HeaderDark">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="KPI_OnTime">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#065F46"/>
   <Interior ss:Color="#D1FAE5" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="KPI_Delayed">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#991B1B"/>
   <Interior ss:Color="#FFE4E6" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="KPI_InProcess">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#1E40AF"/>
   <Interior ss:Color="#DBEAFE" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="RowEven">
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="RowOdd">
   <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Bold">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
  </Style>
 </Styles>

 <!-- Sheet 1: Executive DME Summary -->
 <Worksheet ss:Name="DME Scorecard">
  <Table ss:DefaultColumnWidth="120">
   <Column ss:Width="180"/>
   <Column ss:Width="100"/>
   <Column ss:Width="100"/>
   <Column ss:Width="100"/>
   <Column ss:Width="110"/>
   <Column ss:Width="110"/>
   <Column ss:Width="110"/>

   <Row ss:Height="26">
    <Cell ss:MergeAcross="6" ss:StyleID="Title"><Data ss:Type="String">DME ON-TIME COMPLETION &amp; SYSTEM PERFORMANCE REPORT</Data></Cell>
   </Row>
   <Row ss:Height="18">
    <Cell ss:MergeAcross="6" ss:StyleID="SubTitle"><Data ss:Type="String">Generated on: ${escapeXml(now)} | Make System Consolidated Executive Analytics</Data></Cell>
   </Row>
   <Row ss:Height="12"/>

   <!-- High Level KPI Totals -->
   <Row ss:Height="22">
    <Cell ss:MergeAcross="6" ss:StyleID="HeaderDark"><Data ss:Type="String">EXECUTIVE SUMMARY METRICS</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:StyleID="Bold"><Data ss:Type="String">Total Requests / Tickets</Data></Cell>
    <Cell><Data ss:Type="Number">${summary.total}</Data></Cell>
    <Cell ss:StyleID="Bold"><Data ss:Type="String">Overall On-Time Rate</Data></Cell>
    <Cell ss:StyleID="KPI_OnTime"><Data ss:Type="String">${summary.onTimeRate}%</Data></Cell>
    <Cell ss:StyleID="Bold"><Data ss:Type="String">Total Completed</Data></Cell>
    <Cell><Data ss:Type="Number">${summary.completed}</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:StyleID="Bold"><Data ss:Type="String">Total Pending</Data></Cell>
    <Cell><Data ss:Type="Number">${summary.pending}</Data></Cell>
    <Cell ss:StyleID="Bold"><Data ss:Type="String">Total In Process</Data></Cell>
    <Cell ss:StyleID="KPI_InProcess"><Data ss:Type="Number">${summary.inProcess}</Data></Cell>
    <Cell ss:StyleID="Bold"><Data ss:Type="String">On-Time / Delayed</Data></Cell>
    <Cell><Data ss:Type="String">${summary.onTimeCompleted} On-Time / ${summary.delayedCompleted} Delayed</Data></Cell>
   </Row>
   <Row ss:Height="16"/>

   <!-- System-Wise Breakdown -->
   <Row ss:Height="22">
    <Cell ss:MergeAcross="6" ss:StyleID="Header"><Data ss:Type="String">SYSTEM-WISE PERFORMANCE BREAKDOWN</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:StyleID="HeaderDark"><Data ss:Type="String">System Name</Data></Cell>
    <Cell ss:StyleID="HeaderDark"><Data ss:Type="String">Total</Data></Cell>
    <Cell ss:StyleID="HeaderDark"><Data ss:Type="String">Pending</Data></Cell>
    <Cell ss:StyleID="HeaderDark"><Data ss:Type="String">In Process</Data></Cell>
    <Cell ss:StyleID="HeaderDark"><Data ss:Type="String">Completed</Data></Cell>
    <Cell ss:StyleID="HeaderDark"><Data ss:Type="String">On-Time</Data></Cell>
    <Cell ss:StyleID="HeaderDark"><Data ss:Type="String">On-Time %</Data></Cell>
   </Row>
   ${systemBreakdown
     .map(
       (s, i) => `
   <Row ss:Height="20">
    <Cell ss:StyleID="${i % 2 === 0 ? 'RowEven' : 'RowOdd'}"><Data ss:Type="String">${escapeXml(s.name)}</Data></Cell>
    <Cell ss:StyleID="${i % 2 === 0 ? 'RowEven' : 'RowOdd'}"><Data ss:Type="Number">${s.total}</Data></Cell>
    <Cell ss:StyleID="${i % 2 === 0 ? 'RowEven' : 'RowOdd'}"><Data ss:Type="Number">${s.pending}</Data></Cell>
    <Cell ss:StyleID="${i % 2 === 0 ? 'RowEven' : 'RowOdd'}"><Data ss:Type="Number">${s.inProcess}</Data></Cell>
    <Cell ss:StyleID="${i % 2 === 0 ? 'RowEven' : 'RowOdd'}"><Data ss:Type="Number">${s.completed}</Data></Cell>
    <Cell ss:StyleID="${i % 2 === 0 ? 'RowEven' : 'RowOdd'}"><Data ss:Type="Number">${s.onTime}</Data></Cell>
    <Cell ss:StyleID="KPI_OnTime"><Data ss:Type="String">${s.onTimeRate}%</Data></Cell>
   </Row>`
     )
     .join('')}
   <Row ss:Height="16"/>

   <!-- Company Breakdown -->
   <Row ss:Height="22">
    <Cell ss:MergeAcross="6" ss:StyleID="Header"><Data ss:Type="String">COMPANY-WISE ON-TIME PERFORMANCE</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:StyleID="HeaderDark"><Data ss:Type="String">Company</Data></Cell>
    <Cell ss:StyleID="HeaderDark"><Data ss:Type="String">Total Requests</Data></Cell>
    <Cell ss:StyleID="HeaderDark"><Data ss:Type="String">Pending</Data></Cell>
    <Cell ss:StyleID="HeaderDark"><Data ss:Type="String">In Process</Data></Cell>
    <Cell ss:StyleID="HeaderDark"><Data ss:Type="String">Completed</Data></Cell>
    <Cell ss:StyleID="HeaderDark"><Data ss:Type="String">On-Time</Data></Cell>
    <Cell ss:StyleID="HeaderDark"><Data ss:Type="String">On-Time %</Data></Cell>
   </Row>
   ${companyBreakdown
     .map(
       (c, i) => `
   <Row ss:Height="20">
    <Cell ss:StyleID="${i % 2 === 0 ? 'RowEven' : 'RowOdd'}"><Data ss:Type="String">${escapeXml(c.company)}</Data></Cell>
    <Cell ss:StyleID="${i % 2 === 0 ? 'RowEven' : 'RowOdd'}"><Data ss:Type="Number">${c.total}</Data></Cell>
    <Cell ss:StyleID="${i % 2 === 0 ? 'RowEven' : 'RowOdd'}"><Data ss:Type="Number">${c.pending}</Data></Cell>
    <Cell ss:StyleID="${i % 2 === 0 ? 'RowEven' : 'RowOdd'}"><Data ss:Type="Number">${c.inProcess}</Data></Cell>
    <Cell ss:StyleID="${i % 2 === 0 ? 'RowEven' : 'RowOdd'}"><Data ss:Type="Number">${c.completed}</Data></Cell>
    <Cell ss:StyleID="${i % 2 === 0 ? 'RowEven' : 'RowOdd'}"><Data ss:Type="Number">${c.onTime}</Data></Cell>
    <Cell ss:StyleID="KPI_OnTime"><Data ss:Type="String">${c.onTimeRate}%</Data></Cell>
   </Row>`
     )
     .join('')}
  </Table>
 </Worksheet>

 <!-- Sheet 2: Detailed Consolidated Records -->
 <Worksheet ss:Name="Consolidated Records">
  <Table ss:DefaultColumnWidth="120">
   <Column ss:Width="100"/>
   <Column ss:Width="90"/>
   <Column ss:Width="100"/>
   <Column ss:Width="180"/>
   <Column ss:Width="130"/>
   <Column ss:Width="130"/>
   <Column ss:Width="100"/>
   <Column ss:Width="110"/>
   <Column ss:Width="110"/>
   <Column ss:Width="110"/>
   <Column ss:Width="90"/>

   <Row ss:Height="22">
    <Cell ss:StyleID="Header"><Data ss:Type="String">System</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Identifier</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Company</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Title / Subject</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Requester</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Assigned To</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Status</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Planned Target</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Actual Date</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">On-Time Performance</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Delay</Data></Cell>
   </Row>
   ${records
     .map(
       (r, i) => `
   <Row ss:Height="20">
    <Cell ss:StyleID="${i % 2 === 0 ? 'RowEven' : 'RowOdd'}"><Data ss:Type="String">${escapeXml(r.system)}</Data></Cell>
    <Cell ss:StyleID="${i % 2 === 0 ? 'RowEven' : 'RowOdd'}"><Data ss:Type="String">${escapeXml(r.id)}</Data></Cell>
    <Cell ss:StyleID="${i % 2 === 0 ? 'RowEven' : 'RowOdd'}"><Data ss:Type="String">${escapeXml(r.company)}</Data></Cell>
    <Cell ss:StyleID="${i % 2 === 0 ? 'RowEven' : 'RowOdd'}"><Data ss:Type="String">${escapeXml(r.title)}</Data></Cell>
    <Cell ss:StyleID="${i % 2 === 0 ? 'RowEven' : 'RowOdd'}"><Data ss:Type="String">${escapeXml(r.requester)}</Data></Cell>
    <Cell ss:StyleID="${i % 2 === 0 ? 'RowEven' : 'RowOdd'}"><Data ss:Type="String">${escapeXml(r.assignedTo || 'Unassigned')}</Data></Cell>
    <Cell ss:StyleID="${i % 2 === 0 ? 'RowEven' : 'RowOdd'}"><Data ss:Type="String">${escapeXml(r.status)}</Data></Cell>
    <Cell ss:StyleID="${i % 2 === 0 ? 'RowEven' : 'RowOdd'}"><Data ss:Type="String">${escapeXml(r.plannedDate || '—')}</Data></Cell>
    <Cell ss:StyleID="${i % 2 === 0 ? 'RowEven' : 'RowOdd'}"><Data ss:Type="String">${escapeXml(r.actualDate || '—')}</Data></Cell>
    <Cell ss:StyleID="${
      r.onTimeStatus === 'On-Time'
        ? 'KPI_OnTime'
        : r.onTimeStatus === 'Delayed'
        ? 'KPI_Delayed'
        : 'KPI_InProcess'
    }"><Data ss:Type="String">${escapeXml(r.onTimeStatus)}</Data></Cell>
    <Cell ss:StyleID="${i % 2 === 0 ? 'RowEven' : 'RowOdd'}"><Data ss:Type="String">${escapeXml(r.delay || '0')}</Data></Cell>
   </Row>`
     )
     .join('')}
  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports data as a standardized CSV file with UTF-8 BOM
 */
export function exportDmeReportToCsv(records, filename = 'DME_Consolidated_Records') {
  const headers = [
    'System',
    'Identifier',
    'Company',
    'Title / Subject',
    'Requester',
    'Assigned To',
    'Status',
    'Planned Date',
    'Actual Date',
    'On-Time Performance',
    'Delay'
  ];

  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = records.map(r => [
    escapeCsv(r.system),
    escapeCsv(r.id),
    escapeCsv(r.company),
    escapeCsv(r.title),
    escapeCsv(r.requester),
    escapeCsv(r.assignedTo || 'Unassigned'),
    escapeCsv(r.status),
    escapeCsv(r.plannedDate || '—'),
    escapeCsv(r.actualDate || '—'),
    escapeCsv(r.onTimeStatus),
    escapeCsv(r.delay || '0')
  ].join(','));

  const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Triggers clean PDF print view of the report
 */
export function printDmeReport() {
  window.print();
}

/**
 * Reads and parses an uploaded CSV or text file
 */
export async function parseImportFile(file) {
  if (!file) throw new Error('No file provided.');

  const text = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsText(file);
  });

  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (!lines.length) throw new Error('File is empty.');

  // Auto-detect delimiter (comma or tab)
  const firstLine = lines[0];
  const delimiter = firstLine.includes('\t') ? '\t' : ',';

  const parseLine = (line) => {
    const result = [];
    let insideQuotes = false;
    let token = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (insideQuotes && line[i + 1] === '"') {
          token += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === delimiter && !insideQuotes) {
        result.push(token.trim());
        token = '';
      } else {
        token += char;
      }
    }
    result.push(token.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine).filter(row => row.some(cell => Boolean(cell)));

  return {
    fileName: file.name,
    fileSize: file.size,
    headers,
    rows,
    count: rows.length
  };
}
