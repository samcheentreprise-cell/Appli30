import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface PdfLotAnchor {
  id: string;
  fournisseur: string;
  race: string;
  type: string;
  cartons: number;
  dateIncub: Date | null;
  dateMirage: Date | null;
  dateEclo: Date | null;
  statut: string;
}

export interface PdfPlannedOrderRow {
  rowKey: string;
  orderIndex: number;
  sourceLotId: string | null;
  sourceLotStatut?: string;
  sourceCartons?: number;
  rotationNum: number;
  origineLabel: string;
  dateCommande: Date;
  dateReception: Date;
  dateIncubation: Date;
  dateMirage: Date;
  dateEclosion: Date;
  joursAvantCommande: number;
  urgence: 'retard' | 'urgent' | 'proche' | 'planifie';
  cartons: number;
  oeufs: number;
  poussinsEstimes: number;
  fournisseur: string;
  race: string;
}

export interface PdfPlanningSummary {
  firstCmd: PdfPlannedOrderRow | null;
  earliestIncub: PdfPlannedOrderRow | null;
  totalCartons: number;
  totalOeufs: number;
  totalPoussins: number;
  urgentCount: number;
  byFournisseur: Array<{ name: string; cartons: number; oeufs: number; commandes: number }>;
  cadenceJours: number;
}

export interface PdfTimelineData {
  minDate: Date;
  maxDate: Date;
  totalDays: number;
  todayPct: number | null;
  mode: 'global' | 'single' | 'unique';
  lanes?: Array<{ lot: PdfLotAnchor; cycles: PdfPlannedOrderRow[] }>;
  transitionLots?: PdfLotAnchor[];
  showAnchorLot?: boolean;
}

export interface ExportPlanningPdfParams {
  planningScope: 'global' | 'single' | 'unique';
  today: Date;
  delaiCommandeJours: number;
  battementApresMirage: number;
  tauxEclosionPct: number;
  minCartonsLot: number;
  cartonsUnique: number;
  selectedGlobalLots: PdfLotAnchor[];
  activeAnchorObj: PdfLotAnchor | null;
  anchorMode: 'lot' | 'custom';
  rows: PdfPlannedOrderRow[];
  summary: PdfPlanningSummary;
  timelineData: PdfTimelineData | null;
}

// Normalisation pour la police standard Helvetica (WinAnsi) de jsPDF
const pdfText = (input: string): string =>
  String(input || '')
    .replace(/\u202F|\u00A0/g, ' ')
    .replace(/\u0153/g, 'oe')
    .replace(/\u0152/g, 'OE')
    .replace(/\u2192/g, '->')
    .replace(/\u2019|\u2018/g, "'")
    .replace(/\u2013|\u2014/g, '-');

const formatPdfInt = (n: number): string =>
  pdfText(Math.round(n).toLocaleString('fr-FR'));

const formatFr = (d: Date): string => {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatShortFr = (d: Date): string => {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
};

const toIsoInput = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const diffDays = (target: Date, base: Date): number => {
  const t = new Date(target);
  t.setHours(0, 0, 0, 0);
  const b = new Date(base);
  b.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
};

const getUrgencyText = (r: PdfPlannedOrderRow): string => {
  if (r.joursAvantCommande < 0) return `Retard ${Math.abs(r.joursAvantCommande)} j`;
  if (r.joursAvantCommande === 0) return "Aujourd'hui";
  if (r.joursAvantCommande <= 3) return `Urgent (${r.joursAvantCommande} j)`;
  if (r.joursAvantCommande <= 10) return `A prevoir (${r.joursAvantCommande} j)`;
  return `Dans ${r.joursAvantCommande} j`;
};

export function downloadPlanningPdf(params: ExportPlanningPdfParams): void {
  const {
    planningScope,
    today,
    delaiCommandeJours,
    battementApresMirage,
    tauxEclosionPct,
    minCartonsLot,
    cartonsUnique,
    selectedGlobalLots,
    activeAnchorObj,
    anchorMode,
    rows,
    summary,
    timelineData,
  } = params;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210mm
  const margin = 12;
  const contentWidth = pageWidth - margin * 2; // 273mm

  // ── En-tête document ────────────────────────────────────────────────────────
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(margin, 10, contentWidth, 16, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(
    pdfText("COUVOIR SAMCHE - Planning d'Incubation & Approvisionnement en Oeufs"),
    margin + 4,
    17
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225); // slate-300
  const modeLabel =
    planningScope === 'unique'
      ? `Chargement unique (${cartonsUnique} cartons/lot - incubateur complet)`
      : planningScope === 'global'
        ? `Rechargement multiple · Vision globale (${selectedGlobalLots.length} lot${selectedGlobalLots.length > 1 ? 's' : ''})`
        : anchorMode === 'lot' && activeAnchorObj
          ? `Rechargement multiple · Cycle 1 depuis ${activeAnchorObj.id}`
          : 'Rechargement multiple · Cycle 1 (date personnalisee)';

  const volumeRuleText =
    planningScope === 'unique'
      ? `Chargement : ${cartonsUnique} cartons/lot`
      : `Min. ${minCartonsLot} cartons/lot`;

  doc.text(
    pdfText(
      `${modeLabel}  |  Delai cde : J-${delaiCommandeJours}  |  Reprise apres mirage : J+${battementApresMirage}  |  Taux eclosion : ${tauxEclosionPct}%  |  ${volumeRuleText}`
    ),
    margin + 4,
    22.5
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(251, 191, 36); // amber-400
  doc.text(pdfText(`Edite le ${formatFr(today)}`), pageWidth - margin - 4, 17, {
    align: 'right',
  });

  // ── 4 Cartes KPI ────────────────────────────────────────────────────────────
  const kpiY = 30;
  const kpiGap = 3.5;
  const kpiW = (contentWidth - kpiGap * 3) / 4;
  const kpiH = 16;

  const kpiCards = [
    {
      label: "PROCHAINE COMMANDE D'OEUFS",
      value: summary.firstCmd ? formatFr(summary.firstCmd.dateCommande) : '--',
      sub: summary.firstCmd
        ? pdfText(
            `${getUrgencyText(summary.firstCmd)}${
              planningScope === 'unique'
                ? ` · ${summary.firstCmd.cartons} ctn (lot complet)`
                : summary.firstCmd.sourceLotId
                  ? ` · releve ${summary.firstCmd.sourceLotId}`
                  : ''
            }`
          )
        : '--',
    },
    {
      label: 'PROCHAINE MISE EN INCUBATION',
      value: summary.earliestIncub ? formatFr(summary.earliestIncub.dateIncubation) : '--',
      sub: summary.earliestIncub ? pdfText(summary.earliestIncub.origineLabel) : '--',
    },
    {
      label: `VOLUME A COMMANDER (${rows.length} CDE${rows.length > 1 ? 'S' : ''})`,
      value: `${formatPdfInt(summary.totalCartons)} cartons`,
      sub: pdfText(`${formatPdfInt(summary.totalOeufs)} oeufs`),
    },
    {
      label: 'PRODUCTION PREVISIONNELLE',
      value: `${formatPdfInt(summary.totalPoussins)} poussins`,
      sub: pdfText(`Base ${tauxEclosionPct}% · cadence ${summary.cadenceJours} j/cycle`),
    },
  ];

  kpiCards.forEach((card, i) => {
    const x = margin + i * (kpiW + kpiGap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, kpiY, kpiW, kpiH, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(pdfText(card.label), x + 3, kpiY + 4.5);

    doc.setFontSize(11);
    doc.setTextColor(i === 3 ? 4 : 15, i === 3 ? 120 : 23, i === 3 ? 87 : 42);
    doc.text(pdfText(card.value), x + 3, kpiY + 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    const subLines = doc.splitTextToSize(card.sub, kpiW - 6);
    doc.text(subLines[0] || '', x + 3, kpiY + 14);
  });

  // ── Tableau principal : Calendrier prévisionnel d'approvisionnement ─────────
  const tableTitleY = kpiY + kpiH + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(
    pdfText(
      planningScope === 'unique'
        ? `Calendrier previsionnel — Chargement unique (${cartonsUnique} cartons / lot complet)`
        : planningScope === 'global'
          ? `Calendrier previsionnel d'approvisionnement (${selectedGlobalLots.length} lots en cours)`
          : 'Calendrier previsionnel des mises en incubation & commandes'
    ),
    margin,
    tableTitleY
  );

  const tableBody = rows.map((r) => {
    const lotCol =
      planningScope === 'unique'
        ? `Cycle unique #${r.rotationNum}\n${r.cartons} ctn (${r.race})`
        : planningScope === 'global'
          ? `Cmd #${r.orderIndex} - ${r.sourceLotId}\nReleve #${r.rotationNum} (${r.race})`
          : `Cycle ${r.rotationNum}\n${r.race} - ${r.fournisseur}`;

    const originCol =
      planningScope === 'global' && r.rotationNum === 1 && r.sourceLotStatut
        ? `${r.origineLabel}\nStatut : ${r.sourceLotStatut}`
        : r.origineLabel;

    const volCol =
      planningScope !== 'unique' &&
      r.sourceCartons !== undefined &&
      r.sourceCartons > 0 &&
      r.sourceCartons < minCartonsLot
        ? `${formatPdfInt(r.cartons)} ctn (${formatPdfInt(r.oeufs)} oeufs)\n~${formatPdfInt(r.poussinsEstimes)} poussins\n[Source ${r.sourceCartons} -> min ${minCartonsLot} ctn]`
        : `${formatPdfInt(r.cartons)} ctn (${formatPdfInt(r.oeufs)} oeufs)\n~${formatPdfInt(r.poussinsEstimes)} poussins`;

    return [
      pdfText(lotCol),
      pdfText(originCol),
      pdfText(formatFr(r.dateCommande)),
      pdfText(getUrgencyText(r)),
      pdfText(formatFr(r.dateReception)),
      pdfText(formatFr(r.dateIncubation)),
      pdfText(formatFr(r.dateMirage)),
      pdfText(formatFr(r.dateEclosion)),
      pdfText(`${r.fournisseur}\n${volCol}`),
    ];
  });

  autoTable(doc, {
    startY: tableTitleY + 2.5,
    margin: { left: margin, right: margin },
    head: [[
      pdfText(
        planningScope === 'unique'
          ? 'Cycle complet'
          : planningScope === 'global'
            ? 'Ordre / Lot'
            : 'Cycle'
      ),
      pdfText('Declencheur (Liberation)'),
      pdfText(`Commande (J-${delaiCommandeJours})`),
      pdfText('Priorite'),
      pdfText('Reception (J-1)'),
      pdfText('Incubation (J0)'),
      pdfText('Mirage (J+18)'),
      pdfText('Eclosion (J+21)'),
      pdfText('Fournisseur & Volume'),
    ]],
    body: tableBody,
    theme: 'grid',
    showHead: 'everyPage',
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 34, fontStyle: 'bold' },
      1: { cellWidth: 48 },
      2: { cellWidth: 23, fontStyle: 'bold', halign: 'center' },
      3: { cellWidth: 25, halign: 'center' },
      4: { cellWidth: 22, halign: 'center' },
      5: { cellWidth: 23, fontStyle: 'bold', halign: 'center', textColor: [7, 89, 133] },
      6: { cellWidth: 22, halign: 'center', textColor: [146, 64, 14] },
      7: { cellWidth: 22, halign: 'center', textColor: [4, 120, 87] },
      8: { cellWidth: 54, halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 3) {
        const rowObj = rows[data.row.index];
        if (!rowObj) return;
        if (rowObj.urgence === 'retard') {
          data.cell.styles.textColor = [190, 18, 60];
          data.cell.styles.fontStyle = 'bold';
        } else if (rowObj.urgence === 'urgent') {
          data.cell.styles.textColor = [180, 83, 9];
          data.cell.styles.fontStyle = 'bold';
        } else if (rowObj.urgence === 'proche') {
          data.cell.styles.textColor = [180, 83, 9];
        } else {
          data.cell.styles.textColor = [4, 120, 87];
        }
      }
    },
  });

  let cursorY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? tableTitleY + 40) + 4;

  // ── Répartition par fournisseur ─────────────────────────────────────────────
  if (summary.byFournisseur.length > 0) {
    if (cursorY > pageHeight - 25) {
      doc.addPage();
      cursorY = 16;
    }
    const supplierSummaryText = summary.byFournisseur
      .map(
        (f) =>
          `${f.name} : ${f.commandes} cde${f.commandes > 1 ? 's' : ''} - ${formatPdfInt(f.cartons)} cartons (${formatPdfInt(f.oeufs)} oeufs)`
      )
      .join('   |   ');

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, cursorY, contentWidth, 8.5, 1.2, 1.2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text(pdfText('Repartition par fournisseur :'), margin + 3, cursorY + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    const wrappedSup = doc.splitTextToSize(pdfText(supplierSummaryText), contentWidth - 48);
    doc.text(wrappedSup[0] || '', margin + 45, cursorY + 5.5);
    cursorY += 13;
  }

  // ── Chronogramme vectoriel d'occupation des machines ────────────────────────
  if (timelineData) {
    const laneCount =
      timelineData.mode === 'global'
        ? timelineData.lanes?.length || 0
        : timelineData.mode === 'unique'
          ? (timelineData.transitionLots?.length || 0) + (timelineData.showAnchorLot ? 1 : 0) + rows.length
          : (timelineData.showAnchorLot ? 1 : 0) + rows.length;

    const neededHeight = 16 + laneCount * 9.5;
    if (cursorY + Math.min(neededHeight, 60) > pageHeight - 14) {
      doc.addPage();
      cursorY = 16;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(
      pdfText(
        `Chronogramme d'occupation des machines (${formatFr(timelineData.minDate)} -> ${formatFr(timelineData.maxDate)} · ${timelineData.totalDays} j)`
      ),
      margin,
      cursorY
    );

    const legX = pageWidth - margin;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setFillColor(2, 132, 199);
    doc.rect(legX - 78, cursorY - 2.7, 3.2, 2.5, 'F');
    doc.setTextColor(71, 85, 105);
    doc.text(pdfText('Incubateur (J0-J18)'), legX - 73.5, cursorY - 0.3);

    doc.setFillColor(5, 150, 105);
    doc.rect(legX - 42, cursorY - 2.7, 3.2, 2.5, 'F');
    doc.text(pdfText('Eclosoir (J18-J21)'), legX - 37.5, cursorY - 0.3);

    if (timelineData.todayPct !== null) {
      doc.setFillColor(244, 63, 94);
      doc.rect(legX - 10, cursorY - 3, 0.7, 3.2, 'F');
      doc.text(pdfText("Auj."), legX - 8, cursorY - 0.3);
    }

    cursorY += 4.5;

    const labelColW = 56;
    const trackX = margin + labelColW;
    const trackW = contentWidth - labelColW;

    const drawTodayMarker = (y: number, h: number) => {
      if (timelineData.todayPct === null) return;
      const tx = trackX + (timelineData.todayPct / 100) * trackW;
      doc.setDrawColor(244, 63, 94);
      doc.setLineWidth(0.4);
      doc.line(tx, y, tx, y + h);
    };

    const drawBar = (start: Date, mirage: Date, eclo: Date, y: number, barLabel: string, isCurrentLot = false) => {
      const startOff = Math.max(0, diffDays(start, timelineData.minDate));
      const mirOff = diffDays(mirage, timelineData.minDate);
      const ecloOff = diffDays(eclo, timelineData.minDate);

      const x = trackX + (startOff / timelineData.totalDays) * trackW;
      const wIncub = Math.max(3, ((mirOff - startOff) / timelineData.totalDays) * trackW);
      const hx = trackX + (mirOff / timelineData.totalDays) * trackW;
      const wHatch = Math.max(2, ((ecloOff - mirOff) / timelineData.totalDays) * trackW);

      doc.setFillColor(isCurrentLot ? 56 : 3, isCurrentLot ? 189 : 105, isCurrentLot ? 248 : 161);
      doc.rect(x, y + 0.8, wIncub, 3.6, 'F');

      if (wIncub > 13) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.8);
        doc.setTextColor(255, 255, 255);
        doc.text(pdfText(barLabel), x + 1, y + 3.4, { maxWidth: wIncub - 2 });
      }

      doc.setFillColor(isCurrentLot ? 52 : 5, isCurrentLot ? 211 : 150, isCurrentLot ? 153 : 105);
      doc.rect(hx, y + 4.8, wHatch, 2.3, 'F');
    };

    if (timelineData.mode === 'global' && timelineData.lanes) {
      timelineData.lanes.forEach(({ lot, cycles }) => {
        if (cursorY + 9 > pageHeight - 14) {
          doc.addPage();
          cursorY = 16;
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.2);
        doc.setTextColor(15, 23, 42);
        doc.text(pdfText(lot.id), margin, cursorY + 3.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        const sub = cycles[0] ? `Cde ${formatShortFr(cycles[0].dateCommande)} · ${cycles[0].cartons} ctn` : lot.statut;
        doc.text(pdfText(sub), margin, cursorY + 6.8);

        doc.setFillColor(241, 245, 249);
        doc.rect(trackX, cursorY, trackW, 7.8, 'F');

        if (lot.dateIncub && lot.dateMirage && lot.dateEclo) {
          drawBar(lot.dateIncub, lot.dateMirage, lot.dateEclo, cursorY, `En cours -> M ${formatShortFr(lot.dateMirage)}`, true);
        }
        cycles.forEach((c) => {
          drawBar(c.dateIncubation, c.dateMirage, c.dateEclosion, cursorY, `#${c.rotationNum} ${formatShortFr(c.dateIncubation)}`, false);
        });
        drawTodayMarker(cursorY, 7.8);

        cursorY += 9.2;
      });
    } else {
      if (timelineData.mode === 'unique' && timelineData.transitionLots && timelineData.transitionLots.length > 0) {
        timelineData.transitionLots.forEach((lot) => {
          if (!lot.dateIncub || !lot.dateMirage || !lot.dateEclo) return;
          if (cursorY + 9 > pageHeight - 14) {
            doc.addPage();
            cursorY = 16;
          }
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.2);
          doc.setTextColor(71, 85, 105);
          doc.text(pdfText(`${lot.id} (fin cycle)`), margin, cursorY + 4.5);

          doc.setFillColor(241, 245, 249);
          doc.rect(trackX, cursorY, trackW, 7.8, 'F');
          drawBar(lot.dateIncub, lot.dateMirage, lot.dateEclo, cursorY, `Transition -> M ${formatShortFr(lot.dateMirage)}`, true);
          drawTodayMarker(cursorY, 7.8);
          cursorY += 9.2;
        });
      } else if (timelineData.showAnchorLot && activeAnchorObj?.dateIncub && activeAnchorObj.dateMirage && activeAnchorObj.dateEclo) {
        if (cursorY + 9 > pageHeight - 14) {
          doc.addPage();
          cursorY = 16;
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.2);
        doc.setTextColor(15, 23, 42);
        doc.text(pdfText(`${activeAnchorObj.id} (en cours)`), margin, cursorY + 4.5);

        doc.setFillColor(241, 245, 249);
        doc.rect(trackX, cursorY, trackW, 7.8, 'F');
        drawBar(activeAnchorObj.dateIncub, activeAnchorObj.dateMirage, activeAnchorObj.dateEclo, cursorY, `J0 -> M ${formatShortFr(activeAnchorObj.dateMirage)}`, true);
        drawTodayMarker(cursorY, 7.8);
        cursorY += 9.2;
      }

      rows.forEach((c) => {
        if (cursorY + 9 > pageHeight - 14) {
          doc.addPage();
          cursorY = 16;
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.2);
        doc.setTextColor(15, 23, 42);
        const prefix = planningScope === 'unique' ? `Unique #${c.rotationNum} (${c.cartons} ctn)` : `Cycle ${c.rotationNum}`;
        doc.text(pdfText(`${prefix} · Cde ${formatShortFr(c.dateCommande)}`), margin, cursorY + 4.5);

        doc.setFillColor(241, 245, 249);
        doc.rect(trackX, cursorY, trackW, 7.8, 'F');
        drawBar(c.dateIncubation, c.dateMirage, c.dateEclosion, cursorY, `${formatShortFr(c.dateIncubation)} -> ${formatShortFr(c.dateMirage)}`, false);
        drawTodayMarker(cursorY, 7.8);
        cursorY += 9.2;
      });
    }
  }

  // ── Pied de page sur toutes les pages ──────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(148, 163, 184);
    doc.text(
      pdfText('Couvoir SAMCHE - Document operationnel de planification des mises en incubation'),
      margin,
      pageHeight - 6
    );
    doc.text(pdfText(`Page ${p} / ${pageCount}`), pageWidth - margin, pageHeight - 6, {
      align: 'right',
    });
  }

  const filename = `planning_incubation_${planningScope === 'unique' ? 'chargement_unique_' : ''}${toIsoInput(today)}.pdf`;
  const pdfBlob = doc.output('blob');
  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
