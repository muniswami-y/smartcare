import { Request, Response, NextFunction } from 'express';
import { billingService } from './service';

export class BillingController {
  async getPendingCharges(req: Request, res: Response, next: NextFunction) {
    try {
      const charges = await billingService.getPendingCharges(req.params.patientId);
      return res.json({ success: true, data: charges });
    } catch (err) {
      return next(err);
    }
  }

  async generateBill(req: Request, res: Response, next: NextFunction) {
    try {
      const bill = await billingService.generateBillFromCharges(req.body, req.user!.id);
      return res.status(201).json({ success: true, data: bill });
    } catch (err) {
      return next(err);
    }
  }

  async applyDiscount(req: Request, res: Response, next: NextFunction) {
    try {
      const discount = await billingService.applyDiscount(req.body, req.user!.id);
      return res.status(201).json({ success: true, data: discount });
    } catch (err) {
      return next(err);
    }
  }

  async recordPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await billingService.recordPayment(req.body, req.user!.id);
      return res.status(201).json({ success: true, data: result });
    } catch (err) {
      return next(err);
    }
  }

  async createRazorpayOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { billId, patientId } = req.body;
      const order = await billingService.createRazorpayOrder(billId, patientId);
      return res.json({ success: true, data: order });
    } catch (err) {
      return next(err);
    }
  }

  async verifyRazorpayPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const { billId, patientId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
      const payment = await billingService.verifyAndRecordOnlinePayment(billId, patientId, {
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature
      });
      return res.json({ success: true, data: payment });
    } catch (err) {
      return next(err);
    }
  }

  async finalizeBill(req: Request, res: Response, next: NextFunction) {
    try {
      const bill = await billingService.finalizeBill(req.params.id, req.user!.id);
      return res.json({ success: true, data: bill });
    } catch (err) {
      return next(err);
    }
  }

  async createCreditNote(req: Request, res: Response, next: NextFunction) {
    try {
      const cn = await billingService.createCreditNote(req.body, req.user!.id);
      return res.status(201).json({ success: true, data: cn });
    } catch (err) {
      return next(err);
    }
  }

  async startShift(req: Request, res: Response, next: NextFunction) {
    try {
      const shift = await billingService.startCashierShift(req.user!.id, req.body.openingCashPaise);
      return res.status(201).json({ success: true, data: shift });
    } catch (err) {
      return next(err);
    }
  }

  async closeShift(req: Request, res: Response, next: NextFunction) {
    try {
      const shift = await billingService.closeCashierShift(
        req.params.id,
        req.body.closingCashPaise,
        req.body.notes,
        req.user?.id
      );
      return res.json({ success: true, data: shift });
    } catch (err) {
      return next(err);
    }
  }

  async printReceipt(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await billingService.getPrintableReceipt(req.params.id);
      res.setHeader('Content-Type', 'text/html');
      return res.send(result.html);
    } catch (err) {
      return next(err);
    }
  }

  async printBill(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await billingService.getPrintableBill(req.params.id);
      res.setHeader('Content-Type', 'text/html');
      return res.send(result.html);
    } catch (err) {
      return next(err);
    }
  }

  async getPublicPrices(req: Request, res: Response, next: NextFunction) {
    try {
      const prices = await billingService.getPublicPriceList();
      return res.json({ success: true, data: prices });
    } catch (err) {
      return next(err);
    }
  }
}

export const billingController = new BillingController();
