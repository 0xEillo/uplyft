### Updated Project Brief: GymFlow App

Thank you for the feedback! I've incorporated your preference for using the Vercel AI SDK (https://ai-sdk.dev/) for handling API calls to AI models. This SDK is an excellent fit as it provides a unified TypeScript API for integrating with providers like OpenAI, Anthropic, or Google Generative AI, making it straightforward to parse free-form workout notes into structured data (e.g., via `generateObject` with a schema for exercises, reps, weights). Since your app is built with React Native and Expo, we'll use the SDK primarily in the backend for AI processing, ensuring compatibility without issues. The frontend can handle simple API calls to the backend endpoint that leverages the SDK.

Below is the revised project brief with updates highlighted in the Technical Stack and AI Parsing sections.

## Project Overview

**Hook:** Strava for the gym – a seamless social fitness tracking app that turns gym workouts into effortless, shareable experiences.

**Project Name:** GymFlow  
**Platform:** Mobile app built with React Native and Expo for cross-platform compatibility (iOS and Android).  
**Development Stage:** Conceptual/Ideation.  
**Team/Owner:** [Your Name/Team]  
**Date:** October 02, 2025

GymFlow is a social fitness app designed to revolutionize gym workout tracking by eliminating the high-friction data entry common in existing apps. By leveraging AI for intelligent parsing of free-form notes, users can log workouts as naturally as jotting down thoughts on a notepad, while enjoying a beautiful, minimalist interface and a social feed inspired by Strava.

## Problem Statement

Traditional gym tracking apps require users to navigate complex interfaces, select exercises from dropdowns, input precise weights/reps/sets, and manually categorize data. This friction leads to inconsistent logging, user drop-off, and frustration. Users want to focus on their workouts, not data entry, but still desire organized insights, progress tracking, and social sharing. Existing solutions feel rigid and time-consuming, deterring casual and serious gym-goers alike from maintaining long-term habits.

## Solution

GymFlow prioritizes ultra-low friction through a simple, notepad-like input system powered by AI. Users write workouts in any format they prefer – e.g., "bench 3x10 225" or "Did squats today, felt great, 5 sets of 8 at 315lbs" – and the app's backend AI interprets the notes to extract and standardize details like exercises, weights, reps, sets, and notes. This data is stored in the database for analytics and progress tracking.

Once submitted, the workout generates a clean, standardized post on a social feed, allowing users to share achievements with friends, fostering motivation and community. The app's design emphasizes beauty and simplicity: clean lines, intuitive navigation, and a focus on core functionality without overwhelming features.

### Key Differentiators

- **Low-Friction Entry:** Free-form text input parsed by AI, reducing logging time to seconds.
- **Social Feed:** Like Strava, but for gym workouts – scroll through friends' posts for inspiration and accountability.
- **AI-Powered Backend:** Handles messy inputs intelligently, matching to exercises and metrics without user intervention.
- **Minimalist Design:** Beautiful UI/UX that feels like a premium notepad app, not a clunky tracker.

## Core Features

1. **Social Feed (Home Screen):**

   - Upon opening the app, users land on a scrollable feed displaying workouts from themselves and followed friends.
   - Posts appear in a standardized, clean format: e.g., exercise list with weights/reps, total volume, duration, and optional personal notes.
   - Interactive elements: Like, comment, or share posts for social engagement.

2. **Workout Logging:**

   - "+" button on the feed opens a simple notepad interface.
   - Users type free-form notes about their workout (e.g., exercises, sets, reps, weights, feelings).
   - No structured forms – complete flexibility in formatting.
   - Submit via "Post" button: AI processes the input in the backend, standardizes data, saves to database, and generates a feed post.

3. **AI Parsing and Data Management:**

   - Backend AI uses the Vercel AI SDK to call models (e.g., OpenAI's GPT series) via a unified API.
   - Key SDK functions: `generateObject` to parse notes into a structured schema (e.g., Zod-defined objects for exercises, metrics, and context).
   - Handles extraction like matching "bench" to "Bench Press," identifying reps/sets/weights, and flagging notes (e.g., "PR").
   - Fallback for edge cases: If parsing confidence is low, prompt user for quick confirmation in-app.
   - Data stored in a cloud database (e.g., Firebase or Supabase) for user profiles, history, and analytics.

4. **User Profiles and Social Features:**

   - Personal profile with workout history, progress graphs (e.g., strength gains over time).
   - Follow/friend system to build a community.
   - Privacy controls for sharing workouts publicly or privately.

5. **Additional Polish:**
   - Notifications for friends' posts or personal milestones.
   - Basic analytics: Weekly summaries, trends, and goal tracking.
   - Offline support for drafting notes, with sync on connectivity.

## Target Audience

- Gym enthusiasts aged 18-45 who value simplicity and social motivation.
- Casual users frustrated with apps like MyFitnessPal or Strong.
- Fitness communities seeking a Strava-like experience for weightlifting/cross-training.
- Tech-savvy individuals who appreciate AI-driven efficiency.

## Technical Stack

- **Frontend:** React Native with Expo for rapid development, easy deployment, and native performance.
- **Backend:** Node.js/Express or serverless (e.g., AWS Lambda or Vercel Functions) for API handling; integrate Vercel AI SDK for unified API calls to AI providers (e.g., OpenAI for parsing).
- **AI Integration:** Vercel AI SDK (@ai-sdk/core and provider-specific packages) to handle model calls, text generation, and structured output parsing in the backend.
- **Database:** Firebase Firestore or MongoDB for user data, workouts, and feeds.
- **Authentication:** Expo Auth or Firebase Auth for secure user accounts.
- **Deployment:** Expo EAS for builds; App Store/Google Play distribution.
- **Design Tools:** Figma for UI prototypes emphasizing minimalism (clean fonts, subtle animations, neutral color palette).

## Goals and Milestones

- **Short-Term:** MVP with core logging, AI parsing via Vercel AI SDK, and feed (1-3 months).
- **Long-Term:** Expand to challenges, leaderboards, and integrations (e.g., wearables).
- **Success Metrics:** User retention >70% after first week; 1,000+ downloads in first quarter; positive feedback on ease of use.

## Risks and Considerations

- AI Accuracy: Leverage Vercel AI SDK's structured output features for reliable parsing; include fallback options (e.g., manual edit if AI misinterprets).
- Privacy: Handle fitness data securely, complying with GDPR/Health data regs.
- Scalability: Design backend to handle growing user base and AI calls cost-effectively, using the SDK's efficient API abstraction.
- Compatibility: While the AI SDK is framework-agnostic, test backend integration thoroughly with React Native's API calls.

This update keeps the focus on low-friction AI while aligning with your chosen SDK. If you'd like code snippets for integration, a prototype plan, or further tweaks, let me know!
