import React, { useState, useEffect, useCallback } from "react";
import { Header } from "./components/Header";
import { StatsCards } from "./components/StatsCards";
import { DisputesGrid, DisputeRow } from "./components/DisputesGrid";
import { DisputeDetailModal } from "./components/DisputeDetailModal";
import { PreventionRadar } from "./components/PreventionRadar";
import { SimulateModal } from "./components/SimulateModal";

export const App: React.FC = () => {
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [stats, setStats] = useState<any>({
    totalDisputes: 0,
    actionRequired: 0,
    wonDisputes: 0,
    atRiskCapital: 0,
    savedCapital: 0,
    winRate: 85,
    carrierInsights: [],
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  
  // Modals state
  const [selectedDisputeId, setSelectedDisputeId] = useState<string | null>(null);
  const [selectedDisputeDetail, setSelectedDisputeDetail] = useState<any | null>(null);
  const [isSimulateOpen, setIsSimulateOpen] = useState<boolean>(false);
  const [simulateLoading, setSimulateLoading] = useState<boolean>(false);

  // Load data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [disputesRes, statsRes] = await Promise.all([
        fetch("/api/disputes"),
        fetch("/api/stats"),
      ]);

      if (disputesRes.ok && statsRes.ok) {
        const disputesData = await disputesRes.json();
        const statsData = await statsRes.json();
        setDisputes(disputesData);
        setStats(statsData);
      }
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Load specific dispute detail
  const handleSelectDispute = async (id: string) => {
    try {
      setSelectedDisputeId(id);
      const res = await fetch(`/api/disputes/${id}`);
      if (res.ok) {
        const detail = await res.json();
        setSelectedDisputeDetail(detail);
      }
    } catch (err) {
      console.error("Failed to load dispute details:", err);
    }
  };

  // Submit Evidence to PayPal
  const handleSubmitEvidence = async (disputeId: string) => {
    try {
      setSubmitting(true);
      const res = await fetch(`/api/disputes/${disputeId}/approve-submit`, {
        method: "POST",
      });
      if (res.ok) {
        await handleSelectDispute(disputeId);
        await fetchData();
      }
    } catch (err) {
      console.error("Failed to submit evidence:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // Settle Dispute
  const handleSettle = async (disputeId: string) => {
    try {
      setSubmitting(true);
      const res = await fetch(`/api/disputes/${disputeId}/settle`, {
        method: "POST",
      });
      if (res.ok) {
        await handleSelectDispute(disputeId);
        await fetchData();
      }
    } catch (err) {
      console.error("Failed to settle dispute:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // Adjudicate to Won in Sandbox (Demo highlight)
  const handleAdjudicateWon = async (disputeId: string) => {
    try {
      setSubmitting(true);
      const res = await fetch(`/api/disputes/${disputeId}/sandbox-adjudicate`, {
        method: "POST",
      });
      if (res.ok) {
        await handleSelectDispute(disputeId);
        await fetchData();
      }
    } catch (err) {
      console.error("Failed to adjudicate dispute:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // Simulate new inbound dispute webhook
  const handleSimulateDispute = async (scenario: string) => {
    try {
      setSimulateLoading(true);
      const res = await fetch("/api/simulate-dispute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario }),
      });
      if (res.ok) {
        const data = await res.json();
        setIsSimulateOpen(false);
        await fetchData();
        // Immediately select the simulated dispute to showcase the agent's work
        if (data.disputeId) {
          handleSelectDispute(data.disputeId);
        }
      }
    } catch (err) {
      console.error("Simulation error:", err);
    } finally {
      setSimulateLoading(false);
    }
  };

  return (
    <div style={{ paddingBottom: "40px" }}>
      {/* Top Header */}
      <Header
        onSimulateClick={() => setIsSimulateOpen(true)}
        onRefresh={fetchData}
        loading={loading}
      />

      {/* KPI Stats */}
      <StatsCards stats={stats} />

      {/* Main Dispute Management Command Center (AG Grid) */}
      <DisputesGrid
        disputes={disputes}
        onSelectDispute={handleSelectDispute}
        selectedDisputeId={selectedDisputeId}
      />

      {/* Root-cause Prevention Insights Radar */}
      <PreventionRadar carrierInsights={stats.carrierInsights} />

      {/* Dispute Detail & Action Modal */}
      {selectedDisputeDetail && (
        <DisputeDetailModal
          data={selectedDisputeDetail}
          onClose={() => {
            setSelectedDisputeDetail(null);
            setSelectedDisputeId(null);
          }}
          onSubmitEvidence={handleSubmitEvidence}
          onSettle={handleSettle}
          onAdjudicateWon={handleAdjudicateWon}
          submitting={submitting}
        />
      )}

      {/* Simulation Modal */}
      <SimulateModal
        isOpen={isSimulateOpen}
        onClose={() => setIsSimulateOpen(false)}
        onSimulate={handleSimulateDispute}
        loading={simulateLoading}
      />
    </div>
  );
};

export default App;
