# SiSy

SiSy is a routine management app inspired by the user-centric methodology of **"Getting Things Done"** and the behavioral psychology of **"Atomic Habits"**. It is designed to be a minimalist, always-available companion that helps you focus on the present while managing your daily routines and long-term habits.

## Features

- **Present Focus**: A minimalist "Now/Next" view that keeps you focused on the current task. Swipe right to complete, swipe left to reschedule.
- **Routine Management**: Define your ideal day with a Routine Template. Tasks are automatically generated daily.
- **AI Companion**: An integrated chat interface that is context-aware. Ask Sisy to refine your routine, update your profile, or just chat about your day.
- **"Me" Profile**: A flexible, key-value pair based profile that allows Sisy to learn about you and provide personalized suggestions.
- **Auto-Complete**: Mark routine items to auto-complete, keeping your focus on what requires effort.

## Technology Stack

### Frontend
- **Framework**: React Native (via **Expo**)
- **Navigation**: Expo Router
- **State/Storage**: AsyncStorage for local persistence (MVP)

### Backend
- **Framework**: Python (**FastAPI**)
- **AI Orchestration**: **LangChain**
- **LLM Provider**: MiniMax
- **Observability**: Opik

## Getting Started

### Prerequisites

- Node.js & npm (for Frontend)
- Python 3.10+ (for Backend)
- Expo Go app on your mobile device (for testing)

### Backend Setup

1.  Navigate to the `backend` directory:
    ```bash
    cd backend
    ```
2.  Create a virtual environment:
    ```bash
    python -m venv .venv
    source .venv/bin/activate  # On Windows: .venv\Scripts\activate
    ```
3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
4.  Set up environment variables:
    Create a `.env` file in `backend/` and add your keys:
    ```env
    MINIMAX_API_KEY=your_key_here
    OPIK_API_KEY=your_key_here
    ```
5.  Run the server:
    ```bash
    python main.py
    ```
    The server will start on `http://0.0.0.0:10001`.

### Frontend Setup

1.  Navigate to the `myroutine` directory:
    ```bash
    cd myroutine
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the Expo dev server:
    ```bash
    npm start
    ```
4.  Scan the QR code with your phone (using Expo Go) or press `i` to run in the iOS Simulator.

## Project Structure

- `backend/`: FastAPI server and AI agent logic.
- `myroutine/`: Expo React Native frontend application.
- `docs/`: Project documentation and design specs.
- `eval/`: Evaluation scripts and datasets for the AI agent.
