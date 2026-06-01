// ============================================================
// Payment Service — Mock UPI payment with QR generation
// ============================================================
// Interface designed for future Razorpay/PhonePe integration

import getDb from '@/lib/db';
import QRCode from 'qrcode';
import type { Payment, PaymentStatus } from '@/types';
import { EventService } from './EventService';

export class PaymentService {
  static async createPayment(printJobId: number, amount: number, orderId: string): Promise<Payment> {
    const db = getDb();

    const result = db.prepare(`
      INSERT INTO payments (print_job_id, amount, upi_id, status, qr_data)
      VALUES (?, ?, ?, 'pending', NULL)
    `).run(printJobId, amount, orderId);

    // Update print job payment status
    db.prepare(`
      UPDATE print_jobs SET payment_status = 'pending', payment_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(String(result.lastInsertRowid), printJobId);

    EventService.log('payment_initiated', 'payment', `Razorpay Order ${orderId} initiated for job #${printJobId} (Amount: ₹${amount})`);

    return db.prepare('SELECT * FROM payments WHERE id = ?').get(result.lastInsertRowid) as Payment;
  }

  static getPayment(paymentId: number): Payment | null {
    const db = getDb();
    return db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId) as Payment | null;
  }

  static getPaymentByJob(printJobId: number): Payment | null {
    const db = getDb();
    return db.prepare(
      'SELECT * FROM payments WHERE print_job_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(printJobId) as Payment | null;
  }

  static updateStatus(paymentId: number, status: PaymentStatus, transactionId?: string): void {
    const db = getDb();
    db.prepare(`
      UPDATE payments SET status = ?, transaction_id = COALESCE(?, transaction_id), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, transactionId || null, paymentId);

    // Get payment to update linked print job
    const payment = this.getPayment(paymentId);
    if (payment) {
      db.prepare(`
        UPDATE print_jobs SET payment_status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(status, payment.print_job_id);

      if (status === 'success') {
        EventService.log('payment_received', 'payment', `Payment of ₹${payment.amount} received for job #${payment.print_job_id}`);
      } else if (status === 'failed') {
        EventService.log('payment_failed', 'payment', `Payment failed for job #${payment.print_job_id}`);
      }
    }
  }

  // Auto-approve payment for testing
  static async simulatePaymentSuccess(paymentId: number): Promise<void> {
    // Simulate processing delay
    this.updateStatus(paymentId, 'processing');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const txnId = `TXN${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    this.updateStatus(paymentId, 'success', txnId);
  }

  static isAutoApprove(): boolean {
    const db = getDb();
    const setting = db.prepare("SELECT value FROM settings WHERE key = 'auto_payment_approve'").get() as { value: string } | undefined;
    return setting?.value === 'true';
  }
}
