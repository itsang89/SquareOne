# SquareOne

SquareOne is a modern, neo-brutalist style expense tracking application designed to help friends manage shared costs, track debts, and settle up easily. Built with React and Supabase, it provides a seamless, real-time experience for maintaining financial balance within your social circle.

<div align="center">
  <img width="1200" height="400" alt="SquareOne Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

## 🚀 Features

- **Real-time Sync**: Instant updates across devices using Supabase real-time subscriptions.
- **Friend Management**: Easily add friends and track individual balances.
- **Transaction Tracking**: Log expenses with categories (Meal, Poker, Transport, etc.) and notes.
- **Settle Up**: Simplified debt settlement process.
- **Visual Analytics**: Interactive charts to visualize spending patterns.
- **Neo-brutalist UI**: A unique "Neo" design system with high contrast, bold borders, and a modern aesthetic.
- **Guest Mode**: Try the app without an account (local session).

## 🛠️ Tech Stack

- **Frontend**: [React 19](https://react.dev/), [Vite](https://vitejs.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Routing**: [React Router 7](https://reactrouter.com/)
- **Backend/Database**: [Supabase](https://supabase.com/) (Auth, PostgreSQL, Real-time)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Charts**: [Recharts](https://recharts.org/)
- **Styling**: Custom Neo-brutalist CSS

## 📋 Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- A [Supabase](https://supabase.com/) account and project

## ⚙️ Getting Started

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/squareone.git
   cd squareone
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment Setup**:
   Create a `.env.local` file in the root directory and add your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Open the app**:
   Navigate to `http://localhost:5173` in your browser.

## 📂 Project Structure

- `src/components/`: Reusable UI components and feature-specific blocks.
- `src/screens/`: Page-level components (Home, Friends, History, etc.).
- `src/context/`: Global state management (Auth and App data).
- `src/hooks/`: Custom React hooks for shared logic.
- `src/utils/`: Utility functions for calculations, formatting, and Supabase client.
- `src/types/`: TypeScript interfaces and type definitions.

## 📖 Documentation

For more detailed information, please refer to:
- [Architecture Overview](./docs/architecture.md)
- [Database Schema](./docs/database.md)
- [Contributing Guidelines](./CONTRIBUTING.md)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
