# echo-radio 🎙️

AI Talk Radio Generator - Create dynamic radio shows from text prompts featuring realistic speech, background music, and synchronized transcripts using Antigravity agent.

## ✨ Features

- 🎙️ **AI Radio Show Generation**: Create complete radio shows from simple text prompts
- 🎵 **Dynamic Background Music**: Automatic music that adapts to the content
- 🗣️ **Realistic Speech**: Natural-sounding voice generation
- 📝 **Synchronized Transcripts**: Interactive transcripts that sync with audio playback
- 🎨 **Rich Visuals**: Beautiful cover art and visual elements
- 💾 **Local Storage**: Save your favorite shows locally
- 🔐 **Firebase Auth**: Sign in to generate and share shows
- 📤 **Share Shows**: Share your generated shows with others

## 🚀 Tech Stack

- **Frontend**: React 19, Vite 6, Tailwind CSS 4
- **Backend**: Express, TypeScript, Firebase Admin
- **AI**: Google Gemini API (Antigravity Agent)
- **Database**: Firebase Firestore
- **Storage**: IndexedDB (local), Google Cloud Storage (cloud)
- **Animations**: Motion (Framer Motion)

## 📋 Prerequisites

- Node.js 18+
- Firebase project
- Google Gemini API key
- Google Cloud Storage bucket (optional)

## 🛠️ Installation

1. Clone the repository:
git clone [https://github.com/Mhmda1998/echo-radio.git](https://github.com/Mhmda1998/echo-radio.git)
cd echo-radio

2. Install dependencies:
npm install

3. Create .env file:
cp .env.example .env

4. Add your Firebase config:
   · Create firebase-applet-config.json from the example
   · Add your Firebase project credentials

5. Start the development server:
npm run dev

## 📖 Usage

1. Open http://localhost:3000
2. Sign in with Google
3. Enter a topic or URL
4. Click "Generate Show"
5. Watch as the AI creates your radio show
6. Play, pause, and interact with the synchronized transcript

## 🔧 Scripts

· npm run dev - Start development server
· npm run build - Build for production
· npm start - Start production server
· npm run lint - TypeScript check
· npm run clean - Clean build directory

## 📁 Project Structure

echo-radio/
├── src/
│   ├── components/
│   │   └── Transcript.tsx
│   ├── App.tsx
│   ├── main.tsx
│   ├── index.css
│   ├── types.ts
│   ├── transform.ts
│   ├── db.ts
│   ├── utils.ts
│   └── agent.ts
├── server/
│   ├── lib/
│   │   ├── agentClient.ts
│   │   └── jsonExtractor.ts
│   └── server.ts
├── agent.yaml
├── package.json
├── vite.config.ts
├── tsconfig.json
└── index.html

## 🔒 Security

· firebase-applet-config.json is ignored by git
· Use firebase-applet-config.example.json as template
· Never commit API keys or secrets
· Daily quota limits prevent abuse

## 📄 License

MIT
