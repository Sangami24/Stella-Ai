class MLClient {
  constructor() {
    this.baseUrl = 'http://localhost:8000';
  }

  async predict(telemetryHistory) {
    try {
      const response = await fetch(`${this.baseUrl}/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ history: telemetryHistory }),
      });

      if (!response.ok) {
        throw new Error(`ML Service returned ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (err) {
      console.warn('⚠️ ML Edge Analytics Engine unreachable or failed. Ensure python FastAPI is running on port 8000.', err.message);
      return null;
    }
  }
}

module.exports = new MLClient();
