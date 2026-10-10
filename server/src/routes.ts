import { Router, Request, Response } from "express";
import { db } from "./db";
import { runDisputeAgent } from "./agent";
import { 
  submitEvidenceToPayPal, 
  acceptClaimPayPal, 
  adjudicateDisputeSandbox, 
  verifyWebhookSignature 
} from "./paypalClient";

export const router = Router();

/**
 * GET /api/disputes
 * Returns all disputes formatted for the AG Grid Command Center
 */
router.get("/disputes", (req: Request, res: Response) => {
  try {
    const disputes = db.prepare(`
      SELECT 
        d.id,
        d.paypal_dispute_id,
        d.order_id,
        d.buyer_name,
        d.reason,
        d.reason_code,
        d.dispute_amount,
        d.currency,
        d.dispute_fee,
        d.status,
        d.respond_by,
        d.decision,
        d.win_probability,
        d.ev_fight,
        d.ev_settle,
        d.outcome,
        d.carrier_name,
        d.tracking_number,
        d.created_at,
        d.updated_at,
        o.item_title,
        o.sku,
        o.carrier,
        o.tracking_no,
        o.shipping_status,
        p.status as packet_status,
        p.id as packet_id
      FROM disputes d
      LEFT JOIN shop_orders o ON d.order_id = o.order_id
      LEFT JOIN packets p ON d.id = p.dispute_id
      ORDER BY d.created_at DESC
    `).all();

    res.json(disputes);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/disputes/:id
 * Detailed breakdown of a dispute, including evidence items, packet, and audit logs
 */
router.get("/disputes/:id", (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const dispute = db.prepare(`
      SELECT d.*, o.item_title, o.sku, o.carrier, o.tracking_no, o.shipping_status, 
             o.shipped_at, o.delivered_at, o.shipping_address, o.item_cost
      FROM disputes d
      LEFT JOIN shop_orders o ON d.order_id = o.order_id
      WHERE d.id = ?
    `).get(id) as any;

    if (!dispute) {
      return res.status(404).json({ error: "Dispute not found" });
    }

    const evidenceItems = db.prepare("SELECT * FROM evidence_items WHERE dispute_id = ? ORDER BY created_at ASC").all(id);
    const packet = db.prepare("SELECT * FROM packets WHERE dispute_id = ?").get(id);
    const auditLogs = db.prepare("SELECT * FROM audit_events WHERE dispute_id = ? ORDER BY created_at DESC").all(id);

    res.json({
      dispute,
      evidenceItems,
      packet,
      auditLogs,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/disputes/:id/run-agent
 * Trigger the autonomous evidence agent
 */
router.post("/disputes/:id/run-agent", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const result = await runDisputeAgent(id);
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/disputes/:id/approve-submit
 * Merchant approves packet -> Submits to PayPal Disputes API
 */
router.post("/disputes/:id/approve-submit", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const dispute = db.prepare("SELECT * FROM disputes WHERE id = ?").get(id) as any;
    const packet = db.prepare("SELECT * FROM packets WHERE dispute_id = ?").get(id) as any;

    if (!dispute || !packet) {
      return res.status(404).json({ error: "Dispute or packet not found" });
    }

    // Call PayPal Disputes API
    const carrier = dispute.carrier_name || "BlueDart";
    const tracking = dispute.tracking_number || "BD-982347101";
    const ppResult = await submitEvidenceToPayPal(dispute.paypal_dispute_id, carrier, tracking, packet.narrative);

    const nowIso = new Date().toISOString();

    // Update status to UNDER_REVIEW
    db.prepare(`
      UPDATE disputes 
      SET status = 'UNDER_REVIEW', updated_at = ?
      WHERE id = ?
    `).run(nowIso, id);

    db.prepare(`
      UPDATE packets 
      SET status = 'SUBMITTED', submitted_at = ?, paypal_submission_id = ?
      WHERE dispute_id = ?
    `).run(nowIso, `PP-SUB-${Date.now()}`, id);

    db.prepare(`
      INSERT INTO audit_events (dispute_id, event_type, description, created_at)
      VALUES (?, 'EVIDENCE_SUBMITTED_TO_PAYPAL', ?, ?)
    `).run(id, `Merchant approved packet. Evidence packet transmitted to PayPal Disputes API for case ${dispute.paypal_dispute_id}.`, nowIso);

    res.json({ success: true, paypalResponse: ppResult });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/disputes/:id/settle
 * Merchant accepts claim / issues full refund
 */
router.post("/disputes/:id/settle", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const dispute = db.prepare("SELECT * FROM disputes WHERE id = ?").get(id) as any;
    if (!dispute) return res.status(404).json({ error: "Dispute not found" });

    const ppResult = await acceptClaimPayPal(dispute.paypal_dispute_id, "Merchant accepted settlement claim to maintain customer goodwill.");

    const nowIso = new Date().toISOString();
    db.prepare("UPDATE disputes SET status = 'SETTLED', outcome = 'CLAIM_ACCEPTED_REFUNDED', updated_at = ? WHERE id = ?").run(nowIso, id);
    db.prepare("INSERT INTO audit_events (dispute_id, event_type, description, created_at) VALUES (?, 'CLAIM_SETTLED', ?, ?)").run(
      id, "Merchant chose to accept buyer claim and issue refund. Dispute fee avoided.", nowIso
    );

    res.json({ success: true, result: ppResult });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/disputes/:id/sandbox-adjudicate
 * Trigger Sandbox adjudication to show WON in demo!
 */
router.post("/disputes/:id/sandbox-adjudicate", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const dispute = db.prepare("SELECT * FROM disputes WHERE id = ?").get(id) as any;
    if (!dispute) return res.status(404).json({ error: "Dispute not found" });

    const adjudication = await adjudicateDisputeSandbox(dispute.paypal_dispute_id, "RESOLVED_MERCHANT_WON");

    const nowIso = new Date().toISOString();
    db.prepare(`
      UPDATE disputes 
      SET status = 'RESOLVED_MERCHANT_WON', outcome = 'MERCHANT_WON', updated_at = ?
      WHERE id = ?
    `).run(nowIso, id);

    db.prepare(`
      INSERT INTO audit_events (dispute_id, event_type, description, created_at)
      VALUES (?, 'PAYPAL_ADJUDICATION_WON', ?, ?)
    `).run(id, `PayPal Sandbox Adjudication complete: Claim resolved in Merchant favor! Funds of ₹${dispute.dispute_amount} released.`, nowIso);

    res.json({ success: true, adjudication });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/webhook/paypal
 * Real PayPal Webhook Ingestion Endpoint
 * Listens for CUSTOMER.DISPUTE.* events from PayPal Developer Webhook Subscriptions
 */
router.post("/webhook/paypal", async (req: Request, res: Response) => {
  try {
    const rawBody = req.body;
    const webhookId = process.env.PAYPAL_WEBHOOK_ID || "MOCK_WEBHOOK_ID";

    // 1. Verify Webhook Signature via PayPal API (or graceful sandbox bypass if unconfigured)
    const verification = await verifyWebhookSignature(req.headers, rawBody, webhookId);
    if (!verification.verified) {
      console.warn("[Webhook] Signature verification failed:", verification);
      return res.status(400).json({ error: "Invalid webhook signature", details: verification });
    }

    const eventType = rawBody?.event_type || "CUSTOMER.DISPUTE.CREATED";
    const resource = rawBody?.resource || {};
    const paypalDisputeId = resource.dispute_id || `PP-D-${Date.now()}`;
    const now = new Date();
    const nowIso = now.toISOString();

    console.log(`[DisputeShield AI] Processing Inbound PayPal Webhook: ${eventType} (ID: ${paypalDisputeId})`);

    if (eventType === "CUSTOMER.DISPUTE.RESOLVED") {
      const outcome = resource.dispute_outcome?.outcome_code || "MERCHANT_WON";
      const status = outcome.includes("MERCHANT") ? "RESOLVED_MERCHANT_WON" : "RESOLVED_BUYER_WON";

      db.prepare(`
        UPDATE disputes 
        SET status = ?, outcome = ?, updated_at = ?
        WHERE paypal_dispute_id = ?
      `).run(status, outcome, nowIso, paypalDisputeId);

      const existing = db.prepare("SELECT id FROM disputes WHERE paypal_dispute_id = ?").get(paypalDisputeId) as any;
      if (existing) {
        db.prepare(`
          INSERT INTO audit_events (dispute_id, event_type, description, created_at)
          VALUES (?, 'PAYPAL_ADJUDICATION', ?, ?)
        `).run(existing.id, `PayPal Webhook: Dispute resolved by PayPal. Outcome: ${outcome}.`, nowIso);
      }

      return res.json({ status: "SUCCESS", eventType, paypalDisputeId, outcome });
    }

    if (eventType === "CUSTOMER.DISPUTE.CREATED" || eventType === "CUSTOMER.DISPUTE.UPDATED") {
      const reasonCode = resource.dispute_reason || "MERCHANDISE_OR_SERVICE_NOT_RECEIVED";
      const disputeAmount = parseFloat(resource.dispute_amount?.value || "2499.00");
      const currency = resource.dispute_amount?.currency_code || "INR";
      const disputeFee = 120.00;
      const respondBy = resource.seller_response_due_date || new Date(now.getTime() + 8 * 86400000).toISOString();

      let reasonTitle = "Item Not Received";
      if (reasonCode === "UNAUTHORISED") {
        reasonTitle = "Unauthorized Transaction";
      } else if (reasonCode === "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED") {
        reasonTitle = "Significantly Not As Described";
      }

      const tx = (resource.disputed_transactions && resource.disputed_transactions[0]) || {};
      const orderId = tx.invoice_number || `ORD-${Date.now().toString().slice(-5)}`;
      const buyerName = tx.buyer?.name || "Customer";
      const buyerEmail = tx.buyer?.email || "customer@example.com";

      // Ensure backing shop order exists in local DB
      const existingOrder = db.prepare("SELECT * FROM shop_orders WHERE order_id = ?").get(orderId);
      if (!existingOrder) {
        const carrier = reasonCode === "UNAUTHORISED" ? "BlueDart" : "Delhivery";
        const tracking = reasonCode === "UNAUTHORISED" ? `BD-${Date.now().toString().slice(-8)}` : `DLH-${Date.now().toString().slice(-8)}`;
        db.prepare(`
          INSERT INTO shop_orders (
            id, order_id, paypal_order_id, buyer_name, buyer_email, item_title, sku,
            amount, currency, item_cost, carrier, tracking_no, shipping_status,
            shipped_at, delivered_at, shipping_address, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          `ord-${orderId}`, orderId, `PP-${orderId}`, buyerName, buyerEmail,
          reasonCode === "UNAUTHORISED" ? "Executive Noise-Cancelling Headphones" : (reasonCode === "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED" ? "Premium Italian Leather Briefcase" : "Urban All-Weather Windbreaker Jacket"),
          "SKU-EXP-001", disputeAmount, currency, Math.round(disputeAmount * 0.35),
          carrier, tracking, "DELIVERED",
          new Date(now.getTime() - 5 * 86400000).toISOString(),
          new Date(now.getTime() - 2 * 86400000).toISOString(),
          "DLF Cyber City, Phase 2, Gurugram, HR 122002",
          new Date(now.getTime() - 6 * 86400000).toISOString()
        );
      }

      // Check if dispute already exists
      let internalId = `disp-${Date.now().toString().slice(-5)}`;
      const existingDispute = db.prepare("SELECT id FROM disputes WHERE paypal_dispute_id = ?").get(paypalDisputeId) as any;
      
      if (existingDispute) {
        internalId = existingDispute.id;
        db.prepare(`
          UPDATE disputes 
          SET status = 'ACTION_REQUIRED', updated_at = ?
          WHERE id = ?
        `).run(nowIso, internalId);
      } else {
        const orderInfo = db.prepare("SELECT carrier, tracking_no FROM shop_orders WHERE order_id = ?").get(orderId) as any;
        db.prepare(`
          INSERT INTO disputes (
            id, paypal_dispute_id, order_id, buyer_name, reason, reason_code,
            dispute_amount, currency, dispute_fee, status, respond_by, decision,
            carrier_name, tracking_number, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTION_REQUIRED', ?, 'FIGHT', ?, ?, ?, ?)
        `).run(
          internalId, paypalDisputeId, orderId, buyerName, reasonTitle, reasonCode,
          disputeAmount, currency, disputeFee, respondBy,
          orderInfo?.carrier || "Delhivery", orderInfo?.tracking_no || "DLH-9921",
          nowIso, nowIso
        );
      }

      // Record audit event
      db.prepare(`
        INSERT INTO audit_events (dispute_id, event_type, description, created_at)
        VALUES (?, 'WEBHOOK_RECEIVED', ?, ?)
      `).run(
        internalId,
        `PayPal Webhook ${eventType} verified & ingested. Case: ${paypalDisputeId}. Reason: ${reasonTitle}.`,
        nowIso
      );

      // Trigger Autonomous Dispute Shield Agent to gather reason-specific evidence and compute EV
      const agentResult = await runDisputeAgent(internalId);

      return res.json({
        status: "SUCCESS",
        eventType,
        paypalDisputeId,
        internalId,
        decision: agentResult.decision,
        winProbability: agentResult.win_probability,
        narrativeSnippet: agentResult.narrative.slice(0, 150) + "...",
      });
    }

    res.json({ status: "IGNORED", eventType });
  } catch (err: any) {
    console.error("[Webhook Error]:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/simulate-dispute
 * Inject a new realistic scenario into the pipeline for live demonstration
 */
router.post("/simulate-dispute", async (req: Request, res: Response) => {
  try {
    const { scenario } = req.body;
    const now = new Date();
    const timestamp = Date.now().toString().slice(-5);
    const newOrderId = `ORD-${timestamp}`;
    const newDisputeId = `disp-${timestamp}`;
    const newPpDisputeId = `PP-D-${Date.now()}`;
    const futureDays = (d: number) => new Date(now.getTime() + d * 86400000).toISOString();
    const pastDays = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();

    let orderData: any;
    let disputeData: any;

    if (scenario === "LOW_VALUE_SETTLE") {
      orderData = {
        id: `ord-${timestamp}`,
        order_id: newOrderId,
        paypal_order_id: `PP-ORD-${timestamp}`,
        buyer_name: "Rahul Verma",
        buyer_email: "rahul.v@test.com",
        item_title: "Magnetic Cable Clip (Set of 3)",
        sku: "SKU-ACC-012",
        amount: 199.00,
        currency: "INR",
        item_cost: 50.00,
        carrier: "IndiaPost",
        tracking_no: `IP-${timestamp}99`,
        shipping_status: "IN_TRANSIT",
        shipped_at: pastDays(12),
        delivered_at: null,
        shipping_address: "Sector 14, Chandigarh, 160014",
        created_at: pastDays(13),
      };
      disputeData = {
        id: newDisputeId,
        paypal_dispute_id: newPpDisputeId,
        order_id: newOrderId,
        buyer_name: "Rahul Verma",
        reason: "Item Not Received",
        reason_code: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
        dispute_amount: 199.00,
        currency: "INR",
        dispute_fee: 120.00,
        status: "ACTION_REQUIRED",
        respond_by: futureDays(7),
        decision: "SETTLE",
        carrier_name: "IndiaPost",
        tracking_number: `IP-${timestamp}99`,
      };
    } else if (scenario === "UNAUTHORISED_3DS") {
      // Unauthorized Claim with full 3DS liability shift defense
      orderData = {
        id: `ord-${timestamp}`,
        order_id: newOrderId,
        paypal_order_id: `PP-ORD-${timestamp}`,
        buyer_name: "Aditya Nair",
        buyer_email: "aditya.n@test.com",
        item_title: "Bose QuietComfort 45 Headphones",
        sku: "SKU-AUDIO-771",
        amount: 18990.00,
        currency: "INR",
        item_cost: 11200.00,
        carrier: "BlueDart",
        tracking_no: `BD-${timestamp}33`,
        shipping_status: "DELIVERED",
        shipped_at: pastDays(4),
        delivered_at: pastDays(1),
        shipping_address: "Flat 402, Coral Heights, Indiranagar, Bengaluru, KA 560038",
        created_at: pastDays(5),
      };
      disputeData = {
        id: newDisputeId,
        paypal_dispute_id: newPpDisputeId,
        order_id: newOrderId,
        buyer_name: "Aditya Nair",
        reason: "Unauthorized Transaction",
        reason_code: "UNAUTHORISED",
        dispute_amount: 18990.00,
        currency: "INR",
        dispute_fee: 120.00,
        status: "ACTION_REQUIRED",
        respond_by: futureDays(9),
        decision: "FIGHT",
        carrier_name: "BlueDart",
        tracking_number: `BD-${timestamp}33`,
      };
    } else if (scenario === "SNAD_RETURN_POLICY") {
      // Significantly Not As Described with Catalog Specs & RMA policy defense
      orderData = {
        id: `ord-${timestamp}`,
        order_id: newOrderId,
        paypal_order_id: `PP-ORD-${timestamp}`,
        buyer_name: "Kavita Singhania",
        buyer_email: "kavita.s@test.com",
        item_title: "Handcrafted Top-Grain Leather Tote",
        sku: "SKU-LTHR-404",
        amount: 4499.00,
        currency: "INR",
        item_cost: 1650.00,
        carrier: "Delhivery",
        tracking_no: `DLH-${timestamp}77`,
        shipping_status: "DELIVERED",
        shipped_at: pastDays(7),
        delivered_at: pastDays(3),
        shipping_address: "Villa 12, Palm Meadows, Whitefield, Bengaluru, KA 560066",
        created_at: pastDays(8),
      };
      disputeData = {
        id: newDisputeId,
        paypal_dispute_id: newPpDisputeId,
        order_id: newOrderId,
        buyer_name: "Kavita Singhania",
        reason: "Significantly Not As Described",
        reason_code: "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED",
        dispute_amount: 4499.00,
        currency: "INR",
        dispute_fee: 120.00,
        status: "ACTION_REQUIRED",
        respond_by: futureDays(6),
        decision: "FIGHT",
        carrier_name: "Delhivery",
        tracking_number: `DLH-${timestamp}77`,
      };
    } else {
      // Default: High-value Urban Threads jacket / bag scenario with high win rate (INR)
      orderData = {
        id: `ord-${timestamp}`,
        order_id: newOrderId,
        paypal_order_id: `PP-ORD-${timestamp}`,
        buyer_name: "Sneha Mukherjee",
        buyer_email: "sneha.m@test.com",
        item_title: "Urban All-Weather Windbreaker Jacket",
        sku: "SKU-APP-902",
        amount: 2899.00,
        currency: "INR",
        item_cost: 950.00,
        carrier: "Delhivery",
        tracking_no: `DLH-${timestamp}88`,
        shipping_status: "DELIVERED",
        shipped_at: pastDays(5),
        delivered_at: pastDays(2),
        shipping_address: "B-201, Lake View Apts, Powai, Mumbai, 400076",
        created_at: pastDays(6),
      };
      disputeData = {
        id: newDisputeId,
        paypal_dispute_id: newPpDisputeId,
        order_id: newOrderId,
        buyer_name: "Sneha Mukherjee",
        reason: "Item Not Received",
        reason_code: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
        dispute_amount: 2899.00,
        currency: "INR",
        dispute_fee: 120.00,
        status: "ACTION_REQUIRED",
        respond_by: futureDays(8),
        decision: "FIGHT",
        carrier_name: "Delhivery",
        tracking_number: `DLH-${timestamp}88`,
      };
    }

    // Insert order
    db.prepare(`
      INSERT INTO shop_orders (
        id, order_id, paypal_order_id, buyer_name, buyer_email, item_title, sku, 
        amount, currency, item_cost, carrier, tracking_no, shipping_status, 
        shipped_at, delivered_at, shipping_address, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderData.id, orderData.order_id, orderData.paypal_order_id, orderData.buyer_name, orderData.buyer_email,
      orderData.item_title, orderData.sku, orderData.amount, orderData.currency, orderData.item_cost,
      orderData.carrier, orderData.tracking_no, orderData.shipping_status, orderData.shipped_at, orderData.delivered_at,
      orderData.shipping_address, orderData.created_at
    );

    // Insert dispute
    db.prepare(`
      INSERT INTO disputes (
        id, paypal_dispute_id, order_id, buyer_name, reason, reason_code, 
        dispute_amount, currency, dispute_fee, status, respond_by, decision, 
        carrier_name, tracking_number, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      disputeData.id, disputeData.paypal_dispute_id, disputeData.order_id, disputeData.buyer_name,
      disputeData.reason, disputeData.reason_code, disputeData.dispute_amount, disputeData.currency,
      disputeData.dispute_fee, disputeData.status, disputeData.respond_by, disputeData.decision,
      disputeData.carrier_name, disputeData.tracking_number, now.toISOString(), now.toISOString()
    );

    // Insert initial audit
    db.prepare("INSERT INTO audit_events (dispute_id, event_type, description, created_at) VALUES (?, 'WEBHOOK_RECEIVED', ?, ?)").run(
      disputeData.id, `PayPal Webhook CUSTOMER.DISPUTE.CREATED received for dispute ${disputeData.paypal_dispute_id}`, now.toISOString()
    );

    // Automatically trigger agent processing immediately
    const agentResult = await runDisputeAgent(disputeData.id);

    res.json({
      success: true,
      disputeId: disputeData.id,
      agentResult,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/stats
 * Key executive metrics for the dashboard
 */
router.get("/stats", (req: Request, res: Response) => {
  try {
    const totalDisputes = db.prepare("SELECT COUNT(*) as count FROM disputes").get() as any;
    const actionRequired = db.prepare("SELECT COUNT(*) as count FROM disputes WHERE status = 'ACTION_REQUIRED'").get() as any;
    const wonDisputes = db.prepare("SELECT COUNT(*) as count FROM disputes WHERE status = 'RESOLVED_MERCHANT_WON'").get() as any;
    
    const atRiskRow = db.prepare("SELECT SUM(dispute_amount) as total FROM disputes WHERE status IN ('ACTION_REQUIRED', 'UNDER_REVIEW')").get() as any;
    const savedRow = db.prepare("SELECT SUM(dispute_amount) as total FROM disputes WHERE status = 'RESOLVED_MERCHANT_WON'").get() as any;

    // Carrier dispute distribution for root cause prevention insights
    const carrierInsights = db.prepare(`
      SELECT carrier_name, COUNT(*) as dispute_count, AVG(win_probability) as avg_win_prob
      FROM disputes
      WHERE carrier_name IS NOT NULL
      GROUP BY carrier_name
    `).all();

    res.json({
      totalDisputes: totalDisputes.count,
      actionRequired: actionRequired.count,
      wonDisputes: wonDisputes.count,
      atRiskCapital: atRiskRow.total || 0,
      savedCapital: savedRow.total || 0,
      winRate: totalDisputes.count > 0 ? Math.round((wonDisputes.count / Math.max(1, wonDisputes.count + (totalDisputes.count - wonDisputes.count - actionRequired.count))) * 100) : 85,
      carrierInsights,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
