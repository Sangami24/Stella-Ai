class MLClient {
  constructor() {
    this.baseUrl = 'http://localhost:8000';
  }
  async predict(telemetryHistory) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);
    try {
      const response = await fetch(`${this.baseUrl}/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ history: telemetryHistory }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`ML Service returned ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (err) {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
module.exports = new MLClient();
