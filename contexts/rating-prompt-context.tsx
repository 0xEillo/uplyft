import React, { createContext, useContext, useState } from 'react';
import {
  shouldShowRatingPrompt,
  savePromptWorkoutCount,
  requestReview,
} from '@/lib/rating';

interface RatingPromptContextType {
  isVisible: boolean;
  showPrompt: (workoutCount: number) => Promise<void>;
  hidePrompt: () => void;
  handleRate: () => Promise<void>;
  handleDismiss: (workoutCount: number) => Promise<void>;
}

const RatingPromptContext = createContext<RatingPromptContextType | undefined>(
  undefined
);

export function RatingPromptProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [currentWorkoutCount, setCurrentWorkoutCount] = useState(0);

  const showPrompt = async (workoutCount: number) => {
    // Check if we should show the prompt
    const shouldShow = await shouldShowRatingPrompt(workoutCount);

    if (shouldShow) {
      setCurrentWorkoutCount(workoutCount);
      setIsVisible(true);
      // Save that we showed the prompt at this workout count
      await savePromptWorkoutCount(workoutCount);
    }
  };

  const hidePrompt = () => {
    setIsVisible(false);
  };

  const handleRate = async () => {
    // Hide the prompt
    hidePrompt();

    // Small delay to let the modal animation complete
    setTimeout(async () => {
      // Request the native review
      await requestReview();
    }, 400);
  };

  const handleDismiss = async (workoutCount: number) => {
    // Just hide the prompt - we already saved the workout count
    // when we showed it, so it will re-appear after 10 more workouts
    hidePrompt();
  };

  return (
    <RatingPromptContext.Provider
      value={{
        isVisible,
        showPrompt,
        hidePrompt,
        handleRate,
        handleDismiss,
      }}
    >
      {children}
    </RatingPromptContext.Provider>
  );
}

export function useRatingPrompt() {
  const context = useContext(RatingPromptContext);
  if (context === undefined) {
    throw new Error('useRatingPrompt must be used within a RatingPromptProvider');
  }
  return context;
}
