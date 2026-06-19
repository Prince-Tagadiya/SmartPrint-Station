// ============================================================
// API: Payment Initiate — Create payment with UPI QR
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { PaymentService } from '@/services/PaymentService';
import { PrinterService } from '@/services/PrinterService';
import { serialBridge } from '@/services/SerialBridge';

// POST /api/payment/initiate
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'Job ID is required' },
        { status: 400 }
      );
    }

    const job = PrinterService.getJob(jobId);
    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Print job not found' },
        { status: 404 }
      );
    }

    if (job.payment_status === 'success') {
      return NextResponse.json(
        { success: false, error: 'Payment already completed' },
        { status: 400 }
      );
    }

    // Check if Razorpay keys are configured
    if (!process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID === 'rzp_test_placeholder_key_id') {
      console.warn('[API] Razorpay keys not configured. Simulating payment initiation for testing.');
      const mockOrderId = `order_mock_${Date.now()}`;
      const payment = await PaymentService.createPayment(jobId, job.estimated_cost, mockOrderId);
      serialBridge.setScreen('payment_wait');
      return NextResponse.json({
        success: true,
        data: {
          payment,
          orderId: mockOrderId,
          amount: Math.round(job.estimated_cost * 100),
          currency: 'INR',
          key: 'rzp_test_placeholder_key_id',
          isMock: true,
        },
      });
    }

    // Call Razorpay Order API
    const amountInPaise = Math.round(job.estimated_cost * 100);
    const authString = Buffer.from(
      `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
    ).toString('base64');

    const razorpayRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${authString}`,
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: 'INR',
        receipt: `job_${job.id}`,
      }),
    });

    const orderData = await razorpayRes.json();
    if (!razorpayRes.ok) {
      throw new Error(orderData.error?.description || 'Failed to create Razorpay order');
    }

    const payment = await PaymentService.createPayment(jobId, job.estimated_cost, orderData.id);

    serialBridge.setScreen('payment_wait');

    return NextResponse.json({
      success: true,
      data: {
        payment,
        orderId: orderData.id,
        amount: orderData.amount,
        currency: orderData.currency,
        key: process.env.RAZORPAY_KEY_ID,
        isMock: false,
      },
    });
  } catch (error: any) {
    console.error('[API] Payment initiate error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to initiate payment' },
      { status: 500 }
    );
  }
}
