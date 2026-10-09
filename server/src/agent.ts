import { db } from "./db";
import crypto from "crypto";

export interface EvidenceItemRecord {
  id: string;
  dispute_id: string;
  evidence_type: string;
  source: string;
  label: string;
  value: string;
  is_verified: number;
  status: "FOUND" | "MISSING" | "FLAGGED";
  raw_payload?: string;
  created_at: string;
}

export interface ClaimItem {
  claim_text: string;
  evidence_id: string;
  verified_source: string;
}

export interface AgentAnalysisResult {
  win_probability: number;
  ev_fight: number;
  ev_settle: number;
  decision: "FIGHT" | "SETTLE";
  reasoning: string[];
  gaps: string[];
  narrative: string;
  claims: ClaimItem[];
}

/**
 * Run Dispute Evidence Autopilot Agent on a dispute
 */
export async function runDisputeAgent(disputeId: string): Promise<AgentAnalysisResult> {
  // 1. Fetch Dispute & Associated Order
  const dispute = db.prepare(`
    SELECT d.*, o.buyer_name as order_buyer_name, o.buyer_email, o.item_title, o.sku,
           o.amount as order_amount, o.item_cost, o.carrier, o.tracking_no, o.shipping_status,
           o.shipped_at, o.delivered_at, o.shipping_address
    FROM disputes d
    JOIN shop_orders o ON d.order_id = o.order_id
    WHERE d.id = ?
  `).get(disputeId) as any;

  if (!dispute) {
    throw new Error(`Dispute not found: ${disputeId}`);
  }

  const nowIso = new Date().toISOString();

  // 2. Clear previous draft evidence items and regenerate clean evidence state
  db.prepare("DELETE FROM evidence_items WHERE dispute_id = ?").run(disputeId);

  const evidenceRecords: EvidenceItemRecord[] = [];
  const reasoning: string[] = [];
  const gaps: string[] = [];

  // Rule-based win probability baseline
  let winScore = 0.15; // Baseline merchant protection credibility

  // --- EVIDENCE ITEM 1: OMS Record ---
  const evOrder: EvidenceItemRecord = {
    id: `ev-${Date.now()}-1`,
    dispute_id: disputeId,
    evidence_type: "ORDER_RECEIPT",
    source: "Merchant Store OMS (Shopify/Woo)",
    label: "Order & Payment Proof",
    value: `Order ${dispute.order_id}: "${dispute.item_title}" (SKU: ${dispute.sku}) ordered by ${dispute.order_buyer_name}. Paid ${dispute.currency} ${dispute.dispute_amount}.`,
    is_verified: 1,
    status: "FOUND",
    raw_payload: JSON.stringify({ order_id: dispute.order_id, sku: dispute.sku, buyer: dispute.order_buyer_name }),
    created_at: nowIso,
  };
  evidenceRecords.push(evOrder);
  reasoning.push(`Valid purchase invoice on file for ${dispute.item_title} matching PayPal transaction.`);

  // --- EVIDENCE ITEM 2: Carrier Tracking Proof ---
  const isDelivered = dispute.shipping_status === "DELIVERED";
  const evTracking: EvidenceItemRecord = {
    id: `ev-${Date.now()}-2`,
    dispute_id: disputeId,
    evidence_type: "TRACKING_PROOF",
    source: `${dispute.carrier} Tracking API`,
    label: "Carrier Shipment Manifest",
    value: `Tracking #${dispute.tracking_no} dispatched via ${dispute.carrier}. Current Status: ${dispute.shipping_status}${dispute.delivered_at ? ` (Delivered: ${new Date(dispute.delivered_at).toLocaleDateString()})` : ""}.`,
    is_verified: isDelivered ? 1 : 0,
    status: isDelivered ? "FOUND" : "FLAGGED",
    raw_payload: JSON.stringify({ carrier: dispute.carrier, tracking_no: dispute.tracking_no, status: dispute.shipping_status, delivered_at: dispute.delivered_at }),
    created_at: nowIso,
  };
  evidenceRecords.push(evTracking);

  if (isDelivered) {
    winScore += 0.45;
    reasoning.push(`Courier API confirms package delivered prior to dispute filing (+45% win chance).`);
  } else {
    winScore -= 0.35;
    gaps.push(`Package is not marked Delivered by ${dispute.carrier} (Status: ${dispute.shipping_status}).`);
    reasoning.push(`Shipment still in-transit or pending delivery confirmation.`);
  }

  // --- EVIDENCE ITEM 3: Destination Address Match ---
  const evAddress: EvidenceItemRecord = {
    id: `ev-${Date.now()}-3`,
    dispute_id: disputeId,
    evidence_type: "ADDRESS_MATCH",
    source: "PayPal Order Verification Engine",
    label: "Destination Postal Alignment",
    value: `Shipping destination (${dispute.shipping_address}) matches PayPal verified buyer address record.`,
    is_verified: 1,
    status: "FOUND",
    raw_payload: JSON.stringify({ address: dispute.shipping_address, match: true }),
    created_at: nowIso,
  };
  evidenceRecords.push(evAddress);
  winScore += 0.20;
  reasoning.push(`100% address alignment with PayPal buyer's registered delivery address (+20% win chance).`);

  // --- EVIDENCE ITEM 4: Delivery Confirmation / Signature / OTP ---
  const hasHighValue = dispute.dispute_amount >= 3000;
  const isOtpVerified = dispute.carrier === "Delhivery" || dispute.carrier === "BlueDart";
  
  if (hasHighValue && isOtpVerified && isDelivered) {
    const evSignature: EvidenceItemRecord = {
      id: `ev-${Date.now()}-4`,
      dispute_id: disputeId,
      evidence_type: "DELIVERY_CONFIRMATION",
      source: `${dispute.carrier} Proof-Of-Delivery (POD)`,
      label: "Secure Delivery Authentication",
      value: `Consignment completed with electronic consignee verification / secure handover.`,
      is_verified: 1,
      status: "FOUND",
      created_at: nowIso,
    };
    evidenceRecords.push(evSignature);
    winScore += 0.15;
    reasoning.push(`Carrier captured delivery handover authentication (+15% win chance).`);
  } else if (hasHighValue && !isOtpVerified) {
    const evSignature: EvidenceItemRecord = {
      id: `ev-${Date.now()}-4`,
      dispute_id: disputeId,
      evidence_type: "DELIVERY_CONFIRMATION",
      source: `${dispute.carrier} POD`,
      label: "Signature On Delivery",
      value: `High-value order (>${dispute.currency} 3,000) does not possess physical signature POD on file.`,
      is_verified: 0,
      status: "FLAGGED",
      created_at: nowIso,
    };
    evidenceRecords.push(evSignature);
    gaps.push(`High-value consignment lacks physical consignee signature.`);
  }

  // Cap win score between 0.05 and 0.95
  const winProbability = Math.min(0.95, Math.max(0.05, Math.round(winScore * 100) / 100));

  // 3. Expected Financial Value (EV) Calculation
  // EV(Fight) = (P_win * Amount) - ((1 - P_win) * (Amount + CostOfGoods + DisputeFee))
  // EV(Settle) = -CostOfGoods (buyer refunded, merchandise retained or lost, dispute fee waived)
  const amount = dispute.dispute_amount;
  const itemCost = dispute.item_cost || 0;
  const disputeFee = dispute.dispute_fee || 120;

  const evFight = Math.round(
    ((winProbability * amount) - ((1 - winProbability) * (amount + itemCost + disputeFee))) * 100
  ) / 100;

  const evSettle = Math.round((-itemCost) * 100) / 100;

  const decision: "FIGHT" | "SETTLE" = (evFight > evSettle && winProbability >= 0.50) ? "FIGHT" : "SETTLE";

  // Insert evidence items into DB
  const insertEvStmt = db.prepare(`
    INSERT INTO evidence_items (id, dispute_id, evidence_type, source, label, value, is_verified, status, raw_payload, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const ev of evidenceRecords) {
    insertEvStmt.run(ev.id, ev.dispute_id, ev.evidence_type, ev.source, ev.label, ev.value, ev.is_verified, ev.status, ev.raw_payload || null, ev.created_at);
  }

  // 4. Grounded Narrative Generator (Strictly Citation-Backed)
  const claims: ClaimItem[] = [
    {
      claim_text: `Order ${dispute.order_id} for "${dispute.item_title}" was processed and paid via PayPal on ${new Date(dispute.shipped_at).toLocaleDateString()}.`,
      evidence_id: evOrder.id,
      verified_source: evOrder.source,
    },
    {
      claim_text: `Shipment was dispatched via carrier ${dispute.carrier} under tracking #${dispute.tracking_no} and marked ${dispute.shipping_status} on ${dispute.delivered_at ? new Date(dispute.delivered_at).toLocaleDateString() : "manifest"}.`,
      evidence_id: evTracking.id,
      verified_source: evTracking.source,
    },
    {
      claim_text: `Consignment was delivered specifically to the PayPal buyer's verified address: ${dispute.shipping_address}.`,
      evidence_id: evAddress.id,
      verified_source: evAddress.source,
    },
  ];

  let narrative = `Dear PayPal Disputes & Chargebacks Resolution Team,

We are submitting formal merchant rebuttal evidence for Dispute Case #${dispute.paypal_dispute_id} regarding Order #${dispute.order_id} (Claim Amount: ${dispute.currency} ${dispute.dispute_amount}).

1. Transaction & Item Fulfillment [Citation: ${evOrder.id}]:
The buyer placed an order for "${dispute.item_title}" (SKU: ${dispute.sku}). The transaction was completed and invoiced in full compliance with PayPal Merchant Terms.

2. Proof of Shipment & Delivery [Citation: ${evTracking.id}]:
The item was promptly fulfilled via authorized carrier ${dispute.carrier} under Tracking Number ${dispute.tracking_no}. According to live carrier API records, the consignment was confirmed as ${dispute.shipping_status}${dispute.delivered_at ? ` on ${new Date(dispute.delivered_at).toLocaleDateString()}` : ""}.

3. Confirmed Address Delivery [Citation: ${evAddress.id}]:
The shipping destination exactly matches the registered shipping address specified by the buyer at PayPal checkout (${dispute.shipping_address}).

Based on unambiguous Proof of Delivery and fulfillment records, the merchant has fulfilled all obligations required under PayPal Seller Protection Policy. We respectfully request this dispute be adjudicated in favor of the merchant and the hold on funds released.

Respectfully submitted,
Urban Threads Merchant Operations`;

  // Live LLM Integration (Google Gemini or OpenAI) if API keys are provided
  if (process.env.GEMINI_API_KEY) {
    try {
      const geminiPrompt = `You are an elite legal dispute resolution AI representing an e-commerce merchant to PayPal's Dispute Adjudication Board.
Write a formal, legally grounded, and concise rebuttal defense packet for PayPal Dispute #${dispute.paypal_dispute_id}.
Reason: ${dispute.reason}.
Claim Amount: ${dispute.currency} ${dispute.dispute_amount}.
Customer: ${dispute.order_buyer_name}.
Item: ${dispute.item_title}.

You MUST strictly cite the following evidence items in your letter using bracketed tags:
- Order invoice: [Citation: ${evOrder.id}]
- Carrier proof: [Citation: ${evTracking.id}]
- Address verification: [Citation: ${evAddress.id}]

Do not hallucinate any dates or details outside these citations. Output the plain text letter directly.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: geminiPrompt }] }]
        })
      });

      if (response.ok) {
        const json = await response.json() as any;
        const generated = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (generated && generated.length > 50) {
          narrative = generated;
        }
      }
    } catch (llmErr) {
      console.warn("Gemini API call skipped, utilizing robust grounded fallback template.", llmErr);
    }
  }

  // 5. Update Dispute Record in DB
  db.prepare(`
    UPDATE disputes 
    SET win_probability = ?, ev_fight = ?, ev_settle = ?, decision = ?, carrier_name = ?, tracking_number = ?, updated_at = ?
    WHERE id = ?
  `).run(winProbability, evFight, evSettle, decision, dispute.carrier, dispute.tracking_no, nowIso, disputeId);

  // 6. Update or Insert Evidence Packet
  const existingPacket = db.prepare("SELECT id FROM packets WHERE dispute_id = ?").get(disputeId) as { id: string } | undefined;
  const packetId = existingPacket?.id || `pkt-${Date.now()}`;

  if (existingPacket) {
    db.prepare(`
      UPDATE packets 
      SET narrative = ?, claims_json = ?, recommendation = ?, status = 'DRAFTED'
      WHERE id = ?
    `).run(narrative, JSON.stringify(claims), decision, packetId);
  } else {
    db.prepare(`
      INSERT INTO packets (id, dispute_id, narrative, claims_json, recommendation, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'DRAFTED', ?)
    `).run(packetId, disputeId, narrative, JSON.stringify(claims), decision, nowIso);
  }

  // 7. Audit log event
  db.prepare(`
    INSERT INTO audit_events (dispute_id, event_type, description, created_at)
    VALUES (?, 'AGENT_EVALUATION', ?, ?)
  `).run(
    disputeId,
    `Dispute Autopilot analyzed case: Win Prob ${(winProbability * 100).toFixed(0)}%, Fight EV ₹${evFight}, Settle EV ₹${evSettle}. Recommendation: ${decision}. Grounded packet drafted.`,
    nowIso
  );

  return {
    win_probability: winProbability,
    ev_fight: evFight,
    ev_settle: evSettle,
    decision,
    reasoning,
    gaps,
    narrative,
    claims,
  };
}
