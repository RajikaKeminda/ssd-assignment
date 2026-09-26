import PDFDocument from 'pdfkit';
import { Order, OrderStatus, PaymentStatus } from '../models/order.model';
import { Inventory } from '../models/inventory.model';
import { MedicationRequest, RequestStatus, UrgencyLevel } from '../models/request.model';
import { User, UserRole } from '../models/user.model';
import { ApiError } from '../utils/api-error';

const EMERALD = '#059669';
const DARK = '#111827';
const GREY = '#6b7280';
const LIGHT_GREY = '#f3f4f6';
const LIGHTER_GREY = '#f9fafb';
const RED = '#dc2626';
const ORANGE = '#d97706';

function buildPdf(draw: (doc: InstanceType<typeof PDFDocument>, W: number) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    const W = doc.page.width - 100;
    draw(doc, W);
    doc.end();
  });
}

function drawHeader(doc: InstanceType<typeof PDFDocument>, W: number, title: string, subtitle: string) {
  doc.rect(50, 45, W, 70).fill(EMERALD);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(22).text(title, 65, 60);
  doc.fontSize(10).font('Helvetica').text(subtitle, 65, 90, { align: 'right', width: W - 15 });
  doc.fillColor(DARK);

  const now = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  doc.font('Helvetica').fontSize(9).fillColor(GREY)
    .text(`Generated: ${now}`, 65, 92, { align: 'left', width: W - 15 });
  doc.fillColor(DARK);
}

function drawTableHeader(
  doc: InstanceType<typeof PDFDocument>,
  y: number,
  cols: { label: string; x: number; width: number }[]
) {
  doc.rect(50, y, cols.reduce((s, c) => s + c.width, 0), 22).fill(LIGHT_GREY);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(GREY);
  for (const col of cols) {
    doc.text(col.label, col.x + 4, y + 7, { width: col.width - 8, ellipsis: true });
  }
  doc.fillColor(DARK);
  return y + 22;
}

function drawRow(
  doc: InstanceType<typeof PDFDocument>,
  y: number,
  rowIndex: number,
  cols: { value: string; x: number; width: number; color?: string }[],
  rowHeight = 20
) {
  if (rowIndex % 2 === 1) {
    doc.rect(50, y, cols.reduce((s, c) => s + c.width, 0), rowHeight).fill(LIGHTER_GREY);
  }
  doc.font('Helvetica').fontSize(8).fillColor(DARK);
  for (const col of cols) {
    doc.fillColor(col.color ?? DARK);
    doc.text(col.value, col.x + 4, y + 6, { width: col.width - 8, ellipsis: true });
  }
  doc.fillColor(DARK);
  return y + rowHeight;
}

function drawSummaryBox(
  doc: InstanceType<typeof PDFDocument>,
  x: number, y: number, w: number, h: number,
  label: string, value: string, color = EMERALD
) {
  doc.rect(x, y, w, h).fill(LIGHT_GREY);
  doc.font('Helvetica').fontSize(8).fillColor(GREY).text(label, x + 8, y + 8, { width: w - 16 });
  doc.font('Helvetica-Bold').fontSize(14).fillColor(color).text(value, x + 8, y + 22, { width: w - 16 });
}

export class ReportService {
  // ─── Inventory Report ──────────────────────────────────────────────────────
  static async generateInventoryReport(pharmacyId?: string): Promise<Buffer> {
    const filter: Record<string, unknown> = {};
    if (pharmacyId) filter.pharmacyId = pharmacyId;

    const items = await Inventory.find(filter)
      .populate<{ pharmacyId: { name: string } }>('pharmacyId', 'name')
      .sort({ quantity: 1 })
      .lean();

    if (!items.length) throw ApiError.notFound('No inventory data found for this report');

    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const lowStock = items.filter(i => i.quantity <= i.lowStockThreshold);
    const expiring = items.filter(i => i.expiryDate && new Date(i.expiryDate) <= thirtyDaysLater);
    const totalValue = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

    return buildPdf((doc, W) => {
      drawHeader(doc, W, 'INVENTORY REPORT', 'Remote Pharmacy Medication Tracker');

      // Summary boxes
      const boxW = (W - 20) / 4;
      const boxY = 135;
      drawSummaryBox(doc, 50, boxY, boxW, 55, 'Total Items', String(items.length));
      drawSummaryBox(doc, 50 + boxW + 7, boxY, boxW, 55, 'Low Stock', String(lowStock.length), RED);
      drawSummaryBox(doc, 50 + (boxW + 7) * 2, boxY, boxW, 55, 'Expiring (30d)', String(expiring.length), ORANGE);
      drawSummaryBox(doc, 50 + (boxW + 7) * 3, boxY, boxW, 55, 'Stock Value', `$${totalValue.toFixed(2)}`);

      // Table
      const tableY = boxY + 70;
      const cols = [
        { label: 'MEDICATION',  x: 50,                w: W * 0.25 },
        { label: 'PHARMACY',    x: 50 + W * 0.25,     w: W * 0.20 },
        { label: 'CATEGORY',    x: 50 + W * 0.45,     w: W * 0.12 },
        { label: 'FORM',        x: 50 + W * 0.57,     w: W * 0.10 },
        { label: 'QTY',         x: 50 + W * 0.67,     w: W * 0.08 },
        { label: 'UNIT PRICE',  x: 50 + W * 0.75,     w: W * 0.12 },
        { label: 'STATUS',      x: 50 + W * 0.87,     w: W * 0.13 },
      ];

      let y = drawTableHeader(doc, tableY, cols.map(c => ({ label: c.label, x: c.x, width: c.w })));

      for (const [i, item] of items.entries()) {
        if (y > doc.page.height - 80) {
          doc.addPage();
          y = 50;
          y = drawTableHeader(doc, y, cols.map(c => ({ label: c.label, x: c.x, width: c.w })));
        }

        const isLow = item.quantity <= item.lowStockThreshold;
        const isExp = item.expiryDate && new Date(item.expiryDate) <= thirtyDaysLater;
        const status = isLow ? 'LOW STOCK' : isExp ? 'EXPIRING' : 'OK';
        const statusColor = isLow ? RED : isExp ? ORANGE : EMERALD;

        const pharmacyName = typeof item.pharmacyId === 'object' && item.pharmacyId?.name
          ? item.pharmacyId.name : '—';

        y = drawRow(doc, y, i, [
          { value: item.medicationName, x: cols[0].x, width: cols[0].w },
          { value: pharmacyName,        x: cols[1].x, width: cols[1].w },
          { value: item.category,       x: cols[2].x, width: cols[2].w },
          { value: item.form ?? '—',    x: cols[3].x, width: cols[3].w },
          { value: String(item.quantity), x: cols[4].x, width: cols[4].w, color: isLow ? RED : DARK },
          { value: `$${item.unitPrice.toFixed(2)}`, x: cols[5].x, width: cols[5].w },
          { value: status, x: cols[6].x, width: cols[6].w, color: statusColor },
        ]);
      }
    });
  }

  // ─── Orders Report ─────────────────────────────────────────────────────────
  static async generateOrdersReport(pharmacyId?: string, from?: string, to?: string): Promise<Buffer> {
    const filter: Record<string, unknown> = {};
    if (pharmacyId) filter.pharmacyId = pharmacyId;
    if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) dateFilter.$gte = new Date(from);
      if (to) { const d = new Date(to); d.setHours(23, 59, 59, 999); dateFilter.$lte = d; }
      filter.createdAt = dateFilter;
    }

    const orders = await Order.find(filter)
      .populate<{ userId: { name: string; email: string } }>('userId', 'name email')
      .populate<{ pharmacyId: { name: string } }>('pharmacyId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    if (!orders.length) throw ApiError.notFound('No orders found for the selected criteria');

    const totalRevenue = orders.filter(o => o.paymentStatus === PaymentStatus.PAID)
      .reduce((s, o) => s + o.totalAmount, 0);
    const byStatus = Object.values(OrderStatus).map(s => ({
      status: s,
      count: orders.filter(o => o.status === s).length,
    }));
    const paidCount = orders.filter(o => o.paymentStatus === PaymentStatus.PAID).length;

    return buildPdf((doc, W) => {
      drawHeader(doc, W, 'ORDERS REPORT', 'Remote Pharmacy Medication Tracker');

      // Summary boxes
      const boxW = (W - 15) / 4;
      const boxY = 135;
      drawSummaryBox(doc, 50, boxY, boxW, 55, 'Total Orders', String(orders.length));
      drawSummaryBox(doc, 50 + boxW + 5, boxY, boxW, 55, 'Total Revenue', `$${totalRevenue.toFixed(2)}`);
      drawSummaryBox(doc, 50 + (boxW + 5) * 2, boxY, boxW, 55, 'Paid Orders', String(paidCount));
      drawSummaryBox(doc, 50 + (boxW + 5) * 3, boxY, boxW, 55, 'Avg. Order', orders.length ? `$${(totalRevenue / (paidCount || 1)).toFixed(2)}` : '$0.00');

      // Status breakdown
      let statsY = boxY + 65;
      doc.font('Helvetica-Bold').fontSize(9).fillColor(GREY).text('STATUS BREAKDOWN', 50, statsY);
      statsY += 12;
      const statW = W / byStatus.length;
      byStatus.forEach((s, i) => {
        const color = s.status === OrderStatus.DELIVERED ? EMERALD
          : s.status === OrderStatus.CANCELLED ? RED
          : s.status === OrderStatus.OUT_FOR_DELIVERY ? ORANGE
          : DARK;
        doc.font('Helvetica').fontSize(8).fillColor(GREY)
          .text(s.status.replace(/_/g, ' ').toUpperCase(), 50 + i * statW, statsY, { width: statW - 4 });
        doc.font('Helvetica-Bold').fontSize(12).fillColor(color)
          .text(String(s.count), 50 + i * statW, statsY + 11, { width: statW - 4 });
      });

      // Table
      const tableY = statsY + 35;
      const cols = [
        { label: 'ORDER #',    x: 50,            w: W * 0.15 },
        { label: 'CUSTOMER',   x: 50 + W * 0.15, w: W * 0.20 },
        { label: 'PHARMACY',   x: 50 + W * 0.35, w: W * 0.18 },
        { label: 'STATUS',     x: 50 + W * 0.53, w: W * 0.14 },
        { label: 'PAYMENT',    x: 50 + W * 0.67, w: W * 0.13 },
        { label: 'TOTAL',      x: 50 + W * 0.80, w: W * 0.10 },
        { label: 'DATE',       x: 50 + W * 0.90, w: W * 0.10 },
      ];

      let y = drawTableHeader(doc, tableY, cols.map(c => ({ label: c.label, x: c.x, width: c.w })));

      for (const [i, order] of orders.entries()) {
        if (y > doc.page.height - 80) {
          doc.addPage();
          y = 50;
          y = drawTableHeader(doc, y, cols.map(c => ({ label: c.label, x: c.x, width: c.w })));
        }

        const customer = typeof order.userId === 'object' && order.userId?.name ? order.userId.name : '—';
        const pharmacy = typeof order.pharmacyId === 'object' && order.pharmacyId?.name ? order.pharmacyId.name : '—';
        const statusColor = order.status === OrderStatus.DELIVERED ? EMERALD
          : order.status === OrderStatus.CANCELLED ? RED
          : order.status === OrderStatus.OUT_FOR_DELIVERY ? ORANGE : DARK;
        const payColor = order.paymentStatus === PaymentStatus.PAID ? EMERALD
          : order.paymentStatus === PaymentStatus.FAILED ? RED : ORANGE;
        const date = new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });

        y = drawRow(doc, y, i, [
          { value: order.orderNumber, x: cols[0].x, width: cols[0].w },
          { value: customer, x: cols[1].x, width: cols[1].w },
          { value: pharmacy, x: cols[2].x, width: cols[2].w },
          { value: order.status.replace(/_/g, ' '), x: cols[3].x, width: cols[3].w, color: statusColor },
          { value: order.paymentStatus, x: cols[4].x, width: cols[4].w, color: payColor },
          { value: `$${order.totalAmount.toFixed(2)}`, x: cols[5].x, width: cols[5].w },
          { value: date, x: cols[6].x, width: cols[6].w },
        ]);
      }
    });
  }

  // ─── Users Report ──────────────────────────────────────────────────────────
  static async generateUsersReport(): Promise<Buffer> {
    const users = await User.find({}).sort({ createdAt: -1 }).lean();
    if (!users.length) throw ApiError.notFound('No users found');

    const roleGroups = Object.values(UserRole).map(role => ({
      role,
      count: users.filter(u => u.role === role).length,
    }));
    const activeCount = users.filter(u => u.isActive).length;

    return buildPdf((doc, W) => {
      drawHeader(doc, W, 'USERS REPORT', 'Remote Pharmacy Medication Tracker');

      // Summary boxes
      const boxW = (W - 15) / 4;
      const boxY = 135;
      drawSummaryBox(doc, 50, boxY, boxW, 55, 'Total Users', String(users.length));
      drawSummaryBox(doc, 50 + boxW + 5, boxY, boxW, 55, 'Active', String(activeCount));
      drawSummaryBox(doc, 50 + (boxW + 5) * 2, boxY, boxW, 55, 'Inactive', String(users.length - activeCount), ORANGE);
      drawSummaryBox(doc, 50 + (boxW + 5) * 3, boxY, boxW, 55, 'Verified', String(users.filter(u => u.isEmailVerified).length));

      // Role breakdown
      let rolesY = boxY + 65;
      doc.font('Helvetica-Bold').fontSize(9).fillColor(GREY).text('USERS BY ROLE', 50, rolesY);
      rolesY += 12;
      const rW = W / roleGroups.length;
      roleGroups.forEach((g, i) => {
        doc.font('Helvetica').fontSize(8).fillColor(GREY)
          .text(g.role.toUpperCase(), 50 + i * rW, rolesY, { width: rW - 4 });
        doc.font('Helvetica-Bold').fontSize(12).fillColor(EMERALD)
          .text(String(g.count), 50 + i * rW, rolesY + 11, { width: rW - 4 });
      });

      // Table
      const tableY = rolesY + 35;
      const cols = [
        { label: 'NAME',     x: 50,            w: W * 0.22 },
        { label: 'EMAIL',    x: 50 + W * 0.22, w: W * 0.28 },
        { label: 'ROLE',     x: 50 + W * 0.50, w: W * 0.20 },
        { label: 'STATUS',   x: 50 + W * 0.70, w: W * 0.12 },
        { label: 'VERIFIED', x: 50 + W * 0.82, w: W * 0.10 },
        { label: 'JOINED',   x: 50 + W * 0.92, w: W * 0.08 },
      ];

      let y = drawTableHeader(doc, tableY, cols.map(c => ({ label: c.label, x: c.x, width: c.w })));

      for (const [i, user] of users.entries()) {
        if (y > doc.page.height - 80) {
          doc.addPage();
          y = 50;
          y = drawTableHeader(doc, y, cols.map(c => ({ label: c.label, x: c.x, width: c.w })));
        }

        const joined = new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });

        y = drawRow(doc, y, i, [
          { value: user.name, x: cols[0].x, width: cols[0].w },
          { value: user.email, x: cols[1].x, width: cols[1].w },
          { value: user.role, x: cols[2].x, width: cols[2].w, color: user.role === UserRole.SYSTEM_ADMIN ? EMERALD : DARK },
          { value: user.isActive ? 'Active' : 'Inactive', x: cols[3].x, width: cols[3].w, color: user.isActive ? EMERALD : RED },
          { value: user.isEmailVerified ? 'Yes' : 'No', x: cols[4].x, width: cols[4].w, color: user.isEmailVerified ? EMERALD : ORANGE },
          { value: joined, x: cols[5].x, width: cols[5].w },
        ]);
      }
    });
  }

  // ─── Requests Report ───────────────────────────────────────────────────────
  static async generateRequestsReport(pharmacyId?: string, from?: string, to?: string): Promise<Buffer> {
    const filter: Record<string, unknown> = {};
    if (pharmacyId) filter.pharmacyId = pharmacyId;
    if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) dateFilter.$gte = new Date(from);
      if (to) { const d = new Date(to); d.setHours(23, 59, 59, 999); dateFilter.$lte = d; }
      filter.createdAt = dateFilter;
    }

    const requests = await MedicationRequest.find(filter)
      .populate<{ userId: { name: string; email: string } }>('userId', 'name email')
      .populate<{ pharmacyId: { name: string } }>('pharmacyId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    if (!requests.length) throw ApiError.notFound('No requests found for the selected criteria');

    const byStatus = Object.values(RequestStatus).map(s => ({
      status: s,
      count: requests.filter(r => r.status === s).length,
    }));
    const urgentCount = requests.filter(r => r.urgencyLevel === UrgencyLevel.URGENT).length;
    const fulfilledCount = requests.filter(r => r.status === RequestStatus.FULFILLED).length;

    return buildPdf((doc, W) => {
      drawHeader(doc, W, 'REQUESTS REPORT', 'Remote Pharmacy Medication Tracker');

      // Summary boxes
      const boxW = (W - 15) / 4;
      const boxY = 135;
      drawSummaryBox(doc, 50, boxY, boxW, 55, 'Total Requests', String(requests.length));
      drawSummaryBox(doc, 50 + boxW + 5, boxY, boxW, 55, 'Urgent', String(urgentCount), RED);
      drawSummaryBox(doc, 50 + (boxW + 5) * 2, boxY, boxW, 55, 'Fulfilled', String(fulfilledCount), EMERALD);
      drawSummaryBox(doc, 50 + (boxW + 5) * 3, boxY, boxW, 55, 'Fulfillment Rate',
        requests.length ? `${Math.round((fulfilledCount / requests.length) * 100)}%` : '0%');

      // Status breakdown
      let statsY = boxY + 65;
      doc.font('Helvetica-Bold').fontSize(9).fillColor(GREY).text('STATUS BREAKDOWN', 50, statsY);
      statsY += 12;
      const statW = W / byStatus.length;
      byStatus.forEach((s, i) => {
        const color = s.status === RequestStatus.FULFILLED ? EMERALD
          : s.status === RequestStatus.CANCELLED ? RED
          : s.status === RequestStatus.UNAVAILABLE ? ORANGE : DARK;
        doc.font('Helvetica').fontSize(8).fillColor(GREY)
          .text(s.status.toUpperCase(), 50 + i * statW, statsY, { width: statW - 4 });
        doc.font('Helvetica-Bold').fontSize(12).fillColor(color)
          .text(String(s.count), 50 + i * statW, statsY + 11, { width: statW - 4 });
      });

      // Table
      const tableY = statsY + 35;
      const cols = [
        { label: 'MEDICATION', x: 50,            w: W * 0.20 },
        { label: 'PATIENT',    x: 50 + W * 0.20, w: W * 0.18 },
        { label: 'PHARMACY',   x: 50 + W * 0.38, w: W * 0.18 },
        { label: 'QTY',        x: 50 + W * 0.56, w: W * 0.07 },
        { label: 'URGENCY',    x: 50 + W * 0.63, w: W * 0.12 },
        { label: 'STATUS',     x: 50 + W * 0.75, w: W * 0.13 },
        { label: 'DATE',       x: 50 + W * 0.88, w: W * 0.12 },
      ];

      let y = drawTableHeader(doc, tableY, cols.map(c => ({ label: c.label, x: c.x, width: c.w })));

      for (const [i, req] of requests.entries()) {
        if (y > doc.page.height - 80) {
          doc.addPage();
          y = 50;
          y = drawTableHeader(doc, y, cols.map(c => ({ label: c.label, x: c.x, width: c.w })));
        }

        const patient = typeof req.userId === 'object' && req.userId?.name ? req.userId.name : '—';
        const pharmacy = typeof req.pharmacyId === 'object' && req.pharmacyId?.name ? req.pharmacyId.name : '—';
        const urgColor = req.urgencyLevel === UrgencyLevel.URGENT ? RED
          : req.urgencyLevel === UrgencyLevel.NORMAL ? ORANGE : GREY;
        const statusColor = req.status === RequestStatus.FULFILLED ? EMERALD
          : req.status === RequestStatus.CANCELLED ? RED
          : req.status === RequestStatus.UNAVAILABLE ? ORANGE : DARK;
        const date = new Date(req.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });

        y = drawRow(doc, y, i, [
          { value: req.medicationName, x: cols[0].x, width: cols[0].w },
          { value: patient, x: cols[1].x, width: cols[1].w },
          { value: pharmacy, x: cols[2].x, width: cols[2].w },
          { value: String(req.quantity), x: cols[3].x, width: cols[3].w },
          { value: req.urgencyLevel, x: cols[4].x, width: cols[4].w, color: urgColor },
          { value: req.status, x: cols[5].x, width: cols[5].w, color: statusColor },
          { value: date, x: cols[6].x, width: cols[6].w },
        ]);
      }
    });
  }
}
