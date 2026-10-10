import Database from "better-sqlite3";
import path from "path";

const dbPath = path.resolve(__dirname, "../../disputes.db");
export const db = new Database(dbPath);

// Enable foreign keys and WAL mode for snappy concurrency
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS shop_orders (
      id TEXT PRIMARY KEY,
      order_id TEXT UNIQUE NOT NULL,
      paypal_order_id TEXT,
      buyer_name TEXT NOT NULL,
      buyer_email TEXT NOT NULL,
      item_title TEXT NOT NULL,
      sku TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      item_cost REAL NOT NULL,
      carrier TEXT NOT NULL,
      tracking_no TEXT NOT NULL,
      shipping_status TEXT NOT NULL,
      shipped_at TEXT NOT NULL,
      delivered_at TEXT,
      shipping_address TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS disputes (
      id TEXT PRIMARY KEY,
      paypal_dispute_id TEXT UNIQUE NOT NULL,
      order_id TEXT NOT NULL,
      buyer_name TEXT NOT NULL,
      reason TEXT NOT NULL,
      reason_code TEXT NOT NULL,
      dispute_amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      dispute_fee REAL NOT NULL DEFAULT 120,
      status TEXT NOT NULL, -- 'ACTION_REQUIRED', 'UNDER_REVIEW', 'RESOLVED_MERCHANT_WON', 'RESOLVED_BUYER_WON', 'SETTLED'
      respond_by TEXT NOT NULL,
      decision TEXT, -- 'FIGHT', 'SETTLE', 'PENDING'
      win_probability REAL DEFAULT 0,
      ev_fight REAL DEFAULT 0,
      ev_settle REAL DEFAULT 0,
      outcome TEXT,
      carrier_name TEXT,
      tracking_number TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES shop_orders(order_id)
    );

    CREATE TABLE IF NOT EXISTS evidence_items (
      id TEXT PRIMARY KEY,
      dispute_id TEXT NOT NULL,
      evidence_type TEXT NOT NULL, -- 'TRACKING_PROOF', 'ORDER_RECEIPT', 'ADDRESS_MATCH', 'DELIVERY_CONFIRMATION', 'CUSTOMER_COMMUNICATION'
      source TEXT NOT NULL,
      label TEXT NOT NULL,
      value TEXT NOT NULL,
      is_verified INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'FOUND', -- 'FOUND', 'MISSING', 'FLAGGED'
      raw_payload TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (dispute_id) REFERENCES disputes(id)
    );

    CREATE TABLE IF NOT EXISTS packets (
      id TEXT PRIMARY KEY,
      dispute_id TEXT UNIQUE NOT NULL,
      narrative TEXT NOT NULL,
      claims_json TEXT NOT NULL,
      recommendation TEXT NOT NULL,
      status TEXT NOT NULL, -- 'DRAFTED', 'APPROVED', 'SUBMITTED', 'REJECTED'
      citation_audit_json TEXT,
      paypal_submission_id TEXT,
      submitted_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (dispute_id) REFERENCES disputes(id)
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dispute_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (dispute_id) REFERENCES disputes(id)
    );
  `);

  try {
    db.prepare("ALTER TABLE packets ADD COLUMN citation_audit_json TEXT").run();
  } catch {
    // Column already exists
  }

  seedInitialData();
}

function seedInitialData() {
  const existing = db.prepare("SELECT COUNT(*) as count FROM shop_orders").get() as { count: number };
  if (existing.count > 0) return;

  const now = new Date();
  const pastDays = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();
  const futureDays = (d: number) => new Date(now.getTime() + d * 86400000).toISOString();

  // Seed Orders
  const insertOrder = db.prepare(`
    INSERT INTO shop_orders (
      id, order_id, paypal_order_id, buyer_name, buyer_email, item_title, sku, 
      amount, currency, item_cost, carrier, tracking_no, shipping_status, 
      shipped_at, delivered_at, shipping_address, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertOrder.run(
    "ord-101",
    "ORD-84920",
    "PP-ORD-993821",
    "Ravi Sharma",
    "ravi.sharma@example.com",
    "Urban Voyager Backpack (Waterproof 30L)",
    "SKU-BP-001",
    1499.00,
    "INR",
    580.00,
    "BlueDart",
    "BD-982347101",
    "DELIVERED",
    pastDays(7),
    pastDays(4),
    "Flat 402, Sunshine Heights, Indiranagar, Bangalore, 560038",
    pastDays(8)
  );

  insertOrder.run(
    "ord-102",
    "ORD-84921",
    "PP-ORD-993822",
    "Ananya Iyer",
    "ananya.iyer@example.com",
    "Noise Cancelling Pro Wireless Earbuds",
    "SKU-AUD-502",
    3499.00,
    "INR",
    1200.00,
    "Delhivery",
    "DLH-55421990",
    "DELIVERED",
    pastDays(10),
    pastDays(6),
    "12B Green Glen Layout, Bellandur, Bangalore, 560103",
    pastDays(11)
  );

  insertOrder.run(
    "ord-103",
    "ORD-84922",
    "PP-ORD-993823",
    "Karthik Menon",
    "karthik.m@example.com",
    "Ergonomic Silicone Matte Phone Case",
    "SKU-ACC-091",
    249.00,
    "INR",
    75.00,
    "IndiaPost",
    "IP-88129033",
    "IN_TRANSIT",
    pastDays(14),
    null,
    "44 Marine Drive, Kochi, 682011",
    pastDays(15)
  );

  insertOrder.run(
    "ord-104",
    "ORD-84923",
    "PP-ORD-993824",
    "Priya Nair",
    "priya.nair@example.com",
    "Minimalist Chrono Sapphire Wristwatch",
    "SKU-WT-400",
    7999.00,
    "INR",
    3100.00,
    "BlueDart",
    "BD-982347890",
    "DELIVERED",
    pastDays(5),
    pastDays(2),
    "Plot 88, Banjara Hills Rd No 3, Hyderabad, 500034",
    pastDays(6)
  );

  // Seed Disputes
  const insertDispute = db.prepare(`
    INSERT INTO disputes (
      id, paypal_dispute_id, order_id, buyer_name, reason, reason_code, 
      dispute_amount, currency, dispute_fee, status, respond_by, decision, 
      win_probability, ev_fight, ev_settle, outcome, carrier_name, tracking_number, 
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Dispute 1: The flagship Ravi Sharma backpack case
  insertDispute.run(
    "disp-001",
    "PP-D-9481029",
    "ORD-84920",
    "Ravi Sharma",
    "Item Not Received",
    "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
    1499.00,
    "INR",
    120.00,
    "ACTION_REQUIRED",
    futureDays(6),
    "FIGHT",
    0.82,
    734.20,
    -580.00,
    null,
    "BlueDart",
    "BD-982347101",
    pastDays(2),
    pastDays(2)
  );

  // Dispute 2: Ananya Iyer (high value earbuds, delivered with signature)
  insertDispute.run(
    "disp-002",
    "PP-D-9481030",
    "ORD-84921",
    "Ananya Iyer",
    "Unauthorised Transaction",
    "UNAUTHORISED",
    3499.00,
    "INR",
    120.00,
    "ACTION_REQUIRED",
    futureDays(3),
    "FIGHT",
    0.91,
    2730.00,
    -1200.00,
    null,
    "Delhivery",
    "DLH-55421990",
    pastDays(3),
    pastDays(3)
  );

  // Dispute 3: Low-cost phone case (INR 249, still in transit - clear Settle recommendation)
  insertDispute.run(
    "disp-003",
    "PP-D-9481031",
    "ORD-84922",
    "Karthik Menon",
    "Item Not Received",
    "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
    249.00,
    "INR",
    120.00,
    "ACTION_REQUIRED",
    futureDays(2),
    "SETTLE",
    0.25,
    -195.50,
    -75.00,
    null,
    "IndiaPost",
    "IP-88129033",
    pastDays(4),
    pastDays(4)
  );

  // Dispute 4: Already Won showcase
  insertDispute.run(
    "disp-004",
    "PP-D-9481028",
    "ORD-84923",
    "Priya Nair",
    "Significantly Not As Described",
    "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED",
    7999.00,
    "INR",
    120.00,
    "RESOLVED_MERCHANT_WON",
    pastDays(1),
    "FIGHT",
    0.88,
    6140.00,
    -3100.00,
    "MERCHANT_WON",
    "BlueDart",
    "BD-982347890",
    pastDays(9),
    pastDays(1)
  );

  // Seed Evidence for disp-001
  const insertEvidence = db.prepare(`
    INSERT INTO evidence_items (id, dispute_id, evidence_type, source, label, value, is_verified, status, raw_payload, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertEvidence.run(
    "ev-01",
    "disp-001",
    "TRACKING_PROOF",
    "BlueDart Shipment Tracking API",
    "Carrier Delivery Confirmation",
    "Tracking #BD-982347101 confirmed Delivered on Oct 06 at 14:22 IST.",
    1,
    "FOUND",
    JSON.stringify({ carrier: "BlueDart", tracking: "BD-982347101", status: "DELIVERED", timestamp: pastDays(4) }),
    pastDays(2)
  );

  insertEvidence.run(
    "ev-02",
    "disp-001",
    "ORDER_RECEIPT",
    "Merchant Store OMS (Order #ORD-84920)",
    "Itemized Order & Fulfillment Log",
    "Order #ORD-84920: Urban Voyager Backpack 30L (Qty 1), INR 1,499.00 paid via PayPal.",
    1,
    "FOUND",
    JSON.stringify({ order_id: "ORD-84920", amount: 1499, item: "Urban Voyager Backpack" }),
    pastDays(2)
  );

  insertEvidence.run(
    "ev-03",
    "disp-001",
    "ADDRESS_MATCH",
    "PayPal Disputes API vs Carrier Manifest",
    "Geographic Address Match",
    "Shipping manifest address matches PayPal registered buyer address (Indiranagar, Bangalore 560038).",
    1,
    "FOUND",
    JSON.stringify({ match_rate: "100%", destination_pin: "560038" }),
    pastDays(2)
  );

  insertEvidence.run(
    "ev-04",
    "disp-001",
    "DELIVERY_CONFIRMATION",
    "Carrier Manifest POD",
    "Recipient Signature Proof",
    "Carrier digital signature is not captured on standard ground consignment.",
    0,
    "FLAGGED",
    JSON.stringify({ requires_signature: false, signature_present: false }),
    pastDays(2)
  );

  // Seed Evidence for disp-002
  insertEvidence.run(
    "ev-05",
    "disp-002",
    "TRACKING_PROOF",
    "Delhivery Express API",
    "OTP-Verified Delivery",
    "Tracking #DLH-55421990 delivered with secure OTP confirmation to Ananya Iyer.",
    1,
    "FOUND",
    JSON.stringify({ otp_verified: true, timestamp: pastDays(6) }),
    pastDays(3)
  );

  // Seed Drafted Packet for disp-001
  const insertPacket = db.prepare(`
    INSERT INTO packets (id, dispute_id, narrative, claims_json, recommendation, status, paypal_submission_id, submitted_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const claimsDisp001 = [
    {
      claim_text: "Merchant fulfilled order ORD-84920 in compliance with PayPal Seller Protection guidelines.",
      evidence_id: "ev-02"
    },
    {
      claim_text: "Consignment was dispatched via verified carrier BlueDart under tracking BD-982347101 and successfully delivered on Oct 06.",
      evidence_id: "ev-01"
    },
    {
      claim_text: "Delivery destination exactly matches the buyer's PayPal verified shipping address in Indiranagar, Bangalore 560038.",
      evidence_id: "ev-03"
    }
  ];

  const narrativeDisp001 = `Dear PayPal Disputes Team,\n\nThis evidence packet is submitted on behalf of Urban Threads in response to Dispute PP-D-9481029 regarding Order ORD-84920 (Amount: INR 1,499.00).\n\n1. Fulfilment Record: The order was placed on Oct 02 and fulfilled on Oct 03 [Citation: OMS Record ev-02].\n2. Courier Delivery: Shipment was handled by BlueDart (Tracking #BD-982347101) and officially marked DELIVERED to the recipient's premises on Oct 06 [Citation: Tracking Proof ev-01].\n3. Address Verification: The delivery address coincides with the PayPal confirmed address on file [Citation: Address Verification ev-03].\n\nBased on comprehensive proof of fulfillment, we respectfully request closure of this claim in favor of the merchant under PayPal Seller Protection policy.`;

  insertPacket.run(
    "pkt-001",
    "disp-001",
    narrativeDisp001,
    JSON.stringify(claimsDisp001),
    "FIGHT",
    "DRAFTED",
    null,
    null,
    pastDays(2)
  );

  // Seed Audit Events
  const insertAudit = db.prepare(`
    INSERT INTO audit_events (dispute_id, event_type, description, created_at)
    VALUES (?, ?, ?, ?)
  `);

  insertAudit.run("disp-001", "WEBHOOK_RECEIVED", "Received CUSTOMER.DISPUTE.CREATED webhook for PP-D-9481029", pastDays(2));
  insertAudit.run("disp-001", "EVIDENCE_GATHERED", "Pulled BlueDart tracking #BD-982347101 and OMS record ORD-84920", pastDays(2));
  insertAudit.run("disp-001", "EV_EVALUATED", "Calculated Expected Value: Fight EV (+734.20) > Settle EV (-580.00). Recommendation: FIGHT (Win Prob: 82%)", pastDays(2));
  insertAudit.run("disp-001", "PACKET_DRAFTED", "AI Agent generated zero-hallucination grounded packet with 3 verifiable citations", pastDays(2));
}
