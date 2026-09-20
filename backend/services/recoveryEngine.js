class RecoveryEngine {
  constructor(incidentManager, io, twilioService) {
    this.incidentManager = incidentManager;
    this.io = io;
    this.twilioService = twilioService;
    this.pendingTimers = new Set();
  }
  async executeRecovery(diagnosis, telemetryHistory, incidentId) {
    if (!diagnosis || !incidentId) return;

    // All faults escalate to the call chain — no auto-fix path
    this.io.emit('log', {
      timestamp: new Date().toISOString(),
      category: 'system',
      message: '🔄 Diagnosis complete. Initiating engineer call chain...'
    });

    const timer = setTimeout(async () => {
      this.pendingTimers.delete(timer);
      const incident = this.incidentManager.getIncident();
      // Never let a delayed call from an older demo attach itself to a new
      // incident. This is essential when the presenter restarts a scenario.
      if (incident?.id === incidentId && (incident.status === 'diagnosed' || incident.status === 'resolving')) {
        try {
          await this.twilioService.initiateEngineerCall(diagnosis, telemetryHistory);
        } catch (err) {
          this.io.emit('log', {
            timestamp: new Date().toISOString(),
            category: 'call',
            message: `Twilio not available: ${err.message}. Using simulated call flow.`
          });
          await this.twilioService.simulateCall(diagnosis, telemetryHistory);
        }
      }
    }, 2000);
    this.pendingTimers.add(timer);
  }

  cancelPending() {
    this.pendingTimers.forEach((timer) => clearTimeout(timer));
    this.pendingTimers.clear();
  }
}

module.exports = RecoveryEngine;
