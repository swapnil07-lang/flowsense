# 🚀 FlowSense AI  
### Intelligent Crowd Analytics for Live Events

<p align="center">
  <b>Real-time crowd intelligence powered by cloud deployment</b><br>
  Built for scalability, simplicity, and fast deployment 🚀
</p>

---
This project aligns with real-world event management by providing scalable crowd monitoring and insights.

## 📌 Overview
**FlowSense AI** is a cloud-deployed web application that simulates crowd intelligence for live events.  
It demonstrates a full-stack workflow — from backend API development to frontend integration and deployment using **Google Cloud Run**.

---

## ✨ Key Features
- ⚡ REST API built with **Node.js & Express**
- ☁️ Deployed on **Google Cloud Run**
- 🔗 Frontend integrated with backend using Fetch API
- 🐳 Containerized with Docker for portability
- 📊 Simulated real-time crowd data responses

---

## 🛠️ Tech Stack

| Category        | Technology |
|----------------|----------|
| Backend        | Node.js, Express.js |
| Frontend       | HTML, CSS, JavaScript |
| Deployment     | Google Cloud Run |
| Containerization | Docker |

---
## ☁️ Google Cloud Integration

This project uses:
- Google Cloud Run for deployment
- Container Registry for image storage

Deployment command:
gcloud run deploy

## 📂 Project Structure
flowsense/
│── server.js # Backend server
│── script.js # Frontend logic
│── index.html # UI
│── style.css # Styling
│── package.json # Dependencies
│── Dockerfile # Container config

---

## 🔗 API Endpoints

### 🟢 Health Check

GET /
**Response**
Server is running 🚀

---

### 🔵 Crowd Data API
GET /data
**Response**
```json
{
  "status": "success",
  "data": ["crowd", "analytics", "flow"]
}

🌐 Live Deployment

🔗 Cloud Run URL:
👉https://flowsense-backend-1086829896855.asia-south1.run.app

📈 Future Enhancements
📊 Real-time dashboard visualization
🤖 AI-based crowd prediction models
🗄️ Database integration
🔐 Authentication system

🤝 Contribution

This project was developed as part of a hackathon.
Contributions, suggestions, and improvements are welcome!

👨‍💻 Author

Swapnil Gaur
