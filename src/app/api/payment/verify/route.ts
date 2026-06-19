// ============================================================
// API: Payment Verify — Check payment status
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { PaymentService } from '@/services/PaymentService';
import { PrinterService } from '@/services/PrinterService';

// POST /api/payment/verify
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paymentId, jobId } = body;

    let payment = null;
    if (paymentId) {
      payment = PaymentService.getPayment(paymentId);
    } else if (jobId) {
      payment = PaymentService.getPaymentByJob(jobId);
    }

    if (!payment) {
      return NextResponse.json(
        { success: false, error: 'Payment not found' },
        { status: 404 }
      );
    }

    const job = PrinterService.getJob(payment.print_job_id);

    return NextResponse.json({
      success: true,
      data: {
        payment,
        printJob: job,
        isPaid: payment.status === 'success',
      },
    });
  } catch (error) {
    console.error('[API] Payment verify error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to verify payment' },
      { status: 500 }
    );
  }
}
