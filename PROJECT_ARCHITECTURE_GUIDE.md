# Stella AI — Complete Project Architecture & Study Guide

## 1. Introduction for Beginners
Welcome to Stella AI! If you are reading this, you are looking at a state-of-the-art **Smart Connected Diagnostics Platform** built for the automotive industry. 
Imagine a car that knows exactly what is wrong with it before it even breaks down, and can automatically call an engineer, explain the problem, and dispatch a tow truck to its exact GPS location. That is exactly what Stella AI does.

This project was built to simulate a real-world scenario where a vehicle sends live data (like engine temperature, RPM, and tire pressure) to a cloud server. The server uses Machine Learning and AI to read that data, figure out if something is breaking, and take immediate action.

---

## 2. How the Project is Structured (The 3 Main Parts)

The project is divided into three separate components that talk to each other in real-time.

### Part 1: The Frontend (The Visual Dashboard)
* **What it is:** The beautiful user interface you see in your web browser. It looks like a car's dashboard.
* **Technology Used:** React 18, Vite, TailwindCSS (for styling), and Framer Motion (for the smooth animations of the gauges).
* **How it works:** It connects to the backend using "WebSockets" (a technology for real-time live updates). When the engine temperature goes up on the backend, the gauge on the frontend moves up instantly without needing to refresh the page.

### Part 2: The Backend (The Brains & Orchestrator)
* **What it is:** The central server that controls everything.
* **Technology Used:** Node.js, Express, and Socket.io.
* **How it works:** 
  1. **Simulates the Car:** It acts like the car's computer, generating live data every second (speed, temperature, battery health).
  2. **Manages Incidents:** If it detects a fault, it creates an "Incident".
  3. **Talks to the Outside World:** It connects to Google Gemini (for AI logic) and Twilio (to make actual phone calls to humans).

### Part 3: The ML Edge Analytics Service (The Data Scientist)
* **What it is:** A specialized microservice dedicated entirely to math and machine learning.
* **Technology Used:** Python, FastAPI, Scikit-Learn, and XGBoost.
* **How it works:** It receives the car's data from the Node.js backend. It uses two machine learning models:
  - **Isolation Forest:** This looks for "anomalies". It basically asks, "Does this data look weird or unusual compared to normal driving?"
  - **XGBoost:** If things look unusual, this model classifies the exact problem (e.g., "This specific pattern of high heat and low pressure means a Coolant Leak").

---

## 3. The Step-by-Step Flow (What happens when a car breaks down)

If you click "Test Demo" on the dashboard, here is the exact sequence of events that happens automatically:

**Step 1: The Fault Simulation**
The backend forces a "Coolant System Breakdown". It artificially starts dropping the coolant pressure and spiking the engine temperature.

**Step 2: Machine Learning Detection**
The Python XGBoost model looks at this new bad data and flags it: "Coolant System Failure Detected with 89% Confidence". 

**Step 3: Generative AI (Gemini) Context**
The raw data is securely sent to Google Gemini (the LLM). Gemini is told, "You are an automotive AI. Look at this data." Gemini confirms the XGBoost model's findings, explains *why* the car is breaking down in plain English, and decides if a mechanic needs to physically go to the car.

**Step 4: The Twilio Voice Call**
Since a mechanic is needed, the backend triggers Twilio. Twilio makes a real-world phone call to the On-Call Engineer.
- The AI speaks to the engineer over the phone, explaining the problem.
- The AI asks the engineer: "Should I dispatch a mechanic or a tow truck?"
- The engineer speaks into the phone, and Twilio translates their speech back to text.

**Step 5: Automated Dispatch & WhatsApp**
Once the engineer decides to send a tow truck, the system drops the call. It then automatically:
- Sends a **WhatsApp Message** to the tow truck driver containing the exact Google Maps GPS link of the broken car.
- Sends a backup SMS message.
- Updates the frontend dashboard to show that a Tow Truck is on the way with an ETA.

---

## 4. Why this Architecture is "Enterprise Grade"
- **Microservices:** By separating the Machine Learning (Python) from the web server (Node.js), the platform won't crash if the AI gets overloaded.
- **Blind Diagnosis:** Gemini isn't just told what the problem is. It is forced to look at the raw numbers and figure it out itself, proving it can act as a real mechanic.
- **Real-Time WebSockets:** Absolutely zero page refreshes are required. Everything is perfectly synced live.
