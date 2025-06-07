<div align="center">
  <h1>JAJ - Campus Grocery & Necessities Chatbot</h1>
</div>

<div align="center">
  <img src="https://res.cloudinary.com/df3lhzzy7/image/upload/v1748836703/jaj-icon_n4pqll.png" alt="JAJ Logo" width="120" height="120">
  
  <p><strong>Smart grocery ordering for university students</strong></p>

  [![Go Version](https://img.shields.io/badge/Go-1.21+-00ADD8?logo=go)](https://golang.org/)
  [![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react)](https://reactjs.org/)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-13+-336791?logo=postgresql)](https://postgresql.org/)
</div>

## 📖 Overview

JAJ is a web-based chatbot ordering system designed specifically for university-hostel students to request groceries and daily necessities through natural language conversations. Students can simply chat with the JAJ bot to place orders (e.g., "I want 2 liters of milk"), saving both time and money through centralized ordering and direct delivery to hostel pickup stations.

## ✨ Key Features

### 🤖 Intelligent Chat Ordering
- **Natural Language Processing**: Chat with JAJ using free-text prompts
- **AI-Powered**: Powered by Google Gemini for understanding complex requests
- **Context-Aware**: Maintains conversation context for seamless ordering

### 📦 Smart Order Management  
- **Time-Based Windows**: Orders accepted 08:00–17:00, pickup at 18:00
- **Dynamic Pricing**: Automatic transport fee calculation based on daily order volume
- **Order Tracking**: Real-time status updates and history

### 👨‍💼 Comprehensive Admin Panel
- **Catalog Management**: Full CRUD operations for items, categories, and pricing
- **Order Fulfillment**: View, process, and manage all student orders
- **Analytics Dashboard**: Monitor system performance and order trends
- **CSV Import/Export**: Bulk operations for inventory management

### 🔧 Technical Excellence
- **High Performance**: Built for 500 concurrent users with 99% SLA target
- **Monitoring & Metrics**: Integrated Prometheus metrics and Grafana dashboards
- **Email Notifications**: Rich HTML templates for confirmations and updates
- **Model Context Protocol**: Advanced LLM integration for product catalog queries

## 🛠️ Tech Stack

| Component | Technology |
|-----------|-----------|
| **Frontend** | React 18, TypeScript, Tailwind CSS, Vite |
| **Backend** | Go (stdlib), JSON-over-HTTP API, JWT Auth |
| **Database** | PostgreSQL 13+ |
| **AI/LLM** | Google Gemini via `generative-ai-go` SDK |
| **MCP Server** | Custom Postgres MCP implementation |
| **Monitoring** | Prometheus, Grafana, Zap logging |
| **Email** | Custom SMTP client with HTML templates |
| **DevOps** | Docker, golang-migrate, CI/CD ready |

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Client  │    │   Go API Server │    │ Postgres-MCP    │
│                 │◄──►│                 │◄──►│   Server        │
│ • Chat UI       │    │ • REST API      │    │ • Product Query │
│ • Order Mgmt    │    │ • WebSocket     │    │ • LLM Context   │
│ • Admin Panel   │    │ • JWT Auth      │    │ • JSON/HTTP     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                        ┌───────▼───────┐
                        │  PostgreSQL   │
                        │   Database    │
                        │ • Users       │
                        │ • Orders      │
                        │ • Products    │
                        └───────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Go 1.21+
- Node.js 18+
- PostgreSQL 13+
- Gemini API key

### 1. Clone the Repository
```bash
git clone https://github.com/your-org/jaj.git
cd jaj
```

### 2. Environment Setup
Create `.env` files in both `/backend-api` and `/postgres-server`:

```env
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/jajdb?sslmode=disable

# Server Configuration  
SERVER_ADDRESS=:8080
MCP_URL=http://localhost:5000

# Authentication
JWT_SECRET=your_secure_jwt_secret_here

# AI Integration
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.0-flash

# Email Service
SMTP_HOST=smtp.example.com:465
SMTP_USER=your-email@example.com
SMTP_PASS=your_smtp_password

# Frontend (in client/.env)
VITE_API_URL=http://localhost:8080
VITE_WSS_URL=ws://localhost:8080/chat/ws
```

### 3. Start the Services

**Backend API:**
```bash
cd backend-api
go mod download
go run cmd/jaj-server/main.go
```

**MCP Server:**
```bash
cd postgres-server  
go mod download
go run cmd/server/main.go
```

**Frontend:**
```bash
cd client
npm install
npm run dev
```

### 4. Access the Application
- **Frontend**: http://localhost:5173
- **API Server**: http://localhost:8080
- **MCP Server**: http://localhost:5000

## 📁 Project Structure

```
jaj/
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/         # Route components
│   │   ├── hooks/         # Custom React hooks
│   │   └── utils/         # Helper functions
│   └── package.json
│
├── backend-api/           # Main Go API service
│   ├── cmd/jaj-server/    # Application entry point
│   ├── internal/          # Private application code
│   │   ├── auth/          # Authentication & authorization
│   │   ├── chat/          # Chat & LLM integration
│   │   ├── orders/        # Order management
│   │   ├── admin/         # Admin functionality
│   │   ├── config/        # Configuration management
│   │   ├── db/            # Database layer
│   │   ├── email/         # Email service
│   │   └── monitoring/    # Metrics & logging
│   ├── migrations/        # Database migrations
│   └── templates/         # Email templates
│
└── postgres-server/       # MCP server for LLM context
    ├── cmd/server/        # MCP server entry point
    ├── internal/          # MCP implementation
    └── migrations/        # MCP-specific migrations
```

## 🔌 API Reference

### Authentication
```http
POST /signup              # Register new student
GET  /verify?token=...    # Verify email address
POST /login               # Authenticate user
POST /password-reset      # Request password reset
PUT  /password-reset      # Perform password reset
```

### Chat & Ordering
```http
POST /chat/prompt         # Chat-based ordering endpoint
POST /orders              # Confirm order
GET  /orders              # List user orders (with filters)
DELETE /orders?id=...     # Cancel order
```

### Admin Panel
```http
GET  /admin/models/list       # List MCP models
POST /admin/models/register   # Register new model
GET  /admin/orders            # View all orders
PUT  /admin/orders/:id        # Update order status
```

## 🔐 Security Features

- **TLS Encryption**: All production traffic secured with HTTPS
- **Password Security**: bcrypt hashing with salt
- **JWT Authentication**: Secure token-based auth (1-hour expiry)
- **Input Validation**: Comprehensive sanitization against injection attacks
- **Template Security**: XSS prevention in email templates

## 📊 Monitoring & Observability

- **Metrics**: Prometheus metrics exposed at `/metrics`
- **Logging**: Structured logging with Zap
- **Dashboards**: Pre-configured Grafana dashboards
- **Key Metrics**: Request rates, error rates, order volumes, response times

### Production Checklist
- [ ] Configure TLS certificates
- [ ] Set production environment variables
- [ ] Configure database backups
- [ ] Set up monitoring alerts
- [ ] Configure SMTP for emails
- [ ] Set up reverse proxy (Nginx/Traefik)

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Development Guidelines
- Follow Go formatting standards (`gofmt`)
- Use ESLint and Prettier for frontend code
- Maintain test coverage above 80%
- Update documentation for new features
- Follow conventional commit messages

## 🙏 Acknowledgments

- Google Gemini AI for natural language processing
- PostgreSQL community for the robust database
- Go community for excellent tooling and libraries
- React ecosystem for frontend development

---

<div align="center">
  <p>Made with ❤️ for university students</p>
  <p>
    <a href="#top">Back to top</a> •
    <a href="https://github.com/your-org/jaj/issues">Report Bug</a> •
    <a href="https://github.com/your-org/jaj/issues">Request Feature</a>
  </p>
</div>
