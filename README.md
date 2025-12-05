# DNS Checker - Simple DNS Monitoring

A simple DNS monitoring application that continuously checks DNS resolution for specified domains and displays results in a clean web interface with auto-refresh every 5 seconds.

![DNS Monitoring](https://img.shields.io/badge/Status-Active-green.svg)
![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)
![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)

## 🚀 Features

- **Continuous Monitoring**: DNS resolution checks every 3 seconds (conservative rate)
- **Auto-refresh Dashboard**: Automatic updates every 10 seconds
- **Spam-Safe**: Rate limited to avoid DNS server blocking
- **Error Resilient**: Handles DNS failures and network issues gracefully
- **Simple Design**: Clean and lightweight web interface
- **Docker Ready**: Containerized deployment with nginx reverse proxy
- **REST API**: Standard HTTP endpoints for easy integration
- **Lightweight**: Minimal dependencies and fast startup
- **Configurable**: Easy domain list management via JSON configuration

## 📋 Prerequisites

### For Local Development
- Node.js 18+
- npm or yarn
- Git

### For Docker Deployment
- Docker 20.10+
- Docker Compose (optional)

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │     Nginx       │    │   Backend       │
│   (index.html)  │◄──►│  Reverse Proxy  │◄──►│  Node.js/Express │
│                 │    │   :80           │    │     :3000       │
│ Fetch API       │    │ /api/ ➜ /api/   │    │ DNS Monitoring  │
│ (10s polling)   │    │                 │    │ (3s checks)     │
│ + Manual Refresh│    │                 │    │ + REST API      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Components

- **Frontend**: Vanilla HTML/CSS/JavaScript with Fetch API polling
- **Backend**: Node.js with Express.js framework
- **DNS Engine**: Native Node.js DNS Promises API
- **API**: REST endpoints for DNS status
- **Proxy**: Nginx for serving static content and API routing

## 📁 Project Structure

```
dns-checker/
├── .deployment/
│   ├── nginx.conf         # Nginx reverse proxy configuration
│   └── supervisord.conf   # Supervisor process management
├── config/
│   └── domains.json       # List of domains to monitor
├── server.js              # Node.js/Express backend (main application)
├── index.html             # Frontend interface
├── Dockerfile             # Container build configuration
├── package.json           # Node.js dependencies and scripts
├── README.md              # This documentation
└── CLAUDE.md              # Claude Code assistant guide
```

## 🛠️ Installation & Setup

### Option 1: Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd dns-checker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure domains to monitor**
   ```bash
   # Edit the domains list
   nano config/domains.json
   ```
   Example `config/domains.json`:
   ```json
   [
     "google.com",
     "github.com",
     "stackoverflow.com"
   ]
   ```

4. **Start the application**
   ```bash
   # Start the Node.js backend
   node server.js

   # The server will start on port 3000
   # Open a new terminal for frontend
   ```

5. **Access the application**
   - Open `index.html` in your browser
   - Or serve it with a simple HTTP server:
     ```bash
     npx serve . -p 8080
     # Then open http://localhost:8080
     ```

### Option 2: Docker Deployment

1. **Build the Docker image**
   ```bash
   docker build -t dns-checker .
   ```

2. **Run the container**
   ```bash
   # Basic run
   docker run -p 80:80 --name dns-monitor dns-checker

   # Run with custom domain configuration
   docker run -p 80:80 \
     -v $(pwd)/config/domains.json:/usr/src/app/config/domains.json \
     --name dns-monitor \
     dns-checker
   ```

3. **Access the application**
   - Open your browser and navigate to `http://localhost`
   - The application will be served on port 80 with nginx proxy

### Option 3: Docker Compose (Advanced)

Create `docker-compose.yml`:
```yaml
version: '3.8'
services:
  dns-monitor:
    build: .
    ports:
      - "80:80"
    volumes:
      - ./config/domains.json:/usr/src/app/config/domains.json:ro
    restart: unless-stopped
    container_name: dns-checker
```

Then run:
```bash
docker-compose up -d
```

## ⚙️ Configuration

### Domain Monitoring

Edit `config/domains.json` to specify which domains to monitor:

```json
[
  "client.kiriminaja.com",
  "multichannel.qiscus.com",
  "google.com",
  "github.com"
]
```

### Monitoring Parameters

You can modify these parameters in `server.js`:

- **Check Interval**: Default 5000ms (5 seconds)
- **DNS Timeout**: Default 2000ms (2 seconds)
- **Server Port**: Default 3000 (internal), 80 (external via nginx)

To modify:
```javascript
// In server.js, find these lines:
const intervalMs = 5000;  // Change check frequency
const timeoutMs = 2000;   // Change DNS timeout
```

## 📊 Usage

### Real-time Dashboard

The dashboard displays:

| Column | Description |
|--------|-------------|
| **Domain** | Domain name being monitored |
| **Status** | OK (green) or FAILED (red) |
| **IP / Error** | Resolved IP address or error message |
| **Waktu Cek** | Timestamp of last check |
| **Latency** | DNS resolution time in milliseconds |

### API Endpoints

#### Get All Domain Status
- **Endpoint**: `/api/domains`
- **Method**: GET
- **Purpose**: Get status of all monitored domains

Example response:
```json
{
  "lastUpdated": "2024-01-15T10:30:00.000Z",
  "domains": ["google.com", "github.com"],
  "checkInterval": "3s",
  "pollInterval": "10s",
  "data": {
    "google.com": {
      "domain": "google.com",
      "status": "ok",
      "ip": "142.250.191.14",
      "timeMs": 45.2,
      "checkedAt": "2024-01-15T10:30:00.000Z"
    },
    "github.com": {
      "domain": "github.com",
      "status": "ok",
      "ip": "140.82.112.4",
      "timeMs": 38.5,
      "checkedAt": "2024-01-15T10:30:01.000Z"
    }
  }
}
```

#### Get Specific Domain Status
- **Endpoint**: `/api/domains/{domain}`
- **Method**: GET
- **Purpose**: Get status of a specific domain

Example response:
```json
{
  "domain": "google.com",
  "status": "ok",
  "ip": "142.250.191.14",
  "timeMs": 45.2,
  "checkedAt": "2024-01-15T10:30:00.000Z",
  "errorCode": null
}
```

## 🔒 Safety Considerations

### Rate Limiting Protection
- **DNS Check Rate**: 3 seconds per domain (1200 requests/hour max)
- **API Poll Rate**: 10 seconds (360 requests/hour per user)
- **Total Load**: Well within DNS provider limits (Google/Cloudflare allow 1000+ requests/minute)

### Error Handling & Resilience
- **Exponential Backoff**: Automatic backoff when DNS errors occur
- **Network Timeouts**: 2-second timeout for DNS resolution
- **Failure Logging**: DNS failures logged for monitoring
- **Connection Recovery**: Automatic reconnection with backoff strategy

### Production Guidelines
- **Monitoring**: Watch DNS failure rates (>5% requires investigation)
- **Scaling**: Can handle 100+ domains with current conservative approach
- **DNS Provider**: Recommended to use public resolvers (8.8.8.8, 1.1.1.1)
- **Deployment**: Docker containerized for consistent performance

## 🔧 Development

### Project Scripts

```bash
# Start development server
npm start

# Install dependencies
npm install

# No tests currently configured
npm test  # Will show "Error: no test specified"
```

### Code Structure

#### Backend (`server.js`)
- **DNS Resolution**: Uses `dns/promises` API with timeout handling
- **REST API**: HTTP endpoints for DNS status data
- **Express Server**: HTTP server with CORS support
- **Monitoring Loops**: Async loops for each domain

#### Frontend (`index.html`)
- **Fetch API**: Polls REST API every 5 seconds
- **Dynamic DOM**: Updates table with latest data
- **Auto-refresh**: Automatic polling with error handling

### Adding New Features

1. **New API Endpoints**: Add routes in `server.js`
2. **Frontend Enhancements**: Modify `index.html`
3. **Configuration Changes**: Update `config/domains.json`
4. **Docker Changes**: Modify `.deployment/` files

## 🐳 Docker Details

### Container Architecture

The Docker container includes:

- **Node.js 18 Alpine**: Lightweight Node.js runtime
- **Nginx**: Reverse proxy and static file server
- **Supervisor**: Process manager for both services

### Build Process

1. Install Node.js dependencies
2. Copy application source code
3. Configure nginx reverse proxy
4. Setup supervisor for process management
5. Expose port 80

### Container Volumes

For persistent configuration:
```bash
# Mount custom domain configuration
docker run -p 80:80 \
  -v /path/to/custom/domains.json:/usr/src/app/config/domains.json:ro \
  dns-checker
```

## 🔍 Troubleshooting

### Common Issues

#### Docker Build Fails
```bash
# Clean and rebuild
docker system prune -f
docker build --no-cache -t dns-checker .
```

#### Container Won't Start
```bash
# Check container logs
docker logs dns-monitor

# Check if port 80 is available
netstat -tlnp | grep :80
```

#### API Connection Issues
- Check if nginx is properly proxying `/api/` endpoints
- Verify Node.js backend is running on port 3000
- Check browser console for fetch API errors
- Check network tab in browser developer tools

#### DNS Resolution Failures
- Verify domain names in `config/domains.json`
- Check network connectivity
- Verify DNS server configuration

### Debug Mode

For debugging, you can run the container with shell access:
```bash
docker run -it -p 80:80 --entrypoint /bin/sh dns-checker
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📝 License

This project is licensed under the ISC License - see the `package.json` file for details.

## 🔗 Links

- **Node.js Documentation**: https://nodejs.org/docs/
- **Express.js**: https://expressjs.com/
- **Nginx Documentation**: https://nginx.org/en/docs/
- **Docker Documentation**: https://docs.docker.com/
- **Server-Sent Events**: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events

## 📞 Support

For issues and questions:
- Create an issue in the repository
- Check the troubleshooting section above
- Review the `CLAUDE.md` file for development guidance

---

**DNS Venturo** - Real-time DNS monitoring made simple! 🚀