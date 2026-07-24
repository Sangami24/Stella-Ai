import React, { useEffect } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gauge, Activity, Phone, MapPin, Terminal,
  Shield, AlertTriangle, Zap
} from 'lucide-react';
import useStore from './store/useStore';
import Dashboard from './pages/Dashboard';
import Timeline from './pages/Timeline';
import VoicePanel from './pages/VoicePanel';
import MechanicView from './pages/MechanicView';
import SystemLogs from './pages/SystemLogs';

const SOCKET_URL = 'http://localhost:3001';

const tabs = [
  { id: 'dashboard', label: 'Dashboard', icon: Gauge },
  { id: 'timeline', label: 'Timeline', icon: Activity },
  { id: 'voice', label: 'Voice Panel', icon: Phone },
  { id: 'mechanics', label: 'Mechanics', icon: MapPin },
  { id: 'logs', label: 'System Logs', icon: Terminal },
];

function App() {
  const activeTab = useStore((s) => s.activeTab);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const incident = useStore((s) => s.incident);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('🔌 Connected to STLA Guardian backend');
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

    socket.on('resolution-decision', async (data) => {
      await useStore.getState().triggerResolve(data.action);
      if (data.action === 'escalate') {
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
        activeFault: null,
        isSimulating: false,
        isDemoRunning: false,
      });
    });

    return () => socket.disconnect();
  }, []);

  // Auto-switch to relevant tabs based on incident state
  useEffect(() => {
    if (!incident) return;
    const status = incident.status;
    if (status === 'calling' || status === 'in_call') {
      setActiveTab('voice');
    } else if (status === 'escalated') {
      setActiveTab('mechanics');
    }
  }, [incident?.status]);

  const getStatusColor = () => {
    if (!incident) return 'text-dash-success';
    const status = incident.status;
    if (status === 'resolved') return 'text-dash-success';
    if (status === 'escalated') return 'text-dash-warning';
    if (['detected', 'diagnosing'].includes(status)) return 'text-dash-danger';
    return 'text-dash-warning';
  };

  const getStatusText = () => {
    if (!incident) return 'ALL SYSTEMS NOMINAL';
    const map = {
      detected: 'FAULT DETECTED',
      diagnosing: 'AI DIAGNOSING',
      diagnosed: 'DIAGNOSIS COMPLETE',
      calling: 'CALLING ENGINEER',
      in_call: 'ENGINEER ON CALL',
      resolving: 'AUTO-RESOLVING',
      resolved: 'INCIDENT RESOLVED',
      escalated: 'MECHANIC DISPATCHED',
    };
    return map[incident.status] || incident.status.toUpperCase();
  };

  const renderPage = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'timeline': return <Timeline />;
      case 'voice': return <VoicePanel />;
      case 'mechanics': return <MechanicView />;
      case 'logs': return <SystemLogs />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-dash-bg bg-grid">
      {/* ── Header ────────────────────────────────────── */}
      <header className="glass sticky top-0 z-50 px-6 py-3">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Shield className="w-8 h-8 text-dash-accent" />
              <Zap className="w-4 h-4 text-dash-warning absolute -top-1 -right-1" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold tracking-wider text-white">
                STLA GUARDIAN
              </h1>
              <p className="text-[10px] text-dash-muted tracking-[0.2em] uppercase">
                AI Diagnostics Platform
              </p>
            </div>
          </div>

          {/* Status Badge */}
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

          {/* Team Badge */}
          <div className="flex items-center gap-2 text-dash-muted text-xs">
            <span className="font-display tracking-wider">TEAM FALCONS</span>
            <span className="text-dash-border">|</span>
            <span>STELLANTIS IGNITE</span>
          </div>
        </div>
      </header>

      {/* ── Navigation ────────────────────────────────── */}
      <nav className="glass border-t-0 px-6 py-2">
        <div className="max-w-[1600px] mx-auto flex items-center gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const hasNotification =
              (tab.id === 'voice' && (incident?.status === 'calling' || incident?.status === 'in_call')) ||
              (tab.id === 'mechanics' && incident?.status === 'escalated') ||
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

      {/* ── Main Content ──────────────────────────────── */}
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
    </div>
  );
}

export default App;
