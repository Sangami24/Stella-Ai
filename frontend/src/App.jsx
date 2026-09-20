import React, { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gauge, Activity, Phone, MapPin, Terminal,
  Shield, AlertTriangle, Zap, Radio
} from 'lucide-react';
import useStore from './store/useStore';
import Dashboard from './pages/Dashboard';
import Timeline from './pages/Timeline';
import VoicePanel from './pages/VoicePanel';
import MechanicView from './pages/MechanicView';
import SystemLogs from './pages/SystemLogs';
import TcuLog from './pages/TcuLog';
import TcuUploadModal from './components/TcuUploadModal';
import WhatsAppDispatchToast from './components/WhatsAppDispatchToast';
import CallFlowNotice from './components/CallFlowNotice';
import { inferVehicleSystem } from './components/VehicleSystemMap';

const SOCKET_URL = import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin;
const tabs = [
  { id: 'dashboard', label: 'Dashboard', icon: Gauge },
  { id: 'tcu', label: 'TCU Log', icon: Radio },
  { id: 'timeline', label: 'Timeline', icon: Activity },
  { id: 'voice', label: 'Voice Panel', icon: Phone },
  { id: 'mechanics', label: 'Mechanics', icon: MapPin },
  { id: 'logs', label: 'System Logs', icon: Terminal },
];

function App() {
  const activeTab = useStore((s) => s.activeTab);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const healthScore = useStore((s) => s.healthScore);
  const incident = useStore((s) => s.incident);
  const telemetry = useStore((s) => s.telemetry);
  const diagnosis = useStore((s) => s.diagnosis);
  const tcuLogs = useStore((s) => s.tcuLogs);
  const tcuUploadNotice = useStore((s) => s.tcuUploadNotice);
  const highlightedSystem = inferVehicleSystem(diagnosis, telemetry);
  const visualHandoffIncidentRef = useRef(null);
  const tcuUploadIncidentRef = useRef(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });
    socket.on('connect', () => {
    });
    socket.on('telemetry', (reading) => {
      useStore.getState().updateTelemetry(reading);
    });
    socket.on('telemetry-history', (history) => {
      if (history && history.length > 0) {
        history.forEach((r) => useStore.getState().updateTelemetry(r));
      }
    });
    socket.on('anomalies', (anomalies) => {
      useStore.getState().setAnomalies(anomalies);
    });
    socket.on('incident', (incident) => {
      useStore.getState().updateIncident(incident);
    });
    socket.on('diagnosis', (diagnosis) => {
      useStore.getState().setDiagnosis(diagnosis);
    });
    socket.on('health-score', (score) => {
      useStore.getState().setHealthScore(score);
    });
    socket.on('recovery-progress', (progress) => {
      useStore.getState().setRecoveryProgress(progress);
    });
    socket.on('call-status', (status) => {
      useStore.getState().setCallStatus(status);
    });
    socket.on('transcript', (line) => {
      useStore.getState().addTranscriptLine(line);
    });
    socket.on('mechanics', (mechanics) => {
      useStore.getState().setMechanics(mechanics);
    });
    socket.on('log', (log) => {
      useStore.getState().addLog(log);
    });
    socket.on('logs-history', (logs) => {
      if (logs) useStore.getState().setLogsHistory(logs);
    });
    // TCU Log events
    socket.on('tcu-log', (log) => {
      useStore.getState().addTcuLog(log);
    });
    socket.on('tcu-history', (logs) => {
      useStore.getState().setTcuLogsHistory(logs || []);
    });
    socket.on('vehicle-profile', (profile) => {
      useStore.getState().setVehicleProfile(profile);
    });
    socket.on('ai-status', (status) => {
      useStore.getState().setAiStatus(status);
    });
    // Tracking URL
    socket.on('tracking-url', (url) => {
      useStore.getState().setTrackingUrl(url);
    });
    socket.on('whatsapp-message', (message) => {
      useStore.getState().setWhatsAppNotice(message);
    });
    socket.on('provider-searching', (data) => {
      useStore.getState().setCallFlowNotice({ type: 'provider-searching', ...data });
      useStore.getState().setActiveTab('voice');
    });
    socket.on('driver-helped', (data) => {
      useStore.getState().setCallFlowNotice({ type: 'driver-helped', ...data });
    });
    // Call waiting indicator
    socket.on('call-waiting', (data) => {
      useStore.getState().setCallWaiting(data);
      // Clear after the delay
      setTimeout(() => {
        useStore.getState().setCallWaiting(null);
      }, data.delayMs + 500);
    });
    socket.on('resolution-decision', async (data) => {
      await useStore.getState().triggerResolve(data.action);
      if (data.action === 'escalate' || data.action === 'dispatch-tow') {
        useStore.getState().setActiveTab('mechanics');
      }
    });
    socket.on('reset', () => {
      useStore.setState({
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
      });
    });
    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!incident) return;
    const status = incident.status;
    if (status === 'calling' || status === 'in_call' || status === 'calling_mechanic' || status === 'calling_driver') {
      setActiveTab('voice');
    } else if (status === 'escalated') {
      setActiveTab('mechanics');
    }
  }, [incident?.status]);

  useEffect(() => {
    const isPreCallStage = ['detected', 'diagnosing', 'diagnosed'].includes(incident?.status);
    if (!incident) {
      visualHandoffIncidentRef.current = null;
      tcuUploadIncidentRef.current = null;
      return undefined;
    }
    if (!highlightedSystem || !isPreCallStage || visualHandoffIncidentRef.current === incident.id) return undefined;

    // The fault must be visible on the car before the UI leaves the dashboard.
    visualHandoffIncidentRef.current = incident.id;
    setActiveTab('dashboard');
    const tcuTimer = setTimeout(() => {
      const latestIncident = useStore.getState().incident;
      if (latestIncident && ['detected', 'diagnosing', 'diagnosed'].includes(latestIncident.status)) {
        useStore.getState().setActiveTab('tcu');
      }
    }, 1500);
    return () => clearTimeout(tcuTimer);
  }, [incident?.id, incident?.status, highlightedSystem, setActiveTab]);

  useEffect(() => {
    const isPreCallStage = ['detected', 'diagnosing', 'diagnosed'].includes(incident?.status);
    if (!incident || activeTab !== 'tcu' || !isPreCallStage || tcuLogs.length === 0 || tcuUploadNotice || tcuUploadIncidentRef.current === incident.id) return;
    tcuUploadIncidentRef.current = incident.id;
    useStore.getState().setTcuUploadNotice({ id: `tcu-sync-${incident.id}` });
  }, [activeTab, incident?.id, incident?.status, tcuLogs.length, tcuUploadNotice]);

  const getStatusColor = () => {
    if (!incident) return 'text-dash-success';
    const status = incident.status;
    if (status === 'resolved') return 'text-dash-success';
    if (status === 'escalated') return 'text-dash-warning';
    if (['detected', 'diagnosing'].includes(status)) return 'text-dash-danger';
    return 'text-dash-warning';
  };

  const getStatusText = () => {
    if (!incident) return 'ALL SYSTEMS NORMAL';
    const map = {
      detected: 'FAULT DETECTED',
      diagnosing: 'AI DIAGNOSING',
      diagnosed: 'DIAGNOSIS COMPLETE',
      calling: 'CALLING ENGINEER',
      in_call: 'ENGINEER ON CALL',
      calling_mechanic: 'CALLING SERVICE PROVIDER',
      calling_driver: 'CALLING DRIVER',
      resolving: 'AUTO-RESOLVING',
      resolved: 'INCIDENT RESOLVED',
      escalated: 'MECHANIC DISPATCHED',
    };
    return map[incident.status] || incident.status.toUpperCase();
  };

  const renderPage = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'tcu': return <TcuLog />;
      case 'timeline': return <Timeline />;
      case 'voice': return <VoicePanel />;
      case 'mechanics': return <MechanicView />;
      case 'logs': return <SystemLogs />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-dash-bg bg-grid">
      {}
      <header className="glass sticky top-0 z-50 px-6 py-3">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          {}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Shield className="w-8 h-8 text-dash-accent" />
              <Zap className="w-4 h-4 text-dash-warning absolute -top-1 -right-1" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold tracking-wider text-white">
                STELLA AI
              </h1>
              <p className="text-[10px] text-dash-muted tracking-[0.2em] uppercase">
                AI Diagnostics Platform
              </p>
            </div>
          </div>
          {}
          <motion.div
            key={getStatusText()}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full glass ${getStatusColor()}`}
          >
            <span className={`status-dot ${
              !incident ? 'bg-dash-success' :
              incident.status === 'resolved' ? 'bg-dash-success' :
              incident.status === 'escalated' ? 'bg-dash-warning' :
              'bg-dash-danger'
            }`} />
            <span className="font-display text-xs tracking-wider font-semibold">
              {getStatusText()}
            </span>
          </motion.div>
          <div className="flex items-center gap-4">
            {}
            <div className="flex items-center gap-2 px-3 py-1 bg-dash-bg/50 border border-dash-border rounded-lg">
              <span className="text-[10px] text-dash-muted uppercase tracking-wider">Health Score</span>
              <span className={`text-sm font-bold ${
                healthScore >= 90 ? 'text-green-400' :
                healthScore >= 70 ? 'text-yellow-400' : 'text-red-400'
              }`}>{healthScore}</span>
            </div>
            {}
            <div className="flex items-center gap-2 text-dash-muted text-xs">
              <span className="font-display tracking-wider">TEAM FALCONS</span>
              <span className="text-dash-border">|</span>
              <span>STELLANTIS IGNITE</span>
            </div>
          </div>
        </div>
      </header>
      {}
      <nav className="glass border-t-0 px-6 py-2">
        <div className="max-w-[1600px] mx-auto flex items-center gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const hasNotification =
              (tab.id === 'voice' && (incident?.status === 'calling' || incident?.status === 'in_call' || incident?.status === 'calling_mechanic' || incident?.status === 'calling_driver')) ||
              (tab.id === 'mechanics' && incident?.status === 'escalated') ||
              (tab.id === 'tcu' && incident && !['resolved', 'escalated'].includes(incident.status)) ||
              (tab.id === 'timeline' && incident && incident.status !== 'resolved');
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`nav-tab flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                  ${isActive
                    ? 'active bg-dash-accent/10 text-dash-accent'
                    : 'text-dash-muted hover:text-dash-text hover:bg-white/5'
                  }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {hasNotification && (
                  <span className="w-2 h-2 rounded-full bg-dash-danger animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
      {}
      <main className="max-w-[1600px] mx-auto px-6 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </main>
      <TcuUploadModal />
      <WhatsAppDispatchToast />
      <CallFlowNotice />
    </div>
  );
}
export default App;
