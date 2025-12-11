# Hemut Frontend

A modern Q&A forum built with Next.js, TypeScript, and Tailwind CSS, featuring real-time updates and AI-powered suggestions.

## Features

- **Responsive Design** - Works on all devices
- **Real-time Updates** - Using WebSockets
- **AI-Powered Suggestions** - Get help from AI in crafting answers
- **Markdown Support** - Rich text formatting in questions and answers
- **Dark/Light Mode** - Built-in theme support
- **Type Safety** - Full TypeScript support

## Prerequisites

- Node.js 16+
- npm or yarn
- Backend API (see backend README)

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/sahil-vanarse/hemut-frontend.git
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn
   ```

3. Create a `.env.local` file in the frontend directory:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000
   NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
   ```

4. Run the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_API_URL` | URL of the backend API | Yes |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL for real-time updates | Yes |

## Project Structure

```
hemut-frontend/
├── src/
│   ├── app/                 # Next.js 13+ app directory
│   │   ├── api/             # API routes
│   │   ├── forum/           # Forum pages
│   │   ├── login/           # Login page
│   │   ├── register/        # Registration page
│   │   └── layout.tsx       # Root layout
│   ├── components/          # Reusable components
│   ├── lib/                 # Utility functions
│   └── types/               # TypeScript type definitions
├── public/                  # Static files
└── styles/                  # Global styles
```

## Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build for production
- `npm start` - Start the production server
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## Deployment

### Render
## Contact

Your Name - Sahil Vanarse - sahilvanarse9@gmail.com

Project Link: [https://github.com/sahil-vanarse/hemut-yc](https://github.com/sahil-vanarse/hemut-frontend)
