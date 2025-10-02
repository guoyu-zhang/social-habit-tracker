# Social Habit Tracker

A React Native app built with Expo & Supabase that helps users track habits with photo proof and share their progress in a social feed.

## Features

- 📱 **Habit**: Create, edit, and delete personal habits
- 📸 **Photo Proof**: Capture images when completing habits
- 🌐 **Social Feed**: See other users' habit completions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set up Supabase Project

Go to Supabase and create a new project, get API keys and set up .env

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### 3. Set up Database Schema

Run init_db.sql in Supabase SQL Editor.

### 5. Run the App

Start the development server

```bash

npx expo start

```
