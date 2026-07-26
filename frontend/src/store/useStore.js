import { create } from 'zustand';
const API_BASE = 'http://localhost:3001';
const useStore = create((set, get) => ({
  telemetry: null,
  telemetryHistory: [],
  anomalies: [],
  incident: null,
  diagnosis: null,
  healthScore: 100,
  recoveryProgress: null,
  callStatus: null,
  transcript: [],
  mechanics: [],
  logs: [],
  activeTab: 'dashboard',
  activeFault: null,
  isSimulating: false,
  isDemoRunning: false,
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
  setHealthScore: (score) => set({ healthScore: score }),
  setRecoveryProgress: (progress) => set({ recoveryProgress: progress }),
  setCallStatus: (status) => set({ callStatus: status }),
  addTranscriptLine: (line) => set((state) => ({
    transcript: [...state.transcript, line],
  })),
  setMechanics: (mechanics) => set({ mechanics }),
  addLog: (log) => set((state) => ({
    logs: [...state.logs.slice(-300), log],
  })),
  setLogsHistory: (logs) => set({ logs }),
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
    } finally {
      set({ isSimulating: false });
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
    }
  },
}));
export default useStore;
