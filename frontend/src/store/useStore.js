import { create } from 'zustand';

const API_BASE = 'http://localhost:3001';

const useStore = create((set, get) => ({
  // ── Telemetry State ─────────────────────────────────
  telemetry: null,
  telemetryHistory: [],
  anomalies: [],

  // ── Incident State ──────────────────────────────────
  incident: null,
  diagnosis: null,

  // ── Call State ──────────────────────────────────────
  callStatus: null,
  transcript: [],

  // ── Mechanics ───────────────────────────────────────
  mechanics: [],

  // ── System Logs ─────────────────────────────────────
  logs: [],

  // ── UI State ────────────────────────────────────────
  activeTab: 'dashboard',
  activeFault: null,
  isSimulating: false,
  isDemoRunning: false,

  // ── Actions ─────────────────────────────────────────
  setActiveTab: (tab) => set({ activeTab: tab }),

  updateTelemetry: (reading) => set((state) => ({
    telemetry: reading,
    telemetryHistory: [...state.telemetryHistory.slice(-60), reading],
  })),

  setAnomalies: (anomalies) => set({ anomalies }),

  updateIncident: (incident) => set({
    incident,
    diagnosis: incident?.diagnosis || get().diagnosis,
    callStatus: incident?.callStatus || get().callStatus,
    transcript: incident?.transcript || get().transcript,
    mechanics: incident?.mechanics || get().mechanics,
  }),

  setDiagnosis: (diagnosis) => set({ diagnosis }),

  setCallStatus: (status) => set({ callStatus: status }),

  addTranscriptLine: (line) => set((state) => ({
    transcript: [...state.transcript, line],
  })),

  setMechanics: (mechanics) => set({ mechanics }),

  addLog: (log) => set((state) => ({
    logs: [...state.logs.slice(-300), log],
  })),

  setLogsHistory: (logs) => set({ logs }),

  // ── API Actions ─────────────────────────────────────
  simulateFault: async (type) => {
    set({ activeFault: type, isSimulating: true });
    try {
      const res = await fetch(`${API_BASE}/simulate-fault`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      return await res.json();
    } catch (err) {
      console.error('Simulate fault error:', err);
    }
  },

  startDemo: async () => {
    set({ isDemoRunning: true });
    try {
      const res = await fetch(`${API_BASE}/test-demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      return await res.json();
    } catch (err) {
      console.error('Demo start error:', err);
    }
  },

  resetDemo: async () => {
    try {
      const res = await fetch(`${API_BASE}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      set({
        telemetry: null,
        telemetryHistory: [],
        anomalies: [],
        incident: null,
        diagnosis: null,
        callStatus: null,
        transcript: [],
        mechanics: [],
        logs: [],
        activeFault: null,
        isSimulating: false,
        isDemoRunning: false,
      });
      return await res.json();
    } catch (err) {
      console.error('Reset error:', err);
    }
  },

  triggerResolve: async (action) => {
    try {
      const res = await fetch(`${API_BASE}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      return await res.json();
    } catch (err) {
      console.error('Resolve error:', err);
    }
  },
}));

export default useStore;
