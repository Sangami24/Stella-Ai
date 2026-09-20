const { v4: uuidv4 } = require('uuid');
class IncidentManager {
  constructor(io) {
    this.io = io;
    this.incident = null;
  }
  createIncident(faultTrigger) {
    this.incident = {
      id: uuidv4(),
      sessionId: uuidv4().split('-')[0],
      faultTrigger, 
      status: 'detected',
      priority: 'high',
      severity: null,
      diagnosis: null,
      callStatus: null,
      callRecipient: null,
      activeCallRole: null, 
      callPhase: null, // 'engineer' | 'mechanic' | 'driver'
      callAttempt: 0,   // retry counter for mechanic/tow
      maxCallAttempts: 3,
      pendingResolution: null, 
      trackingSessionId: null,
      trackingUrl: null,
      transcript: [],
      tcuLogs: [],
      mechanics: null,
      resolution: null,
      timeline: [
        {
          event: 'fault_detected',
          label: 'Fault Detected',
          description: 'Telemetry anomaly detected in vehicle systems',
          timestamp: new Date().toISOString(),
          status: 'completed',
          color: 'red'
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.io.emit('incident', this.incident);
    return this.incident;
  }
  updateStatus(status) {
    if (!this.incident) return;
    this.incident.status = status;
    this.incident.updatedAt = new Date().toISOString();
    const timelineMap = {
      'diagnosing': {
        event: 'ai_diagnosing',
        label: 'AI Analyzing',
        description: 'Gemini AI analyzing telemetry patterns...',
        status: 'in_progress',
        color: 'blue'
      },
      'diagnosed': {
        event: 'diagnosis_complete',
        label: 'Diagnosis Complete',
        description: `Root cause identified with ${this.incident.diagnosis?.confidence || 'N/A'}% confidence`,
        status: 'completed',
        color: 'blue'
      },
      'calling': {
        event: 'calling_engineer',
        label: 'Calling Engineer',
        description: 'Initiating voice call to on-call engineer...',
        status: 'in_progress',
        color: 'yellow'
      },
      'in_call': {
        event: 'in_call',
        label: 'Engineer Conversation',
        description: 'AI discussing diagnosis with engineer',
        status: 'in_progress',
        color: 'yellow'
      },
      'calling_mechanic': {
        event: 'calling_mechanic',
        label: 'Calling Service Provider',
        description: `Calling mechanic/tow — attempt ${this.incident.callAttempt || 1}`,
        status: 'in_progress',
        color: 'yellow'
      },
      'calling_driver': {
        event: 'calling_driver',
        label: 'Calling Driver',
        description: 'Notifying driver about rescue status...',
        status: 'in_progress',
        color: 'yellow'
      },
      'resolving': {
        event: 'auto_resolving',
        label: 'Auto-Resolving',
        description: 'Automated resolution in progress...',
        status: 'in_progress',
        color: 'green'
      },
      'resolved': {
        event: 'resolved',
        label: 'Incident Resolved',
        description: 'Systems restored to nominal parameters',
        status: 'completed',
        color: 'green'
      },
      'escalated': {
        event: 'escalated',
        label: 'Escalated to Mechanic',
        description: 'Remote fix not possible — dispatching nearest mechanic',
        status: 'completed',
        color: 'yellow'
      }
    };
    if (timelineMap[status]) {
      this.incident.timeline.forEach(t => {
        if (t.status === 'in_progress') t.status = 'completed';
      });
      this.incident.timeline.push({
        ...timelineMap[status],
        timestamp: new Date().toISOString()
      });
    }
    this.io.emit('incident', this.incident);
  }
  setDiagnosis(diagnosis) {
    if (!this.incident) return;
    this.incident.diagnosis = diagnosis;
    this.incident.severity = diagnosis.severity;
    this.incident.status = 'diagnosed';
    this.incident.updatedAt = new Date().toISOString();
    this.incident.timeline.forEach(t => {
      if (t.status === 'in_progress') t.status = 'completed';
    });
    this.incident.timeline.push({
      event: 'diagnosis_complete',
      label: 'Diagnosis Complete',
      description: `${diagnosis.rootCause} — Severity ${diagnosis.severity}/5, Confidence ${diagnosis.confidence}%`,
      timestamp: new Date().toISOString(),
      status: 'completed',
      color: 'blue'
    });
    this.io.emit('incident', this.incident);
    this.io.emit('diagnosis', diagnosis);
  }
  addTranscriptLine(speaker, text) {
    if (!this.incident) return;
    const line = {
      id: uuidv4(),
      speaker,
      text,
      role: this.incident.activeCallRole || 'engineer',
      callPhase: this.incident.callPhase || 'engineer',
      timestamp: new Date().toISOString()
    };
    this.incident.transcript.push(line);
    console.log(`[TRANSCRIPT] ${line.callPhase} | ${speaker}: ${text}`);
    this.io.emit('transcript', line);
    this.io.emit('incident', this.incident);
  }
  addTcuLog(logEntry) {
    if (!this.incident) return;
    this.incident.tcuLogs.push(logEntry);
    this.io.emit('tcu-log', logEntry);
  }
  setCallStatus(status) {
    if (!this.incident) return;
    this.incident.callStatus = status;
    this.io.emit('call-status', status);
    this.io.emit('incident', this.incident);
  }
  setCallRecipient(recipient) {
    if (!this.incident) return;
    this.incident.callRecipient = recipient;
    this.io.emit('incident', this.incident);
  }
  setActiveCallRole(role) {
    if (!this.incident) return;
    this.incident.activeCallRole = role;
  }
  setCallPhase(phase) {
    if (!this.incident) return;
    this.incident.callPhase = phase;
    this.io.emit('incident', this.incident);
  }
  incrementCallAttempt() {
    if (!this.incident) return;
    this.incident.callAttempt = (this.incident.callAttempt || 0) + 1;
  }
  setTrackingInfo(sessionId, url) {
    if (!this.incident) return;
    this.incident.trackingSessionId = sessionId;
    this.incident.trackingUrl = url;
    this.io.emit('incident', this.incident);
    this.io.emit('tracking-url', url);
  }
  setPendingResolution(data) {
    if (!this.incident) return;
    this.incident.pendingResolution = data;
  }
  setMechanics(mechanics) {
    if (!this.incident) return;
    this.incident.mechanics = mechanics;
    this.io.emit('incident', this.incident);
  }
  setResolution(resolution) {
    if (!this.incident) return;
    this.incident.resolution = resolution;
    this.io.emit('incident', this.incident);
  }
  getIncident() {
    return this.incident;
  }
  reset() {
    this.incident = null;
    this.io.emit('incident', null);
  }
}
module.exports = { IncidentManager };
