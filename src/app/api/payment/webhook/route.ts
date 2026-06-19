// ============================================================
// API: Payment Webhook — External payment callback
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { PaymentService } from '@/services/PaymentService';

// POST /api/payment/webhook
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paymentId, status, transactionId } = body;

    if (!paymentId || !status) {
      return NextResponse.json(
        { success: false, error: 'Payment ID and status are required' },
        { status: 400 }
      );
    }

    if (!['processing', 'success', 'failed'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid payment status' },
        { status: 400 }
      );
    }

    PaymentService.updateStatus(paymentId, status, transactionId);

    return NextResponse.json({
      success: true,
      data: { message: 'Payment status updated' },
    });
  } catch (error) {
    console.error('[API] Payment webhook error:', error);
    return NextResponse.json(
      { success: false, error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
