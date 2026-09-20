import { create } from 'zustand';
const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';
const dedupeTranscript = (lines = []) => {
  const seen = new Set();
  return lines.filter((line) => {
    const key = line.id || `${line.timestamp}-${line.speaker}-${line.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
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
  tcuLogs: [],
  trackingUrl: null,
  callWaiting: null,
  decisionNotice: null,
  tcuUploadNotice: null,
  whatsappNotice: null,
  callFlowNotice: null,
  vehicleProfile: null,
  aiStatus: { mode: 'checking', provider: 'Checking', model: 'Checking connection' },
  activeTab: 'dashboard',
  activeFault: null,
  isSimulating: false,
  isDemoRunning: false,
  demoError: null,
  setActiveTab: (tab) => set({ activeTab: tab }),
  updateTelemetry: (reading) => {
    if (!reading) return;
    set((state) => ({
      telemetry: reading,
      telemetryHistory: [...state.telemetryHistory.slice(-60), reading],
    }));
  },
  setAnomalies: (anomalies) => set({ anomalies }),
  updateIncident: (incident) => {
    if (!incident) {
      // Socket.IO sends `incident: null` when the backend reconnects before it
      // has restored state. Never erase an in-progress call from the screen;
      // the explicit Reset session action owns that destructive transition.
      set((state) => {
        if (state.incident && state.incident.status !== 'resolved') return {};
        return { incident: null, diagnosis: null, callStatus: null, transcript: [], mechanics: [], tcuLogs: [], trackingUrl: null, callWaiting: null, decisionNotice: null, tcuUploadNotice: null, whatsappNotice: null, callFlowNotice: null };
      });
      return;
    }
    set((state) => {
      const isSameIncident = state.incident?.id === incident.id;
      const incomingTranscript = Array.isArray(incident.transcript) ? incident.transcript : null;
      // A partial Socket.IO incident update must never erase lines already
      // received for the same live call.
      const transcript = incomingTranscript && (incomingTranscript.length > 0 || !isSameIncident)
        ? dedupeTranscript(incomingTranscript)
        : state.transcript;
      return {
        incident,
        diagnosis: incident.diagnosis ?? state.diagnosis,
        callStatus: incident.callStatus ?? state.callStatus,
        transcript,
        mechanics: incident.mechanics ?? state.mechanics,
        tcuLogs: incident.tcuLogs ?? state.tcuLogs,
        trackingUrl: incident.trackingUrl ?? state.trackingUrl,
      };
    });
  },
  setDiagnosis: (diagnosis) => set({ diagnosis }),
  setHealthScore: (score) => set({ healthScore: score }),
  setRecoveryProgress: (progress) => set({ recoveryProgress: progress }),
  setCallStatus: (status) => set({ callStatus: status }),
  addTranscriptLine: (line) => set((state) => ({
    transcript: dedupeTranscript([...state.transcript, line]),
  })),
  setMechanics: (mechanics) => set({ mechanics }),
  addLog: (log) => set((state) => ({
    logs: [...state.logs.slice(-300), log],
  })),
  setLogsHistory: (logs) => set({ logs }),
  addTcuLog: (log) => set((state) => ({
    tcuLogs: [...state.tcuLogs.slice(-200), log],
  })),
  setTcuLogsHistory: (logs) => set({ tcuLogs: logs }),
  setTrackingUrl: (url) => set({ trackingUrl: url }),
  setCallWaiting: (data) => set({ callWaiting: data }),
  setDecisionNotice: (notice) => set({ decisionNotice: notice }),
  setTcuUploadNotice: (notice) => set({ tcuUploadNotice: notice }),
  setWhatsAppNotice: (notice) => set({ whatsappNotice: notice }),
  setCallFlowNotice: (notice) => set({ callFlowNotice: notice }),
  setVehicleProfile: (vehicleProfile) => set({ vehicleProfile }),
  setAiStatus: (aiStatus) => set({ aiStatus }),
  simulateFault: async (type) => {
    if (get().isSimulating || get().isDemoRunning) {
      return { success: false, error: 'A scenario is already starting. Please wait a moment.' };
    }
    set({ activeFault: type, isSimulating: true, demoError: null });
    try {
      const res = await fetch(`${API_BASE}/simulate-fault`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'The fault simulation could not start.');
      return data;
    } catch (err) {
      set({ activeFault: null, demoError: err.message || 'The fault simulation could not start.' });
      return { success: false, error: err.message };
    } finally {
      set({ isSimulating: false });
    }
  },
  startDemo: async () => {
    if (get().isDemoRunning || get().isSimulating) {
      return { success: false, error: 'A scenario is already starting. Please wait a moment.' };
    }
    set({ isDemoRunning: true, activeFault: null, demoError: null });
    try {
      const res = await fetch(`${API_BASE}/test-demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !data.fault) throw new Error(data.error || 'The randomized demo did not start.');
      set({ activeFault: data.fault });
      return data;
    } catch (err) {
      set({ activeFault: null, demoError: err.message || 'The randomized demo did not start.' });
      return { success: false, error: err.message };
    } finally {
      // This flag only protects the launch request. The backend deliberately
      // supports replacing an active scenario with the next button click.
      set({ isDemoRunning: false });
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
        tcuLogs: [],
        trackingUrl: null,
        callWaiting: null,
        decisionNotice: null,
        tcuUploadNotice: null,
        whatsappNotice: null,
        callFlowNotice: null,
        activeFault: null,
        isSimulating: false,
        isDemoRunning: false,
        demoError: null,
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
