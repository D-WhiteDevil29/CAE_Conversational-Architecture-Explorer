# CAE UI - Conversational Architecture Explorer

Modern, animated UI for the Conversational Architecture Explorer hackathon project.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:3001`

### Build for Production

```bash
npm run build
npm run preview
```

## 🎨 Features

- **Beautiful Modern UI**: Built with shadcn/ui and Tailwind CSS
- **Smooth Animations**: Powered by Framer Motion
- **Interactive Dependency Graph**: Visualize service dependencies with ReactFlow
- **AI Chat Interface**: Natural language queries about architecture
- **Split View Mode**: Chat and graph side-by-side
- **Dark Theme**: Professional dark mode design
- **Responsive**: Works on desktop and mobile

## 📁 Project Structure

```
UI/
├── src/
│   ├── components/
│   │   ├── chat/          # Chat interface components
│   │   ├── graph/         # Dependency graph components
│   │   ├── layout/        # Layout components
│   │   ├── search/        # Search panel
│   │   ├── settings/      # Settings panel
│   │   └── ui/            # Base UI components (shadcn)
│   ├── hooks/             # Custom React hooks
│   ├── services/          # API services
│   ├── config/            # Configuration constants
│   ├── utils/             # Helper functions
│   └── App.jsx            # Main app component
├── .env.example           # Environment variables template
└── package.json
```

## 🔧 Configuration

Copy `.env.example` to `.env.local` and configure:

```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:3000
VITE_JIRA_BASE_URL=https://singtel-jira.atlassian.net
VITE_JIRA_EMAIL=your-email@singtel.com
VITE_JIRA_TOKEN=your-app-token

# Feature Flags
VITE_ENABLE_MOCK_MODE=true  # Use mock data for development
```

## 🎯 View Modes

1. **Chat Mode**: Full-screen chat interface
2. **Graph Mode**: Full-screen dependency graph
3. **Split Mode**: Chat and graph side-by-side

## 🛠️ Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **shadcn/ui** - Component library
- **Framer Motion** - Animations
- **ReactFlow** - Graph visualization
- **Lucide Icons** - Icon library
- **Axios** - HTTP client

## 📦 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## 🎨 Customization

### Colors
Edit `tailwind.config.js` to change the color scheme.

### Animations
Edit animation timings in `tailwind.config.js` or component-level in Framer Motion props.

### Mock Data
Toggle mock mode in `.env.local` with `VITE_ENABLE_MOCK_MODE=true`

## 📝 Notes

- The UI works standalone with mock data
- Connect to backend by setting `VITE_ENABLE_MOCK_MODE=false`
- Jira integration requires valid credentials in `.env.local`

## 🏆 Hackathon Ready

This UI is fully functional with:
- ✅ Beautiful professional design
- ✅ Smooth animations and transitions
- ✅ Mock data for demonstration
- ✅ Ready to connect to backend
- ✅ Responsive and accessible

## 📧 Support

For issues or questions, contact the development team.
