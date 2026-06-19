import { NextRequest, NextResponse } from 'next/server';
import { PaymentService } from '@/services/PaymentService';
import crypto from 'crypto';
import { serialBridge } from '@/services/SerialBridge';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, paymentId } = body;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !paymentId) {
      return NextResponse.json(
        { success: false, error: 'Missing required payment verification fields' },
        { status: 400 }
      );
    }

    if (razorpay_payment_id.startsWith('pay_mock_')) {
      PaymentService.updateStatus(Number(paymentId), 'success', razorpay_payment_id);
      serialBridge.setScreen('payment_ok');
      return NextResponse.json({
        success: true,
        message: 'Mock payment verified successfully',
      });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET || '';
    const generatedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      console.error('[API] Razorpay signature mismatch!', {
        generated: generatedSignature,
        received: razorpay_signature,
      });
      PaymentService.updateStatus(Number(paymentId), 'failed');
      return NextResponse.json(
        { success: false, error: 'Payment signature verification failed' },
        { status: 400 }
      );
    }

    // Success: Update database status
    PaymentService.updateStatus(Number(paymentId), 'success', razorpay_payment_id);
    
    serialBridge.setScreen('payment_ok');

    return NextResponse.json({
      success: true,
      message: 'Payment verified and captured successfully',
    });
  } catch (error: any) {
    console.error('[API] Razorpay verify error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal verification error' },
      { status: 500 }
    );
  }
}
